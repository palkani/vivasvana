import type { PrismaClient } from '@vivasvana/db';
import { env } from '../config/env';
import {
  checkServiceability,
  createOrder,
  assignAwb,
  type ServiceabilityResponse,
} from '../integrations/shiprocket';
import type { NotificationService } from './notification.service';

/**
 * Shipping orchestration. Wraps the raw Shiprocket client with our
 * domain rules: pickup pincode lookup, courier auto-selection, idempotent
 * push, webhook ingestion, and status mapping.
 *
 * Design notes:
 *   - Every public method is safe to call repeatedly. pushOrder() short-
 *     circuits if shipmentId already exists; cancellation is idempotent
 *     at the Shiprocket layer.
 *   - Webhook handler updates Order.status AND fires SMS via
 *     NotificationService. The two side-effects are deliberately wrapped
 *     in independent try blocks so a notification failure can't roll
 *     back the status update.
 *   - Default package dimensions live here, not on Product, so the
 *     fallback rule is in one place. Each Product can override per-SKU
 *     once the catalog editor adds dimensions.
 */

// Catalog-wide defaults for products that haven't been measured yet.
// A 500g millet pouch fits comfortably in this envelope. Adjust per-SKU
// in the admin product editor once it's available.
const DEFAULT_PACKAGE = {
  lengthCm: 20,
  breadthCm: 15,
  heightCm: 10,
};

// Our pickup pincode for serviceability quotes when the operator hasn't
// configured the warehouse address yet. Real value comes from the
// Shiprocket dashboard (where it's tied to the SHIPROCKET_PICKUP_LOCATION
// name). We expose it here as an env-overridable default so the cart
// pincode check works in stub mode.
const PICKUP_PINCODE = process.env.SHIPROCKET_PICKUP_PINCODE ?? '600020';

export interface PincodeCheckResult {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  /** Best-case ETA in days. Null if no courier available. */
  etaDays: number | null;
  /** Lowest freight (₹) we'd be charged for delivering this order. */
  rate: number | null;
  /** Friendly message the storefront can render directly. */
  message: string;
}

export interface PushOrderResult {
  pushed: boolean;
  shiprocketOrderId?: string;
  shipmentId?: string;
  awbCode?: string;
  courierName?: string;
  /** Set when push was skipped because already pushed. */
  alreadyPushed?: boolean;
  /** Set on failure — message safe to surface in admin UI. */
  error?: string;
}

export class ShippingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationService,
  ) {}

  // ----- Public pincode check (PDP + cart) ---------------------------------

  async checkPincode(pincode: string, weightKg = 0.5): Promise<PincodeCheckResult> {
    const normalized = pincode.replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) {
      return {
        pincode,
        serviceable: false,
        codAvailable: false,
        etaDays: null,
        rate: null,
        message: 'Enter a valid 6-digit pincode.',
      };
    }
    let res: ServiceabilityResponse;
    try {
      res = await checkServiceability({
        pickupPincode: PICKUP_PINCODE,
        deliveryPincode: normalized,
        weightKg,
        cod: true,
      });
    } catch (err) {
      console.error('shiprocket serviceability failed', err);
      return {
        pincode: normalized,
        serviceable: false,
        codAvailable: false,
        etaDays: null,
        rate: null,
        message: "We're checking availability for this pincode — please try again in a moment.",
      };
    }
    if (!res.available || !res.cheapest) {
      return {
        pincode: normalized,
        serviceable: false,
        codAvailable: false,
        etaDays: null,
        rate: null,
        message: 'Sorry, we don’t deliver to this pincode yet. Email hello@vivasvana.com.',
      };
    }
    const eta = parseInt(res.cheapest.estimated_delivery_days, 10) || null;
    const codSuffix = res.cod_available ? ' · COD available' : '';
    return {
      pincode: normalized,
      serviceable: true,
      codAvailable: res.cod_available,
      etaDays: eta,
      rate: res.cheapest.freight_charge,
      message: eta
        ? `Delivers in ${eta}–5 working days${codSuffix}.`
        : `Delivery available${codSuffix}.`,
    };
  }

  // ----- Push order to Shiprocket ----------------------------------------

  /**
   * Idempotent: returns alreadyPushed:true if shipmentId already set.
   * Auto-selects the cheapest available courier from serviceability,
   * assigns AWB, and writes the result back to OrderShipping.
   *
   * Designed to be called fire-and-forget from the payment success path
   * — failures are caught, logged, and reflected in the response so an
   * admin retry endpoint can surface what went wrong.
   */
  async pushOrder(orderId: string): Promise<PushOrderResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shippingAddress: true },
    });
    if (!order) return { pushed: false, error: 'Order not found' };
    if (!order.shippingAddress) {
      return { pushed: false, error: 'Order has no shipping address' };
    }
    if (order.shippingAddress.shipmentId) {
      return {
        pushed: false,
        alreadyPushed: true,
        shiprocketOrderId: order.shippingAddress.shiprocketOrderId ?? undefined,
        shipmentId: order.shippingAddress.shipmentId,
        awbCode: order.shippingAddress.awbCode ?? undefined,
        courierName: order.shippingAddress.carrier ?? undefined,
      };
    }

    // Compute total weight from items + product weight (grams → kg). If
    // any item is missing a weight we fall back to 200g per unit — safer
    // to over-quote a few rupees than to under-quote and have the courier
    // refuse pickup at the door.
    const items = await this.prisma.product.findMany({
      where: { id: { in: order.items.map((i) => i.productId).filter(Boolean) as string[] } },
      select: { id: true, weight: true, title: true, sku: true, hsnCode: true },
    });
    const productById = new Map(items.map((p) => [p.id, p]));
    let weightG = 0;
    for (const item of order.items) {
      const product = item.productId ? productById.get(item.productId) : null;
      const perUnitG = product?.weight ? Number(product.weight) : 200;
      weightG += perUnitG * item.quantity;
    }
    const weightKg = Math.max(0.05, weightG / 1000); // 50g floor (Shiprocket min)

    // Split customer name to fit Shiprocket's first/last fields. An
    // empty name on the shipping record shouldn't happen in practice
    // (form validation requires it) but fall back to "Customer" so the
    // push doesn't blow up.
    const fullName = order.shippingAddress.name.trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? 'Customer';
    const lastName = nameParts.slice(1).join(' ');

    const paymentMethod = order.paymentMethod === 'COD' ? 'COD' : 'Prepaid';

    let created;
    try {
      created = await createOrder({
        orderNumber: order.orderNumber,
        orderDate: order.placedAt ?? new Date(0),
        pickupLocation: env.SHIPROCKET_PICKUP_LOCATION,
        billing: {
          firstName,
          lastName,
          addressLine: order.shippingAddress.addressLine,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pincode: order.shippingAddress.pincode,
          country: order.shippingAddress.country === 'IN' ? 'India' : order.shippingAddress.country,
          email: order.email,
          phone: order.shippingAddress.phone,
        },
        items: order.items.map((i) => ({
          name: i.title,
          sku: i.sku,
          units: i.quantity,
          sellingPrice: Number(i.price),
          hsn: i.productId ? productById.get(i.productId)?.hsnCode ?? undefined : undefined,
        })),
        paymentMethod,
        subTotal: Number(order.subtotal),
        package: {
          lengthCm: DEFAULT_PACKAGE.lengthCm,
          breadthCm: DEFAULT_PACKAGE.breadthCm,
          heightCm: DEFAULT_PACKAGE.heightCm,
          weightKg,
        },
      });
    } catch (err) {
      const msg = (err as Error).message;
      console.error('shiprocket create order failed', { orderId, msg });
      return { pushed: false, error: msg };
    }

    // Save the order/shipment IDs early so a failure during courier
    // assignment doesn't cause a duplicate push on retry.
    await this.prisma.orderShipping.update({
      where: { orderId },
      data: {
        shiprocketOrderId: created.shiprocketOrderId,
        shipmentId: created.shipmentId,
        carrier: created.courierName ?? null,
        awbCode: created.awbCode ?? null,
      },
    });

    // If Shiprocket already assigned a courier (some accounts auto-pick),
    // we're done — write what we know.
    if (created.awbCode) {
      return {
        pushed: true,
        shiprocketOrderId: created.shiprocketOrderId,
        shipmentId: created.shipmentId,
        awbCode: created.awbCode,
        courierName: created.courierName,
      };
    }

    // Otherwise look up serviceability + pick the cheapest courier.
    let assigned;
    try {
      const quote = await checkServiceability({
        pickupPincode: PICKUP_PINCODE,
        deliveryPincode: order.shippingAddress.pincode,
        weightKg,
        cod: paymentMethod === 'COD',
      });
      if (!quote.available || !quote.cheapest) {
        return {
          pushed: true,
          shiprocketOrderId: created.shiprocketOrderId,
          shipmentId: created.shipmentId,
          error: 'No courier available for this pincode',
        };
      }
      assigned = await assignAwb({
        shipmentId: created.shipmentId,
        courierId: quote.cheapest.courier_company_id,
      });
    } catch (err) {
      const msg = (err as Error).message;
      console.error('shiprocket assign AWB failed', { orderId, msg });
      return {
        pushed: true,
        shiprocketOrderId: created.shiprocketOrderId,
        shipmentId: created.shipmentId,
        error: msg,
      };
    }

    await this.prisma.orderShipping.update({
      where: { orderId },
      data: {
        awbCode: assigned.awbCode,
        carrier: assigned.courierName,
        trackingUrl: assigned.trackingUrl ?? null,
      },
    });

    return {
      pushed: true,
      shiprocketOrderId: created.shiprocketOrderId,
      shipmentId: created.shipmentId,
      awbCode: assigned.awbCode,
      courierName: assigned.courierName,
    };
  }

  // ----- Webhook ingestion -----------------------------------------------

  /**
   * Process a Shiprocket tracking webhook. Maps their status strings to
   * our OrderStatus enum and fires the existing SMS pipeline so the
   * shopper is notified the same way as a manual admin transition.
   *
   * Authentication: we expect Shiprocket to send the value of
   * SHIPROCKET_WEBHOOK_TOKEN as a `x-api-key` header (configured in
   * their dashboard). Caller is responsible for verifying that header
   * before invoking this method.
   */
  async handleWebhook(payload: {
    awb?: string;
    current_status?: string;
    shipment_status?: string;
    order_id?: string;
  }): Promise<{ matched: boolean; orderId?: string; status?: string }> {
    const status = mapStatus(payload.current_status, payload.shipment_status);
    if (!status) {
      console.warn('[shiprocket] webhook with unrecognized status', payload);
      return { matched: false };
    }

    // Look up the order by AWB or by our orderNumber. Shiprocket sends
    // both in the payload but field names vary — try both.
    const where = payload.awb
      ? { shippingAddress: { awbCode: payload.awb } }
      : payload.order_id
        ? { orderNumber: payload.order_id }
        : null;
    if (!where) return { matched: false };

    const order = await this.prisma.order.findFirst({ where });
    if (!order) {
      console.warn('[shiprocket] webhook for unknown order', payload);
      return { matched: false };
    }

    // Idempotency: don't bounce backwards through the state machine. If
    // the webhook arrives out of order (transit → delivered → transit
    // because of a retry on their side), keep the further-along state.
    if (statusRank(order.status) >= statusRank(status)) {
      return { matched: true, orderId: order.id, status: order.status };
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        ...(status === 'SHIPPED' ? { shippedAt: new Date() } : {}),
        ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });

    // Mirror to OrderShipping timestamps where Prisma's relation doesn't
    // share columns.
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      await this.prisma.orderShipping.update({
        where: { orderId: order.id },
        data:
          status === 'SHIPPED'
            ? { shippedAt: new Date() }
            : { deliveredAt: new Date() },
      });
    }

    // Fan out the SMS. The notifications service tolerates missing phone
    // / Twilio creds gracefully.
    if (status === 'SHIPPED' || status === 'DELIVERED' || status === 'CANCELLED') {
      void this.notifications.sendOrderStatusUpdate(order.id, status);
    }

    return { matched: true, orderId: order.id, status };
  }
}

// ----- Status mapping --------------------------------------------------

type AppStatus = 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

/**
 * Shiprocket uses ~30 distinct status strings. We collapse them into the
 * 5 our domain cares about. Anything we don't recognize gets logged and
 * we skip the update — better silent than to bounce an order to a wrong
 * state.
 */
function mapStatus(
  current?: string,
  shipment?: string,
): AppStatus | null {
  const raw = (current ?? shipment ?? '').toUpperCase();
  if (!raw) return null;
  if (raw.includes('DELIVERED')) return 'DELIVERED';
  if (raw.includes('RTO') || raw.includes('RETURN')) return 'RETURNED';
  if (raw.includes('CANCEL') || raw.includes('LOST')) return 'CANCELLED';
  if (
    raw.includes('IN TRANSIT') ||
    raw.includes('PICKED UP') ||
    raw.includes('OUT FOR DELIVERY') ||
    raw.includes('SHIPPED')
  ) {
    return 'SHIPPED';
  }
  if (raw.includes('CONFIRMED') || raw.includes('PICKUP SCHEDULED')) return 'CONFIRMED';
  return null;
}

/**
 * Linear rank for the state machine. Webhook updates can arrive out of
 * order; we use this to refuse "backward" transitions silently.
 */
function statusRank(s: string): number {
  switch (s) {
    case 'PENDING':
      return 0;
    case 'CONFIRMED':
      return 1;
    case 'PACKED':
      return 2;
    case 'SHIPPED':
      return 3;
    case 'DELIVERED':
      return 4;
    case 'RETURNED':
      return 5;
    case 'CANCELLED':
      return 6;
    case 'REFUNDED':
      return 7;
    default:
      return -1;
  }
}

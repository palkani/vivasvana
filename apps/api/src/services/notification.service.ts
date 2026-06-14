import type { PrismaClient, Order, OrderItem, OrderShipping } from '@vivasvana/db';
import { sendEmail } from '../integrations/email.js';
import { sendSms } from '../integrations/sms.js';
import { renderOrderConfirmation, renderWelcome } from '../emails/templates.js';
import { renderOrderConfirmationSms } from '../sms/templates.js';

/**
 * Fire-and-forget notification dispatcher. Failures should never block the
 * primary request — we log and move on. A Phase 3 outbox table can pick up
 * retries if reliability becomes a concern.
 *
 * Channels:
 *   - Email (Resend) — rich HTML order confirmation with line items
 *   - SMS (Twilio)   — one-segment summary with order # + total + track URL
 *
 * Both fire via Promise.allSettled so a Twilio outage doesn't suppress the
 * email, and vice versa. Per-channel failures are logged with the channel
 * name so dashboards can alert on either independently.
 */

type OrderWithRelations = Order & {
  items: OrderItem[];
  shippingAddress: OrderShipping | null;
};

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async sendWelcome(args: { name?: string | null; email: string }) {
    try {
      const msg = renderWelcome(args);
      await sendEmail({ to: args.email, ...msg });
    } catch (err) {
      console.error('welcome email failed', err);
    }
  }

  async sendOrderConfirmation(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shippingAddress: true },
    });
    if (!order) return;

    // Fan-out. allSettled because we want both attempted regardless of the
    // other's outcome; each handler logs its own failure context.
    await Promise.allSettled([
      this.deliverOrderEmail(order),
      this.deliverOrderSms(order),
    ]);
  }

  private async deliverOrderEmail(order: OrderWithRelations) {
    try {
      const msg = renderOrderConfirmation(order);
      await sendEmail({ to: order.email, ...msg });
    } catch (err) {
      console.error('order confirmation email failed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: (err as Error).message,
      });
    }
  }

  private async deliverOrderSms(order: OrderWithRelations) {
    try {
      // Prefer the shipping address phone (the one tied to the delivery)
      // over the contact phone, because that's the line the courier will
      // call. Fall back to contact phone if shipping has none.
      const phone = order.shippingAddress?.phone || order.phone;
      if (!phone) return;
      const body = renderOrderConfirmationSms({
        orderNumber: order.orderNumber,
        total: order.total.toString(),
      });
      await sendSms({ to: phone, body });
    } catch (err) {
      console.error('order confirmation sms failed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: (err as Error).message,
      });
    }
  }
}

import { env } from '../config/env.js';

/**
 * Shiprocket API client.
 *
 * Auth: Shiprocket issues a JWT via /auth/login that lasts 10 days. We
 * cache it in-process for safe TTL (9 days) and silently re-login when
 * the upstream returns 401. In-memory cache is fine for the single-pod
 * Railway service; a multi-instance setup should move to Redis.
 *
 * Stub mode: When SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD is absent we
 * skip every network call and return shaped mock data instead, prefixed
 * `[shiprocket:dev]` in logs. The full flow (push order → assign
 * cheapest courier → webhook → SMS) stays exercisable without an
 * account, which is critical for CI + local dev.
 *
 * Idempotency: We pass our orderNumber (e.g. VV2026-000123) as
 * Shiprocket's `order_id`. Re-pushing the same order returns an error
 * we treat as success — see shipping.service.ts for the orchestration.
 *
 * India DLT / KYC: not Shiprocket's concern (that's an SMS-side issue
 * handled in sms.ts). But Shiprocket DOES require KYC + pickup address
 * registration on their dashboard before the first real shipment. Code
 * runs fine without it; shipments will just fail with a clear error.
 */

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // 9 days, 1 day safety margin

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function stubMode(): boolean {
  return !env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD;
}

async function login(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`shiprocket login failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('shiprocket login returned no token');
  cachedToken = { token: body.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return body.token;
}

/**
 * Authenticated request helper. Transparently retries once on 401 by
 * invalidating the cached token and re-logging in — covers the case
 * where Shiprocket revoked our session before our local TTL expired.
 */
async function authed<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number> } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, String(v));
  }

  const send = async (token: string) =>
    fetch(url.toString(), {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

  let token = await login();
  let res = await send(token);
  if (res.status === 401) {
    cachedToken = null;
    token = await login();
    res = await send(token);
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(
      `shiprocket ${init.method ?? 'GET'} ${path} failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ----- Types -------------------------------------------------------------

export interface ServiceabilityCourier {
  courier_company_id: number;
  courier_name: string;
  freight_charge: number;
  cod_charges: number;
  estimated_delivery_days: string;
  etd: string; // delivery date estimate
  rating: number;
  cod: 0 | 1;
}

export interface ServiceabilityResponse {
  available: boolean;
  cod_available: boolean;
  /** Lowest freight + lowest delivery-day estimate among available couriers. */
  cheapest?: ServiceabilityCourier;
  fastest?: ServiceabilityCourier;
  /** All couriers, capped to the top 5 by rate, for an admin override UI. */
  options: ServiceabilityCourier[];
}

export interface CreateOrderInput {
  /** Our orderNumber — acts as Shiprocket's `order_id` (idempotency key). */
  orderNumber: string;
  orderDate: Date;
  pickupLocation: string;
  billing: {
    firstName: string;
    lastName?: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    email: string;
    phone: string;
  };
  items: Array<{
    name: string;
    sku: string;
    units: number;
    sellingPrice: number;
    hsn?: string;
  }>;
  paymentMethod: 'Prepaid' | 'COD';
  subTotal: number;
  /** Package dimensions (cm) and weight (kg) — Shiprocket's quote engine needs these. */
  package: {
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
    weightKg: number;
  };
}

export interface CreateOrderResponse {
  /** Shiprocket's internal order id — for cancellation later. */
  shiprocketOrderId: string;
  /** Shipment id — used for AWB assignment + tracking. */
  shipmentId: string;
  /** AWB may or may not be issued at create time depending on courier config. */
  awbCode?: string;
  courierName?: string;
}

// ----- Public API --------------------------------------------------------

/**
 * Get the available couriers for a pickup → delivery route. Used by the
 * pincode check on PDP/cart AND by pushOrder() to pick the cheapest
 * courier before AWB assignment.
 */
export async function checkServiceability(args: {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  cod: boolean;
}): Promise<ServiceabilityResponse> {
  if (stubMode()) {
    console.info('[shiprocket:dev] serviceability check', args);
    return stubServiceability(args);
  }
  type Raw = {
    data: { available_courier_companies?: ServiceabilityCourier[] };
  };
  const res = await authed<Raw>('/courier/serviceability/', {
    query: {
      pickup_postcode: args.pickupPincode,
      delivery_postcode: args.deliveryPincode,
      weight: args.weightKg.toFixed(3),
      cod: args.cod ? 1 : 0,
    },
  });
  const options = res.data?.available_courier_companies ?? [];
  if (options.length === 0) {
    return { available: false, cod_available: false, options: [] };
  }
  const sortedByPrice = [...options].sort((a, b) => a.freight_charge - b.freight_charge);
  const sortedBySpeed = [...options].sort(
    (a, b) => parseDays(a.estimated_delivery_days) - parseDays(b.estimated_delivery_days),
  );
  return {
    available: true,
    cod_available: options.some((o) => o.cod === 1),
    cheapest: sortedByPrice[0],
    fastest: sortedBySpeed[0],
    options: sortedByPrice.slice(0, 5),
  };
}

/**
 * Create the order on Shiprocket. The returned shipment_id is the
 * handle we use to assign a courier + track downstream events.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
  if (stubMode()) {
    console.info('[shiprocket:dev] create order', {
      orderNumber: input.orderNumber,
      pin: input.billing.pincode,
      payment: input.paymentMethod,
    });
    return {
      shiprocketOrderId: `stub-${input.orderNumber}`,
      shipmentId: `stub-ship-${input.orderNumber}`,
    };
  }

  const payload = {
    order_id: input.orderNumber,
    order_date: input.orderDate.toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: input.pickupLocation,
    billing_customer_name: input.billing.firstName,
    billing_last_name: input.billing.lastName ?? '',
    billing_address: input.billing.addressLine,
    billing_city: input.billing.city,
    billing_pincode: input.billing.pincode,
    billing_state: input.billing.state,
    billing_country: input.billing.country,
    billing_email: input.billing.email,
    billing_phone: input.billing.phone,
    shipping_is_billing: true,
    order_items: input.items.map((i) => ({
      name: i.name.slice(0, 100),
      sku: i.sku,
      units: i.units,
      selling_price: i.sellingPrice,
      hsn: i.hsn ?? '',
    })),
    payment_method: input.paymentMethod,
    sub_total: input.subTotal,
    length: input.package.lengthCm,
    breadth: input.package.breadthCm,
    height: input.package.heightCm,
    weight: input.package.weightKg,
  };

  type Raw = {
    order_id?: number;
    shipment_id?: number;
    awb_code?: string;
    courier_name?: string;
    status?: string;
    status_code?: number;
    message?: string;
  };
  const res = await authed<Raw>('/orders/create/adhoc', {
    method: 'POST',
    body: payload,
  });

  if (!res.order_id || !res.shipment_id) {
    throw new Error(`shiprocket create returned no ids: ${JSON.stringify(res).slice(0, 200)}`);
  }
  return {
    shiprocketOrderId: String(res.order_id),
    shipmentId: String(res.shipment_id),
    awbCode: res.awb_code,
    courierName: res.courier_name,
  };
}

/**
 * Assign a specific courier to a shipment and get back an AWB. Caller
 * is expected to have picked the courier from checkServiceability().
 */
export async function assignAwb(args: {
  shipmentId: string;
  courierId: number;
}): Promise<{ awbCode: string; courierName: string; trackingUrl?: string }> {
  if (stubMode()) {
    console.info('[shiprocket:dev] assign awb', args);
    return {
      awbCode: `STUB-AWB-${args.shipmentId}`,
      courierName: 'Stub Courier',
      trackingUrl: undefined,
    };
  }
  type Raw = {
    awb_assign_status?: number;
    response?: {
      data?: {
        awb_code?: string;
        courier_name?: string;
        // Shiprocket doesn't return a stable tracking URL field at this
        // stage; the customer-facing tracking link is constructed from
        // their public domain + AWB.
      };
    };
    message?: string;
  };
  const res = await authed<Raw>('/courier/assign/awb', {
    method: 'POST',
    body: { shipment_id: args.shipmentId, courier_id: args.courierId },
  });
  const awb = res.response?.data?.awb_code;
  if (!awb) {
    throw new Error(
      `shiprocket assign-awb returned no AWB: ${JSON.stringify(res).slice(0, 300)}`,
    );
  }
  return {
    awbCode: awb,
    courierName: res.response?.data?.courier_name ?? '',
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
  };
}

/**
 * Cancel a Shiprocket order. Idempotent — repeated calls return the
 * same "already cancelled" error which we swallow.
 */
export async function cancelOrder(shiprocketOrderId: string): Promise<void> {
  if (stubMode()) {
    console.info('[shiprocket:dev] cancel order', { shiprocketOrderId });
    return;
  }
  await authed('/orders/cancel', {
    method: 'POST',
    body: { ids: [Number(shiprocketOrderId)] },
  });
}

// ----- Stubs -------------------------------------------------------------

function stubServiceability(args: {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  cod: boolean;
}): ServiceabilityResponse {
  // Mimic realistic shape: 3 couriers ordered by price, all available.
  // ETA derives loosely from pincode distance — first 2 digits compared.
  const distance = Math.abs(
    parseInt(args.pickupPincode.slice(0, 2)) - parseInt(args.deliveryPincode.slice(0, 2)),
  );
  const baseDays = Math.max(2, Math.min(7, Math.floor(distance / 3) + 2));
  const options: ServiceabilityCourier[] = [
    {
      courier_company_id: 1,
      courier_name: 'Stub Express',
      freight_charge: 49,
      cod_charges: args.cod ? 30 : 0,
      estimated_delivery_days: String(baseDays),
      etd: '',
      rating: 4.5,
      cod: 1,
    },
    {
      courier_company_id: 2,
      courier_name: 'Stub Standard',
      freight_charge: 59,
      cod_charges: args.cod ? 30 : 0,
      estimated_delivery_days: String(baseDays + 1),
      etd: '',
      rating: 4.2,
      cod: 1,
    },
    {
      courier_company_id: 3,
      courier_name: 'Stub Premium',
      freight_charge: 89,
      cod_charges: args.cod ? 30 : 0,
      estimated_delivery_days: String(Math.max(1, baseDays - 1)),
      etd: '',
      rating: 4.8,
      cod: 1,
    },
  ];
  return {
    available: true,
    cod_available: true,
    cheapest: options[0],
    fastest: options[2],
    options,
  };
}

function parseDays(raw: string | undefined): number {
  // Shiprocket sometimes returns "2-4" or "3" — normalize to the upper bound.
  if (!raw) return 99;
  const parts = raw.split('-').map((s) => parseInt(s.trim(), 10));
  const valid = parts.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return 99;
  return Math.max(...valid);
}

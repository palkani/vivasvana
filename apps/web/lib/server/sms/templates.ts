/**
 * SMS templates. Designed to fit one **GSM-7 segment** (160 chars max) so
 * we never pay for a multi-segment send. If a future template uses non-GSM
 * characters (₹, em-dash, smart quotes) Twilio switches to UCS-2 and the
 * limit drops to 70 chars per segment — keep templates ASCII-friendly.
 *
 * The rupee symbol ₹ IS in GSM-7 extended (single-shift), which counts as
 * 2 chars. We use "Rs." instead so the count stays predictable.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'vivasvana.com').replace(/^https?:\/\//, '');

export function renderOrderConfirmationSms(order: {
  orderNumber: string;
  total: string | number;
}): string {
  const total = typeof order.total === 'number' ? order.total.toFixed(0) : order.total;
  // Example: "Vivasvana: Order VV2026-000123 confirmed. Total Rs. 648.
  //  Delivery 3-5 days. Track: vivasvana.com/orders. Thanks!" (147 chars)
  return (
    `Vivasvana: Order ${order.orderNumber} confirmed. ` +
    `Total Rs. ${total}. Delivery 3-5 days. ` +
    `Track: ${SITE}/orders. Thanks!`
  );
}

/**
 * One template for both signup and order-time OTPs. Wording stays uniform
 * on purpose — shoppers who see "verification code" twice in a session
 * (account + checkout) shouldn't be confused by differently-worded SMS.
 * The "account" vs "order" tag gives just enough context to disambiguate.
 */
export function renderOtpSms(args: {
  code: string;
  kind: 'signup' | 'order' | 'login';
  expiresInMinutes: number;
}): string {
  // `tag` is the {#var#} slot in the DLT-registered OTP template, so adding a
  // new kind ('login') needs no new template — it's just another value.
  const tag = args.kind === 'signup' ? 'account' : args.kind;
  // Example: "Vivasvana: 123456 is your account verification code.
  //  Valid 10 min. Do not share." (~85 chars)
  return (
    `Vivasvana: ${args.code} is your ${tag} verification code. ` +
    `Valid ${args.expiresInMinutes} min. Do not share.`
  );
}

export function renderOrderShippedSms(args: {
  orderNumber: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}): string {
  // FIXED shape for DLT strict template matching: carrier and AWB are always
  // present as {#var#} slots — we substitute neutral defaults rather than
  // dropping the segments (variable-shape bodies get rejected by the DLT
  // template matcher, failing the send).
  const carrier = args.carrier?.trim() || 'courier';
  const awb = args.trackingNumber?.trim() || 'NA';
  return (
    `Vivasvana: Order ${args.orderNumber} shipped via ${carrier} (AWB ${awb}). ` +
    `Track: ${SITE}/orders`
  );
}

export function renderOrderDeliveredSms(args: { orderNumber: string }): string {
  return (
    `Vivasvana: Order ${args.orderNumber} delivered. ` +
    `Loved it? Reorder at ${SITE}. Thanks!`
  );
}

export function renderOrderCancelledSms(args: { orderNumber: string }): string {
  return (
    `Vivasvana: Order ${args.orderNumber} cancelled. ` +
    `Refund processed if paid. Help: hello@vivasvana.com`
  );
}

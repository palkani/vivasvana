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

import type { Order, OrderItem, OrderShipping } from '@vivasvana/db';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vivasvana.com';
const BRAND = '#bf8b3a';

function layout(opts: { title: string; preheader?: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(opts.title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fbf7ee; margin: 0; padding: 24px; color: #341e10; }
      .wrap { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      a.btn { display: inline-block; background: ${BRAND}; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      td, th { padding: 8px 0; text-align: left; vertical-align: top; font-size: 14px; }
      .right { text-align: right; }
      .muted { color: #6b6b6b; font-size: 12px; }
      .footer { text-align: center; color: #6b6b6b; font-size: 12px; padding: 16px 0; }
      .total { font-weight: 700; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
  </head>
  <body>
    ${opts.preheader ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escape(opts.preheader)}</div>` : ''}
    <div class="wrap">
      <p style="margin: 0 0 12px;"><strong style="font-family: Georgia, serif; font-size: 20px; color: ${BRAND};">Vivasvana</strong></p>
      ${opts.body}
    </div>
    <p class="footer">Vivasvana · FSSAI Certified<br>© ${new Date().getFullYear()} Vivasvana. Made in India.</p>
  </body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inr(s: string | number | { toString(): string }): string {
  const n = typeof s === 'number' ? s : parseFloat(s.toString());
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ---------- Welcome ---------------------------------------------------------

export function renderWelcome(data: { name?: string | null; email: string }) {
  const greeting = data.name ? `Hi ${escape(data.name.split(' ')[0] ?? '')},` : 'Hi there,';
  const subject = 'Welcome to Vivasvana 🌾';
  const body = `
    <h1>${greeting}</h1>
    <p>Thank you for joining the Vivasvana family. We make plant-based millet superfoods that bring ancient grains into modern Indian kitchens.</p>
    <p>Use code <strong>WELCOME10</strong> for 10% off your first order, up to ₹100.</p>
    <p style="margin: 24px 0;"><a class="btn" href="${SITE}/products">Shop now →</a></p>
    <p class="muted">If you didn't create this account, you can ignore this email.</p>
  `;
  return {
    subject,
    html: layout({ title: subject, preheader: 'Welcome — here is 10% off your first order.', body }),
    text: `Welcome to Vivasvana. Use code WELCOME10 for 10% off your first order. Shop: ${SITE}/products`,
  };
}

// ---------- One-time codes -------------------------------------------------

export type OtpKind = 'signup' | 'order';

/**
 * One-time passcode email. The 6-digit code is rendered in a giant
 * tracking-wide span so the shopper can read it from a notification
 * preview without opening the mail client.
 */
export function renderOtp(data: {
  code: string;
  kind: OtpKind;
  expiresInMinutes: number;
}) {
  const isSignup = data.kind === 'signup';
  const subject = isSignup
    ? `${data.code} is your Vivasvana sign-up code`
    : `${data.code} is your Vivasvana order confirmation code`;
  const heading = isSignup ? 'Verify your email' : 'Confirm your order';
  const intro = isSignup
    ? 'Enter this 6-digit code on the sign-up page to finish creating your account.'
    : 'Enter this 6-digit code on the checkout page to confirm and place your order.';
  const body = `
    <h1>${heading}</h1>
    <p style="margin: 4px 0 24px;">${intro}</p>
    <div style="text-align:center;background:#fbf7ee;border:1px solid #ead8a8;border-radius:12px;padding:24px;margin: 0 0 20px;">
      <div style="font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #82532a;">
        ${escape(data.code)}
      </div>
      <p class="muted" style="margin:12px 0 0;">Expires in ${data.expiresInMinutes} minutes</p>
    </div>
    <p class="muted">If you didn&rsquo;t request this code, ignore this email — your account is safe.</p>
  `;
  return {
    subject,
    html: layout({ title: subject, preheader: `Your code: ${data.code}`, body }),
    text: `${heading}\n\nYour code is: ${data.code}\nExpires in ${data.expiresInMinutes} minutes.\n\nIf you didn’t request this, ignore this email.`,
  };
}

// ---------- Order confirmation ---------------------------------------------

type OrderWithRelations = Order & {
  items: OrderItem[];
  shippingAddress: OrderShipping | null;
};

export function renderOrderConfirmation(order: OrderWithRelations) {
  const subject = `Order confirmed · ${order.orderNumber}`;
  const rows = order.items
    .map(
      (it) => `
        <tr>
          <td>${escape(it.title)}<br><span class="muted">× ${it.quantity}</span></td>
          <td class="right">${inr(it.total)}</td>
        </tr>`,
    )
    .join('');

  const addr = order.shippingAddress;
  const addressBlock = addr
    ? `
        <p style="margin: 0">
          <strong>${escape(addr.name)}</strong><br>
          ${escape(addr.addressLine)}${addr.landmark ? `, ${escape(addr.landmark)}` : ''}<br>
          ${escape(addr.city)}, ${escape(addr.state)} — ${escape(addr.pincode)}<br>
          ${escape(addr.phone)}
        </p>`
    : '';

  const body = `
    <h1>Thank you for your order!</h1>
    <p>We've received <strong style="font-family: ui-monospace, monospace;">${escape(order.orderNumber)}</strong>${
      order.paymentMethod === 'COD'
        ? ' — you can pay by cash on delivery.'
        : ' — your payment is confirmed.'
    }</p>
    <h2>What you ordered</h2>
    <table>
      ${rows}
    </table>
    <table style="margin-top:12px;">
      <tr><td>Subtotal</td><td class="right">${inr(order.subtotal)}</td></tr>
      ${parseFloat(order.discount.toString()) > 0 ? `<tr><td>Discount${order.discountCode ? ` (${escape(order.discountCode)})` : ''}</td><td class="right">−${inr(order.discount)}</td></tr>` : ''}
      <tr><td>Shipping</td><td class="right">${inr(order.shipping)}</td></tr>
      ${parseFloat(order.codFee.toString()) > 0 ? `<tr><td>COD fee</td><td class="right">${inr(order.codFee)}</td></tr>` : ''}
      <tr class="total"><td>Total</td><td class="right">${inr(order.total)}</td></tr>
    </table>
    ${addressBlock ? `<h2>Shipping to</h2>${addressBlock}` : ''}
    <p style="margin-top: 24px;">
      <a class="btn" href="${SITE}/account/orders">Track your order →</a>
    </p>
    <p class="muted">Questions? Reply to this email or message us on WhatsApp.</p>
  `;

  const text = `
Order ${order.orderNumber} confirmed.
Total: ${inr(order.total)}
${order.items.map((it) => `${it.title} × ${it.quantity} — ${inr(it.total)}`).join('\n')}
Track at ${SITE}/account/orders
`.trim();

  return {
    subject,
    html: layout({ title: subject, preheader: `Order ${order.orderNumber} — ${inr(order.total)}`, body }),
    text,
  };
}

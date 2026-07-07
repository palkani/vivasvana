# Phase 2 — Commerce Core

Goal of Phase 2: a customer can browse, add to cart, sign up, save an address, apply a discount, place an order, complete payment (mock), and view their order history. **Real Razorpay is deferred** — a `/pay/[orderId]` mock page stands in until Phase 3.

## What's in this phase

| Area | Done |
|---|---|
| Address book API + UI with PIN→city/state auto-fill | ✓ |
| Discount validation (percentage, fixed, free-shipping) | ✓ |
| Order service: cart→order in one transaction, totals, stock decrement, audit log | ✓ |
| Order routes: create, my orders, get one, cancel, public lookup | ✓ |
| Mock PaymentService with COD + simulated online flow | ✓ |
| Single-page checkout (contact, shipping, payment) | ✓ |
| Mock payment page `/pay/[orderId]` with success/failure buttons | ✓ |
| Order confirmation page `/orders/confirmed` | ✓ |
| Customer account: orders list, order detail, addresses | ✓ |
| Customer signup/signin with cart-merge-on-login | ✓ |
| Transactional emails (welcome, order confirmation) via Resend with dev fallback | ✓ |
| Lazy mirror-user upsert (no more manual UUID dance) | ✓ |
| Integration tests for orders + payments + lookup + discount apply | ✓ |

## Not in Phase 2 (deferred)

- **Real Razorpay SDK** — `/pay/[orderId]` is a mock for now (Phase 3)
- Shipping rate calculation via Shiprocket (Phase 3)
- Shiprocket label generation + tracking URLs (Phase 3)
- COD OTP verification (Phase 3 with MSG91)
- Stock reservation TTL — provisional decrement at order create is fine because we have no real money on the table yet (Phase 3)
- Admin order management UI (Phase 3)
- GST-compliant invoice PDF generation (Phase 4)
- Refunds (Phase 3)
- Abandoned-cart recovery emails (Phase 4)

## New API endpoints (Phase 2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/pincode/:pin` | — | India Post lookup, Redis-cached 30 days |
| GET/POST/PUT/DELETE | `/api/addresses` | required | Address book |
| POST | `/api/discount/validate` | optional | Returns `{ valid, reason?, discount? }` |
| POST | `/api/orders` | optional | Create order from cart |
| GET | `/api/orders/lookup?orderNumber=&email=` | — | Guest confirmation page lookup |
| GET | `/api/orders/by-id/:id` | — | Capability link (used by /pay) |
| GET | `/api/orders` | required | My orders |
| GET | `/api/orders/:id` | required | My order detail |
| POST | `/api/orders/:id/cancel` | required | Cancel pending order |
| POST | `/api/payments/intents` | — | Create mock payment intent |
| POST | `/api/payments/mock-confirm/:orderId` | — | Mock success/failure |
| POST | `/api/payments/cod-confirm/:orderId` | — | Confirm COD order |

## End-to-end smoke test

1. Open `/products` → PDP → **Add to cart**.
2. Open `/cart` → optionally apply `WELCOME10` → click **Checkout**.
3. On `/checkout`:
   - Sign in is optional. As a guest, fill contact + shipping (PIN auto-fills city/state).
   - Pick **Cash on delivery** to see the COD path: order is confirmed instantly.
   - Pick **Pay online** for the mock payment path: you land on `/pay/[orderId]`.
4. On `/pay/[orderId]` click **Simulate success** → you land on `/orders/confirmed`.
5. Sign up at `/account/login` → guest cart is merged + welcome email logs to console (or sends via Resend if `RESEND_API_KEY` is set).
6. `/account/orders` shows the order with a 4-step status tracker.

## Mock vs real payments — the swap path

Phase 3 will:
1. Add `apps/api/src/integrations/razorpay.ts` (HMAC-verified order create + webhook).
2. Add `RAZORPAY_WEBHOOK_SECRET` to env.
3. Replace `MockPaymentPanel` in `apps/web/app/pay/[orderId]/` with a `<RazorpayCheckout>` component that opens the Razorpay modal.
4. Replace `/api/payments/mock-confirm/:orderId` POST handler with a Razorpay webhook handler that verifies the HMAC signature, marks the payment PAID, and triggers the same NotificationService call.

The order/payment/notification surface stays identical, so customer-facing UI doesn't change.

## Carried into Phase 3

- Admin order management (filter by status, generate Shiprocket label, mark shipped, refund)
- Inventory adjustments in admin (currently you can only adjust via DB)
- Real shipping rates from Shiprocket (now a flat `₹50 over ₹400 free`)
- Abandoned-cart emails — schema already supports the query via `carts.updatedAt` index
- Reviews submission flow (data model is there, just no UI yet)

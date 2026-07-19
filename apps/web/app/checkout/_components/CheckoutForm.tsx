'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SmartPincodeInput } from '@/components/storefront/SmartPincodeInput';
import { SmartCityInput } from '@/components/storefront/SmartCityInput';
import { INDIA_STATES, stateName } from '@/lib/india-states';
import { formatINR } from '@/lib/utils';
import { api } from '@/lib/api';
import { useCartStore, cartSubtotal } from '@/lib/cart-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Cart, Address, Order, PaymentMethod } from '@/lib/types';
import type { DiscountInfo } from '@/lib/discount';

interface Props {
  initialCart: Cart;
  savedAddresses: Address[];
  userEmail: string | null;
}

const FREE_SHIPPING_THRESHOLD = 400;
const BASE_SHIPPING = 50;
const COD_FEE = 50;
const DISCOUNT_STORAGE_KEY = 'vv_discount';

interface ShippingForm {
  name: string;
  phone: string;
  addressLine: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_SHIPPING: ShippingForm = {
  name: '',
  phone: '',
  addressLine: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
};

export function CheckoutForm({ initialCart, savedAddresses, userEmail }: Props) {
  const router = useRouter();
  const [contactEmail, setContactEmail] = useState(userEmail ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [useSavedId, setUseSavedId] = useState<string>(
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? '',
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('RAZORPAY');
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // "Place order" opens a review modal; confirming it creates the order and
  // routes to payment. No OTP — order-time OTP is friction that hurts
  // conversion, and identity is already established at login / at payment.
  const [reviewOpen, setReviewOpen] = useState(false);

  // PIN → city/state auto-fill is wired directly inside <SmartPincodeInput>
  // via onResolved. We keep one bit of state to know if the shopper has
  // manually typed a city, so we don't clobber their input on PIN re-resolve.
  const [cityManuallyEdited, setCityManuallyEdited] = useState(false);

  function applyPinResolution(r: { city: string; stateCode: string }) {
    setShipping((prev) => ({
      ...prev,
      // Don't clobber a city the shopper deliberately typed (e.g. a colony
      // name not in the post-office record). State is always trustworthy
      // from PIN so we overwrite that unconditionally.
      city: cityManuallyEdited && prev.city.trim() ? prev.city : r.city,
      state: r.stateCode,
    }));
  }

  // restore discount applied on /cart
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (raw) setDiscount(JSON.parse(raw) as DiscountInfo);
    } catch {
      // ignore
    }
  }, []);

  // pre-fill shipping form from saved selection
  useEffect(() => {
    if (!useSavedId) return;
    const a = savedAddresses.find((x) => x.id === useSavedId);
    if (!a) return;
    setShipping({
      name: a.name,
      phone: a.phone,
      addressLine: a.addressLine,
      landmark: a.landmark ?? '',
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    });
    setContactPhone((p) => p || a.phone);
    // Saved addresses already have a deliberate city — treat it as manual
    // so a future PIN re-resolve doesn't silently replace it.
    setCityManuallyEdited(true);
  }, [useSavedId, savedAddresses]);


  const items = initialCart.items;
  const subtotal = cartSubtotal(initialCart);
  const discountAmount = discount ? Math.min(parseFloat(discount.appliedAmount), subtotal) : 0;
  const baseShipping =
    subtotal - discountAmount >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : BASE_SHIPPING;
  const shippingCost = discount?.freeShipping ? 0 : baseShipping;
  const codFee = paymentMethod === 'COD' ? COD_FEE : 0;
  const total = Math.max(0, subtotal - discountAmount + shippingCost + codFee);

  function setShip<K extends keyof ShippingForm>(key: K, value: ShippingForm[K]) {
    setShipping((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * "Place order" — the form's native `required` validation runs first (so we
   * only get here with a filled shipping form), then we open the review modal.
   */
  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contactEmail.trim()) {
      setError('Please enter your email so we can send the order confirmation.');
      return;
    }
    setReviewOpen(true);
  }

  /**
   * Confirm & place from the review modal — creates the order, clears the
   * cart, and routes to payment (or straight to the confirmation page for COD).
   */
  function placeOrder() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        const order = await api.post<Order>(
          '/api/orders',
          {
            email: contactEmail,
            phone: contactPhone || shipping.phone,
            paymentMethod,
            shipping: {
              name: shipping.name,
              phone: shipping.phone,
              addressLine: shipping.addressLine,
              landmark: shipping.landmark || undefined,
              city: shipping.city,
              state: shipping.state,
              pincode: shipping.pincode,
              country: 'IN',
            },
            discountCode: discount?.code,
          },
          { accessToken },
        );

        useCartStore.setState({ cart: { ...initialCart, items: [] } });
        try {
          localStorage.removeItem(DISCOUNT_STORAGE_KEY);
        } catch {
          // ignore
        }

        if (order.paymentMethod === 'COD') {
          await api.post(`/api/payments/cod-confirm/${order.id}`);
          router.push(
            `/orders/confirmed?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`,
          );
          return;
        }

        router.push(`/pay/${order.id}`);
      } catch (e) {
        setReviewOpen(false);
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not place order');
      }
    });
  }

  return (
    <form
      onSubmit={handleReview}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 space-y-6">
        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Email *</span>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Mobile *</span>
              <Input
                type="tel"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="Phone number"
              />
            </label>
          </CardContent>
        </Card>

        {/* Shipping */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Use a saved address</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {savedAddresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                        useSavedId === a.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={useSavedId === a.id}
                        onChange={() => setUseSavedId(a.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-medium">{a.name}</span>
                        <span className="block text-muted-foreground">
                          {a.addressLine}, {a.city}, {stateName(a.state)} — {a.pincode}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                      useSavedId === '' ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={useSavedId === ''}
                      onChange={() => {
                        setUseSavedId('');
                        setShipping(EMPTY_SHIPPING);
                      }}
                      className="mt-1"
                    />
                    <span className="font-medium">+ Use a new address</span>
                  </label>
                </div>
                <hr className="my-2" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium">Full name *</span>
                <Input
                  required
                  value={shipping.name}
                  onChange={(e) => setShip('name', e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Mobile *</span>
                <Input
                  type="tel"
                  inputMode="tel"
                  required
                  value={shipping.phone}
                  onChange={(e) => setShip('phone', e.target.value)}
                  autoComplete="tel"
                  placeholder="Phone number"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Address line *</span>
                <Input
                  required
                  value={shipping.addressLine}
                  onChange={(e) => setShip('addressLine', e.target.value)}
                  autoComplete="address-line1"
                  placeholder="House no., street, area"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Landmark</span>
                <Input
                  value={shipping.landmark}
                  onChange={(e) => setShip('landmark', e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">PIN code *</span>
                <SmartPincodeInput
                  value={useSavedId ? '' : shipping.pincode}
                  onChange={(v) => setShip('pincode', v)}
                  onResolved={applyPinResolution}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">City *</span>
                <SmartCityInput
                  value={shipping.city}
                  stateCode={shipping.state}
                  onSelect={({ city, stateCode }) => {
                    // A picked city marks the field as manually edited so
                    // any subsequent PIN re-resolve doesn't clobber it.
                    setCityManuallyEdited(true);
                    setShipping((prev) => ({
                      ...prev,
                      city,
                      // If the shopper picks a known city we also lock in
                      // its state (free for them). For free-text commits
                      // (stateCode === null) we leave state untouched.
                      state: stateCode ?? prev.state,
                    }));
                  }}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">State *</span>
                <select
                  required
                  value={shipping.state}
                  onChange={(e) => setShip('state', e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select a state</option>
                  {INDIA_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                paymentMethod === 'RAZORPAY' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="payment"
                value="RAZORPAY"
                checked={paymentMethod === 'RAZORPAY'}
                onChange={() => setPaymentMethod('RAZORPAY')}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">Pay online (UPI / cards / netbanking)</span>
                <span className="block text-xs text-muted-foreground">
                  Mock gateway in development — real Razorpay drops in for production.
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                paymentMethod === 'COD' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="payment"
                value="COD"
                checked={paymentMethod === 'COD'}
                onChange={() => setPaymentMethod('COD')}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">Cash on delivery</span>
                <span className="block text-xs text-muted-foreground">
                  Pay {formatINR(COD_FEE)} extra · pay the rest when you receive the order.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Order summary */}
      <Card className="sticky top-20 h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2">
            {items.map((item) => {
              const image = item.product.images[0];
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {image && (
                      <Image
                        src={image.url}
                        alt={image.altText ?? item.product.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.product.title}</p>
                    <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {formatINR(parseFloat(item.price) * item.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>

          <hr />
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-leaf-600">
              <span>Discount ({discount?.code})</span>
              <span className="tabular-nums">−{formatINR(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="tabular-nums">
              {shippingCost === 0 ? <span className="text-leaf-600">Free</span> : formatINR(shippingCost)}
            </span>
          </div>
          {codFee > 0 && (
            <div className="flex justify-between">
              <span>COD fee</span>
              <span className="tabular-nums">{formatINR(codFee)}</span>
            </div>
          )}
          <hr />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {`Place order · ${formatINR(total)}`}
          </Button>
          <p className="text-xs text-muted-foreground">
            You&rsquo;ll review your order before{' '}
            {paymentMethod === 'COD' ? 'confirming' : 'paying'}. By placing it you agree to
            our terms of service.
          </p>
        </CardContent>
      </Card>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-xl">
            <h2 className="font-serif text-xl font-semibold">Review your order</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Please confirm everything looks right before {paymentMethod === 'COD' ? 'placing it' : 'you pay'}.
            </p>

            <div className="mt-4 divide-y rounded-md border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{item.product.title}</span>
                    <span className="text-muted-foreground"> × {item.quantity}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatINR(parseFloat(item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md border p-3 text-sm">
              <p className="font-medium">Ship to</p>
              <p className="mt-1 text-muted-foreground">
                {shipping.name} · {shipping.phone}
                <br />
                {shipping.addressLine}
                {shipping.landmark ? `, ${shipping.landmark}` : ''}
                <br />
                {shipping.city}, {stateName(shipping.state)} – {shipping.pincode}
              </p>
              <p className="mt-2 text-muted-foreground">{contactEmail}</p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatINR(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-leaf-700">
                  <span>Discount{discount?.code ? ` (${discount.code})` : ''}</span>
                  <span className="tabular-nums">−{formatINR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="tabular-nums">
                  {shippingCost === 0 ? 'Free' : formatINR(shippingCost)}
                </span>
              </div>
              {codFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">COD fee</span>
                  <span className="tabular-nums">{formatINR(codFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total · {paymentMethod === 'COD' ? 'Cash on delivery' : 'Pay online'}</span>
                <span className="tabular-nums">{formatINR(total)}</span>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setReviewOpen(false)}
                disabled={pending}
              >
                Edit
              </Button>
              <Button
                type="button"
                className="flex-1"
                size="lg"
                onClick={placeOrder}
                disabled={pending}
              >
                {pending ? 'Placing…' : paymentMethod === 'COD' ? 'Confirm order' : 'Confirm & pay'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

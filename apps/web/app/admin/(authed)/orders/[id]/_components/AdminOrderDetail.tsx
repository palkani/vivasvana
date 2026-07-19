'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, Truck, Package, CheckCircle2, XCircle, RotateCcw, IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/admin-api';
import { formatINR } from '@/lib/utils';
import { stateName } from '@/lib/india-states';
import type { Order, OrderStatus, Payment } from '@/lib/types';
import { ShipmentForm } from './ShipmentForm';
import { OrderTimeline } from './OrderTimeline';
import { OrderTimeline as CarrierTimeline } from '@/components/storefront/OrderTimeline';

interface AdminOrder extends Order {
  payments: Payment[];
  user: { id: string; email: string; name: string | null; role: string; createdAt: string } | null;
}

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'outline' | 'success' | 'secondary'> = {
  PENDING: 'outline',
  CONFIRMED: 'secondary',
  PACKED: 'secondary',
  SHIPPED: 'secondary',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  RETURNED: 'outline',
  REFUNDED: 'outline',
};

export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showShipForm, setShowShipForm] = useState(false);
  const [editTracking, setEditTracking] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);

  async function load() {
    setError(null);
    try {
      const o = await adminApi.get<AdminOrder>(`/api/admin/orders/${orderId}`);
      setOrder(o);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function doAction(path: string, confirmMsg: string, body?: unknown) {
    if (!confirm(confirmMsg)) return;
    startTransition(async () => {
      try {
        await adminApi.post(path, body);
        await load();
        setShowShipForm(false);
        setEditTracking(false);
        setShowRefundForm(false);
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Action failed');
      }
    });
  }

  if (error && !order) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!order) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const ship = order.shippingAddress;
  const refundableAmount = parseFloat(order.total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
            <Link href="/admin/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All orders
            </Link>
          </Button>
          <h1 className="font-mono text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed{' '}
            {new Date(order.placedAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[order.status]}>{order.status.toLowerCase()}</Badge>
          <Badge variant="outline">{order.paymentMethod}</Badge>
          <Badge
            variant={order.paymentStatus === 'PAID' ? 'success' : 'outline'}
            className="capitalize"
          >
            {order.paymentStatus.toLowerCase().replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* === Status workflow buttons ====================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status workflow</CardTitle>
          <p className="text-xs text-muted-foreground">
            Manual shipping — admin advances each step. Tracking number required to ship.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'PENDING' && (
              <Button
                disabled={pending}
                onClick={() => doAction(`/api/admin/orders/${order.id}/confirm`, 'Confirm this order?')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm order
              </Button>
            )}
            {order.status === 'CONFIRMED' && (
              <Button
                disabled={pending}
                onClick={() => doAction(`/api/admin/orders/${order.id}/pack`, 'Mark this order as packed?')}
              >
                <Package className="mr-2 h-4 w-4" /> Mark as packed
              </Button>
            )}
            {order.status === 'PACKED' && (
              <Button disabled={pending} onClick={() => setShowShipForm((s) => !s)}>
                <Truck className="mr-2 h-4 w-4" />
                {showShipForm ? 'Cancel shipping' : 'Add tracking & ship'}
              </Button>
            )}
            {order.status === 'SHIPPED' && (
              <>
                <Button
                  disabled={pending}
                  onClick={() =>
                    doAction(`/api/admin/orders/${order.id}/deliver`, 'Mark this order as delivered?')
                  }
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as delivered
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditTracking((e) => !e)}
                >
                  {editTracking ? 'Cancel edit' : 'Edit tracking'}
                </Button>
              </>
            )}
            {['PENDING', 'CONFIRMED', 'PACKED'].includes(order.status) && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  const reason = prompt('Cancellation reason (optional)') ?? undefined;
                  doAction(`/api/admin/orders/${order.id}/cancel`, 'Cancel order and restock?', {
                    reason,
                  });
                }}
              >
                <XCircle className="mr-2 h-4 w-4" /> Cancel & restock
              </Button>
            )}
            {['SHIPPED', 'DELIVERED'].includes(order.status) && (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  const reason = prompt('Return reason (optional)') ?? undefined;
                  doAction(
                    `/api/admin/orders/${order.id}/return`,
                    'Mark as returned and restock inventory?',
                    { reason },
                  );
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Mark returned
              </Button>
            )}
            {['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status) &&
              order.paymentStatus !== 'REFUNDED' && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setShowRefundForm((s) => !s)}
                >
                  <IndianRupee className="mr-2 h-4 w-4" />
                  {showRefundForm ? 'Cancel refund' : 'Issue refund'}
                </Button>
              )}
          </div>

          {showShipForm && (
            <ShipmentForm
              mode="ship"
              defaultCarrier={ship?.carrier ?? ''}
              defaultTrackingNumber={ship?.trackingNumber ?? ''}
              defaultTrackingUrl={ship?.trackingUrl ?? ''}
              disabled={pending}
              onSubmit={(body) => {
                startTransition(async () => {
                  try {
                    await adminApi.post(`/api/admin/orders/${order.id}/ship`, body);
                    await load();
                  } catch (e) {
                    const err = e as { payload?: { message?: string }; message?: string };
                    setError(err.payload?.message ?? err.message ?? 'Could not ship');
                  }
                });
              }}
            />
          )}

          {editTracking && (
            <ShipmentForm
              mode="update"
              defaultCarrier={ship?.carrier ?? ''}
              defaultTrackingNumber={ship?.trackingNumber ?? ''}
              defaultTrackingUrl={ship?.trackingUrl ?? ''}
              disabled={pending}
              onSubmit={(body) => {
                startTransition(async () => {
                  try {
                    await adminApi.patch(`/api/admin/orders/${order.id}/tracking`, body);
                    await load();
                    setEditTracking(false);
                  } catch (e) {
                    const err = e as { payload?: { message?: string }; message?: string };
                    setError(err.payload?.message ?? err.message ?? 'Could not update');
                  }
                });
              }}
            />
          )}

          {showRefundForm && (
            <RefundForm
              maxAmount={refundableAmount}
              disabled={pending}
              onSubmit={(body) => {
                startTransition(async () => {
                  try {
                    await adminApi.post(`/api/admin/orders/${order.id}/refund`, body);
                    await load();
                    setShowRefundForm(false);
                  } catch (e) {
                    const err = e as { payload?: { message?: string }; message?: string };
                    setError(err.payload?.message ?? err.message ?? 'Refund failed');
                  }
                });
              }}
            />
          )}
        </CardContent>
      </Card>

      <OrderTimeline order={order} />

      <CarrierTimeline endpoint={`/api/admin/orders/${orderId}/timeline`} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Items + totals ------------------------------------------ */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-medium">{item.title.split('|')[0]?.trim()}</span>
                    <span className="text-xs text-muted-foreground">
                      SKU {item.sku} · HSN {item.hsnCode} · × {item.quantity} ·{' '}
                      {formatINR(item.price)} ea · GST {item.taxRate}%
                    </span>
                  </span>
                  <span className="tabular-nums">{formatINR(item.total)}</span>
                </li>
              ))}
            </ul>
            <hr className="my-4" />
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatINR(order.subtotal)}</dd>
              </div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between text-leaf-600">
                  <dt>Discount{order.discountCode && ` (${order.discountCode})`}</dt>
                  <dd className="tabular-nums">−{formatINR(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{formatINR(order.shipping)}</dd>
              </div>
              {parseFloat(order.codFee) > 0 && (
                <div className="flex justify-between">
                  <dt>COD fee</dt>
                  <dd className="tabular-nums">{formatINR(order.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>GST included</dt>
                <dd className="tabular-nums">{formatINR(order.tax)}</dd>
              </div>
              <div className="flex justify-between pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(order.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* ---- Sidebar: customer, ship, payments ----------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{ship?.name ?? order.user?.name ?? '—'}</p>
              <p className="text-muted-foreground">{order.email}</p>
              <p className="text-muted-foreground">{order.phone}</p>
              {order.user ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Account since{' '}
                  {new Date(order.user.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Guest checkout</p>
              )}
            </CardContent>
          </Card>

          {ship && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shipping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  {ship.addressLine}
                  {ship.landmark && `, ${ship.landmark}`}
                  <br />
                  {ship.city}, {stateName(ship.state)} — {ship.pincode}
                  <br />
                  <span className="text-muted-foreground">{ship.phone}</span>
                </p>
                {ship.trackingNumber && (
                  <div className="rounded-md border bg-muted/40 p-2 text-xs">
                    <p>
                      <span className="text-muted-foreground">Carrier: </span>
                      <span className="font-medium">{ship.carrier}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Tracking: </span>
                      <span className="font-mono">{ship.trackingNumber}</span>
                    </p>
                    {ship.trackingUrl && (
                      <a
                        href={ship.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Track package →
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.payments.length === 0 ? (
                <p className="text-muted-foreground">No payment attempts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {order.payments.map((p) => (
                    <li key={p.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.gateway}</span>
                        <Badge variant={p.status === 'PAID' ? 'success' : 'outline'}>
                          {p.status.toLowerCase()}
                        </Badge>
                      </div>
                      <div className="mt-1 tabular-nums">{formatINR(p.amount)}</div>
                      {p.failureReason && (
                        <div className="mt-1 text-muted-foreground">{p.failureReason}</div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString('en-IN')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Refund form ---------------------------------------------------------

function RefundForm({
  maxAmount,
  disabled,
  onSubmit,
}: {
  maxAmount: number;
  disabled: boolean;
  onSubmit: (body: { amount: string; reason?: string }) => void;
}) {
  const [amount, setAmount] = useState(maxAmount.toFixed(2));
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ amount, reason: reason.trim() || undefined });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-brand-200 bg-brand-50/50 p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-800">
        Refund (Phase 3 will wire this to the Razorpay API — for now, records only)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Amount (max {formatINR(maxAmount)})</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            pattern="\d+(\.\d{1,2})?"
            required
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Reason (optional)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={disabled}>
          Record refund
        </Button>
      </div>
    </form>
  );
}

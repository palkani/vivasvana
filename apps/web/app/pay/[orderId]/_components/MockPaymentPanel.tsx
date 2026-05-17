'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import type { Order } from '@/lib/types';

interface Props {
  order: Order;
}

/**
 * Simulates a payment gateway page. Two buttons:
 *   - Simulate success → POST /api/payments/mock-confirm with success: true
 *   - Simulate failure → POST /api/payments/mock-confirm with success: false
 *
 * Real Razorpay (Phase 3) replaces the entire panel with the Razorpay SDK
 * modal. Order shape and downstream routes stay identical.
 */
export function MockPaymentPanel({ order }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [intentCreated, setIntentCreated] = useState(false);

  // Create the mock payment intent on mount so a Payment row exists
  useEffect(() => {
    if (intentCreated) return;
    if (order.paymentStatus !== 'PENDING') {
      setIntentCreated(true);
      return;
    }
    (async () => {
      try {
        await api.post('/api/payments/intents', { orderId: order.id });
        setIntentCreated(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [order.id, order.paymentStatus, intentCreated]);

  function simulate(success: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await api.post(`/api/payments/mock-confirm/${order.id}`, {
          success,
          ...(success ? {} : { failureReason: 'User simulated failure' }),
        });
        if (success) {
          router.push(
            `/orders/confirmed?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`,
          );
        } else {
          router.refresh();
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (order.paymentStatus === 'PAID') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-leaf-600">Payment already received for this order.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mock payment gateway</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border-l-4 border-brand-400 bg-brand-50 p-3 text-xs text-brand-900">
            This is a development stand-in for Razorpay. In production, the Razorpay checkout
            modal opens here. Choose an outcome to test downstream behavior.
          </p>

          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="tabular-nums text-right font-medium">{formatINR(order.total)}</dd>
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="text-right">{order.currency}</dd>
            <dt className="text-muted-foreground">Method</dt>
            <dd className="text-right">{order.paymentMethod}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right">
              <Badge
                variant={
                  order.paymentStatus === 'FAILED'
                    ? 'outline'
                    : order.paymentStatus === 'PAID'
                      ? 'success'
                      : 'outline'
                }
              >
                {order.paymentStatus.toLowerCase()}
              </Badge>
            </dd>
          </dl>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              disabled={pending || !intentCreated || order.paymentStatus === 'FAILED'}
              onClick={() => simulate(true)}
            >
              {pending ? 'Processing…' : `Simulate success · pay ${formatINR(order.total)}`}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={pending || !intentCreated}
              onClick={() => simulate(false)}
            >
              Simulate failure
            </Button>
          </div>

          {order.paymentStatus === 'FAILED' && (
            <p className="text-sm text-destructive">
              Last attempt failed. You can retry by creating a new intent (refresh this page) or
              cancel the order from your account.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                </div>
                <p className="tabular-nums">{formatINR(item.total)}</p>
              </li>
            ))}
          </ul>
          <hr />
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(order.subtotal)}</span>
          </div>
          {parseFloat(order.discount) > 0 && (
            <div className="flex justify-between text-leaf-600">
              <span>Discount</span>
              <span className="tabular-nums">−{formatINR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="tabular-nums">{formatINR(order.shipping)}</span>
          </div>
          <hr />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(order.total)}</span>
          </div>

          {order.shippingAddress && (
            <>
              <hr />
              <p className="text-xs text-muted-foreground">Ship to</p>
              <p className="text-xs">
                {order.shippingAddress.name}, {order.shippingAddress.addressLine},{' '}
                {order.shippingAddress.city} — {order.shippingAddress.pincode}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

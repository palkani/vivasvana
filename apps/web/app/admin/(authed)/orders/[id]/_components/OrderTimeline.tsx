'use client';

import {
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  Truck,
  XCircle,
  RotateCcw,
  IndianRupee,
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Step {
  key: string;
  label: string;
  at: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'done' | 'pending' | 'danger';
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OrderTimeline({ order }: { order: Order }) {
  const cancelled = !!order.cancelledAt;

  // Happy-path steps in order. Each step is "done" only if its timestamp exists.
  const happy: Step[] = [
    { key: 'placed', label: 'Order placed', at: order.placedAt, icon: Clock, tone: 'done' },
    {
      key: 'confirmed',
      label: 'Confirmed',
      at: order.confirmedAt,
      icon: CheckCircle2,
      tone: order.confirmedAt ? 'done' : 'pending',
    },
    {
      key: 'packed',
      label: 'Packed',
      at: order.packedAt,
      icon: Package,
      tone: order.packedAt ? 'done' : 'pending',
    },
    {
      key: 'shipped',
      label: 'Shipped',
      at: order.shippedAt,
      icon: Truck,
      tone: order.shippedAt ? 'done' : 'pending',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      at: order.deliveredAt,
      icon: PackageCheck,
      tone: order.deliveredAt ? 'done' : 'pending',
    },
  ];

  const extras: Step[] = [];
  if (cancelled) {
    extras.push({
      key: 'cancelled',
      label: 'Cancelled',
      at: order.cancelledAt,
      icon: XCircle,
      tone: 'danger',
    });
  }
  if (order.status === 'RETURNED') {
    extras.push({
      key: 'returned',
      label: 'Returned',
      at: null,
      icon: RotateCcw,
      tone: 'danger',
    });
  }
  if (order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PARTIAL_REFUNDED') {
    extras.push({
      key: 'refunded',
      label: order.paymentStatus === 'PARTIAL_REFUNDED' ? 'Partial refund issued' : 'Refunded',
      at: null,
      icon: IndianRupee,
      tone: 'done',
    });
  }

  // If cancelled, fade the remaining pending happy-path steps — they will never happen.
  const steps = cancelled
    ? [...happy.filter((s) => s.tone === 'done'), ...extras]
    : [...happy, ...extras];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-6">
          {steps.map((step) => {
            const Icon = step.icon;
            const color =
              step.tone === 'done'
                ? 'bg-leaf-100 text-leaf-700 border-leaf-300'
                : step.tone === 'danger'
                ? 'bg-destructive/10 text-destructive border-destructive/30'
                : 'bg-muted text-muted-foreground border-border';

            return (
              <li key={step.key} className="relative">
                <span
                  className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border ${color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${
                      step.tone === 'pending' ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fmt(step.at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

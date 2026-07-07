import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiscountForm, EMPTY_DISCOUNT } from '../_components/DiscountForm';

export const metadata = {
  title: 'New discount',
  robots: { index: false, follow: false },
};

export default function NewDiscountPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href="/admin/discounts">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All discounts
          </Link>
        </Button>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">New discount</h1>
        <p className="text-sm text-muted-foreground">
          Create a promo code, percentage offer, or free-shipping coupon.
        </p>
      </div>
      <DiscountForm mode="create" initial={EMPTY_DISCOUNT} />
    </div>
  );
}

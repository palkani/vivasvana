import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DiscountsTable } from './_components/DiscountsTable';

export const metadata = {
  title: 'Discounts',
  robots: { index: false, follow: false },
};

export default function AdminDiscountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Discounts</h1>
          <p className="text-sm text-muted-foreground">
            Promo codes, free-shipping offers, and percentage discounts with usage limits.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/discounts/new">+ New discount</Link>
        </Button>
      </div>
      <DiscountsTable />
    </div>
  );
}

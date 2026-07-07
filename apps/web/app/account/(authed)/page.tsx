import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
};

export default function AccountOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Welcome back</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">View order status and download invoices.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/account/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add and edit shipping addresses for faster checkout.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/account/addresses">Manage addresses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

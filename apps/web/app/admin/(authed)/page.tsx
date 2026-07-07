import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardKpis } from './_components/DashboardKpis';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Last 30 days at a glance.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/reports">Open full reports →</Link>
        </Button>
      </div>

      <DashboardKpis />

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recent orders list lands in Phase 3 once /admin/orders is built.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

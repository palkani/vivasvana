import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboardPage() {
  // Stats become real once /api/admin/reports lands in Phase 3.
  // Today we render placeholders so the route works end-to-end.
  const stats = [
    { label: "Today's orders", value: '—' },
    { label: "Today's revenue", value: '—' },
    { label: 'New customers', value: '—' },
    { label: 'Low stock SKUs', value: '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live store overview. Real numbers wire up in Phase 3.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Order list lands in Phase 2 after checkout is built.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

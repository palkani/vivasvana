import { OrdersTable } from './_components/OrdersTable';

export const metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage shipments, update status, and process refunds.
        </p>
      </div>
      <OrdersTable />
    </div>
  );
}

import { CustomersTable } from './_components/CustomersTable';

export const metadata = {
  title: 'Customers',
  robots: { index: false, follow: false },
};

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Registered shoppers with lifetime value and order history.
        </p>
      </div>
      <CustomersTable />
    </div>
  );
}

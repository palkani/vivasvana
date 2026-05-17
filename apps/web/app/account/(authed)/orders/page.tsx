import { OrdersList } from './_components/OrdersList';

export const metadata = {
  title: 'My orders',
  robots: { index: false, follow: false },
};

export default function MyOrdersPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">My orders</h1>
      <OrdersList />
    </div>
  );
}

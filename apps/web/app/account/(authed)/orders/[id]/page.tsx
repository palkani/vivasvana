import { OrderDetail } from './_components/OrderDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <OrderDetail orderId={id} />
    </div>
  );
}

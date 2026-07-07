import { AdminOrderDetail } from './_components/AdminOrderDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <AdminOrderDetail orderId={id} />;
}

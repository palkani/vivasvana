import { CustomerDetail } from './_components/CustomerDetail';

export const metadata = {
  title: 'Customer detail',
  robots: { index: false, follow: false },
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetail customerId={id} />;
}

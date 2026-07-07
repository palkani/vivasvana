import { AdminDiscountEditor } from './_components/AdminDiscountEditor';

export const metadata = {
  title: 'Edit discount',
  robots: { index: false, follow: false },
};

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminDiscountEditor discountId={id} />;
}

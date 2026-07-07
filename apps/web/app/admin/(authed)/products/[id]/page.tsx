import { EditProduct } from './_components/EditProduct';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Edit product</h1>
      <EditProduct productId={id} />
    </div>
  );
}

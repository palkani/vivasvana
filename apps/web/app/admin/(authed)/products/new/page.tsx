import { ProductForm } from '../_components/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">New product</h1>
      <ProductForm mode="create" />
    </div>
  );
}

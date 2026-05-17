import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProductsTable } from './_components/ProductsTable';

export default function AdminProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your catalog</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">+ Add product</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ProductsTable />
        </CardContent>
      </Card>
    </div>
  );
}

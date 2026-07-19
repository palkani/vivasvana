import type { Metadata } from 'next';
import { CategoriesView } from './_components/CategoriesView';

export const metadata: Metadata = { title: 'Categories · Admin' };
export const dynamic = 'force-dynamic';

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Categories</h1>
      <CategoriesView />
    </div>
  );
}

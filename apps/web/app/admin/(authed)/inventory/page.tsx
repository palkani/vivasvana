import { InventoryView } from './_components/InventoryView';

export const metadata = {
  title: 'Inventory',
  robots: { index: false, follow: false },
};

export default function AdminInventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Watch low-stock items and make ledger-backed stock corrections. Every manual change is
          recorded as a stock movement.
        </p>
      </div>
      <InventoryView />
    </div>
  );
}
import { AddressesView } from './_components/AddressesView';

export const metadata = {
  title: 'My addresses',
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Saved addresses</h1>
      <AddressesView />
    </div>
  );
}

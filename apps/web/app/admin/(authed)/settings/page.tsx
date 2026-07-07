import { SettingsForm } from './_components/SettingsForm';

export const metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Storefront knobs that change without a deploy — shipping defaults, COD fee, announcement bar, social links.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}

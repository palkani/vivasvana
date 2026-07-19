import { ReportsView } from './_components/ReportsView';
import { ProfitCards } from './_components/ProfitCards';

export const metadata = {
  title: 'Reports',
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Sales reports</h1>
        <p className="text-sm text-muted-foreground">
          Revenue counted from orders in CONFIRMED, PACKED, SHIPPED, or DELIVERED status —
          including COD orders pending delivery.
        </p>
      </div>
      <ProfitCards />
      <ReportsView />
    </div>
  );
}

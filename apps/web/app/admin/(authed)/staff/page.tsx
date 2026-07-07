import { StaffManager } from './_components/StaffManager';

export const metadata = {
  title: 'Staff',
  robots: { index: false, follow: false },
};

export default function AdminStaffPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Add team members and grant scoped access. Owners can do everything; staff roles
          have curated permission sets so day-to-day employees never touch sensitive areas.
        </p>
      </div>
      <StaffManager />
    </div>
  );
}

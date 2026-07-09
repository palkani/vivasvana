import type { Metadata } from 'next';
import { ResetPasswordForm } from './_components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <ResetPasswordForm />
    </div>
  );
}

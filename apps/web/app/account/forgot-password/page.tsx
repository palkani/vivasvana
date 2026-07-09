import type { Metadata } from 'next';
import { ForgotPasswordForm } from './_components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <ForgotPasswordForm />
    </div>
  );
}

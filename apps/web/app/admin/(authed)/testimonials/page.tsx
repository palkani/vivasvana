import type { Metadata } from 'next';
import { TestimonialsView } from './_components/TestimonialsView';

export const metadata: Metadata = { title: 'Testimonials · Admin' };
export const dynamic = 'force-dynamic';

export default function TestimonialsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Testimonials</h1>
      <TestimonialsView />
    </div>
  );
}

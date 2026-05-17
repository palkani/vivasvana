import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function HeroBanner() {
  return (
    <section className="bg-gradient-to-br from-brand-50 via-background to-leaf-500/5">
      <div className="container grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <p className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-900">
            FSSAI Certified · Plant-Based · Made in India
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            Ancient millet,<br />everyday nutrition.
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Vivasvana brings you wholesome millet blends crafted for modern Indian families —
            powered by ragi, foxtail, and little millets with no refined sugar or preservatives.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/products">Shop the range</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Our story</Link>
            </Button>
          </div>
        </div>

        <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-100 md:rounded-3xl">
          <div className="absolute inset-0 flex items-center justify-center font-serif text-9xl text-brand-300">
            🌾
          </div>
        </div>
      </div>
    </section>
  );
}

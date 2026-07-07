import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Phase 4 wires this to /api/newsletter; for now it's visual + submits
 * to the form action (no-op in dev) and a polite hint.
 */
export function NewsletterBand() {
  return (
    <section className="bg-brand-700 text-brand-50">
      <div className="container grid gap-6 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-12">
        <div>
          <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Get 10% off your first order
          </h2>
          <p className="mt-2 text-brand-100">
            Join the Vivasvana family. Drop your email — we&rsquo;ll send recipes,
            wellness tips, and your welcome discount.
          </p>
        </div>
        <form
          className="flex w-full flex-col gap-3 sm:flex-row"
          action="/api/newsletter"
          method="post"
        >
          <label htmlFor="newsletter-email" className="sr-only">
            Email
          </label>
          <div className="relative flex-1">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="newsletter-email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="h-11 bg-white pl-9 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 bg-brand-500 hover:bg-brand-400"
          >
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}

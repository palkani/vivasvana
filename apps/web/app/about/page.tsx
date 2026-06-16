import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About us — Vivasvana',
  description:
    'Vivasvana is on a mission to bring traditional Indian millets back to everyday tables — plant-based, nutrient-dense, and made in India.',
};

export default function AboutPage() {
  return (
    <>
      <section className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
            Our story
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            Mindful nourishment, rooted in India
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Vivasvana exists to bring traditional Indian millets back to everyday tables — in
            forms that fit how families actually eat today.
          </p>
        </div>
      </section>

      <section className="container pb-12 md:pb-16">
        <div className="mx-auto max-w-3xl space-y-8 text-base leading-relaxed text-foreground/85">
          <div>
            <h2 className="mb-3 font-serif text-2xl font-semibold">Why millets</h2>
            <p>
              For thousands of years, millets were the staple of Indian kitchens — drought-hardy,
              nutrient-dense, and easy on the land. Somewhere along the way, they were edged out
              by refined grains. We are part of a generation putting them back where they belong:
              in the morning bowl, in the after-school snack, in the everyday meal.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-2xl font-semibold">What we make</h2>
            <p>
              Every Vivasvana blend is plant-based, free of refined sugar and palm oil, and built
              around small millets — foxtail, kodo, little, barnyard, finger. We source from
              farmers in Tamil Nadu and Karnataka and finish in FSSAI-certified facilities.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-2xl font-semibold">Our promises</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Real ingredients on the front of the pack and the back.</li>
              <li>No added preservatives, no artificial colours, no MSG.</li>
              <li>Honest pricing — what it costs to make, plus a fair margin.</li>
              <li>Made and packed in India. Always.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-serif text-2xl font-semibold md:text-3xl">
            Taste the difference
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start with a single pack or our combo. If you don&rsquo;t love it, we&rsquo;ll make
            it right — see our refund policy.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/products">Shop all products</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Get in touch</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

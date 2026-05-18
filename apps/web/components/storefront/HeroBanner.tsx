import Image from 'next/image';
import Link from 'next/link';
import { Leaf, Wheat, ShieldCheck, Heart, Sprout, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Leaf, label: '100% Plant-Based' },
  { icon: Sprout, label: 'No Added Sugar' },
  { icon: ShieldCheck, label: 'No Preservatives' },
  { icon: Heart, label: 'Clean & Natural' },
  { icon: Wheat, label: '6+ Ancient Millets' },
];

interface Props {
  /** Optional product packshots — kept in the signature so the homepage
   *  doesn't need to change when we swap art back to a layered hero. */
  productImages?: Array<{ url: string; alt: string; slug: string }>;
}

/**
 * Hero uses the actual Vivasvana banner art at /brand/hero-banner.png
 * so the homepage looks production-ready. Copy lives in a left column on
 * desktop; the banner image stacks above the text on mobile.
 */
export function HeroBanner(_props: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-background to-brand-100/40">
      <Leaf
        className="pointer-events-none absolute -left-10 top-8 h-32 w-32 rotate-[-20deg] text-leaf-500/10"
        aria-hidden
      />
      <Leaf
        className="pointer-events-none absolute -right-8 bottom-12 h-40 w-40 rotate-[35deg] text-leaf-500/10"
        aria-hidden
      />

      <div className="container relative grid items-center gap-10 py-10 md:gap-12 md:py-16 lg:grid-cols-2 lg:py-20">
        <div className="order-2 space-y-6 lg:order-1">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium tracking-wide text-brand-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> FSSAI Certified · Plant-Based · Made in India
          </p>

          <h1 className="font-serif text-4xl font-bold uppercase leading-[0.95] tracking-tight text-brand-900 md:text-5xl lg:text-6xl">
            Fuel your day
            <br />
            <span className="text-brand-600">the natural way</span>
          </h1>

          <p className="max-w-prose text-lg text-foreground/80">
            Powerful nutrition from <span className="font-medium">6+ ancient Indian millets</span> —
            ragi, foxtail, kodo, little, barnyard, pearl — blended with almonds, dates and digestive
            herbs. A stronger, healthier you starts with what&rsquo;s on your spoon.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="px-7">
              <Link href="/products">Shop the range</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-brand-300 px-7">
              <Link href="/about">Our story</Link>
            </Button>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs font-medium text-foreground/70">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-leaf-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative mx-auto aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-2xl shadow-xl ring-1 ring-brand-100">
            <Image
              src="/brand/hero-banner.png"
              alt="Vivasvana — Nutri Millet and Millet Mojo plant-based millet superfoods"
              fill
              priority
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

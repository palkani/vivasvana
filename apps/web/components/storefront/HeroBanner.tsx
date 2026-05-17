import Image from 'next/image';
import Link from 'next/link';
import { Leaf, Wheat, ShieldCheck, Heart, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SunMark } from './SunMark';

const features = [
  { icon: Leaf, label: '100% Plant-Based' },
  { icon: Sprout, label: 'No Added Sugar' },
  { icon: ShieldCheck, label: 'No Preservatives' },
  { icon: Heart, label: 'Clean & Natural' },
  { icon: Wheat, label: '7 Ancient Millets' },
];

interface Props {
  productImages?: Array<{ url: string; alt: string; slug: string }>;
}

export function HeroBanner({ productImages = [] }: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-background to-brand-100/50">
      {/* Decorative leaves — pure visual */}
      <Leaf
        className="absolute -left-8 top-6 h-32 w-32 rotate-[-20deg] text-leaf-500/10"
        aria-hidden
      />
      <Leaf
        className="absolute -right-6 top-1/2 h-40 w-40 rotate-[35deg] text-leaf-500/10"
        aria-hidden
      />

      <div className="container relative grid items-center gap-10 py-12 md:gap-12 md:py-20 lg:grid-cols-2 lg:py-24">
        {/* ---- Copy ------------------------------------------------------ */}
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium tracking-wide text-brand-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> FSSAI Certified · Plant-Based · Made in India
          </p>

          <h1 className="font-serif text-5xl font-bold uppercase leading-[0.95] tracking-tight text-brand-900 md:text-6xl lg:text-7xl">
            Fuel your day
            <br />
            <span className="text-brand-600">the natural way</span>
          </h1>

          <p className="max-w-prose text-lg text-foreground/80">
            Powerful nutrition from ancient millets — ragi, foxtail, kodo and little —
            blended with almonds, dates and jaggery. A stronger, healthier you starts
            with what&rsquo;s on your spoon.
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

        {/* ---- Visual ---------------------------------------------------- */}
        <div className="relative">
          <HeroArtwork productImages={productImages} />
        </div>
      </div>
    </section>
  );
}

function HeroArtwork({ productImages }: { productImages: Props['productImages'] }) {
  const images = productImages ?? [];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg">
      {/* Soft sun glow behind */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(220,189,118,0.45), rgba(255,255,255,0) 60%)',
        }}
      />

      {/* Brand mark medallion */}
      <div className="absolute left-1/2 top-6 z-10 flex -translate-x-1/2 flex-col items-center text-center">
        <SunMark className="h-20 w-20 drop-shadow-sm" />
        <p className="mt-2 font-serif text-2xl font-semibold tracking-tight text-brand-700">
          Vivasvana
        </p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-brand-500">
          Mindful Nourishment
        </p>
      </div>

      {/* Two product packshots */}
      {images[0] && (
        <div className="absolute bottom-0 left-2 z-20 h-[68%] w-[44%] rotate-[-6deg]">
          <Image
            src={images[0].url}
            alt={images[0].alt}
            fill
            priority
            sizes="(min-width: 1024px) 280px, 40vw"
            className="object-contain drop-shadow-xl"
          />
        </div>
      )}
      {images[1] && (
        <div className="absolute bottom-0 right-2 z-10 h-[68%] w-[44%] rotate-[6deg]">
          <Image
            src={images[1].url}
            alt={images[1].alt}
            fill
            priority
            sizes="(min-width: 1024px) 280px, 40vw"
            className="object-contain drop-shadow-xl"
          />
        </div>
      )}

      {/* Fallback if no product images yet */}
      {images.length === 0 && (
        <div className="absolute inset-x-0 bottom-0 flex h-[60%] items-end justify-center gap-2">
          <div className="h-[85%] w-[40%] rounded-2xl bg-gradient-to-b from-brand-200 to-brand-300 shadow-lg" />
          <div className="h-[90%] w-[40%] rounded-2xl bg-gradient-to-b from-leaf-500/40 to-leaf-600/30 shadow-lg" />
        </div>
      )}
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

export interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  content: string;
  rating: number;
}

export function TestimonialsRow({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section className="border-y border-brand-100 bg-brand-50/60">
      <div className="container py-16">
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-brand-900 md:text-4xl">
            Loved by thousands of families
          </h2>
          <p className="mt-3 text-muted-foreground">
            Real reviews from busy parents, athletes and seniors who&rsquo;ve made millets
            their everyday fuel.
          </p>
        </header>

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <li key={t.id}>
              <Card className="h-full border-brand-100/80 bg-card/80">
                <CardContent className="space-y-4 p-6">
                  <Quote className="h-6 w-6 text-brand-400" aria-hidden />
                  <div
                    className="text-amber-500"
                    aria-label={`${t.rating} out of 5`}
                  >
                    {'★'.repeat(t.rating)}
                    <span className="text-amber-200">{'★'.repeat(5 - t.rating)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    &ldquo;{t.content}&rdquo;
                  </p>
                  <div className="pt-2 text-sm">
                    <p className="font-medium">{t.name}</p>
                    {t.location && (
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

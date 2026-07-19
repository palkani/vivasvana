'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { accountApi } from '@/lib/account-api';
import { pluralize } from '@/lib/utils';

interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

interface Aggregate {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  aggregate: Aggregate;
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= Math.round(rating)
              ? `${cls} fill-amber-400 text-amber-400`
              : `${cls} text-muted-foreground/30`
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${pluralize(n, 'star')}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={
              n <= (hover || value)
                ? 'h-6 w-6 fill-amber-400 text-amber-400'
                : 'h-6 w-6 text-muted-foreground/40'
            }
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ slug }: { slug: string }) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await accountApi.get<ReviewsResponse>(`/api/products/${slug}/reviews`);
      setData(res);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (rating < 1) {
      setFormError('Please select a star rating');
      return;
    }
    setSubmitting(true);
    try {
      await accountApi.post(`/api/products/${slug}/reviews`, {
        authorName: authorName.trim(),
        rating,
        title: title.trim() || undefined,
        content: content.trim(),
      });
      setSubmitted(true);
      setShowForm(false);
      setAuthorName('');
      setRating(0);
      setTitle('');
      setContent('');
    } catch (e) {
      const err = e as { payload?: { message?: string }; message?: string };
      setFormError(err.payload?.message ?? err.message ?? 'Could not submit your review');
    } finally {
      setSubmitting(false);
    }
  }

  const agg = data?.aggregate;
  const total = agg?.count ?? 0;

  return (
    <section className="mt-14 border-t pt-10" id="reviews">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Customer reviews</h2>
          {agg && total > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <Stars rating={agg.average} size="lg" />
              <span className="text-sm text-muted-foreground">
                {agg.average.toFixed(1)} out of 5 · {total} {pluralize(total, 'review')}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No reviews yet. Be the first to share your thoughts.
            </p>
          )}
        </div>
        {!showForm && (
          <Button variant="outline" onClick={() => { setShowForm(true); setSubmitted(false); }}>
            Write a review
          </Button>
        )}
      </div>

      {submitted && (
        <p className="mt-4 rounded-md border border-leaf-600/30 bg-leaf-600/5 p-3 text-sm text-leaf-600">
          Thank you! Your review has been submitted and will appear once approved.
        </p>
      )}

      {/* Rating distribution */}
      {agg && total > 0 && (
        <div className="mt-6 max-w-sm space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const n = agg.distribution[String(star) as '1' | '2' | '3' | '4' | '5'] ?? 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-muted-foreground">{star} star</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{n}</span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-6 max-w-lg space-y-4 rounded-lg border p-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Your rating</label>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-name" className="text-sm font-medium">Your name</label>
            <Input
              id="review-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Priya S."
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-title" className="text-sm font-medium">
              Title <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Sum up your experience"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-content" className="text-sm font-medium">Your review</label>
            <Textarea
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={10}
              maxLength={5000}
              rows={4}
              placeholder="What did you like or dislike?"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loadError && (
        <p className="mt-6 text-sm text-destructive">Could not load reviews: {loadError}</p>
      )}

      <ul className="mt-8 space-y-6">
        {data?.reviews.map((r) => (
          <li key={r.id} className="border-b pb-6 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={r.rating} />
              <span className="text-sm font-medium">{r.authorName}</span>
              {r.isVerifiedPurchase && <Badge variant="success">Verified purchase</Badge>}
            </div>
            {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

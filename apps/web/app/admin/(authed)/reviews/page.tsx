import { ReviewsModeration } from './_components/ReviewsModeration';

export const metadata = {
  title: 'Reviews',
  robots: { index: false, follow: false },
};

export default function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Moderate customer product reviews. Approve to publish on the storefront, or reject to hide.
        </p>
      </div>
      <ReviewsModeration />
    </div>
  );
}
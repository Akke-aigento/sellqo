import { Star } from 'lucide-react';

interface Review {
  id: string;
  author_name?: string | null;
  reviewer_name?: string | null;
  rating: number;
  review_text?: string | null;
  content?: string | null;
  review_date?: string | null;
  platform?: string;
}

interface ProductReviewsSectionProps {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  display: 'full' | 'stars_only' | 'hidden';
}

export function ProductReviewsSection({ reviews, averageRating, totalReviews, display }: ProductReviewsSectionProps) {
  if (display === 'hidden' || totalReviews === 0) return null;

  return (
    <div className="border-t pt-8 mt-8">
      {/* Average Rating */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold">Beoordelingen</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`h-5 w-5 ${star <= Math.round(averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
          <span className="font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">({totalReviews} reviews)</span>
        </div>
      </div>

      {/* Full reviews list */}
      {display === 'full' && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.slice(0, 10).map(review => (
            <div key={review.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                  <span className="font-medium text-sm">{review.author_name || review.reviewer_name || 'Anoniem'}</span>
                </div>
                {review.review_date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.review_date).toLocaleDateString('nl-NL')}
                  </span>
                )}
              </div>
              {(review.review_text || (review as any).content) && (
                <p className="text-sm text-muted-foreground">{review.review_text || (review as any).content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StarRating({ rating, count }: { rating: number; count: number }) {
  if (count === 0) return null;
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">({count})</span>
    </div>
  );
}

import { usePublicReviews } from '@/hooks/useReviewsHub';
import { AggregateReviewScore } from '@/components/storefront/reviews/AggregateReviewScore';
import { UnifiedReviewsCarousel } from '@/components/storefront/reviews/UnifiedReviewsCarousel';
import { ReviewsPlatformBadges } from '@/components/storefront/reviews/ReviewsPlatformBadges';
import type { HomepageSection } from '@/types/storefront';
import type { ReviewPlatform } from '@/types/reviews-hub';

interface ExternalReviewsSectionProps {
  section: HomepageSection;
  tenantId?: string;
}

export function ExternalReviewsSection({ section, tenantId }: ExternalReviewsSectionProps) {
  const { reviews, aggregate, isLoading } = usePublicReviews(tenantId);

  const content = section.content as {
    title?: string;
    subtitle?: string;
    display_style?: 'carousel' | 'grid' | 'list';
    show_aggregate?: boolean;
    show_platform_badges?: boolean;
    max_reviews?: number;
    featured_only?: boolean;
  };

  const settings = section.settings as {
    background_color?: string;
    text_color?: string;
    padding?: string;
  };

  if (isLoading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-48 bg-muted rounded max-w-2xl mx-auto mt-8" />
          </div>
        </div>
      </section>
    );
  }

  if (!aggregate || aggregate.total_reviews === 0) {
    return null;
  }

  const displayReviews = content.featured_only
    ? reviews.filter((r) => r.is_featured)
    : reviews;

  const limitedReviews = content.max_reviews
    ? displayReviews.slice(0, content.max_reviews)
    : displayReviews;

  const paddingClass = settings?.padding === 'large' ? 'py-16 md:py-24' : 'py-12 md:py-16';

  return (
    <section
      className={paddingClass}
      style={{
        backgroundColor: settings?.background_color,
        color: settings?.text_color,
      }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          {content.title && (
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {content.title}
            </h2>
          )}
          {content.subtitle && (
            <p className="text-muted-foreground">
              {content.subtitle}
            </p>
          )}
        </div>

        {/* Aggregate score */}
        {content.show_aggregate !== false && (
          <div className="mb-8">
            <AggregateReviewScore
              averageRating={aggregate.average_rating}
              totalReviews={aggregate.total_reviews}
              platforms={aggregate.platforms.map((p) => p.platform) as ReviewPlatform[]}
              size="lg"
            />
          </div>
        )}

        {/* Platform badges */}
        {content.show_platform_badges && (
          <div className="flex justify-center mb-8">
            <ReviewsPlatformBadges
              platforms={aggregate.platforms.map(p => ({ platform: p.platform as ReviewPlatform, rating: p.rating, count: p.count }))}
              size="md"
              showCount
            />
          </div>
        )}

        {/* Reviews display */}
        {content.display_style === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {limitedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : content.display_style === 'list' ? (
          <div className="space-y-4 max-w-2xl mx-auto">
            {limitedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <UnifiedReviewsCarousel
            reviews={limitedReviews}
            autoPlay
            autoPlayInterval={5000}
          />
        )}
      </div>
    </section>
  );
}

// Simple review card for grid/list display
function ReviewCard({ review }: { review: { id: string; rating: number; text?: string | null; title?: string | null; author_name?: string | null; platform: string } }) {
  return (
    <div className="bg-card rounded-lg p-4 border">
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= review.rating ? 'text-yellow-400' : 'text-muted'}
          >
            ★
          </span>
        ))}
      </div>
      <p className="text-sm line-clamp-3 mb-2">
        {review.text || review.title || 'Geweldige ervaring!'}
      </p>
      <p className="text-xs text-muted-foreground">
        — {review.author_name || 'Anoniem'}
      </p>
    </div>
  );
}

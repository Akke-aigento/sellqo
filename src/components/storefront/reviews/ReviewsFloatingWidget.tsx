import { useState } from 'react';
import { Star, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLATFORM_INFO, type ExternalReview, type ReviewPlatform } from '@/types/reviews-hub';
import { UnifiedReviewsCarousel } from './UnifiedReviewsCarousel';

interface ReviewsFloatingWidgetProps {
  averageRating: number;
  totalReviews: number;
  reviews: ExternalReview[];
  platforms: ReviewPlatform[];
  position?: 'bottom-left' | 'bottom-right';
  style?: 'badge' | 'expandable';
}

export function ReviewsFloatingWidget({
  averageRating,
  totalReviews,
  reviews,
  platforms,
  position = 'bottom-right',
  style = 'badge',
}: ReviewsFloatingWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  if (style === 'badge') {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 bg-background border shadow-lg rounded-full px-4 py-2 hover:shadow-xl transition-shadow"
        >
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm">
            • {totalReviews} reviews
          </span>
        </button>
      </div>
    );
  }

  // Expandable style
  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {/* Collapsed state */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-background border shadow-lg rounded-full px-4 py-2 hover:shadow-xl transition-all hover:scale-105"
        >
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3 h-3 ${
                  star <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-muted text-muted'
                }`}
              />
            ))}
          </div>
          <span className="font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">
            ({totalReviews})
          </span>
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Expanded state */}
      {isExpanded && (
        <div className="bg-background border shadow-2xl rounded-xl w-[90vw] max-w-md p-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-lg">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                uit {totalReviews} reviews
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Platform logos */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            {platforms.map((platform) => {
              const info = PLATFORM_INFO[platform];
              return (
                <a
                  key={platform}
                  href={info.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <img
                    src={info.logo}
                    alt={info.name}
                    className="h-5 w-auto object-contain"
                  />
                </a>
              );
            })}
          </div>

          {/* Mini carousel */}
          {reviews.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto">
              <UnifiedReviewsCarousel
                reviews={reviews.slice(0, 5)}
                autoPlay={false}
                showPlatformBadge={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

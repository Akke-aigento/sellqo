import { Star } from 'lucide-react';
import { PLATFORM_INFO, type ReviewPlatform } from '@/types/reviews-hub';

interface AggregateReviewScoreProps {
  averageRating: number;
  totalReviews: number;
  platforms: ReviewPlatform[];
  size?: 'sm' | 'md' | 'lg';
  showPlatforms?: boolean;
}

export function AggregateReviewScore({
  averageRating,
  totalReviews,
  platforms,
  size = 'md',
  showPlatforms = true,
}: AggregateReviewScoreProps) {
  const sizeConfig = {
    sm: { stars: 'w-3 h-3', text: 'text-sm', gap: 'gap-1' },
    md: { stars: 'w-4 h-4', text: 'text-base', gap: 'gap-1.5' },
    lg: { stars: 'w-5 h-5', text: 'text-lg', gap: 'gap-2' },
  };

  const config = sizeConfig[size];
  const fullStars = Math.floor(averageRating);
  const hasHalfStar = averageRating - fullStars >= 0.5;

  return (
    <div className={`flex flex-col items-center ${config.gap}`}>
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${config.stars} ${
              star <= fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : star === fullStars + 1 && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>

      {/* Score text */}
      <p className={`${config.text} text-foreground`}>
        <span className="font-semibold">{averageRating.toFixed(1)}</span>
        <span className="text-muted-foreground"> gemiddeld uit </span>
        <span className="font-semibold">{totalReviews.toLocaleString('nl-NL')}</span>
        <span className="text-muted-foreground"> reviews</span>
      </p>

      {/* Platform logos */}
      {showPlatforms && platforms.length > 0 && (
        <div className="flex items-center gap-2 mt-1">
          {platforms.map((platform) => {
            const info = PLATFORM_INFO[platform];
            return (
              <img
                key={platform}
                src={info.logo}
                alt={info.name}
                className="h-4 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                title={info.name}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

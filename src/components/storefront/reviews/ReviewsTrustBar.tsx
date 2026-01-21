import { Star } from 'lucide-react';
import { PLATFORM_INFO, type ReviewPlatform } from '@/types/reviews-hub';

interface ReviewsTrustBarProps {
  averageRating: number;
  totalReviews: number;
  platforms: ReviewPlatform[];
  variant?: 'light' | 'dark' | 'primary';
}

export function ReviewsTrustBar({
  averageRating,
  totalReviews,
  platforms,
  variant = 'light',
}: ReviewsTrustBarProps) {
  const variantClasses = {
    light: 'bg-muted/50 text-foreground',
    dark: 'bg-foreground text-background',
    primary: 'bg-primary text-primary-foreground',
  };

  return (
    <div className={`py-2 px-4 ${variantClasses[variant]}`}>
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-3 text-sm">
        {/* Stars */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-4 h-4 ${
                star <= Math.round(averageRating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : variant === 'light'
                  ? 'fill-muted text-muted'
                  : 'fill-current/30 text-current/30'
              }`}
            />
          ))}
        </div>

        {/* Score text */}
        <span>
          <strong>{averageRating.toFixed(1)}/5</strong> op basis van{' '}
          <strong>{totalReviews.toLocaleString('nl-NL')}</strong> reviews bij
        </span>

        {/* Platform logos */}
        <div className="flex items-center gap-2">
          {platforms.map((platform) => {
            const info = PLATFORM_INFO[platform];
            return (
              <a
                key={platform}
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <img
                  src={info.logo}
                  alt={info.name}
                  className="h-4 w-auto object-contain"
                  style={{
                    filter: variant === 'dark' ? 'brightness(0) invert(1)' : undefined,
                  }}
                />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

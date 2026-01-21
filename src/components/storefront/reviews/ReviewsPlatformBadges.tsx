import { PLATFORM_INFO, type ReviewPlatform } from '@/types/reviews-hub';

interface PlatformScore {
  platform: ReviewPlatform;
  rating: number;
  count: number;
}

interface ReviewsPlatformBadgesProps {
  platforms: PlatformScore[];
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export function ReviewsPlatformBadges({ 
  platforms, 
  size = 'md',
  showCount = false 
}: ReviewsPlatformBadgesProps) {
  if (platforms.length === 0) return null;

  const sizeClasses = {
    sm: 'text-xs gap-1 px-2 py-1',
    md: 'text-sm gap-1.5 px-3 py-1.5',
    lg: 'text-base gap-2 px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {platforms.map(({ platform, rating, count }) => {
        const info = PLATFORM_INFO[platform];
        return (
          <a
            key={platform}
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center rounded-full bg-muted/50 hover:bg-muted transition-colors ${sizeClasses[size]}`}
            title={`${info.name}: ${rating.toFixed(1)} sterren${showCount ? ` (${count} reviews)` : ''}`}
          >
            <img 
              src={info.logo} 
              alt={info.name} 
              className={`${iconSizes[size]} object-contain`}
            />
            <span className="font-medium">{rating.toFixed(1)}</span>
            <span className="text-yellow-500">★</span>
            {showCount && (
              <span className="text-muted-foreground">({count})</span>
            )}
          </a>
        );
      })}
    </div>
  );
}

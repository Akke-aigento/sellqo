import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import type { BadgeWithStatus } from '@/hooks/useBadges';

interface BadgeCardProps {
  badge: BadgeWithStatus;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

export function BadgeCard({ badge, size = 'md', showDescription = false }: BadgeCardProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
        badge.earned
          ? 'hover:bg-muted/50 cursor-default'
          : 'opacity-50 grayscale'
      )}
      title={badge.earned ? `${badge.name} - ${badge.description}` : `Nog niet verdiend: ${badge.description}`}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl transition-transform',
          sizeClasses[size],
          badge.earned
            ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-800'
            : 'bg-muted border border-border'
        )}
      >
        {badge.earned ? (
          <span>{badge.emoji}</span>
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <span
        className={cn(
          'text-xs font-medium text-center line-clamp-1',
          !badge.earned && 'text-muted-foreground'
        )}
      >
        {badge.earned ? badge.name : '???'}
      </span>
      {showDescription && badge.earned && (
        <span className="text-xs text-muted-foreground text-center line-clamp-2">
          {badge.description}
        </span>
      )}
    </div>
  );
}

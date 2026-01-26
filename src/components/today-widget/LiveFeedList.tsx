import { Coffee } from 'lucide-react';
import { LiveFeedItem } from './LiveFeedItem';
import type { LiveFeedItem as LiveFeedItemType } from '@/hooks/useTodayLiveFeed';

interface LiveFeedListProps {
  items: LiveFeedItemType[];
  isLoading?: boolean;
}

export function LiveFeedList({ items, isLoading }: LiveFeedListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="h-6 w-6 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/4 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Coffee className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Nog geen activiteit vandaag
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Bestellingen verschijnen hier zodra ze binnenkomen
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {items.map((item, index) => (
        <LiveFeedItem 
          key={item.id} 
          item={item} 
          isNew={index === 0}
        />
      ))}
    </div>
  );
}

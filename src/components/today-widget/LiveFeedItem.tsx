import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { LiveFeedItem as LiveFeedItemType } from '@/hooks/useTodayLiveFeed';

interface LiveFeedItemProps {
  item: LiveFeedItemType;
  isNew?: boolean;
}

export function LiveFeedItem({ item, isNew = false }: LiveFeedItemProps) {
  const timeAgo = formatDistanceToNow(item.timestamp, { 
    addSuffix: false, 
    locale: nl 
  });

  return (
    <div 
      className={cn(
        "flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-all duration-500",
        isNew && "bg-emerald-50 dark:bg-emerald-950/30 animate-in slide-in-from-left-2"
      )}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight truncate">{item.message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo} geleden</p>
      </div>
      {item.amount && item.type === 'order_new' && (
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          {formatCurrency(item.amount)}
        </span>
      )}
    </div>
  );
}

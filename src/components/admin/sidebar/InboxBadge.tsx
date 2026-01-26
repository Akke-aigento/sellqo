import { Badge } from '@/components/ui/badge';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount';

export function InboxBadge() {
  const { count } = useUnreadMessagesCount();

  if (count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="ml-auto h-5 min-w-5 text-xs px-1.5 flex items-center justify-center"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

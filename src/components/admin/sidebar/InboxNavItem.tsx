import { MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount';
import { useSidebar } from '@/components/ui/sidebar';

export function InboxNavItem() {
  const { count } = useUnreadMessagesCount();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <NavLink
      to="/admin/messages"
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground'
        )
      }
    >
      <MessageSquare className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
        <>
          <span className="flex-1">Gesprekken</span>
          {count > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 text-xs px-1.5 flex items-center justify-center"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          )}
        </>
      )}
      {isCollapsed && count > 0 && (
        <span className="absolute top-0 right-0 h-2 w-2 bg-destructive rounded-full" />
      )}
    </NavLink>
  );
}

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, AlertTriangle, Info, AlertCircle, Bot, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { useAIActions } from '@/hooks/useAIActions';
import { AICoachNotificationItem } from './notifications/AICoachNotificationItem';
import type { Notification, NotificationPriority } from '@/types/notification';
import { cn } from '@/lib/utils';

const priorityConfig: Record<NotificationPriority, { icon: React.ElementType; color: string }> = {
  low: { icon: Info, color: 'text-muted-foreground' },
  medium: { icon: Info, color: 'text-blue-500' },
  high: { icon: AlertCircle, color: 'text-orange-500' },
  urgent: { icon: AlertTriangle, color: 'text-destructive' },
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { icon: PriorityIcon, color } = priorityConfig[notification.priority];
  const isUnread = !notification.read_at;

  return (
    <div
      className={cn(
        'p-3 border-b last:border-0 hover:bg-muted/50 transition-colors',
        isUnread && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', color)}>
          <PriorityIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-medium truncate', isUnread && 'font-semibold')}>
              {notification.title}
            </p>
            {notification.priority === 'urgent' && (
              <Badge variant="destructive" className="text-xs py-0">Urgent</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {notification.action_url && (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link to={notification.action_url}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {isUnread && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMarkAsRead(notification.id)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(notification.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications();

  const { pendingSuggestions, rejectSuggestion } = useAIActions();

  const unreadNotifications = notifications.filter(n => !n.read_at);
  const urgentNotifications = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high');
  const aiCoachCount = pendingSuggestions?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {(unreadCount > 0 || aiCoachCount > 0) && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {(unreadCount + aiCoachCount) > 99 ? '99+' : unreadCount + aiCoachCount}
            </span>
          )}
          <span className="sr-only">Notificaties</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notificaties</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs">
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Alles gelezen
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Alle ({notifications.length})
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Ongelezen ({unreadCount})
            </TabsTrigger>
            <TabsTrigger
              value="urgent"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Urgent ({urgentNotifications.length})
            </TabsTrigger>
            <TabsTrigger
              value="ai_coach"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 gap-1"
            >
              <Bot className="h-3.5 w-3.5" />
              Coach ({aiCoachCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Geen notificaties</p>
                </div>
              ) : (
                notifications.slice(0, 20).map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="m-0">
            <ScrollArea className="h-80">
              {unreadNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Alles gelezen!</p>
                </div>
              ) : (
                unreadNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="urgent" className="m-0">
            <ScrollArea className="h-80">
              {urgentNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Geen urgente notificaties</p>
                </div>
              ) : (
                urgentNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ai_coach" className="m-0">
            <ScrollArea className="h-80">
              {aiCoachCount === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Geen AI suggesties</p>
                  <p className="text-xs mt-1">De AI Coach analyseert je data en geeft proactief advies</p>
                </div>
              ) : (
                pendingSuggestions?.slice(0, 10).map(suggestion => (
                  <AICoachNotificationItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    onDismiss={(id) => rejectSuggestion.mutate(id)}
                    compact
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="border-t p-2 flex justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/notifications" onClick={() => setOpen(false)}>
              Bekijk alles
            </Link>
          </Button>
          {notifications.some(n => n.read_at) && (
            <Button variant="ghost" size="sm" onClick={deleteAllRead} className="text-muted-foreground">
              Gelezen verwijderen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

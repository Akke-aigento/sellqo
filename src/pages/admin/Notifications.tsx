import { useState } from 'react';
import {
  Bell, Check, CheckCheck, Trash2, ExternalLink, AlertTriangle,
  Info, AlertCircle, Search, Filter, X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import { NOTIFICATION_CONFIG, NotificationCategory, NotificationPriority, Notification } from '@/types/notification';
import { cn } from '@/lib/utils';

const priorityConfig: Record<NotificationPriority, { icon: React.ElementType; color: string; label: string }> = {
  low: { icon: Info, color: 'text-muted-foreground', label: 'Laag' },
  medium: { icon: Info, color: 'text-blue-500', label: 'Normaal' },
  high: { icon: AlertCircle, color: 'text-orange-500', label: 'Hoog' },
  urgent: { icon: AlertTriangle, color: 'text-destructive', label: 'Urgent' },
};

function NotificationRow({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { icon: PriorityIcon, color, label: priorityLabel } = priorityConfig[notification.priority];
  const isUnread = !notification.read_at;
  const categoryConfig = NOTIFICATION_CONFIG.find(c => c.category === notification.category);

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors',
        isUnread && 'bg-primary/5'
      )}
    >
      <div className={cn('mt-1', color)}>
        <PriorityIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn('font-medium', isUnread && 'font-semibold')}>
            {notification.title}
          </p>
          {notification.priority === 'urgent' && (
            <Badge variant="destructive" className="text-xs">Urgent</Badge>
          )}
          {notification.priority === 'high' && (
            <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">Hoog</Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {categoryConfig?.label || notification.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {notification.message}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>
            {format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: nl })}
          </span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: nl })}
          </span>
          {notification.read_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> Gelezen
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {notification.action_url && (
          <Button variant="outline" size="sm" asChild>
            <Link to={notification.action_url}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Bekijk
            </Link>
          </Button>
        )}
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMarkAsRead(notification.id)}
            title="Markeer als gelezen"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(notification.id)}
          className="text-muted-foreground hover:text-destructive"
          title="Verwijderen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    getUnreadByCategory,
  } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = searchQuery === '' ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || n.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || n.priority === priorityFilter;
    return matchesSearch && matchesCategory && matchesPriority;
  });

  const unreadByCategory = getUnreadByCategory();

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPriorityFilter('all');
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || priorityFilter !== 'all';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Card>
          <CardContent className="p-0">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 m-4" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificaties</h1>
          <p className="text-muted-foreground">
            Alle meldingen en alerts op één plek
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Alles gelezen ({unreadCount})
            </Button>
          )}
          {notifications.some(n => n.read_at) && (
            <Button variant="outline" onClick={deleteAllRead}>
              <Trash2 className="h-4 w-4 mr-2" />
              Gelezen verwijderen
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notifications.length}</p>
                <p className="text-xs text-muted-foreground">Totaal</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Ongelezen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.priority === 'high').length}
                </p>
                <p className="text-xs text-muted-foreground">Hoog</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.priority === 'urgent').length}
                </p>
                <p className="text-xs text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.read_at).length}
                </p>
                <p className="text-xs text-muted-foreground">Gelezen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek in notificaties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as NotificationCategory | 'all')}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {NOTIFICATION_CONFIG.map(config => (
                  <SelectItem key={config.category} value={config.category}>
                    {config.label}
                    {unreadByCategory[config.category] && (
                      <span className="ml-2 text-muted-foreground">
                        ({unreadByCategory[config.category]})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as NotificationPriority | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioriteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle prioriteiten</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">Hoog</SelectItem>
                <SelectItem value="medium">Normaal</SelectItem>
                <SelectItem value="low">Laag</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Wis filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications list */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>
            {hasActiveFilters ? `${filteredNotifications.length} resultaten` : 'Alle notificaties'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Geen notificaties gevonden</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? 'Probeer andere zoektermen of filters'
                  : 'Je bent helemaal bij!'}
              </p>
            </div>
          ) : (
            <div>
              {filteredNotifications.map(notification => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

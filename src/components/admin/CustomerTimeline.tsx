import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  ShoppingBag, Mail, MailOpen, MousePointerClick, Heart, 
  MessageSquare, Award, Store, Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerTimeline, type TimelineEvent } from '@/hooks/useCustomerTimeline';
import { cn } from '@/lib/utils';

const EVENT_CONFIG: Record<TimelineEvent['type'], { icon: typeof ShoppingBag; color: string }> = {
  order: { icon: ShoppingBag, color: 'bg-blue-500' },
  email_sent: { icon: Mail, color: 'bg-gray-400' },
  email_opened: { icon: MailOpen, color: 'bg-green-500' },
  email_clicked: { icon: MousePointerClick, color: 'bg-emerald-600' },
  wishlist: { icon: Heart, color: 'bg-pink-500' },
  pos: { icon: Store, color: 'bg-purple-500' },
  message: { icon: MessageSquare, color: 'bg-orange-500' },
  loyalty: { icon: Award, color: 'bg-yellow-500' },
  registration: { icon: Clock, color: 'bg-indigo-500' },
  login: { icon: Clock, color: 'bg-slate-400' },
};

interface CustomerTimelineProps {
  customerId: string;
}

export function CustomerTimeline({ customerId }: CustomerTimelineProps) {
  const { data: events, isLoading } = useCustomerTimeline(customerId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nog geen activiteit geregistreerd</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const dateKey = format(new Date(event.timestamp), 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) ?? [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
        <div key={dateKey}>
          <div className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
            {format(new Date(dateKey), 'EEEE d MMMM yyyy', { locale: nl })}
          </div>
          <div className="relative pl-6 border-l-2 border-muted space-y-4">
            {dayEvents.map(event => {
              const config = EVENT_CONFIG[event.type];
              const Icon = config.icon;
              return (
                <div key={event.id} className="relative flex gap-3">
                  {/* Dot on timeline */}
                  <div className={cn(
                    'absolute -left-[calc(0.75rem+1px)] w-6 h-6 rounded-full flex items-center justify-center',
                    config.color
                  )}>
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 ml-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(event.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

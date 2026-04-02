import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Eye, ShoppingCart, Mail, MousePointer, Search, Heart,
  Globe, Package, Activity, Clock, BarChart3, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerEvents, type CustomerEvent, type EngagementSummary } from '@/hooks/useCustomerEvents';

interface CustomerActivityTabProps {
  customerId?: string;
  storefrontCustomerId?: string;
}

const EVENT_CONFIG: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  page_view: { icon: Globe, label: 'Pagina bekeken', color: 'text-blue-500' },
  product_view: { icon: Eye, label: 'Product bekeken', color: 'text-green-500' },
  add_to_cart: { icon: ShoppingCart, label: 'Aan winkelwagen', color: 'text-orange-500' },
  remove_from_cart: { icon: ShoppingCart, label: 'Uit winkelwagen', color: 'text-red-400' },
  checkout_start: { icon: Package, label: 'Checkout gestart', color: 'text-purple-500' },
  search: { icon: Search, label: 'Gezocht', color: 'text-amber-500' },
  wishlist_add: { icon: Heart, label: 'Aan verlanglijst', color: 'text-pink-500' },
  email_open: { icon: Mail, label: 'Email geopend', color: 'text-sky-500' },
  email_click: { icon: MousePointer, label: 'Email link geklikt', color: 'text-indigo-500' },
  purchase: { icon: Package, label: 'Bestelling geplaatst', color: 'text-emerald-600' },
};

function EngagementOverview({ engagement }: { engagement: EngagementSummary }) {
  const stats = [
    { label: 'Sessies', value: engagement.totalSessions, icon: Users },
    { label: "Pagina's", value: engagement.totalPageViews, icon: Globe },
    { label: 'Producten', value: engagement.totalProductViews, icon: Eye },
    { label: 'Winkelwagen', value: engagement.totalCartAdds, icon: ShoppingCart },
    { label: 'Emails geopend', value: engagement.totalEmailOpens, icon: Mail },
    { label: 'Gem. tijd', value: engagement.avgTimeOnSite > 0 ? `${Math.floor(engagement.avgTimeOnSite / 60)}m ${engagement.avgTimeOnSite % 60}s` : '-', icon: Clock },
  ];

  const scoreColor = engagement.engagementScore > 50 ? 'text-green-600' : engagement.engagementScore > 20 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Engagement
          </CardTitle>
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${scoreColor}`} />
            <span className={`text-lg font-bold ${scoreColor}`}>{engagement.engagementScore}</span>
            <span className="text-xs text-muted-foreground">score</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventItem({ event }: { event: CustomerEvent }) {
  const config = EVENT_CONFIG[event.event_type] || { icon: Activity, label: event.event_type, color: 'text-muted-foreground' };
  const Icon = config.icon;
  const data = event.event_data || {};

  let detail = '';
  if (event.event_type === 'page_view') {
    detail = (data.page_url as string) || event.page_url || '';
    if (data.duration_seconds && !data.is_exit) {
      const dur = data.duration_seconds as number;
      detail += ` — ${Math.floor(dur / 60)}m ${dur % 60}s`;
    }
  } else if (event.event_type === 'product_view' || event.event_type === 'add_to_cart' || event.event_type === 'remove_from_cart') {
    detail = (data.product_name as string) || (data.product_id as string) || '';
  } else if (event.event_type === 'search') {
    detail = `"${data.search_query || data.query || ''}"`;
  } else if (event.event_type === 'email_open' || event.event_type === 'email_click') {
    detail = (data.campaign_name as string) || (data.subject as string) || '';
    if (event.event_type === 'email_click' && data.link_url) {
      detail += ` → ${data.link_url}`;
    }
  } else if (event.event_type === 'purchase') {
    detail = `${data.order_number || ''} — €${data.total || ''}`;
  }

  // Filter out exit-type page_views (duration tracking artifacts)
  if (event.event_type === 'page_view' && data.is_exit) return null;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        {detail && (
          <p className="text-xs text-muted-foreground truncate">{detail}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(event.created_at), 'd MMM HH:mm', { locale: nl })}
      </span>
    </div>
  );
}

export function CustomerActivityTab({ customerId, storefrontCustomerId }: CustomerActivityTabProps) {
  const { events, engagement, isLoading } = useCustomerEvents(customerId, storefrontCustomerId);
  const [filter, setFilter] = useState<string>('all');

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.event_type === filter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EngagementOverview engagement={engagement} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activiteiten timeline</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle events</SelectItem>
                <SelectItem value="page_view">Pagina bekeken</SelectItem>
                <SelectItem value="product_view">Product bekeken</SelectItem>
                <SelectItem value="add_to_cart">Winkelwagen</SelectItem>
                <SelectItem value="search">Zoekopdrachten</SelectItem>
                <SelectItem value="email_open">Email opens</SelectItem>
                <SelectItem value="email_click">Email clicks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nog geen activiteiten geregistreerd</p>
              <p className="text-sm mt-1">Activiteiten verschijnen hier zodra de klant de webshop bezoekt</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {filteredEvents.map(event => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

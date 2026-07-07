import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  Package, Clock, Truck, CheckCircle, XCircle, RotateCcw, PackageOpen,
  Search, Banknote, MailCheck, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'destructive' | 'return' | 'financial';

interface Event {
  key: string;
  at: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: Variant;
  tag?: { label: string; to?: string };
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Aangevraagd',
  registered: 'Geregistreerd',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  label_sent: 'Retourlabel verstuurd',
  shipped_by_customer: 'Verzonden door klant',
  shipped: 'Onderweg',
  in_transit: 'Onderweg',
  received: 'Ontvangen in magazijn',
  inspecting: 'Onder inspectie',
  inspected: 'Geïnspecteerd',
  awaiting_refund: 'Wacht op terugbetaling',
  refunded: 'Terugbetaald',
  completed: 'Afgerond',
  closed: 'Gesloten',
  cancelled: 'Geannuleerd',
  exchanged: 'Omgeruild',
  repaired: 'Hersteld',
  approved_for_refund: 'Refund goedgekeurd',
  initiated: 'Refund gestart',
  failed: 'Refund mislukt',
  denied: 'Refund geweigerd',
  pending: 'In afwachting',
  not_applicable: 'Niet van toepassing',
};

const iconFor = (to: string, flow: string | null): React.ReactNode => {
  if (flow === 'financial') return <Banknote className="h-4 w-4" />;
  switch (to) {
    case 'approved': return <CheckCircle className="h-4 w-4" />;
    case 'rejected':
    case 'cancelled':
    case 'failed':
    case 'denied': return <XCircle className="h-4 w-4" />;
    case 'label_sent': return <MailCheck className="h-4 w-4" />;
    case 'shipped':
    case 'in_transit':
    case 'shipped_by_customer': return <Truck className="h-4 w-4" />;
    case 'received': return <PackageOpen className="h-4 w-4" />;
    case 'inspecting':
    case 'inspected': return <Search className="h-4 w-4" />;
    case 'refunded':
    case 'completed':
    case 'closed': return <CheckCircle className="h-4 w-4" />;
    default: return <RotateCcw className="h-4 w-4" />;
  }
};

interface Props {
  order: {
    id: string;
    created_at: string;
    updated_at: string;
    status: string;
    shipped_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
    tracking_number?: string | null;
    carrier?: string | null;
  };
}

export function OrderReturnTimeline({ order }: Props) {
  const { data: returnEvents = [] } = useQuery({
    queryKey: ['order-return-timeline', order.id],
    queryFn: async () => {
      const { data: returns, error } = await supabase
        .from('returns')
        .select('id, rma_number, status, created_at, registration_date, approved_at, label_sent_at, received_at, refund_completed_at, refund_initiated_at, refund_failed_at, refund_failure_reason, label_last_event_at, label_last_status, label_carrier, label_tracking_number')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!returns || returns.length === 0) return [];

      const ids = returns.map((r: any) => r.id);
      const { data: history } = await supabase
        .from('return_status_history')
        .select('id, return_id, from_status, to_status, notes, flow_type, created_at')
        .in('return_id', ids)
        .order('created_at', { ascending: true });

      const rmaMap = new Map<string, string | null>();
      returns.forEach((r: any) => rmaMap.set(r.id, r.rma_number));

      const events: Event[] = [];

      returns.forEach((r: any) => {
        const rma = r.rma_number || r.id.slice(0, 8);
        events.push({
          key: `r-${r.id}-created`,
          at: r.registration_date || r.created_at,
          title: `Retour aangemaakt`,
          subtitle: r.rma_number ? `RMA ${r.rma_number}` : undefined,
          icon: <RotateCcw className="h-4 w-4" />,
          variant: 'return',
          tag: { label: `Retour ${rma}`, to: `/admin/returns/${r.id}` },
        });
      });

      (history || []).forEach((h: any) => {
        const rma = rmaMap.get(h.return_id) || h.return_id.slice(0, 8);
        events.push({
          key: `h-${h.id}`,
          at: h.created_at,
          title: STATUS_LABEL[h.to_status] || h.to_status,
          subtitle: h.notes || undefined,
          icon: iconFor(h.to_status, h.flow_type),
          variant: h.flow_type === 'financial' ? 'financial' : 'return',
          tag: { label: `Retour ${rma}`, to: `/admin/returns/${h.return_id}` },
        });
      });

      return events;
    },
  });

  const orderEvents: Event[] = [];
  orderEvents.push({
    key: 'o-created',
    at: order.created_at,
    title: 'Bestelling geplaatst',
    icon: <Package className="h-4 w-4" />,
  });
  if (order.status !== 'pending' && order.status !== 'cancelled' && order.updated_at !== order.created_at) {
    orderEvents.push({
      key: 'o-processing',
      at: order.updated_at,
      title: 'In behandeling genomen',
      icon: <Clock className="h-4 w-4" />,
    });
  }
  if (order.shipped_at) {
    orderEvents.push({
      key: 'o-shipped',
      at: order.shipped_at,
      title: order.tracking_number ? `Verzonden via ${order.carrier || 'carrier'}` : 'Verzonden',
      subtitle: order.tracking_number ? `Track: ${order.tracking_number}` : undefined,
      icon: <Truck className="h-4 w-4" />,
    });
  }
  if (order.delivered_at) {
    orderEvents.push({
      key: 'o-delivered',
      at: order.delivered_at,
      title: 'Afgeleverd',
      icon: <CheckCircle className="h-4 w-4" />,
    });
  }
  if (order.cancelled_at) {
    orderEvents.push({
      key: 'o-cancelled',
      at: order.cancelled_at,
      title: 'Geannuleerd',
      icon: <XCircle className="h-4 w-4" />,
      variant: 'destructive',
    });
  }

  const all = [...orderEvents, ...returnEvents]
    .filter((e) => !!e.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tijdlijn
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {all.map((e) => (
            <TimelineRow key={e.key} event={e} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineRow({ event }: { event: Event }) {
  const variantClasses: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    return: 'bg-amber-500 text-white',
    financial: 'bg-emerald-600 text-white',
  };
  const v = event.variant || 'default';
  return (
    <div className="flex gap-3">
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', variantClasses[v])}>
        {event.icon}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{event.title}</p>
          {event.tag && (
            event.tag.to ? (
              <Link to={event.tag.to}>
                <Badge variant="outline" className="text-[10px] hover:bg-accent">{event.tag.label}</Badge>
              </Link>
            ) : (
              <Badge variant="outline" className="text-[10px]">{event.tag.label}</Badge>
            )
          )}
        </div>
        {event.subtitle && (
          <p className="text-xs text-muted-foreground break-words">{event.subtitle}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {format(new Date(event.at), 'dd MMM yyyy · HH:mm', { locale: nl })}
        </p>
      </div>
    </div>
  );
}

// unused imports kept for icon variety
void AlertTriangle;
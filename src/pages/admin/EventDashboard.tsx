// EVENT-DASHBOARD — event-centrisch overzicht (puur additief, leest bestaande data).
//
// Data-laag: directe client-queries. RLS op event_details/ticket_instances/orders
// dwingt tenant-isolatie af op DB-niveau; daarbovenop filteren we altijd expliciet
// op tenant_id. Geen SECURITY DEFINER RPC (die zou RLS omzeilen).
//
// MIDDERNACHT-PRINCIPE: datum-ondergrens (vandaag - 2 dagen), geen "vandaag"-afkap —
// events lopen over middernacht (crawl 21:00 → 03:00).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Check, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EventCardActions } from '@/components/admin/events/EventCardActions';

interface EventRow {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  meeting_point: string | null;
  capacity: number;
  min_attendees: number;
  product_name: string;
}

interface EventStats {
  sold: number;
  checked_in: number;
  refunded: number;
  /** Alle ticket_instances, ongeacht status — blokkeert verwijderen via de FK. */
  total: number;
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');

const statusLabel: Record<string, string> = {
  scheduled: 'Gepland',
  confirmed: 'Bevestigd',
  cancelled: 'Geannuleerd',
  completed: 'Afgerond',
  skipped: 'Overgeslagen',
  merged: 'Samengevoegd',
};

function EventStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'confirmed' ? 'default'
      : status === 'cancelled' || status === 'skipped' ? 'destructive'
      : 'secondary';
  return <Badge variant={variant}>{statusLabel[status] ?? status}</Badge>;
}

export default function EventDashboard() {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();

  // Events binnen het venster (middernacht-veilige ondergrens).
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['event-dashboard-events', currentTenant?.id],
    queryFn: async (): Promise<EventRow[]> => {
      if (!currentTenant) return [];
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, end_time, status, location_name, meeting_point, capacity, min_attendees, products(name)')
        .eq('tenant_id', currentTenant.id)
        .gte('event_date', since)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id as string,
        event_date: e.event_date as string,
        start_time: e.start_time as string,
        end_time: (e.end_time as string | null) ?? null,
        status: e.status as string,
        location_name: (e.location_name as string | null) ?? null,
        meeting_point: (e.meeting_point as string | null) ?? null,
        capacity: (e.capacity as number) ?? 0,
        min_attendees: (e.min_attendees as number) ?? 0,
        product_name: ((e as { products?: { name?: string } }).products?.name) ?? 'Event',
      }));
    },
    enabled: !!currentTenant,
  });

  const eventIds = useMemo(() => events.map((e) => e.id).sort(), [events]);

  // ÉÉN select voor alle events in het venster; client-side aggregeren (geen N+1).
  const { data: stats = {} } = useQuery({
    queryKey: ['event-dashboard-stats', currentTenant?.id, eventIds.join(',')],
    queryFn: async (): Promise<Record<string, EventStats>> => {
      if (!currentTenant || eventIds.length === 0) return {};
      const { data, error } = await supabase
        .from('ticket_instances')
        .select('event_detail_id, status')
        .eq('tenant_id', currentTenant.id)
        .in('event_detail_id', eventIds);
      if (error) throw error;
      const out: Record<string, EventStats> = {};
      for (const row of data ?? []) {
        const key = (row as { event_detail_id: string | null }).event_detail_id;
        if (!key) continue;
        const status = (row as { status: string }).status;
        const s = (out[key] ??= { sold: 0, checked_in: 0, refunded: 0, total: 0 });
        s.total += 1;
        if (status === 'valid' || status === 'checked_in') s.sold += 1;
        if (status === 'checked_in') s.checked_in += 1;
        if (status === 'refunded' || status === 'cancelled') s.refunded += 1;
      }
      return out;
    },
    enabled: !!currentTenant && eventIds.length > 0,
    refetchInterval: 30000,
  });

  // Blokkerende kinderen per event. GEEN enkele FK naar event_details heeft
  // ON DELETE CASCADE, dus elk kind laat een DELETE stuklopen op een 23503.
  // Drie selects over de hele set ineens (geen N+1 per kaart); tickets komen uit
  // de stats-query hierboven, en ticket_scans hoeft niet apart geteld te worden
  // omdat ticket_scans.ticket_instance_id NOT NULL naar ticket_instances wijst.
  const { data: childCounts = {} } = useQuery({
    queryKey: ['event-dashboard-child-counts', currentTenant?.id, eventIds.join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!currentTenant || eventIds.length === 0) return {};
      const tables = ['event_ticket_types', 'event_zones', 'event_scanner_access'] as const;
      const results = await Promise.all(
        tables.map((table) =>
          supabase
            .from(table)
            .select('event_detail_id')
            .eq('tenant_id', currentTenant.id)
            .in('event_detail_id', eventIds),
        ),
      );
      const out: Record<string, number> = {};
      results.forEach((res, i) => {
        if (res.error) throw new Error(`${tables[i]}: ${res.error.message}`);
        for (const row of res.data ?? []) {
          const key = (row as { event_detail_id: string | null }).event_detail_id;
          if (key) out[key] = (out[key] ?? 0) + 1;
        }
      });
      return out;
    },
    enabled: !!currentTenant && eventIds.length > 0,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> Events
        </h1>
        <p className="text-sm text-muted-foreground">
          Stand van je events: verkochte tickets, check-ins en bezetting.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Geen aankomende events gevonden. Voeg datums toe bij een ticketproduct.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => {
            const s = stats[e.id] ?? { sold: 0, checked_in: 0, refunded: 0, total: 0 };
            // Verwijderen kan alleen als er nul kinderen zijn: tickets in welke
            // status dan ook, tickettypes, zones of scanner-toegangen.
            const deleteBlocked = s.total > 0 || (childCounts[e.id] ?? 0) > 0;
            const pct = e.capacity > 0 ? Math.min(100, Math.round((s.sold / e.capacity) * 100)) : 0;
            const minReached = e.min_attendees > 0 && s.sold >= e.min_attendees;
            return (
              <Card
                key={e.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => navigate(`/admin/events/${e.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base break-words">{e.product_name}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <EventStatusBadge status={e.status} />
                      <EventCardActions
                        eventId={e.id}
                        status={e.status}
                        eventDate={e.event_date}
                        startTime={e.start_time}
                        endTime={e.end_time}
                        sold={s.sold}
                        deleteBlocked={deleteBlocked}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(e.event_date)} · {fmtTime(e.start_time)}
                    {e.end_time ? `–${fmtTime(e.end_time)}` : ''}
                  </p>
                  {(e.location_name || e.meeting_point) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {e.location_name || e.meeting_point}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Ticket className="h-3.5 w-3.5" /> Verkocht
                    </span>
                    <span className="font-medium tabular-nums">{s.sold} / {e.capacity}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {s.checked_in} ingecheckt
                    </span>
                    {e.min_attendees > 0 && (
                      <span className={minReached ? 'text-primary font-medium' : ''}>
                        {minReached
                          ? `${s.sold}/${e.min_attendees} minimum gehaald ✓`
                          : `${s.sold}/${e.min_attendees} minimum`}
                      </span>
                    )}
                  </div>
                  {s.refunded > 0 && (
                    <p className="text-xs text-muted-foreground">{s.refunded} terugbetaald</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

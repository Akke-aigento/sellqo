// EVENT-DASHBOARD — event-centrisch overzicht (puur additief, leest bestaande data).
//
// Data-laag: directe client-queries. RLS op event_details/ticket_instances/orders
// dwingt tenant-isolatie af op DB-niveau; daarbovenop filteren we altijd expliciet
// op tenant_id. Geen SECURITY DEFINER RPC (die zou RLS omzeilen).
//
// MIDDERNACHT-PRINCIPE: datum-ondergrens (vandaag - 2 dagen), geen "vandaag"-afkap —
// events lopen over middernacht (crawl 21:00 → 03:00).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Users, Check, ArrowLeft, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

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
}

interface Attendee {
  id: string;
  seq: number | null;
  attendee_name: string | null;
  status: string;
  checked_in_at: string | null;
  order_number: string | null;
  customer_email: string | null;
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');
const fmtStamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';

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

function TicketStatusBadge({ status }: { status: string }) {
  if (status === 'checked_in') return <Badge variant="default">Ingecheckt</Badge>;
  if (status === 'refunded' || status === 'cancelled') return <Badge variant="destructive">Terugbetaald</Badge>;
  return <Badge variant="secondary">Geldig</Badge>;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

export default function EventDashboard() {
  const { currentTenant } = useTenant();
  const [selected, setSelected] = useState<EventRow | null>(null);

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
        const s = (out[key] ??= { sold: 0, checked_in: 0, refunded: 0 });
        if (status === 'valid' || status === 'checked_in') s.sold += 1;
        if (status === 'checked_in') s.checked_in += 1;
        if (status === 'refunded' || status === 'cancelled') s.refunded += 1;
      }
      return out;
    },
    enabled: !!currentTenant && eventIds.length > 0,
    refetchInterval: 30000,
  });

  // Deelnemerslijst van het gekozen event.
  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ['event-dashboard-attendees', currentTenant?.id, selected?.id],
    queryFn: async (): Promise<Attendee[]> => {
      if (!currentTenant || !selected) return [];
      const { data, error } = await supabase
        .from('ticket_instances')
        .select('id, seq, attendee_name, status, checked_in_at, orders(order_number, customer_email)')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', selected.id)
        .order('seq', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((t) => {
        const order = (t as { orders?: { order_number?: string | null; customer_email?: string | null } }).orders;
        return {
          id: t.id as string,
          seq: (t.seq as number | null) ?? null,
          attendee_name: (t.attendee_name as string | null) ?? null,
          status: t.status as string,
          checked_in_at: (t.checked_in_at as string | null) ?? null,
          order_number: order?.order_number ?? null,
          customer_email: order?.customer_email ?? null,
        };
      });
    },
    enabled: !!currentTenant && !!selected,
  });

  if (selected) {
    const s = stats[selected.id] ?? { sold: 0, checked_in: 0, refunded: 0 };
    const free = Math.max(0, selected.capacity - s.sold);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Terug
          </Button>
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-bold break-words">{selected.product_name}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtDate(selected.event_date)} · {fmtTime(selected.start_time)}
            {selected.end_time ? `–${fmtTime(selected.end_time)}` : ''}
            {selected.location_name ? ` · ${selected.location_name}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Capaciteit" value={selected.capacity} />
          <StatTile label="Verkocht" value={s.sold} />
          <StatTile label="Ingecheckt" value={s.checked_in} />
          <StatTile label="Plaatsen vrij" value={free} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Deelnemers ({attendees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendeesLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen tickets verkocht voor deze datum.</p>
            ) : (
              <>
                {/* Mobiel: kaarten */}
                <div className="space-y-2 md:hidden">
                  {attendees.map((a) => (
                    <div key={a.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm break-words">
                          {a.attendee_name || a.customer_email || '—'}
                        </span>
                        <TicketStatusBadge status={a.status} />
                      </div>
                      <p className="text-xs text-muted-foreground break-all">
                        {a.order_number ?? '—'}{a.customer_email ? ` · ${a.customer_email}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{a.seq ?? '—'}{a.checked_in_at ? ` · ingecheckt ${fmtStamp(a.checked_in_at)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Desktop: tabel */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="py-2 pr-3 font-medium">Koper</th>
                        <th className="py-2 pr-3 font-medium">Deelnemer</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 font-medium">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 tabular-nums">{a.seq ?? '—'}</td>
                          <td className="py-2 pr-3">
                            <div className="font-medium">{a.order_number ?? '—'}</div>
                            <div className="text-xs text-muted-foreground break-all">{a.customer_email ?? '—'}</div>
                          </td>
                          <td className="py-2 pr-3">{a.attendee_name || '—'}</td>
                          <td className="py-2 pr-3"><TicketStatusBadge status={a.status} /></td>
                          <td className="py-2">{a.checked_in_at ? fmtStamp(a.checked_in_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
            const s = stats[e.id] ?? { sold: 0, checked_in: 0, refunded: 0 };
            const pct = e.capacity > 0 ? Math.min(100, Math.round((s.sold / e.capacity) * 100)) : 0;
            const minReached = e.min_attendees > 0 && s.sold >= e.min_attendees;
            return (
              <Card
                key={e.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => setSelected(e)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base break-words">{e.product_name}</CardTitle>
                    <EventStatusBadge status={e.status} />
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

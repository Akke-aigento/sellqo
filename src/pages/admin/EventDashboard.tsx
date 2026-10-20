// EVENT-DASHBOARD — event-centrisch overzicht (puur additief, leest bestaande data).
//
// Data-laag: directe client-queries. RLS op event_details/ticket_instances/orders
// dwingt tenant-isolatie af op DB-niveau; daarbovenop filteren we altijd expliciet
// op tenant_id. Geen SECURITY DEFINER RPC (die zou RLS omzeilen).
//
// MIDDERNACHT-PRINCIPE: datum-ondergrens (vandaag - 2 dagen), geen "vandaag"-afkap —
// events lopen over middernacht (crawl 21:00 → 03:00).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Armchair, CalendarDays, Coins, DoorOpen, Layers, MapPin, Check, Ticket, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useBusinessModules } from '@/hooks/useBusinessModules';
import { ModuleOffCard } from '@/components/admin/ModuleOffCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EventCardActions } from '@/components/admin/events/EventCardActions';
import { DoorSettingsDialog } from '@/components/admin/events/DoorSettingsDialog';
import { EventReadinessBadge } from '@/components/admin/events/EventReadinessBadge';
import { eventReadiness } from '@/lib/eventReadiness';
import { useEventTicketTypesByEvent } from '@/hooks/useEventReadiness';

interface EventRow {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  meeting_point: string | null;
  /** null = onbeperkt. */
  capacity: number | null;
  min_attendees: number;
  product_name: string;
  product_active: boolean;
  product_hidden: boolean;
}

interface EventStats {
  sold: number;
  checked_in: number;
  refunded: number;
  /** Alle ticket_instances, ongeacht status — blokkeert verwijderen via de FK. */
  total: number;
}

const fmtDate = (d: string, lng?: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(lng, {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');

function EventStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variant =
    status === 'confirmed' ? 'default'
      : status === 'cancelled' || status === 'skipped' ? 'destructive'
      : 'secondary';
  return <Badge variant={variant}>{t(`events.status.${status}`, status)}</Badge>;
}

/** Dagen terugkijken. Uit = alleen aankomend, met marge voor events die over
 *  middernacht lopen (een crawl van gisteren 21:00 tot 03:00 hoort nog bij nu).
 *  Aan = een half jaar historie. */
const PAST_WINDOW_DAYS = { upcoming: 1, past: 180 } as const;

export default function EventDashboard() {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showPast, setShowPast] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const eventsModule = useBusinessModules().has('events');

  // Events binnen het venster (middernacht-veilige ondergrens).
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['event-dashboard-events', currentTenant?.id, showPast],
    queryFn: async (): Promise<EventRow[]> => {
      if (!currentTenant) return [];
      const days = showPast ? PAST_WINDOW_DAYS.past : PAST_WINDOW_DAYS.upcoming;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, end_time, status, location_name, meeting_point, capacity, min_attendees, products(name, is_active, hide_from_storefront)')
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
        capacity: (e.capacity as number | null) ?? null,
        min_attendees: (e.min_attendees as number) ?? 0,
        product_name: ((e as { products?: { name?: string } }).products?.name) ?? 'Event',
        product_active: ((e as { products?: { is_active?: boolean } }).products?.is_active) !== false,
        product_hidden: ((e as { products?: { hide_from_storefront?: boolean } }).products?.hide_from_storefront) === true,
      }));
    },
    enabled: !!currentTenant,
  });

  const eventIds = useMemo(() => events.map((e) => e.id).sort(), [events]);
  const { data: ticketTypesByEvent = {}, isLoading: readinessLoading } = useEventTicketTypesByEvent(eventIds);

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

  if (!eventsModule) return <ModuleOffCard module="events" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Events
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('events.wizard.dashboard_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end sm:shrink-0 sm:pt-1">
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/events/venues')}><Armchair className="mr-1 h-4 w-4" />{t('events.venues.title')}</Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/events/bundles')}><Layers className="mr-1 h-4 w-4" />{t('events.bundles.title')}</Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/events/tokens')}><Coins className="mr-1 h-4 w-4" />{t('events.tokens.title')}</Button>
          <Button size="sm" variant="outline" onClick={() => setDoorOpen(true)}><DoorOpen className="mr-1 h-4 w-4" />{t('door.settings.button')}</Button>
          <Button size="sm" onClick={() => navigate('/admin/events/new')}><Plus className="mr-1 h-4 w-4" />{t('events.wizard.new_event')}</Button>
          <Switch id="show-past" checked={showPast} onCheckedChange={setShowPast} />
          <Label htmlFor="show-past" className="text-sm cursor-pointer whitespace-nowrap">
            {t('events.dashboard.showPast', 'Toon afgelopen')}
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <p>{t('events.wizard.empty')}</p>
            <Button onClick={() => navigate('/admin/events/new')}><Plus className="mr-1 h-4 w-4" />{t('events.wizard.first_event')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => {
            const s = stats[e.id] ?? { sold: 0, checked_in: 0, refunded: 0, total: 0 };
            // Verwijderen kan alleen als er nul kinderen zijn: tickets in welke
            // status dan ook, tickettypes, zones of scanner-toegangen.
            // EVENT-WORKSPACE-1: alleen tickets blokkeren; configuratie ruimt de delete zelf op.
            const deleteBlocked = s.total > 0;
            const unlimited = e.capacity == null;
            const pct = e.capacity != null && e.capacity > 0 ? Math.min(100, Math.round((s.sold / e.capacity) * 100)) : 0;
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
                  <EventReadinessBadge
                    className="self-start"
                    loading={readinessLoading}
                    readiness={eventReadiness(e, ticketTypesByEvent[e.id] ?? [], { productActive: e.product_active, productHidden: e.product_hidden })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(e.event_date, i18n.language)} · {fmtTime(e.start_time)}
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
                      <Ticket className="h-3.5 w-3.5" /> {t('events.stats.sold')}
                    </span>
                    <span className="font-medium tabular-nums">{s.sold} / {unlimited ? '\u221E' : e.capacity}</span>
                  </div>
                  {/* Onbeperkt: geen balk (een lege balk suggereert 0 %). */}
                  {!unlimited && <Progress value={pct} className="h-2" />}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {t('events.dashboard.checkedIn', { n: s.checked_in })}
                    </span>
                    {e.min_attendees > 0 && (
                      <span className={minReached ? 'text-primary font-medium' : ''}>
                        {minReached
                          ? t('events.dashboard.minimumReached', { sold: s.sold, min: e.min_attendees })
                          : t('events.dashboard.minimumProgress', { sold: s.sold, min: e.min_attendees })}
                      </span>
                    )}
                  </div>
                  {s.refunded > 0 && (
                    <p className="text-xs text-muted-foreground">{t('events.dashboard.refunded', { n: s.refunded })}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <DoorSettingsDialog open={doorOpen} onOpenChange={setDoorOpen} />
    </div>
  );
}

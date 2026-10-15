// TICKET-1 fase 5 — check-in PWA (QR-scannen aan de deur).
//
// MIDDERNACHT-PRINCIPE: de host kiest BEWUST een event_detail. Er wordt nergens
// "vandaag" afgeleid — events lopen over middernacht (crawl 21:00 → 03:00).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DoorScanner, type DoorAdapter, type DoorScanResult, type DoorSearchHit } from '@/components/door/DoorScanner';
import { useDoorAppShell } from '@/hooks/useDoorAppShell';

interface EventOption {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  product_name: string;
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');

export default function TicketCheckin() {
  const { currentTenant } = useTenant();
  const { roles, isPlatformAdmin } = useAuth();
  const { t } = useTranslation();
  // Wie de scanner vanaf hier op zijn beginscherm zet, krijgt de app "SellQo Deur".
  useDoorAppShell();

  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // host = tenant_admin voor deze tenant OF platform_admin. staff = crew.
  const isHost = useMemo(() => {
    if (isPlatformAdmin) return true;
    return (roles ?? []).some(
      (r) => (r.role as AppRole) === 'tenant_admin' && (!r.tenant_id || r.tenant_id === currentTenant?.id),
    );
  }, [roles, isPlatformAdmin, currentTenant?.id]);

  // Lopende/eerstvolgende events — bewuste keuze door de host, geen auto-selectie.
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['checkin-events', currentTenant?.id],
    queryFn: async (): Promise<EventOption[]> => {
      if (!currentTenant) return [];
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, end_time, status, location_name, products(name)')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('event_date', since)
        .order('event_date', { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id as string,
        event_date: e.event_date as string,
        start_time: e.start_time as string,
        end_time: (e.end_time as string | null) ?? null,
        status: e.status as string,
        location_name: (e.location_name as string | null) ?? null,
        product_name: ((e as { products?: { name?: string } }).products?.name) ?? 'Event',
      }));
    },
    enabled: !!currentTenant,
  });

  // Voorselectie via ?event=:id (bv. vanuit het event-dashboard "Scanner openen").
  // Respecteert de bewuste-keuze-filosofie: selecteert alleen wanneer expliciet
  // via de query-param binnengekomen, niet automatisch.
  //
  // Bewust LOS van de kieslijst hierboven: die filtert op scheduled/confirmed, en
  // dat blijft zo. Een afgelopen (completed) event staat er dus niet in, terwijl
  // nascannen of controleren daar wel zinvol is. Daarom halen we het gevraagde
  // event apart op, ongeacht status.
  const wantedEventId = searchParams.get('event');
  const preselectDoneRef = useRef(false);

  const { data: preselectEvent } = useQuery({
    queryKey: ['checkin-preselect-event', currentTenant?.id, wantedEventId],
    queryFn: async (): Promise<EventOption | null> => {
      if (!currentTenant || !wantedEventId) return null;
      const { data, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, end_time, status, location_name, products(name)')
        .eq('id', wantedEventId)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        event_date: data.event_date as string,
        start_time: data.start_time as string,
        end_time: (data.end_time as string | null) ?? null,
        status: data.status as string,
        location_name: (data.location_name as string | null) ?? null,
        product_name: ((data as { products?: { name?: string } }).products?.name) ?? 'Event',
      };
    },
    enabled: !!currentTenant && !!wantedEventId,
  });

  useEffect(() => {
    if (preselectDoneRef.current || !wantedEventId || !preselectEvent) return;
    preselectDoneRef.current = true;

    // Geannuleerd event: niet openen. Scannen heeft geen zin en zou de indruk
    // wekken dat de deur nog loopt. Terugvallen op de normale kieslijst.
    if (preselectEvent.status === 'cancelled') {
      toast.warning(t('events.checkin.preselectCancelled', 'Dit event is geannuleerd, scannen heeft geen zin.'));
    } else {
      setSelectedEvent(preselectEvent);
    }

    // Param opruimen zodat een handmatige deselectie niet meteen weer
    // overschreven wordt.
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: true });
  }, [wantedEventId, preselectEvent, searchParams, setSearchParams, t]);
  // EVENT-SCAN-1: zelfde schermvullende scanner als de crew-scanlink (SellQo Deur),
  // met de JWT van de ingelogde gebruiker en het bewust gekozen event.
  const adapter = useMemo<DoorAdapter | null>(() => {
    if (!selectedEvent) return null;
    const eventId = selectedEvent.id;
    const call = async <T,>(fn: string, body: Record<string, unknown>): Promise<T> => {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      return data as T;
    };
    return {
      scan: (qr) => call<DoorScanResult>('ticket-checkin', { qr_token: qr, event_detail_id: eventId, action: 'checkin' }),
      undo: isHost ? (qr) => call<DoorScanResult>('ticket-checkin', { qr_token: qr, event_detail_id: eventId, action: 'undo' }) : undefined,
      stats: () => call<{ sold: number; inside: number }>('scanner-door', { action: 'stats', event_detail_id: eventId })
        .then((r) => ({ sold: r.sold, inside: r.inside })),
      search: (q) => call<{ results: DoorSearchHit[] }>('scanner-door', { action: 'search', q, event_detail_id: eventId })
        .then((r) => r.results ?? []),
    };
  }, [selectedEvent, isHost]);

  // SCAN-APP-1 — de actieve scanlink van dit event, voor "als eigen app op je beginscherm".
  const { data: appToken } = useQuery({
    queryKey: ['checkin-app-link', currentTenant?.id, selectedEvent?.id],
    queryFn: async (): Promise<string | null> => {
      if (!currentTenant || !selectedEvent) return null;
      const { data } = await (supabase as unknown as SupabaseClient)
        .from('event_scanner_access')
        .select('access_token, expires_at')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', selectedEvent.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      const live = ((data ?? []) as { access_token: string; expires_at: string | null }[])
        .find((r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now());
      return live?.access_token ?? null;
    },
    enabled: !!currentTenant && !!selectedEvent,
  });

  // --- Event-keuze ---
  if (!selectedEvent) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-semibold">{t('door.pick_title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('door.pick_text')}
        </p>
        {eventsLoading && <p className="text-sm text-muted-foreground">{t('door.loading_events')}</p>}
        {!eventsLoading && events.length === 0 && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            {t('door.no_events')}
          </CardContent></Card>
        )}
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEvent(e)}
              className="w-full text-left rounded-lg border bg-card p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(e.event_date)} · {fmtTime(e.start_time)}
                    {e.end_time ? `–${fmtTime(e.end_time)}` : ''}
                  </p>
                  {e.location_name && (
                    <p className="text-xs text-muted-foreground truncate">{e.location_name}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">{t(`events.status.${e.status}`, e.status)}</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DoorScanner
      title={selectedEvent.product_name}
      subtitle={`${fmtDate(selectedEvent.event_date)} · ${fmtTime(selectedEvent.start_time)}${selectedEvent.end_time ? `–${fmtTime(selectedEvent.end_time)}` : ''}`}
      adapter={adapter!}
      onBack={() => setSelectedEvent(null)}
      backLabel={t('door.switch_event')}
      appUrl={appToken ? `/scan/${appToken}` : undefined}
    />
  );
}

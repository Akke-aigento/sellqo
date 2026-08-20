// EVENT-SYSTEEM — dupliceer een bestaande event-datum naar een nieuwe datum/tijd.
//
// Kopieert de event_details-kernvelden (capaciteit, locatie, meeting_point, min_attendees,
// early-bird) én alle event_ticket_types van het origineel naar een nieuw event op een
// andere datum. Het nieuwe event krijgt status 'scheduled' (verkoopklaar). De bronwaarden
// worden VERS uit de DB gelezen (niet uit een dashboard-row), zodat capacity=NULL
// (ongelimiteerd) correct meegaat en niet per ongeluk als 0 gekopieerd wordt.
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

const DASHBOARD_EVENTS_KEY = ['event-dashboard-events'] as const;

/**
 * Ververst alle views die een event-mutatie kunnen tonen: het dashboard én de
 * detailpagina met al haar tabbladen.
 *
 * Let op de predicate. React-query matcht query-keys per element met deep equality
 * (`partialMatchKey`, query-core/utils.js:93), niet als string-prefix. De sub-queries
 * heten `event-detail-attendees`, `event-detail-ticket-types`, `event-detail-zones`,
 * `event-detail-scans` en `event-detail-scanners` — allemaal een ANDER eerste element
 * dan `event-detail`. Een filter op `queryKey: ['event-detail']` raakt dus alleen de
 * hoofdquery en laat elk tabblad verouderd staan. Vandaar het matchen op de naam zelf.
 *
 * Dat vangt ook `['event-details', productId]` (de datums-tab van het product). Bedoeld:
 * status wijzigen, dupliceren of verwijderen verandert die lijst evengoed.
 */
function invalidateEventViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: DASHBOARD_EVENTS_KEY });
  queryClient.invalidateQueries({
    predicate: (query) => {
      const head = query.queryKey[0];
      return typeof head === 'string' && head.startsWith('event-detail');
    },
  });
}

export interface DuplicateEventInput {
  /** Bron-event dat gekopieerd wordt. */
  sourceEventId: string;
  /** Nieuwe datum (YYYY-MM-DD). */
  event_date: string;
  /** Nieuwe starttijd (HH:MM of HH:MM:SS). */
  start_time: string;
  /** Nieuwe eindtijd, optioneel. */
  end_time?: string | null;
}

/**
 * Zet de zone_ids van een bron-tickettype om naar de zone-id's van het duplicaat.
 * `null` blijft `null` (geen zonebeperking). Een bron-id dat niet in de map zit
 * hoort niet voor te komen — dan wijst het tickettype naar een zone buiten zijn
 * eigen event — en dat is een harde fout: stil weglaten zou de beperking ruimer
 * maken dan het origineel, precies wat deze omzetting moet voorkomen.
 */
function mapZoneIds(source: string[] | null, map: Map<string, string>): string[] | null {
  if (!source || source.length === 0) return source ?? null;
  return source.map((id) => {
    const mapped = map.get(id);
    if (!mapped) {
      throw new Error(
        'Een tickettype verwijst naar een zone die niet bij dit event hoort; dupliceren is gestopt om de zonebeperking niet te verruimen.',
      );
    }
    return mapped;
  });
}

export function useDuplicateEvent() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceEventId, event_date, start_time, end_time }: DuplicateEventInput) => {
      if (!currentTenant) throw new Error('Geen tenant');

      // 1. Bron-event vers ophalen (tenant-scoped) — echte waarden, incl. capacity NULL.
      const { data: source, error: srcErr } = await supabase
        .from('event_details')
        .select('product_id, capacity, capacity_mode, min_attendees, location_name, meeting_point, timezone, early_bird_price, early_bird_deadline, early_bird_quantity')
        .eq('id', sourceEventId)
        .eq('tenant_id', currentTenant.id)
        .single();
      if (srcErr) throw srcErr;
      if (!source) throw new Error('Bron-event niet gevonden');

      // 2. Nieuw event aanmaken met overgenomen velden + nieuwe datum/tijd, status scheduled.
      const { data: newEvent, error: insErr } = await supabase
        .from('event_details')
        .insert({
          product_id: source.product_id,
          tenant_id: currentTenant.id,
          event_date,
          start_time,
          end_time: end_time ?? null,
          status: 'scheduled',
          capacity: source.capacity,               // kan NULL zijn = ongelimiteerd
          // capacity_mode hoort bij capacity: 'sold' telt verkochte tickets,
          // 'inside' telt wie er nu binnen is. De kolom is NOT NULL DEFAULT 'sold',
          // dus zonder deze regel valt een 'inside'-event stil terug op 'sold' en
          // handhaaft de kopie zijn capaciteit anders dan het origineel.
          capacity_mode: source.capacity_mode,
          min_attendees: source.min_attendees ?? 0,
          location_name: source.location_name,
          meeting_point: source.meeting_point,
          timezone: source.timezone,
          early_bird_price: source.early_bird_price,
          early_bird_deadline: source.early_bird_deadline,
          early_bird_quantity: source.early_bird_quantity,
        })
        .select('id, product_id')
        .single();
      if (insErr) throw insErr;

      // 3. Zones kopiëren. event_zones is per-event (event_detail_id, XOR met group),
      // en event_ticket_types.zone_ids bevat de UUID's van die zone-rijen. Een
      // letterlijke kopie van zone_ids zou dus naar de zones van het ORIGINEEL
      // wijzen, terwijl de scanner-toegangen van het duplicaat aan zijn eigen zones
      // hangen (event_scanner_access.zone_id → event_zones.id). De scan-RPC toetst
      // p_zone_id tegen zone_ids, dus dat zou elke scan op 'not_allowed_zone' laten
      // stranden. Daarom: zones dupliceren en de id's hieronder omzetten.
      // Sequentieel invoegen — een bulk-insert geeft geen gegarandeerde rij-volgorde,
      // en zonder betrouwbare koppeling oud→nieuw is de hermapping niet te maken.
      const { data: sourceZones, error: zoneErr } = await supabase
        .from('event_zones')
        .select('id, name, capacity, is_default, sort_order, location_name')
        .eq('event_detail_id', sourceEventId)
        .eq('tenant_id', currentTenant.id);
      if (zoneErr) throw zoneErr;

      const zoneIdMap = new Map<string, string>();
      for (const z of sourceZones ?? []) {
        const { data: newZone, error: zInsErr } = await supabase
          .from('event_zones')
          .insert({
            tenant_id: currentTenant.id,
            event_detail_id: newEvent.id,
            name: z.name,
            capacity: z.capacity,
            is_default: z.is_default,
            sort_order: z.sort_order,
            location_name: z.location_name,
          })
          .select('id')
          .single();
        if (zInsErr) throw zInsErr;
        zoneIdMap.set(z.id, newZone.id);
      }

      // 4. Tickettypes van het origineel ophalen en kopiëren naar het nieuwe event.
      const { data: ticketTypes, error: ttErr } = await supabase
        .from('event_ticket_types')
        .select('product_id, sub_capacity, sales_start, sales_end, sort_order, is_active, reentry_policy, zone_ids')
        .eq('event_detail_id', sourceEventId)
        .eq('tenant_id', currentTenant.id);
      if (ttErr) throw ttErr;

      if (ticketTypes && ticketTypes.length > 0) {
        const rows = ticketTypes.map((tt) => ({
          tenant_id: currentTenant.id,
          // XOR-scope: alleen event_detail_id (nooit group-scope), conform de check-constraint.
          event_detail_id: newEvent.id,
          product_id: tt.product_id,
          sub_capacity: tt.sub_capacity,
          sales_start: tt.sales_start,
          sales_end: tt.sales_end,
          sort_order: tt.sort_order,
          is_active: tt.is_active,
          reentry_policy: tt.reentry_policy,
          // zone_ids beperkt bij welke zones dit tickettype toegang geeft; de
          // scan-RPC weigert erop. Omgezet naar de zone-id's van het duplicaat.
          zone_ids: mapZoneIds(tt.zone_ids, zoneIdMap),
        }));
        const { error: copyErr } = await supabase.from('event_ticket_types').insert(rows);
        if (copyErr) throw copyErr;
      }

      return { id: newEvent.id, product_id: newEvent.product_id, ticketTypesCopied: ticketTypes?.length ?? 0 };
    },
    onSuccess: () => {
      invalidateEventViews(queryClient);
      toast({ title: 'Event gedupliceerd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Dupliceren mislukt', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Snelle status-wijziging vanuit het event-dashboard (afronden/annuleren).
 * Update puur op event-id en invalideert de dashboard-query. Losstaand van
 * useUpdateEventDate (die aan een product-cache hangt en door de product-tab
 * gebruikt wordt — bewust niet aangeraakt).
 */
export function useUpdateEventStatusQuick() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_details')
        .update({ status })
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select('id, status')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateEventViews(queryClient);
    },
    onError: (error: Error) => {
      toast({ title: 'Status wijzigen mislukt', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Verwijdert een event-datum vanuit het dashboard, met een guard: verwijderen
 * wordt geblokkeerd zodra er tickets verkocht zijn (valid/checked_in). De aanroeper
 * hoort dit vooraf te checken; deze hook doet het als extra vangnet op de teller.
 */
export function useDeleteEventQuick() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!currentTenant) throw new Error('Geen tenant');
      // Vangnet: tel ALLE tickets, ongeacht status. Ook een geannuleerd of
      // terugbetaald ticket houdt de FK vast (ticket_instances.event_detail_id
      // heeft geen ON DELETE CASCADE), dus filteren op valid/checked_in zou een
      // event doorlaten dat vervolgens alsnog op een 23503 stukloopt.
      const { count, error: cntErr } = await supabase
        .from('ticket_instances')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', id);
      if (cntErr) throw cntErr;
      if ((count ?? 0) > 0) {
        throw new Error('Er zijn tickets aan dit event gekoppeld; verwijderen is niet mogelijk. Zet het event op geannuleerd.');
      }

      // Default-zones opruimen. Die worden automatisch aangemaakt (fase 4c en bij
      // dupliceren), dus de tenant heeft ze nooit bewust gemaakt — ze horen een
      // verder leeg event niet onverwijderbaar te maken. Alleen is_default = true:
      // een zelf aangemaakte zone blijft staan en laat de delete hieronder terecht
      // stuklopen op de FK, die het 23503-vangnet leesbaar maakt.
      const { error: zoneDelErr } = await supabase
        .from('event_zones')
        .delete()
        .eq('event_detail_id', id)
        .eq('tenant_id', currentTenant.id)
        .eq('is_default', true);
      // Hangt er een scanner-toegang aan die default-zone, dan weigert Postgres deze
      // delete (event_scanner_access.zone_id → event_zones.id). Dat is terecht: het
      // event is dan in gebruik. Doorgeven aan de 23503-vertaling hieronder.
      if (zoneDelErr && zoneDelErr.code !== '23503') throw zoneDelErr;

      const { error } = await supabase
        .from('event_details')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant.id);
      // Laatste vangnet: mocht er tóch een kind bestaan dat de UI niet telt
      // (bijv. een openstaande winkelwagenregel), vertaal de ruwe FK-violatie
      // naar iets leesbaars in plaats van de Postgres-tekst te tonen.
      if (error) {
        if (error.code === '23503') {
          throw new Error('Dit event is nog aan andere gegevens gekoppeld en kan niet verwijderd worden. Zet het event op geannuleerd.');
        }
        throw error;
      }
    },
    // Optimistisch: de kaart verdwijnt meteen, vóór de server bevestigt.
    onMutate: async ({ id }: { id: string }) => {
      // Lopende refetches afbreken, anders kan een antwoord van vóór deze mutatie
      // de optimistische verwijdering weer overschrijven.
      await queryClient.cancelQueries({ queryKey: DASHBOARD_EVENTS_KEY });
      // Prefix-match: de echte key bevat ook tenant-id en showPast, dus er kunnen
      // meerdere varianten in de cache staan. Alle varianten snapshotten én bijwerken.
      const snapshot = queryClient.getQueriesData({ queryKey: DASHBOARD_EVENTS_KEY });
      queryClient.setQueriesData({ queryKey: DASHBOARD_EVENTS_KEY }, (old: unknown) =>
        Array.isArray(old) ? old.filter((e) => (e as { id?: string })?.id !== id) : old,
      );
      return { snapshot };
    },
    onSuccess: () => {
      toast({ title: 'Event verwijderd' });
    },
    onError: (error: Error, _vars, context) => {
      // Rollback: de kaart komt terug zoals hij was.
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast({ title: 'Verwijderen mislukt', description: error.message, variant: 'destructive' });
    },
    // In onSettled, niet in onSuccess: ook ná een rollback moet de waarheid van de
    // server opgehaald worden, zodat de teruggezette snapshot geen oude stand blijft.
    onSettled: () => {
      invalidateEventViews(queryClient);
    },
  });
}

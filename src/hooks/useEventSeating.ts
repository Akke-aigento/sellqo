// ZAAL-2 — zaalplan per datum: koppelen, ontkoppelen en de stand van de stoelen lezen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface EventSeat {
  id: string;
  section_name: string;
  row_label: string;
  seat_number: string;
  x: number;
  y: number;
  kind: string;
  color: string;
  class_name: string | null;
  product_id: string | null;
  status: 'available' | 'held' | 'sold' | 'blocked';
  hold_expires_at: string | null;
  ticket_instance_id: string | null;
}

export interface EventSeating {
  venueId: string | null;
  venueName: string | null;
  seats: EventSeat[];
}

/** Een vastgehouden stoel waarvan de hold verlopen is, telt als vrij. */
export function effectiveSeatStatus(s: Pick<EventSeat, 'status' | 'hold_expires_at'>, nowMs = Date.now()): EventSeat['status'] {
  if (s.status === 'held' && s.hold_expires_at && new Date(s.hold_expires_at).getTime() < nowMs) return 'available';
  return s.status;
}

export function useEventSeating(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['event-seating', currentTenant?.id, eventId],
    queryFn: async (): Promise<EventSeating> => {
      if (!currentTenant || !eventId) return { venueId: null, venueName: null, seats: [] };
      const { data: ev, error } = await supabase.from('event_details').select('venue_id')
        .eq('id', eventId).eq('tenant_id', currentTenant.id).maybeSingle();
      if (error) throw error;
      const venueId = (ev?.venue_id as string | null) ?? null;
      const [{ data: venue }, { data: seats, error: sErr }] = await Promise.all([
        venueId
          ? supabase.from('venues').select('name').eq('id', venueId).eq('tenant_id', currentTenant.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('event_seats')
          .select('id, section_name, row_label, seat_number, x, y, kind, color, class_name, product_id, status, hold_expires_at, ticket_instance_id')
          .eq('event_detail_id', eventId).eq('tenant_id', currentTenant.id).limit(10000),
      ]);
      if (sErr) throw sErr;
      return {
        venueId,
        venueName: (venue as { name?: string } | null)?.name ?? null,
        seats: (seats ?? []) as EventSeat[],
      };
    },
    enabled: !!currentTenant && !!eventId,
    refetchInterval: 30000,
  });
}

function useInvalidateSeating(eventId: string | undefined) {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return () => {
    void qc.invalidateQueries({ queryKey: ['event-seating', currentTenant?.id, eventId] });
    void qc.invalidateQueries({ queryKey: ['event-detail', currentTenant?.id, eventId] });
    void qc.invalidateQueries({ queryKey: ['event-detail-ticket-types', currentTenant?.id, eventId] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard-events'] });
  };
}

/** Foutcode uit een RAISE EXCEPTION in link/unlink_event_venue. */
export function seatingErrorCode(e: unknown): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
  const known = ['date_has_tickets', 'date_has_seat_activity', 'no_sellable_seats', 'product_not_on_date', 'venue_not_found', 'not_allowed'];
  return known.find((k) => msg.includes(k)) ?? 'unknown';
}

export function useLinkVenue(eventId: string | undefined) {
  const invalidate = useInvalidateSeating(eventId);
  return useMutation({
    mutationFn: async ({ venueId, mapping }: { venueId: string; mapping: Record<string, string> }) => {
      if (!eventId) throw new Error('no_event');
      const { data, error } = await supabase.rpc('link_event_venue', { p_event_detail_id: eventId, p_venue_id: venueId, p_mapping: mapping });
      if (error) throw error;
      return data as { ok: boolean; seats: number };
    },
    onSuccess: invalidate,
  });
}

export function useUnlinkVenue(eventId: string | undefined) {
  const invalidate = useInvalidateSeating(eventId);
  return useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('no_event');
      const { error } = await supabase.rpc('unlink_event_venue', { p_event_detail_id: eventId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

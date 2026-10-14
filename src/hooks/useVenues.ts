// ZAAL-1 — zalen en hun stoelplan lezen en bewaren (tabellen venues, venue_sections,
// venue_price_classes, venue_seats; RLS: tenant_admin of staff van de winkel).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { LayoutSeat, SeatKind } from '@/lib/seatLayout';

export interface Venue { id: string; name: string; stage_label: string; address: string | null }
export interface VenueSection { id: string; name: string; sort_order: number }
export interface VenuePriceClass { id: string; name: string; color: string; default_price: number; sort_order: number }
export interface VenueData { venue: Venue; sections: VenueSection[]; classes: VenuePriceClass[]; seats: LayoutSeat[] }

export const CLASS_COLORS = ['#FF6B35', '#1E3A5F', '#7FA6CC', '#0E8F5F', '#9C6ADE', '#C2410C', '#334155'];

export function useVenues() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['venues', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [] as (Venue & { seats: number })[];
      const [{ data: venues, error }, { data: seats }] = await Promise.all([
        supabase.from('venues').select('id, name, stage_label, address').eq('tenant_id', currentTenant.id).order('name'),
        supabase.from('venue_seats').select('venue_id').eq('tenant_id', currentTenant.id),
      ]);
      if (error) throw error;
      const count: Record<string, number> = {};
      for (const s of seats ?? []) count[s.venue_id as string] = (count[s.venue_id as string] ?? 0) + 1;
      return (venues ?? []).map((v) => ({ ...(v as Venue), seats: count[v.id as string] ?? 0 }));
    },
    enabled: !!currentTenant,
  });
}

export function useCreateVenue() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, sectionName, className }: { name: string; sectionName: string; className: string }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const tenant_id = currentTenant.id;
      const { data: venue, error } = await supabase.from('venues').insert({ tenant_id, name: name.trim() }).select('id').single();
      if (error || !venue) throw error ?? new Error('venue_failed');
      const venue_id = venue.id as string;
      const [{ error: sErr }, { error: cErr }] = await Promise.all([
        supabase.from('venue_sections').insert({ tenant_id, venue_id, name: sectionName, sort_order: 0 }),
        supabase.from('venue_price_classes').insert({ tenant_id, venue_id, name: className, color: CLASS_COLORS[0], default_price: 0, sort_order: 0 }),
      ]);
      if (sErr || cErr) throw sErr ?? cErr;
      return venue_id;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['venues'] }); },
  });
}

export function useVenueData(venueId: string | undefined) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['venue', currentTenant?.id, venueId],
    queryFn: async (): Promise<VenueData | null> => {
      if (!currentTenant || !venueId) return null;
      const t = currentTenant.id;
      const [v, sec, cls, seats] = await Promise.all([
        supabase.from('venues').select('id, name, stage_label, address').eq('tenant_id', t).eq('id', venueId).maybeSingle(),
        supabase.from('venue_sections').select('id, name, sort_order').eq('tenant_id', t).eq('venue_id', venueId).order('sort_order'),
        supabase.from('venue_price_classes').select('id, name, color, default_price, sort_order').eq('tenant_id', t).eq('venue_id', venueId).order('sort_order'),
        supabase.from('venue_seats').select('id, section_id, price_class_id, row_label, seat_number, x, y, kind, sellable').eq('tenant_id', t).eq('venue_id', venueId).limit(10000),
      ]);
      for (const r of [v, sec, cls, seats]) if (r.error) throw r.error;
      if (!v.data) return null;
      return {
        venue: v.data as Venue,
        sections: (sec.data ?? []) as VenueSection[],
        classes: (cls.data ?? []).map((c) => ({ ...(c as VenuePriceClass), default_price: Number(c.default_price ?? 0) })),
        seats: (seats.data ?? []).map((s) => ({ ...(s as Omit<LayoutSeat, 'kind'>), kind: s.kind as SeatKind })),
      };
    },
    enabled: !!currentTenant && !!venueId,
  });
}

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Bewaart de hele zaal: eerst weg wat verdwenen is (stoelen eerst), dan de rest upserten. */
export function useSaveVenue(venueId: string | undefined) {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ before, after }: { before: VenueData; after: VenueData }) => {
      if (!currentTenant || !venueId) throw new Error('no_venue');
      const tenant_id = currentTenant.id;
      const gone = <T extends { id: string }>(a: T[], b: T[]) => { const keep = new Set(b.map((x) => x.id)); return a.filter((x) => !keep.has(x.id)).map((x) => x.id); };
      const seatIdsGone = gone(before.seats, after.seats);
      for (const ids of chunk(seatIdsGone, 300)) {
        const { error } = await supabase.from('venue_seats').delete().in('id', ids).eq('tenant_id', tenant_id);
        if (error) throw error;
      }
      // Stoelen die van plaats wisselen kunnen tijdelijk op een bezette (x, y) botsen:
      // gewijzigde bestaande stoelen eerst weg, daarna alles wat er hoort opnieuw erin.
      const beforeById = new Map(before.seats.map((s) => [s.id, s]));
      const moved = after.seats.filter((s) => { const o = beforeById.get(s.id); return o && (o.x !== s.x || o.y !== s.y); }).map((s) => s.id);
      for (const ids of chunk(moved, 300)) {
        const { error } = await supabase.from('venue_seats').delete().in('id', ids).eq('tenant_id', tenant_id);
        if (error) throw error;
      }
      const secGone = gone(before.sections, after.sections);
      if (secGone.length) { const { error } = await supabase.from('venue_sections').delete().in('id', secGone).eq('tenant_id', tenant_id); if (error) throw error; }
      const clsGone = gone(before.classes, after.classes);
      if (clsGone.length) { const { error } = await supabase.from('venue_price_classes').delete().in('id', clsGone).eq('tenant_id', tenant_id); if (error) throw error; }

      const { error: vErr } = await supabase.from('venues').update({ name: after.venue.name.trim(), stage_label: after.venue.stage_label.trim() || 'PODIUM', address: after.venue.address?.trim() || null }).eq('id', venueId).eq('tenant_id', tenant_id);
      if (vErr) throw vErr;
      if (after.sections.length) {
        const { error } = await supabase.from('venue_sections').upsert(after.sections.map((s, i) => ({ id: s.id, tenant_id, venue_id: venueId, name: s.name, sort_order: i })));
        if (error) throw error;
      }
      if (after.classes.length) {
        const { error } = await supabase.from('venue_price_classes').upsert(after.classes.map((c, i) => ({ id: c.id, tenant_id, venue_id: venueId, name: c.name, color: c.color, default_price: c.default_price, sort_order: i })));
        if (error) throw error;
      }
      for (const part of chunk(after.seats, 400)) {
        const { error } = await supabase.from('venue_seats').upsert(part.map((s) => ({ ...s, tenant_id, venue_id: venueId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['venue'] });
      void qc.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useDeleteVenue() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (venueId: string) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await supabase.from('venues').delete().eq('id', venueId).eq('tenant_id', currentTenant.id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['venues'] }); },
  });
}

// DASH-2b — data voor de spoor-specifieke hero's (events, horeca) en het maanddoel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { isSoldOutNow } from '@/components/admin/storefront/food/useSoldOutToday';

// ------------------------------------------------------------------ events

export interface CockpitEvent {
  id: string;
  name: string;
  date: string;
  startTime: string | null;
  location: string | null;
  capacity: number | null;
  sold: number;
  soldLastWeek: number;
  checkedIn: number;
}

/** Het eerstvolgende geplande event (vandaag of later) met zijn tickettellingen. */
export function useCockpitNextEvent(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-next-event', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CockpitEvent | null> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: ev, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, location_name, capacity, products(name)')
        .eq('tenant_id', tenantId!)
        .eq('status', 'scheduled')
        .is('merged_into_event_id', null)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!ev) return null;

      const base = () =>
        supabase.from('ticket_instances').select('id', { count: 'exact', head: true }).eq('event_detail_id', ev.id).eq('status', 'valid');
      const weekAgo = subDays(new Date(), 7).toISOString();
      const [sold, lastWeek, checkedIn] = await Promise.all([
        base(),
        base().gte('created_at', weekAgo),
        base().not('checked_in_at', 'is', null),
      ]);
      if (sold.error) throw sold.error;

      const product = ev.products as { name?: string | null } | null;
      return {
        id: ev.id,
        name: product?.name ?? '',
        date: ev.event_date,
        startTime: ev.start_time,
        location: ev.location_name,
        capacity: ev.capacity,
        sold: sold.count ?? 0,
        soldLastWeek: lastWeek.count ?? 0,
        checkedIn: checkedIn.count ?? 0,
      };
    },
  });
}

// ------------------------------------------------------------------ horeca

/** Open kassasessie (de vroegste, als er meerdere terminals open staan). */
export function useCockpitPosSession(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-pos-session', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_sessions')
        .select('id, opened_at')
        .eq('tenant_id', tenantId!)
        .eq('status', 'open')
        .order('opened_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface MenuItemState {
  id: string;
  name: string;
  soldOut: boolean;
}

/**
 * Producten voor "Op voor vandaag": eerst wat al op is, dan de bestverkochte producten (ids
 * uit de toplijst), aangevuld tot `limit`. Alleen actieve producten.
 */
export function useCockpitMenuState(topProductIds: string[], enabled: boolean, limit = 5) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-menu-state', tenantId, topProductIds.join(','), limit],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<MenuItemState[]> => {
      const [out, top] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sold_out_until')
          .eq('tenant_id', tenantId!)
          .eq('is_active', true)
          .gt('sold_out_until', new Date().toISOString())
          .order('name')
          .limit(limit),
        topProductIds.length
          ? supabase.from('products').select('id, name, sold_out_until').eq('tenant_id', tenantId!).eq('is_active', true).in('id', topProductIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (out.error) throw out.error;
      if (top.error) throw top.error;
      type Row = { id: string; name: string; sold_out_until: string | null };
      const rows = new Map<string, MenuItemState>();
      for (const r of (out.data ?? []) as Row[]) rows.set(r.id, { id: r.id, name: r.name, soldOut: isSoldOutNow(r.sold_out_until) });
      const byId = new Map(((top.data ?? []) as Row[]).map((r) => [r.id, r]));
      for (const id of topProductIds) {
        const r = byId.get(id);
        if (r && !rows.has(r.id)) rows.set(r.id, { id: r.id, name: r.name, soldOut: isSoldOutNow(r.sold_out_until) });
      }
      return [...rows.values()].slice(0, limit);
    },
  });
}

// ------------------------------------------------------------------ maanddoel

export function useCockpitGoal() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['cockpit-goal', tenantId];

  const query = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_cockpit_settings')
        .select('monthly_goal')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      const goal = data?.monthly_goal == null ? null : Number(data.monthly_goal);
      return Number.isFinite(goal) && goal ? goal : null;
    },
  });

  const save = useMutation({
    mutationFn: async (goal: number | null) => {
      const { error } = await supabase.from('tenant_cockpit_settings').upsert(
        { tenant_id: tenantId!, monthly_goal: goal, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
        { onConflict: 'tenant_id' },
      );
      if (error) throw error;
      return goal;
    },
    onSuccess: (goal) => qc.setQueryData(key, goal),
  });

  return { goal: query.data ?? null, isLoading: query.isLoading, save };
}

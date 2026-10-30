// TAFEL-1 — bereidingsposten (keuken, bar, …) en welke categorie naar welke post gaat.
// Een tafelronde maakt per post één keukenbon; het keukenscherm kan op één post filteren.
// RLS: lezen = elk lid van de winkel, schrijven = tenant_admin. Een post wordt nooit echt
// verwijderd (oude bonnen verwijzen ernaar): "verwijderen" zet is_active op false.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export type StationKind = 'kitchen' | 'bar' | 'other';
export interface PrepStation { id: string; name: string; kind: StationKind; sort: number; is_default: boolean }
export interface PrepRoute { id: string; station_id: string; category_id: string | null; product_id: string | null }
export interface PrepStationsData { stations: PrepStation[]; routes: PrepRoute[] }

export const prepStationsKey = (tenantId: string | undefined) => ['prep-stations', tenantId] as const;

export function usePrepStations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: prepStationsKey(tenantId),
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<PrepStationsData> => {
      const [s, r] = await Promise.all([
        supabase.from('prep_stations' as never).select('id, name, kind, sort, is_default').eq('tenant_id', tenantId!).eq('is_active', true).order('sort').order('name'),
        supabase.from('prep_station_routes' as never).select('id, station_id, category_id, product_id').eq('tenant_id', tenantId!),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      return { stations: (s.data ?? []) as unknown as PrepStation[], routes: (r.data ?? []) as unknown as PrepRoute[] };
    },
  });
}

export function usePrepStationMutations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: prepStationsKey(tenantId) });
  const table = (name: string) => supabase.from(name as never);

  const save = useMutation({
    mutationFn: async (s: { id?: string; name: string; kind: StationKind; sort?: number }) => {
      const row = { tenant_id: tenantId!, name: s.name.trim(), kind: s.kind, sort: s.sort ?? 0, updated_at: new Date().toISOString() };
      const { error } = s.id
        ? await table('prep_stations').update(row as never).eq('id', s.id)
        : await table('prep_stations').insert(row as never);
      if (error) throw error;
    },
    onSuccess: done,
  });

  /** Eén standaardpost per winkel (unieke index): eerst de oude uitzetten. */
  const setDefault = useMutation({
    mutationFn: async (id: string | null) => {
      const off = await table('prep_stations').update({ is_default: false } as never).eq('tenant_id', tenantId!).eq('is_default', true);
      if (off.error) throw off.error;
      if (id) {
        const on = await table('prep_stations').update({ is_default: true } as never).eq('id', id);
        if (on.error) throw on.error;
      }
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await table('prep_station_routes').delete().eq('station_id', id);
      if (r.error) throw r.error;
      const { error } = await table('prep_stations').update({ is_active: false, is_default: false } as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: done,
  });

  /** Categorie naar een post sturen; `null` = terug naar de standaardpost. */
  const routeCategory = useMutation({
    mutationFn: async ({ categoryId, stationId }: { categoryId: string; stationId: string | null }) => {
      const del = await table('prep_station_routes').delete().eq('tenant_id', tenantId!).eq('category_id', categoryId);
      if (del.error) throw del.error;
      if (stationId) {
        const { error } = await table('prep_station_routes').insert({ tenant_id: tenantId!, station_id: stationId, category_id: categoryId } as never);
        if (error) throw error;
      }
    },
    onSuccess: done,
  });

  /** KASSA-UX-4: één product naar een post (wint van de categorie); `null` = volgens de categorie. */
  const routeProduct = useMutation({
    mutationFn: async ({ productId, stationId }: { productId: string; stationId: string | null }) => {
      const del = await table('prep_station_routes').delete().eq('tenant_id', tenantId!).eq('product_id', productId);
      if (del.error) throw del.error;
      if (stationId) {
        const { error } = await table('prep_station_routes').insert({ tenant_id: tenantId!, station_id: stationId, product_id: productId } as never);
        if (error) throw error;
      }
    },
    onSuccess: done,
  });

  return { save, setDefault, remove, routeCategory, routeProduct };
}

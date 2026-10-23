// ZAAL-H1 — het horeca-zaalplan lezen en bewaren (dining_areas, dining_tables,
// floor_markers). RLS: lezen = elk lid van de winkel, schrijven = tenant_admin of staff.
// Tafels en ruimtes worden nooit echt verwijderd (fiscaal: een tafel-id blijft altijd
// dezelfde tafel); "verwijderen" zet is_active op false. Decor mag echt weg.
//
// Elke bewerking gaat meteen naar de databank (geen "Opslaan"-knop): het plan in de
// cache wordt eerst bijgewerkt (vlot slepen), bij een fout teruggezet.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { FloorArea, FloorMarker, FloorTableRow, MarkerKind, TableKind, TableShape } from '@/lib/floorplan';
import type { NewMarker, NewTable } from '@/lib/floorplan';

export interface FloorPlanData {
  areas: FloorArea[];
  tables: FloorTableRow[];
  markers: FloorMarker[];
}

const AREA_COLS = 'id, name, sort, grid_w, grid_h, is_active';
const TABLE_COLS = 'id, area_id, label, kind, shape, seats, x, y, w, h, rotation, qr_token, is_active';
const MARKER_COLS = 'id, area_id, kind, label, x, y, w, h, rotation';

export const floorPlanKey = (tenantId: string | undefined) => ['floor-plan', tenantId] as const;

/** Actieve ruimtes, tafels en decor van de huidige winkel. */
export function useFloorPlan() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: floorPlanKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<FloorPlanData> => {
      const [a, t, m] = await Promise.all([
        supabase.from('dining_areas').select(AREA_COLS).eq('tenant_id', tenantId!).eq('is_active', true).order('sort').order('name'),
        supabase.from('dining_tables').select(TABLE_COLS).eq('tenant_id', tenantId!).eq('is_active', true).limit(2000),
        supabase.from('floor_markers').select(MARKER_COLS).eq('tenant_id', tenantId!).limit(2000),
      ]);
      for (const r of [a, t, m]) if (r.error) throw r.error;
      const areas = (a.data ?? []) as FloorArea[];
      const live = new Set(areas.map((x) => x.id));
      return {
        areas,
        tables: ((t.data ?? []) as FloorTableRow[]).filter((x) => live.has(x.area_id)).map((x) => ({ ...x, kind: x.kind as TableKind, shape: x.shape as TableShape })),
        markers: ((m.data ?? []) as FloorMarker[]).filter((x) => live.has(x.area_id)).map((x) => ({ ...x, kind: x.kind as MarkerKind })),
      };
    },
  });
}

/** Heeft deze winkel een zaalplan (minstens één actieve tafel)? Dan werkt enkel nog ?t=<token>. */
export function useHasFloorPlan(): { hasFloorPlan: boolean; isLoading: boolean } {
  const { data, isLoading } = useFloorPlan();
  return useMemo(() => ({ hasFloorPlan: (data?.tables.length ?? 0) > 0, isLoading }), [data, isLoading]);
}

type TablePatch = Partial<Pick<FloorTableRow, 'area_id' | 'label' | 'kind' | 'shape' | 'seats' | 'x' | 'y' | 'w' | 'h' | 'rotation'>>;
type MarkerPatch = Partial<Pick<FloorMarker, 'area_id' | 'kind' | 'label' | 'x' | 'y' | 'w' | 'h' | 'rotation'>>;
type AreaPatch = Partial<Pick<FloorArea, 'name' | 'sort' | 'grid_w' | 'grid_h'>>;

/** Alle bewerkingen op het zaalplan. Gooit de Supabase-fout door; de UI toont hem. */
export function useFloorPlanMutations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = floorPlanKey(tenantId);

  const patchCache = (fn: (d: FloorPlanData) => FloorPlanData) => {
    const prev = qc.getQueryData<FloorPlanData>(key);
    if (prev) qc.setQueryData<FloorPlanData>(key, fn(prev));
    return prev;
  };
  const restore = (prev: FloorPlanData | undefined) => { if (prev) qc.setQueryData(key, prev); };
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const need = () => { if (!tenantId) throw new Error('no_tenant'); return tenantId; };

  const createArea = useMutation({
    mutationFn: async (input: { name: string; sort: number; grid_w?: number; grid_h?: number }) => {
      const tenant_id = need();
      const { data, error } = await supabase.from('dining_areas').insert({ tenant_id, name: input.name.trim(), sort: input.sort, grid_w: input.grid_w ?? 40, grid_h: input.grid_h ?? 24 }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSettled: refresh,
  });

  const updateArea = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AreaPatch }) => {
      const { error } = await supabase.from('dining_areas').update(patch).eq('id', id).eq('tenant_id', need());
      if (error) throw error;
    },
    onMutate: ({ id, patch }) => ({ prev: patchCache((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) })) }),
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: refresh,
  });

  /** Ruimte weg (soft): eerst haar tafels uit, dan de ruimte zelf. */
  const deactivateArea = useMutation({
    mutationFn: async (id: string) => {
      const tenant_id = need();
      const { error: tErr } = await supabase.from('dining_tables').update({ is_active: false }).eq('area_id', id).eq('tenant_id', tenant_id);
      if (tErr) throw tErr;
      const { error } = await supabase.from('dining_areas').update({ is_active: false }).eq('id', id).eq('tenant_id', tenant_id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const insertItems = useMutation({
    mutationFn: async ({ areaId, tables = [], markers = [] }: { areaId: string; tables?: NewTable[]; markers?: NewMarker[] }) => {
      const tenant_id = need();
      let ids: string[] = [];
      if (tables.length) {
        const { data, error } = await supabase.from('dining_tables').insert(tables.map((x) => ({ ...x, tenant_id, area_id: areaId }))).select('id');
        if (error) throw error;
        ids = (data ?? []).map((r) => r.id as string);
      }
      if (markers.length) {
        const { error } = await supabase.from('floor_markers').insert(markers.map((x) => ({ ...x, tenant_id, area_id: areaId })));
        if (error) throw error;
      }
      return ids;
    },
    onSettled: refresh,
  });

  const updateTable = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablePatch }) => {
      const { error } = await supabase.from('dining_tables').update(patch).eq('id', id).eq('tenant_id', need());
      if (error) throw error;
    },
    onMutate: ({ id, patch }) => ({ prev: patchCache((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })) }),
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: refresh,
  });

  /** Tafel weg (soft): het id blijft bestaan voor de historiek, de QR-code werkt niet meer. */
  const deactivateTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dining_tables').update({ is_active: false }).eq('id', id).eq('tenant_id', need());
      if (error) throw error;
    },
    onMutate: (id) => ({ prev: patchCache((d) => ({ ...d, tables: d.tables.filter((t) => t.id !== id) })) }),
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: refresh,
  });

  const updateMarker = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: MarkerPatch }) => {
      const { error } = await supabase.from('floor_markers').update(patch).eq('id', id).eq('tenant_id', need());
      if (error) throw error;
    },
    onMutate: ({ id, patch }) => ({ prev: patchCache((d) => ({ ...d, markers: d.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)) })) }),
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: refresh,
  });

  const deleteMarker = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('floor_markers').delete().eq('id', id).eq('tenant_id', need());
      if (error) throw error;
    },
    onMutate: (id) => ({ prev: patchCache((d) => ({ ...d, markers: d.markers.filter((m) => m.id !== id) })) }),
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: refresh,
  });

  /** Nieuwe QR-code voor een tafel; de oude sticker werkt meteen niet meer. */
  const renewToken = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('renew_dining_table_token', { _table_id: id });
      if (error) throw error;
      return data as string;
    },
    onSettled: refresh,
  });

  return { createArea, updateArea, deactivateArea, insertItems, updateTable, deactivateTable, updateMarker, deleteMarker, renewToken };
}

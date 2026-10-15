// EVENT-SCAN-2 — de vaste deurlink van de winkel en het scanvenster.
// Een vaste deurlink is een event_scanner_access-rij ZONDER event: het ticket wijst
// het event aan, het venster (event_scan_settings) bewaakt dat het nú klopt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

const db = supabase as unknown as SupabaseClient;

export interface DoorLink { id: string; name: string; access_token: string; is_active: boolean; use_count: number; last_used_at: string | null }

export function useDoorLinks() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['door-links', currentTenant?.id],
    queryFn: async (): Promise<DoorLink[]> => {
      if (!currentTenant) return [];
      const { data, error } = await db.from('event_scanner_access')
        .select('id, name, access_token, is_active, use_count, last_used_at')
        .eq('tenant_id', currentTenant.id)
        .is('event_detail_id', null)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as DoorLink[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateDoorLink() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<DoorLink> => {
      if (!currentTenant) throw new Error('no_tenant');
      const { data, error } = await db.from('event_scanner_access')
        .insert({ tenant_id: currentTenant.id, name: name.trim() })
        .select('id, name, access_token, is_active, use_count, last_used_at').single();
      if (error) throw error;
      return data as DoorLink;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['door-links'] });
      void qc.invalidateQueries({ queryKey: ['door-link'] });
    },
  });
}

export function useToggleDoorLink() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('event_scanner_access')
        .update({ is_active }).eq('id', id).eq('tenant_id', currentTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['door-links'] });
      void qc.invalidateQueries({ queryKey: ['door-link'] });
    },
  });
}

export interface ScanWindowSettings { open_before_minutes: number; close_after_minutes: number; no_end_fallback_hours: number }
export const DEFAULT_SCAN_WINDOW: ScanWindowSettings = { open_before_minutes: 60, close_after_minutes: 60, no_end_fallback_hours: 6 };

export function useScanWindow() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['scan-window', currentTenant?.id],
    queryFn: async (): Promise<ScanWindowSettings> => {
      if (!currentTenant) return DEFAULT_SCAN_WINDOW;
      const { data, error } = await db.from('event_scan_settings')
        .select('open_before_minutes, close_after_minutes, no_end_fallback_hours')
        .eq('tenant_id', currentTenant.id).maybeSingle();
      if (error) throw error;
      return data ? (data as ScanWindowSettings) : DEFAULT_SCAN_WINDOW;
    },
    enabled: !!currentTenant,
  });
}

export function useSaveScanWindow() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: ScanWindowSettings) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await db.from('event_scan_settings')
        .upsert({ tenant_id: currentTenant.id, ...s, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['scan-window'] }); },
  });
}

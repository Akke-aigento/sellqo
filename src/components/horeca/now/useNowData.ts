// HORECA-NU-1/2 — data en schrijfacties van het Nu-paneel in beheer. Elke tegel leest en schrijft dezelfde
// bron als het scherm waar de instelling thuishoort (één bron per getal):
//   QR-bestellen    → fulfillment_settings.qr_mode     (Kaart › QR aan tafel, QrModeSettings)
//   vandaag dicht   → business_hours.closures           (Openingsuren), via business_hours_close_today
//   zone open/dicht → dining_areas.is_open              (Zaal), RLS zoals het zaalplan (tenant_admin, staff)
//   dagschotel      → products.daily_special_until      (nieuw), via set_product_daily_special / clear_daily_specials
// Online bestellen en keuken pauzeren: useShopOpen en useKitchenPause (gedeeld met ShopOpenCard en het keukenscherm).
// Uitverkocht: useSoldOutToday (gedeeld met de Kaart).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { floorPlanKey } from '@/hooks/useFloorPlan';
import { kaartKey } from '@/components/admin/horeca/kaart/useKaart';
import type { QrMode } from '@/components/admin/storefront/food/qrModes';
import { qrOrderHasNoPayWay } from '@/components/admin/storefront/food/qrModeRules';
import { closedToday, localYmd } from '@/lib/horeca/nowPanel';
import { businessHoursKey, useBusinessHours } from '@/hooks/useBusinessHours';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
// R14: nooit losgekoppeld (zonder `this` faalt elke aanroep live).
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
const isMissingColumn = (e: { code?: string } | null | undefined) => e?.code === '42703' || e?.code === 'PGRST204';

// ------------------------------------------------------------------ QR-bestellen aan tafel

export const nowQrKey = (tenantId: string | undefined) => ['now-qr', tenantId];

export function useNowQr() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: nowQrKey(tenantId),
    enabled: !!tenantId,
    queryFn: async () => {
      const [fs, ts] = await Promise.all([
        supabase.from('fulfillment_settings').select('qr_mode, qr_flow, qr_pay_counter, qr_pay_online' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('tenant_theme_settings').select('shop_live').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (fs.error) throw fs.error;
      const r = fs.data as { qr_mode?: string | null; qr_flow?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null } | null;
      return {
        // Zelfde standaard als QrModeSettings en storefront-api: geen instelling = 'view'.
        mode: ((r?.qr_mode as QrMode) || 'view') as QrMode,
        flow: (r?.qr_flow === 'check' ? 'check' : 'order') as 'order' | 'check',
        counter: r?.qr_pay_counter !== false,
        payOnline: !!r?.qr_pay_online,
        // Onbekend (leesfout) = geen melding: nooit een valse waarschuwing.
        shopLive: ts.error ? true : ts.data?.shop_live === true,
      };
    },
  });
  const set = useMutation({
    mutationFn: async (mode: 'order' | 'view') => {
      const d = query.data;
      if (!d) throw new Error('not_loaded');
      if (qrOrderHasNoPayWay({ ...d, mode })) throw new Error('no_pay_way');
      const { data, error } = await supabase.from('fulfillment_settings')
        .upsert({ tenant_id: tenantId!, qr_mode: mode, updated_at: new Date().toISOString() } as never, { onConflict: 'tenant_id' })
        .select('tenant_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('no_permission');
      return mode;
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: nowQrKey(tenantId) }),
      qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] }),
      qc.invalidateQueries({ queryKey: ['ordering-hub', tenantId] }),
    ]),
  });
  return { ...query, set };
}

// ------------------------------------------------------------------ vandaag uitzonderlijk dicht

export function useNowClosedToday(nowMs: number) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  // Zelfde bron en sleutel als het urenscherm (useBusinessHours): bewaren werkt beide meteen bij.
  const query = useBusinessHours();
  const today = localYmd(nowMs, query.data?.timezone);
  const state = query.isSuccess ? closedToday(query.data?.closures ?? [], today) : null;
  const set = useMutation({
    mutationFn: async ({ closed, reason }: { closed: boolean; reason?: string | null }) => {
      const { data, error } = await rpc('business_hours_close_today', { p_tenant_id: tenantId, p_closed: closed, p_reason: reason ?? null });
      if (error) throw error;
      const r = data as { closed?: boolean; period?: boolean } | null;
      // Terug open terwijl er een periode loopt: die beheer je in Openingsuren (geen stille "gelukt").
      if (!closed && r?.closed) throw new Error(r.period ? 'period' : 'no_permission');
      if (closed && !r?.closed) throw new Error('no_permission');
      return closed;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: businessHoursKey(tenantId) }),
  });
  return { ...query, today, state, set };
}

// ------------------------------------------------------------------ zones (terras) open of dicht

export interface NowArea { id: string; name: string; is_active: boolean; is_open: boolean; sort: number }
export const nowAreasKey = (tenantId: string | undefined) => ['now-areas', tenantId];

export function useNowAreas() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: nowAreasKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<NowArea[] | null> => {
      const { data, error } = await supabase.from('dining_areas').select('id, name, is_active, is_open, sort' as 'id')
        .eq('tenant_id', tenantId!).eq('is_active', true).order('sort').order('name');
      // Vóór de migratie (kolom bestaat niet): geen zonetegels, nooit een tegel die faalt.
      if (isMissingColumn(error)) return null;
      if (error) throw error;
      return ((data ?? []) as unknown as NowArea[]).map((a) => ({ ...a, is_open: a.is_open !== false }));
    },
  });
  const set = useMutation({
    mutationFn: async ({ id, open }: { id: string; open: boolean }) => {
      const { data, error } = await supabase.from('dining_areas').update({ is_open: open } as never).eq('id', id).eq('tenant_id', tenantId!).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('no_permission');
      return open;
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: nowAreasKey(tenantId) }),
      // Zaal (live en kassa) toont de zone gedimd met "dicht".
      qc.invalidateQueries({ queryKey: floorPlanKey(tenantId) }),
    ]),
  });
  return { ...query, set };
}

// ------------------------------------------------------------------ dagschotel

export const nowSpecialsKey = (tenantId: string | undefined) => ['now-specials', tenantId];

export function useNowSpecials() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: nowSpecialsKey(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ id: string; until: string }[] | null> => {
      const { data, error } = await supabase.from('products').select('id, daily_special_until' as 'id')
        .eq('tenant_id', tenantId!).not('daily_special_until' as 'id', 'is', null).limit(50);
      if (isMissingColumn(error)) return null;
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as unknown as { id: string; daily_special_until: string }[])
        .filter((r) => new Date(r.daily_special_until).getTime() > now)
        .map((r) => ({ id: r.id, until: r.daily_special_until }));
    },
  });
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: nowSpecialsKey(tenantId) }),
    qc.invalidateQueries({ queryKey: kaartKey(tenantId) }),
    qc.invalidateQueries({ queryKey: ['kassa-catalog', tenantId] }),
  ]);
  const set = useMutation({
    mutationFn: async ({ productId, on }: { productId: string; on: boolean }) => {
      const { error } = await rpc('set_product_daily_special', { p_product_id: productId, p_on: on });
      if (error) throw error;
      return on;
    },
    onSettled: refresh,
  });
  const clear = useMutation({
    mutationFn: async () => {
      const { data, error } = await rpc('clear_daily_specials', { p_tenant_id: tenantId });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSettled: refresh,
  });
  return { ...query, set, clear };
}

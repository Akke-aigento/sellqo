// HORECA-INSTELLINGEN-1 — de stand van een horecazaak, één keer opgehaald.
//
// Vroeger rekenden Instellingen › Horeca (HorecaSettingsHub) en Kaart › Overzicht elk hun eigen
// stand uit, met een eigen telling van de tafels. Nu lezen zij én de checklist van Mijn zaak deze
// ene hook. De tafels komen uit useFloorPlan (zelfde bron als het zaalplan, één bron per getal).
// De query-key blijft 'horeca-settings-hub', zodat de bestaande invalidaties (QR aan tafel,
// Kassa › Betalen) hem blijven verversen.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { weekHasRanges } from '@/lib/businessHours';
import { normalizePaySettings, type PaySettings } from '@/kassa/app/horeca/paySettings';
import type { HorecaStatus } from '@/lib/horecaSetup';

export const horecaStatusKey = (tenantId: string | undefined) => ['horeca-settings-hub', tenantId] as const;

type Counted = { count: number | null };

export function useHorecaStatus(): { data: HorecaStatus | undefined; isLoading: boolean } {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data: hours, isLoading: hoursLoading } = useBusinessHours();
  const { data: floor, isLoading: floorLoading } = useFloorPlan();

  const { data: raw, isLoading } = useQuery({
    queryKey: horecaStatusKey(tenantId),
    enabled: !!tenantId,
    queryFn: async () => {
      const id = tenantId!;
      // Telling zonder rijen; `table` als string omdat niet elke tabel in types.ts staat.
      const count = (table: string, active = true) => {
        let q = supabase.from(table as never).select('*', { count: 'exact', head: true }).eq('tenant_id' as never, id as never);
        if (active) q = q.eq('is_active' as never, true as never);
        return q as unknown as Promise<Counted>;
      };
      const [pay, fs, ts, methods, stations, printers, notify, terminals, cashiers, accounts, beats, res, groups, menu] = await Promise.all([
        supabase.from('horeca_pay_settings' as never).select('methods, terminal, kassa_tip, online_pay, online_tip, receipt_print, mail_online').eq('tenant_id' as never, id as never).maybeSingle(),
        supabase.from('fulfillment_settings').select('slots_enabled, pay_on_pickup, qr_mode, qr_pay_counter, qr_pay_online, qr_flow').eq('tenant_id', id).maybeSingle(),
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', id).maybeSingle(),
        supabase.from('shipping_methods').select('fulfillment_type').eq('tenant_id', id).eq('is_active', true).in('fulfillment_type', ['pickup', 'local_delivery']),
        count('prep_stations'),
        count('printers'),
        count('horeca_notify_devices', false),
        count('pos_terminals', false),
        supabase.from('pos_cashiers' as never).select('id', { count: 'exact', head: true }).eq('tenant_id' as never, id as never).eq('is_active' as never, true as never).eq('can_use_pos' as never, true as never) as unknown as Promise<Counted>,
        // Gekoppelde toestellen: enkel de zaakvoerder ziet de accounts (RLS); de hartslag zien ook anderen.
        supabase.from('kassa_device_accounts' as never).select('user_id', { count: 'exact', head: true }).eq('tenant_id' as never, id as never).is('revoked_at' as never, null) as unknown as Promise<Counted>,
        count('kassa_devices', false),
        supabase.from('reservation_settings' as never).select('lead_minutes').eq('tenant_id' as never, id as never).maybeSingle(),
        count('product_addon_groups'),
        // Zelfde telling als de tab Kaart (actieve producten, zonder tickets/cadeaubonnen).
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', id).eq('is_active', true).in('product_type', ['physical', 'service', 'digital'] as never),
      ]);
      const p = pay.data as (Partial<PaySettings> & { online_pay?: boolean | null; online_tip?: boolean | null; receipt_print?: boolean | null; mail_online?: boolean | null }) | null;
      const norm = normalizePaySettings(p);
      const f = fs.data as { slots_enabled?: boolean | null; pay_on_pickup?: boolean | null; qr_mode?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null; qr_flow?: string | null } | null;
      const m = (methods.data ?? []) as { fulfillment_type: string }[];
      const qrMode = f?.qr_mode === 'order' ? 'order' : f?.qr_mode === 'off' ? 'off' : 'view';
      return {
        payMethods: norm.methods.length, kassaTip: norm.kassa_tip, terminalMode: norm.terminal,
        checkOnline: p?.online_pay === true, onlineTip: p?.online_tip !== false,
        receiptPrint: p?.receipt_print === true, mailOnline: p?.mail_online === true,
        qrMode, qrFlow: f?.qr_flow === 'check' ? 'check' : 'order',
        qrPayCounter: f?.qr_pay_counter !== false, qrPayOnline: !!f?.qr_pay_online,
        slots: !!f?.slots_enabled, payOnPickup: !!f?.pay_on_pickup,
        shopLive: !!ts.data?.shop_live, shopOrdering: !!ts.data?.shop_ordering,
        pickup: m.some((x) => x.fulfillment_type === 'pickup'), delivery: m.some((x) => x.fulfillment_type === 'local_delivery'),
        stations: stations.count ?? 0, printers: printers.count ?? 0, notifyDevices: notify.count ?? 0,
        terminals: terminals.count ?? 0, cashiers: cashiers.count ?? 0,
        pairedDevices: Math.max(accounts.count ?? 0, beats.count ?? 0),
        leadMinutes: (res.data as { lead_minutes?: number } | null)?.lead_minutes ?? 60,
        addonGroups: groups.count ?? 0, menuItems: menu.count ?? 0,
      } as const;
    },
  });

  const t = currentTenant as unknown as Record<string, unknown> | null;
  const str = (k: string) => (typeof t?.[k] === 'string' ? (t[k] as string) : '');
  const data: HorecaStatus | undefined = raw && currentTenant ? {
    ...raw,
    name: str('name'), address: str('address'), postalCode: str('postal_code'), city: str('city'), vat: str('btw_number'),
    logo: !!str('logo_url'),
    stripe: t?.stripe_charges_enabled === true,
    hoursSet: weekHasRanges(hours?.week),
    tables: floor?.tables.length ?? 0, areas: floor?.areas.length ?? 0,
  } : undefined;
  return { data, isLoading: isLoading || hoursLoading || floorLoading };
}

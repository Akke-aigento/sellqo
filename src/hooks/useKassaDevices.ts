// LIVE-1 — hartslag van SellQo Kassa-toestellen (kassa_devices), per zaak.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface KassaDevice {
  device_id: string; terminal_id: string; sw_version: string | null; fiscal_mode: string | null;
  queue_count: number; outbox_count: number; pending_pays: number; online: boolean; last_seen_at: string;
  /** TAFEL-3: getekend maar door de server geweigerd (kolom bestaat na de TAFEL-3-migratie). */
  rejected_count?: number;
}

/** Stil = meer dan 5 minuten geen hartslag (elke minuut verwacht). */
export const isSilent = (d: Pick<KassaDevice, 'last_seen_at'>, now = Date.now()) => now - new Date(d.last_seen_at).getTime() > 5 * 60_000;
export const waitingCount = (d: Pick<KassaDevice, 'queue_count' | 'outbox_count' | 'pending_pays' | 'rejected_count'>) => d.queue_count + d.outbox_count + d.pending_pays + (d.rejected_count ?? 0);

export function useKassaDevices() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['kassa-devices', currentTenant?.id],
    enabled: !!currentTenant?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('kassa_devices' as never)
        // '*': rejected_count bestaat pas na de TAFEL-3-migratie; zo breekt de admin niet als die later live gaat.
        .select('*')
        .eq('tenant_id' as never, currentTenant!.id as never).order('last_seen_at' as never, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KassaDevice[];
    },
  });
}


// KASSA-ACCOUNT-1 — gekoppelde toestellen (eigen account per toestel), per zaak. Enkel de zaakvoerder ziet ze
// (RLS op kassa_device_accounts: tenant_admin of het toestel zelf).
export interface KassaDeviceAccount {
  user_id: string; tenant_id: string; terminal_id: string; device_uuid: string; name: string; paired_at: string;
}

export function useKassaDeviceAccounts(enabled = true, fast = false) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['kassa-device-accounts', currentTenant?.id],
    enabled: enabled && !!currentTenant?.id,
    // Tijdens het koppelen (code op het scherm) elke 3 s, zodat "Gekoppeld" meteen verschijnt.
    refetchInterval: fast ? 3_000 : 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('kassa_device_accounts' as never)
        .select('user_id, tenant_id, terminal_id, device_uuid, name, paired_at')
        .eq('tenant_id' as never, currentTenant!.id as never).is('revoked_at' as never, null)
        .order('paired_at' as never, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KassaDeviceAccount[];
    },
  });
}

export interface TerminalDeviceRow { key: string; account: KassaDeviceAccount | null; beat: KassaDevice | null }

/** Oude aanmelding (hartslag zonder koppeling) nog tonen als ze de laatste 7 dagen gezien werd. */
const UNPAIRED_VISIBLE_MS = 7 * 24 * 3600_000;

/** Eén lijst per kassa: gekoppelde toestellen (met hun hartslag, op device_uuid = device_id), daarna recente
 *  toestellen die nog met een gewone account draaien (van vóór de koppeling). Eén rij per toestel. */
export function terminalDeviceRows(terminalId: string, accounts: KassaDeviceAccount[], beats: KassaDevice[], now = Date.now()): TerminalDeviceRow[] {
  const mine = accounts.filter((a) => a.terminal_id === terminalId);
  const paired = new Set(accounts.map((a) => a.device_uuid));
  const rows: TerminalDeviceRow[] = mine.map((a) => ({
    key: `a:${a.user_id}`, account: a, beat: beats.find((b) => b.device_id === a.device_uuid) ?? null,
  }));
  for (const b of beats) {
    if (b.terminal_id !== terminalId || paired.has(b.device_id)) continue;
    if (now - new Date(b.last_seen_at).getTime() > UNPAIRED_VISIBLE_MS) continue;
    rows.push({ key: `b:${b.device_id}`, account: null, beat: b });
  }
  return rows;
}

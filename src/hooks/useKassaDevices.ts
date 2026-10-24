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


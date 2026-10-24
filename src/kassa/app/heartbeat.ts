// LIVE-1 — toestelhartslag: elke minuut meldt de kassa zich bij SellQo (versie, wachtrij,
// ondertekende events en betalingen die nog naar de cloud moeten, laatste sync). Nooit
// blokkerend: lukt het niet, dan is dat zelf het signaal (het toestel valt stil).
import { supabase } from '@/integrations/supabase/client';
import { KASSA_SW_VERSION } from '../version';
import type { KassaRuntime } from './runtime';
import type { HorecaStore } from './horeca/store';
import { readPendingPays, readRejectedPays } from './horeca/payActions';
import { readPendingOps, readRejectedOps } from './fiscalOps';

export const HEARTBEAT_MS = 60_000;

export function heartbeatInfo(runtime: KassaRuntime, store: Pick<HorecaStore, 'pendingCount' | 'lastSyncAt' | 'online'>) {
  return {
    sw_version: KASSA_SW_VERSION,
    fiscal_mode: runtime.fiscal.mode,
    queue_count: store.pendingCount,
    outbox_count: runtime.outboxCount,
    // Wachtend én geweigerd: beide vragen aandacht (geweigerd = getekend maar niet geboekt).
    // TAFEL-3: kas-, telling- en rapporthandelingen tellen mee.
    pending_pays: readPendingPays(runtime.device.tenantId).length + readRejectedPays(runtime.device.tenantId).length
      + readPendingOps(runtime.device.tenantId).length + readRejectedOps(runtime.device.tenantId).length,
    last_sync_at: store.lastSyncAt ? new Date(store.lastSyncAt).toISOString() : null,
    online: store.online,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  };
}

export async function sendHeartbeat(runtime: KassaRuntime, store: Pick<HorecaStore, 'pendingCount' | 'lastSyncAt' | 'online'>): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('kassa_heartbeat' as never, {
      p_tenant_id: runtime.device.tenantId, p_terminal_id: runtime.device.terminalRowId,
      p_device_id: runtime.device.deviceUuid, p_info: heartbeatInfo(runtime, store),
    } as never);
    return !error;
  } catch {
    return false;
  }
}

// PERSONEEL-1 — in- en uitklokken (USR-05): S-event WORK_IN/WORK_OUT. Los van de PIN-login:
// aanmelden aan de kassa is geen aanwezigheid. In niet-fiscale modus gaat het naar het
// auditspoor; in fiscale modus naar de FDM en fiscal_events.
import { buildWorkInOut } from '../fiscal/builders';
import { FiscalUnavailableError, type KassaRuntime } from './runtime';

export type ClockDirection = 'in' | 'out';

function key(tenantId: string, staffId: string) { return `sq_kassa_clock|${tenantId}|${staffId}`; }

export function isClockedIn(tenantId: string, staffId: string): boolean {
  try { return localStorage.getItem(key(tenantId, staffId)) === 'in'; } catch { return false; }
}

export interface ClockResult { ok: boolean; reason?: 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'rejected' | 'unreachable' | 'error' }

export async function clock(runtime: KassaRuntime, staffId: string, employeeId: string | null, dir: ClockDirection): Promise<ClockResult> {
  const name = dir === 'in' ? 'signWorkIn' : 'signWorkOut';
  try {
    if (!runtime.isFiscal) {
      await runtime.audit(dir === 'in' ? 'work_in' : 'work_out', { staff_id: staffId });
    } else {
      if (!employeeId) return { ok: false, reason: 'no_insz' };
      // S-events worden niet afgedrukt (USR-05): ticketMedium NONE is hier toegelaten.
      const data = buildWorkInOut(runtime.posContext(), await runtime.meta(name, employeeId, 'NONE'));
      const out = await runtime.sign(name, data, { staffId });
      if (out.kind !== 'signed') return { ok: false, reason: out.kind };
    }
    try { localStorage.setItem(key(runtime.device.tenantId, staffId), dir); } catch { /* geen opslag: enkel de knopstand */ }
    return { ok: true };
  } catch (e) {
    if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as ClockResult['reason'] };
    return { ok: false, reason: 'error' };
  }
}

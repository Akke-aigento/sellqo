// PERSONEEL-1 — in- en uitklokken (USR-05): S-event WORK_IN/WORK_OUT. Los van de PIN-login:
// aanmelden aan de kassa is geen aanwezigheid. In niet-fiscale modus gaat het naar het
// auditspoor; in fiscale modus naar de FDM en fiscal_events.
//
// PERSONEEL-2 — de stand (ingeklokt of niet) en de tijden leven op de server (kassa_shifts via
// kassa_clock / kassa_clock_state), zodat elk toestel van de zaak dezelfde knopstand toont en er
// een urenoverzicht is. Het fiscale pad (tekenen van WORK_IN/OUT) is ongewijzigd: kassa_clock
// komt erna en bewaart enkel het event-id. localStorage is nog enkel een cache voor als het
// toestel offline is.
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import { buildWorkInOut } from '../fiscal/builders';
import { FiscalUnavailableError, type KassaRuntime } from './runtime';

export type ClockDirection = 'in' | 'out';

function key(tenantId: string, staffId: string) { return `sq_kassa_clock|${tenantId}|${staffId}`; }

function cache(tenantId: string, staffId: string, dir: ClockDirection) {
  try { localStorage.setItem(key(tenantId, staffId), dir); } catch { /* geen opslag: enkel de knopstand */ }
}

/** Laatst gekende stand op dit toestel (cache; de server is de bron). */
export function isClockedIn(tenantId: string, staffId: string): boolean {
  try { return localStorage.getItem(key(tenantId, staffId)) === 'in'; } catch { return false; }
}

/** Stand volgens de server, of null als die niet bereikbaar is. Werkt de cache bij. */
export async function fetchClockState(tenantId: string, staffId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc('kassa_clock_state' as never, { p_tenant_id: tenantId, p_staff_id: staffId } as never);
    if (error) return null;
    const state = (data as { state?: string } | null)?.state;
    if (state !== 'in' && state !== 'out') return null;
    cache(tenantId, staffId, state);
    return state === 'in';
  } catch {
    return null;
  }
}

async function recordShift(runtime: KassaRuntime, staffId: string, dir: ClockDirection, fiscalEventId: string | null): Promise<ClockDirection | null> {
  try {
    const { data, error } = await supabase.rpc('kassa_clock' as never, {
      p_tenant_id: runtime.device.tenantId, p_staff_id: staffId, p_direction: dir, p_device_id: runtime.device.deviceUuid,
      p_terminal_id: runtime.device.terminalRowId, p_fiscal_event_id: fiscalEventId,
    } as never);
    if (error) return null;
    const state = (data as { state?: string } | null)?.state;
    return state === 'in' || state === 'out' ? state : null;
  } catch {
    return null;
  }
}

export interface ClockResult {
  ok: boolean;
  reason?: 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'rejected' | 'unreachable' | 'offline' | 'error';
  /** De stand na de actie (volgens de server als die antwoordde). */
  clockedIn?: boolean;
  /** Fiscaal getekend, maar de shift kon niet bewaard worden: de zaakvoerder moet ze toevoegen. */
  notSaved?: boolean;
  /** De server had deze stand al (bv. ingeklokt op een ander toestel): er is niets getekend. */
  already?: boolean;
}

export async function clock(runtime: KassaRuntime, staffId: string, employeeId: string | null, dir: ClockDirection): Promise<ClockResult> {
  const name = dir === 'in' ? 'signWorkIn' : 'signWorkOut';
  const tenantId = runtime.device.tenantId;
  try {
    // Stand op de server al zo (ander toestel)? Dan niets tekenen of loggen, enkel de knop bijwerken.
    const current = await fetchClockState(tenantId, staffId);
    if (current !== null && current === (dir === 'in')) return { ok: true, clockedIn: current, already: true };

    if (!runtime.isFiscal) {
      // Niet-fiscaal: de server is de registratie. Lukt die niet, dan is er niets gebeurd.
      const state = await recordShift(runtime, staffId, dir, null);
      if (!state) return { ok: false, reason: 'offline' };
      try { await runtime.audit(dir === 'in' ? 'work_in' : 'work_out', { staff_id: staffId }); } catch { /* auditspoor is aanvullend */ }
      cache(tenantId, staffId, state);
      return { ok: true, clockedIn: state === 'in' };
    }

    if (!employeeId) return { ok: false, reason: 'no_insz' };
    // S-events worden niet afgedrukt (USR-05): ticketMedium NONE is hier toegelaten.
    const data = buildWorkInOut(runtime.posContext(), await runtime.meta(name, employeeId, 'NONE'));
    const out = await runtime.sign(name, data, { staffId });
    if (out.kind !== 'signed') return { ok: false, reason: out.kind };
    // Getekend = geklokt. Daarna de shift op de server; mislukt dat, dan blijft het event gelden
    // en meldt de kassa dat de uren nagekeken moeten worden.
    // Staat het event nog in de uitgaande wachtrij (niet in de cloud), dan zonder verwijzing.
    const state = (await recordShift(runtime, staffId, dir, out.eventId ?? null))
      ?? (out.eventId ? await recordShift(runtime, staffId, dir, null) : null);
    cache(tenantId, staffId, state ?? dir);
    return state ? { ok: true, clockedIn: state === 'in' } : { ok: true, clockedIn: dir === 'in', notSaved: true };
  } catch (e) {
    if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as ClockResult['reason'] };
    return { ok: false, reason: 'error' };
  }
}

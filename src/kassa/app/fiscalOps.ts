// TAFEL-3 — kas-, shift- en rapporthandelingen: eerst tekenen, dan de server.
//
// Zelfde regels als afrekenen (payActions.ts), in het klein:
// - Elke handeling heeft een vaste id (verzoek-id). Het ondertekende event hangt aan die id
//   (fiscal_events.cost_center_reference) en de server is idempotent op die id.
// - Geen antwoord van de zwarte doos ≠ niet getekend: de handeling blijft op het toestel staan
//   ('unsigned') en hetzelfde bericht gaat byte-identiek opnieuw (ID-11).
// - Getekend = op het toestel bewaard vóór het netwerk (write-ahead); een netwerkfout daarna
//   betekent later opnieuw proberen, nooit opnieuw tekenen.
// - Weigert de server een getekende handeling definitief, dan blijft ze als 'rejected' staan
//   en komt ze in het auditspoor.
// In niet-fiscale modus valt het tekenen weg; een netwerkfout laat de handeling ook dan in de
// wachtrij (de server is idempotent), zodat een kasbeweging nooit verloren gaat.
import { supabase } from '@/integrations/supabase/client';
import type { AnyFiscalInput, MutationName, SignResult } from '../fiscal/types';
import type { SignedEvent } from '../print/types';
import { FiscalUnavailableError, type KassaRuntime } from './runtime';

export type FiscalOpRpc = 'kassa_cash_move' | 'kassa_shift' | 'kassa_report_finish';

export interface FiscalOpSign { name: MutationName; data: AnyFiscalInput; eventId?: string | null; result?: SignResult | null }

export interface FiscalOp {
  id: string;
  rpc: FiscalOpRpc;
  payload: Record<string, unknown>;
  /** Hoe de event-id('s) in het verzoek gaan: één (kas, telling) of een lijst (rapport). */
  eventField: 'fiscal_event_id' | 'fiscal_event_ids';
  signs: FiscalOpSign[];
  staffId: string | null;
  status: 'unsigned' | 'pending' | 'rejected';
  error?: string;
  at: string;
}

export type FiscalOpFailure = 'offline' | 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'fdm_rejected' | 'fdm_unreachable'
  | 'server' | 'pending_elsewhere' | 'signed_rejected';

export type FiscalOpOutcome<T> =
  | { ok: true; pending: boolean; data: T | null; signed: SignedEvent[]; reason?: undefined; detail?: undefined }
  | { ok: false; reason: FiscalOpFailure; detail?: string; pending?: undefined; data?: undefined; signed?: undefined };

const key = (tenantId: string) => `sq_kassa_fop|${tenantId}`;

function readAll(tenantId: string): FiscalOp[] {
  try { return JSON.parse(localStorage.getItem(key(tenantId)) ?? '[]') as FiscalOp[]; } catch { return []; }
}
function writeAll(tenantId: string, ops: FiscalOp[]) {
  try { localStorage.setItem(key(tenantId), JSON.stringify(ops)); } catch { /* privémodus */ }
}
/**
 * Review M6b: een gebruikersrapport bevat de werknemersnummers van iedereen. Zolang het niet
 * getekend is, moet het bericht bewaard blijven (identiek opnieuw sturen, ID-11); zodra het
 * getekend is of geweigerd, houden we enkel de event-id bij en verdwijnt de inhoud van het toestel.
 */
function storable(op: FiscalOp): FiscalOp {
  return {
    ...op,
    // Ook de andere getekende berichten: na het tekenen is de inhoud niet meer nodig (enkel de
    // event-id gaat naar de server), en ze dragen het werknemersnummer van wie tekende.
    signs: op.signs.map((s) => ((s.eventId || op.status === 'rejected')
      ? { ...s, data: null as unknown as AnyFiscalInput, result: null }
      : s)),
  };
}
function upsert(tenantId: string, op: FiscalOp) { writeAll(tenantId, [...readAll(tenantId).filter((x) => x.id !== op.id), storable(op)]); }

// Review M4: één handeling tegelijk (voorgrond en achtergrond tekenen nooit hetzelfde tegelijk).
const inFlight = new Set<string>();
function drop(tenantId: string, id: string) { writeAll(tenantId, readAll(tenantId).filter((x) => x.id !== id)); }

/** Handelingen die nog moeten (tekenen of naar de server), zonder de geweigerde. */
export const readPendingOps = (tenantId: string) => readAll(tenantId).filter((x) => x.status !== 'rejected');
export const readRejectedOps = (tenantId: string) => readAll(tenantId).filter((x) => x.status === 'rejected');

interface RpcError { code?: string; message?: string }
const BUSINESS = new Set(['40001', '55000', '22023', '42501', 'P0002']);
const definitive = (e: RpcError | null) => !!e?.code && BUSINESS.has(e.code);

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> {
  try {
    const { data, error } = await supabase.rpc(name as never, args as never);
    return { data: data as T, error: error as RpcError | null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

function payloadOf(op: FiscalOp): Record<string, unknown> {
  const ids = op.signs.map((s) => s.eventId).filter((x): x is string => !!x);
  if (!op.signs.length) return op.payload;
  return { ...op.payload, [op.eventField]: op.eventField === 'fiscal_event_id' ? ids[0] ?? null : ids };
}

async function submit<T>(runtime: KassaRuntime, op: FiscalOp) {
  if (op.signs.length && !(await runtime.flushOutbox())) return { data: null, error: { message: 'outbox' } as RpcError };
  return rpc<T>(op.rpc, { p_tenant_id: runtime.device.tenantId, p_device_id: runtime.device.deviceUuid, p: payloadOf(op) });
}

/** Teken wat nog niet getekend is. 'unreachable' = later identiek opnieuw; 'rejected' = niets getekend. */
async function signAll(runtime: KassaRuntime, op: FiscalOp): Promise<'signed' | 'unreachable' | { rejected: string }> {
  for (const s of op.signs) {
    if (s.eventId) continue;
    const out = await runtime.sign(s.name, s.data, { staffId: op.staffId ?? undefined, reference: op.id });
    if (out.kind === 'unreachable') return 'unreachable';
    if (out.kind === 'rejected') return { rejected: JSON.stringify(out.errors ?? '').slice(0, 200) };
    s.eventId = out.eventId ?? null;
    s.result = out.result;
    upsert(runtime.device.tenantId, { ...op, status: 'unsigned' });
  }
  return 'signed';
}

const signedEvents = (op: FiscalOp): SignedEvent[] => op.signs.filter((s) => s.result && s.data).map((s) => ({ name: s.name, isTraining: false, data: s.data, result: s.result ?? null }));

/**
 * Voer een handeling uit. `op.signs` leeg = niet-fiscaal. Bij een weigering van de zwarte doos
 * vóór de eerste handtekening gebeurt er niets (onRejected, bv. een rapportnummer vrijgeven).
 */
export async function runFiscalOp<T>(runtime: KassaRuntime, op: FiscalOp, opts: { onRejected?: () => Promise<void> } = {}): Promise<FiscalOpOutcome<T>> {
  const tenantId = runtime.device.tenantId;
  if (inFlight.has(op.id) || readAll(tenantId).some((x) => x.id === op.id && x.status !== 'unsigned')) return { ok: false, reason: 'pending_elsewhere' };
  inFlight.add(op.id);
  try {
    return await runOnce<T>(runtime, op, opts);
  } finally {
    inFlight.delete(op.id);
  }
}

async function runOnce<T>(runtime: KassaRuntime, op: FiscalOp, opts: { onRejected?: () => Promise<void> }): Promise<FiscalOpOutcome<T>> {
  const tenantId = runtime.device.tenantId;
  if (op.signs.length) {
    // Review M5: bewaard vóór het eerste bericht naar de FDM vertrekt.
    upsert(tenantId, { ...op, status: 'unsigned' });
    let r;
    try { r = await signAll(runtime, op); } catch (e) {
      if (e instanceof FiscalUnavailableError) {
        // Review ronde 2 (N5): niets kon vertrekken; zonder handtekening de handeling vergeten.
        if (!op.signs.some((s) => s.eventId)) { drop(tenantId, op.id); await opts.onRejected?.(); }
        return { ok: false, reason: e.message as FiscalOpFailure };
      }
      throw e;
    }
    if (r === 'unreachable') {
      upsert(tenantId, { ...op, status: 'unsigned' });
      return { ok: false, reason: 'fdm_unreachable' };
    }
    if (typeof r === 'object') {
      // Iets al getekend (rapport: omzet wel, gebruikers niet)? Dan bewaren voor SellQo.
      if (op.signs.some((s) => s.eventId)) {
        upsert(tenantId, { ...op, status: 'rejected', error: r.rejected });
        try { await runtime.audit('fiscal_op_partly_signed', { op_id: op.id, rpc: op.rpc, error: r.rejected }); } catch { /* offline */ }
        return { ok: false, reason: 'signed_rejected', detail: r.rejected };
      }
      drop(tenantId, op.id);
      await opts.onRejected?.();
      return { ok: false, reason: 'fdm_rejected', detail: r.rejected };
    }
  }
  // Write-ahead: alles wat getekend is of naar de server moet, staat op het toestel.
  upsert(tenantId, { ...op, status: 'pending' });
  const res = await submit<T>(runtime, op);
  if (res.error && !definitive(res.error)) return { ok: true, pending: true, data: null, signed: signedEvents(op) };
  if (res.error) {
    if (op.signs.length) {
      upsert(tenantId, { ...op, status: 'rejected', error: res.error.message ?? 'error' });
      try { await runtime.audit('signed_op_rejected', { op_id: op.id, rpc: op.rpc, error: res.error.message ?? null }); } catch { /* offline */ }
      return { ok: false, reason: 'signed_rejected', detail: res.error.message };
    }
    drop(tenantId, op.id);
    return { ok: false, reason: 'server', detail: res.error.message };
  }
  drop(tenantId, op.id);
  return { ok: true, pending: false, data: res.data, signed: signedEvents(op) };
}

let retrying: Promise<{ done: number; rejected: { op: FiscalOp; error: string }[] }> | null = null;

/** Wachtende handelingen opnieuw (achtergrond, één run tegelijk). */
export function retryFiscalOps(runtime: KassaRuntime) {
  if (retrying) return retrying;
  retrying = (async () => {
    const out = { done: 0, rejected: [] as { op: FiscalOp; error: string }[] };
    const tenantId = runtime.device.tenantId;
    for (const op of readPendingOps(tenantId)) {
      if (inFlight.has(op.id)) continue;
      // Een ongetekend bericht zonder inhoud kan niet identiek opnieuw (zou niet mogen voorkomen,
      // zie storable): niet raden, als geweigerd laten staan voor SellQo.
      if (op.signs.some((s) => !s.eventId && !s.data)) { upsert(tenantId, { ...op, status: 'rejected', error: 'bericht niet meer op het toestel' }); continue; }
      inFlight.add(op.id);
      try {
      if (op.status === 'unsigned') {
        let r;
        try { r = await signAll(runtime, op); } catch (e) {
          if (e instanceof FiscalUnavailableError && !op.signs.some((s) => s.eventId)) drop(tenantId, op.id);
          continue;
        }
        if (r === 'unreachable') continue;
        if (typeof r === 'object') {
          if (op.signs.some((s) => s.eventId)) { upsert(tenantId, { ...op, status: 'rejected', error: r.rejected }); out.rejected.push({ op, error: r.rejected }); }
          else drop(tenantId, op.id);
          continue;
        }
        upsert(tenantId, { ...op, status: 'pending' });
      }
      const res = await submit(runtime, op);
      if (res.error && !definitive(res.error)) return out;
      if (res.error) {
        if (op.signs.length) { upsert(tenantId, { ...op, status: 'rejected', error: res.error.message ?? 'error' }); out.rejected.push({ op, error: res.error.message ?? 'error' }); }
        else drop(tenantId, op.id);
      } else {
        drop(tenantId, op.id);
        out.done += 1;
      }
      } finally {
        inFlight.delete(op.id);
      }
    }
    return out;
  })().finally(() => { retrying = null; });
  return retrying;
}

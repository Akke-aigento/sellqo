// TAFEL-3 — X- en Z-rapporten (RPT-01..RPT-09).
//
// Volgorde: kassa_report_begin (Z: doorlopend nummer reserveren, periode vastleggen) → in een
// GKS-zaak het omzet- en gebruikersrapport tekenen uit de ondertekende events van die periode
// (kassa_report_source) → kassa_report_finish (cijfers uit SellQo + de twee events).
// Weigert de zwarte doos vóór er iets getekend is, dan wordt het nummer vrijgegeven.
//
// De events bevatten werknemersnummers (INSZ). Ze leven enkel in het geheugen tijdens het
// tekenen; het toestel bewaart ze niet en drukt ze nooit af (print: staffDirectory).
// Automatische Z (RPT-03): voor elke bedrijfsdag zonder Z, met de robotgebruiker.
import { supabase } from '@/integrations/supabase/client';
import { buildReportTurnover, buildReportUser } from '../fiscal/builders';
import { ROBOT_EMPLOYEE_ID } from '../fiscal/identity';
import type { AnyFiscalInput, MutationName, SignResult } from '../fiscal/types';
import type { SignedEvent } from '../fiscal/reports';
import { FiscalUnavailableError, type KassaRuntime } from './runtime';
import { readPendingOps, retryFiscalOps, runFiscalOp, type FiscalOpOutcome } from './fiscalOps';

export type ReportKind = 'X' | 'Z';

export interface ReportData {
  from: string; to: string;
  sales: { count: number; total_cents: number; vat_cents: number; net_cents: number; discount_cents: number };
  vats: { rate: number; gross_cents: number; vat_cents: number; net_cents: number }[];
  payments: { method: string; cents: number }[];
  rounding_cents: number;
  tips: { method: string; cents: number }[];
  cash: { in_cents: number; out_cents: number; count: number };
  voided: { count: number; total_cents: number };
  corrections: { count: number; total_cents: number };
  staff: { staff_id: string | null; name: string; count: number; total_cents: number; tips_cents: number }[];
  shifts: { terminal_id: string; closed_at: string; opening_cents: number; expected_cents: number; counted_cents: number; difference_cents: number }[];
  drawer_opens: number;
  open_checks: number;
}

export interface ReportResult {
  id: string; kind: ReportKind; report_no: number | null; booking_date: string; period_start: string; period_end: string; data: ReportData;
}

interface Begin {
  id: string; report_no?: number | null; booking_date: string; period_start: string; period_end: string; fiscal: boolean;
  /** Een onafgewerkte Z met al een ondertekend rapport: die eerst afwerken (andere id). */
  resume?: boolean;
  /** Al ondertekende rapportsoorten voor deze id. */
  signed?: string[];
}

interface RpcError { code?: string; message?: string }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> {
  try {
    const { data, error } = await supabase.rpc(name as never, args as never);
    return { data: data as T, error: error as RpcError | null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;

/** Bron-events (request/response zoals bewaard) → ondertekende events voor de rapportberekening. */
export function eventsFromSource(rows: { mutation: string; is_training: boolean; request_body: unknown; response_body: unknown }[]): SignedEvent[] {
  const out: SignedEvent[] = [];
  for (const r of rows) {
    try {
      const req = json(r.request_body) as { variables?: { data?: AnyFiscalInput } };
      const res = json(r.response_body) as { data?: Record<string, SignResult> };
      const data = req.variables?.data;
      const result = res.data?.[r.mutation];
      if (data && result) out.push({ name: r.mutation as MutationName, isTraining: !!r.is_training, data, result });
    } catch { /* onleesbaar event: telt niet mee, de server-Z toont het verschil */ }
  }
  return out;
}

export interface ReportWho { staffId: string | null; employeeId: string | null; auto?: boolean }

export type ReportOutcome = FiscalOpOutcome<ReportResult> | { ok: false; reason: 'closed' | 'not_allowed'; detail?: string; pending?: undefined; data?: undefined; signed?: undefined };

/** Maak een X (tussenstand) of Z (afsluiting) voor een bedrijfsdag (standaard vandaag). */
export async function makeReport(runtime: KassaRuntime, who: ReportWho, kind: ReportKind, opts: { bookingDate?: string } = {}): Promise<ReportOutcome> {
  const tenantId = runtime.device.tenantId;
  const auto = !!who.auto;
  // Review M7: eerst eigen ondertekende events in de cloud zetten, anders mist het rapport ze.
  if (runtime.isFiscal && !(await runtime.flushOutbox())) return { ok: false, reason: 'offline', detail: 'outbox' };
  // Review ronde 2 (N3): een rapport dat dit toestel nog bewaart (ongetekend of niet doorgestuurd)
  // gaat eerst identiek door; nooit een nieuw bericht voor dezelfde Z bouwen.
  if (readPendingOps(tenantId).some((o) => o.rpc === 'kassa_report_finish')) {
    await retryFiscalOps(runtime);
    if (readPendingOps(tenantId).some((o) => o.rpc === 'kassa_report_finish')) return { ok: false, reason: 'pending_elsewhere' };
  }
  const begin = await rpc<Begin>('kassa_report_begin', {
    p_tenant_id: tenantId, p_device_id: runtime.device.deviceUuid,
    p: { id: crypto.randomUUID(), kind, booking_date: opts.bookingDate ?? null, staff_id: who.staffId, auto },
  });
  if (begin.error || !begin.data) {
    if (begin.error?.code === '55000') return { ok: false, reason: 'closed', detail: begin.error.message };
    if (begin.error?.code === '42501') return { ok: false, reason: 'not_allowed', detail: begin.error.message };
    return { ok: false, reason: begin.error?.code ? 'server' : 'offline', detail: begin.error?.message };
  }
  const b = begin.data;
  // Bij resume werkt dit toestel een eerder begonnen Z af: die id, dat nummer en die periode.
  const id = b.id;
  const already = new Set(b.signed ?? []);
  const release = async () => { await rpc('kassa_report_release', { p_tenant_id: tenantId, p_report_id: id }); };
  const payload = { id, kind, booking_date: b.booking_date, terminal_id: runtime.device.terminalRowId, staff_id: who.staffId, auto };

  const signs: { name: MutationName; data: AnyFiscalInput }[] = [];
  if (b.fiscal && !runtime.isFiscal) { await release(); return { ok: false, reason: 'fiscal_not_configured' }; }
  if (runtime.isFiscal) {
    const employeeId = auto ? ROBOT_EMPLOYEE_ID : who.employeeId;
    if (!employeeId) { await release(); return { ok: false, reason: 'no_insz' }; }
    const src = await rpc<{ mutation: string; is_training: boolean; request_body: unknown; response_body: unknown }[]>('kassa_report_source', { p_tenant_id: tenantId, p_report_id: id, p_device_id: runtime.device.deviceUuid });
    if (src.error) { await release(); return { ok: false, reason: src.error.code ? 'server' : 'offline', detail: src.error.message }; }
    const events = eventsFromSource(src.data ?? []);
    const z = kind === 'Z' && b.report_no ? { reportNo: b.report_no, reportBookingDate: b.booking_date } : null;
    try {
      const ctx = runtime.posContext();
      const tName: MutationName = kind === 'Z' ? 'signReportTurnoverZ' : 'signReportTurnoverX';
      const uName: MutationName = kind === 'Z' ? 'signReportUserZ' : 'signReportUserX';
      // Enkel wat nog niet ondertekend is (resume na een afgebroken Z).
      if (!already.has(tName)) signs.push({ name: tName, data: buildReportTurnover(ctx, await runtime.meta(tName, employeeId, 'PAPER'), events, z) });
      if (!already.has(uName)) signs.push({ name: uName, data: buildReportUser(ctx, await runtime.meta(uName, employeeId, 'PAPER'), events, z) });
    } catch (e) {
      if (!already.size) await release();
      if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as 'fiscal_not_configured' };
      throw e;
    }
  }
  return runFiscalOp<ReportResult>(runtime, {
    id, rpc: 'kassa_report_finish', eventField: 'fiscal_event_ids', signs, staffId: who.staffId, status: 'unsigned', at: new Date().toISOString(), payload,
  }, { onRejected: already.size ? undefined : release });
}

let autoRunning = false;

/** Ontbrekende Z's aanvullen (RPT-03). Een ander toestel dat net hetzelfde doet = 'closed', geen fout. */
export async function autoZ(runtime: KassaRuntime): Promise<{ made: number; failed: number }> {
  if (autoRunning) return { made: 0, failed: 0 };
  autoRunning = true;
  try {
    const due = await rpc<string[]>('kassa_report_due', { p_tenant_id: runtime.device.tenantId });
    let made = 0;
    let failed = 0;
    for (const day of due.data ?? []) {
      const r = await makeReport(runtime, { staffId: null, employeeId: null, auto: true }, 'Z', { bookingDate: day });
      if (r.ok) made += 1;
      else if (r.reason !== 'closed') failed += 1;
    }
    return { made, failed };
  } finally {
    autoRunning = false;
  }
}

/** Laatste rapporten van de zaak (lezen via RLS). */
export async function recentReports(tenantId: string, limit = 30): Promise<ReportResult[]> {
  const { data, error } = await supabase.from('kassa_reports' as never)
    .select('id, kind, report_no, booking_date, period_start, period_end, data')
    .eq('tenant_id' as never, tenantId as never)
    .order('created_at' as never, { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReportResult[];
}

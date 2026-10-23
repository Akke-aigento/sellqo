// TAFEL-2 — een rekening afrekenen.
//
// Volgorde (FDM-04: eerst tekenen, dan doorvoeren):
//   1. open ronde versturen; totaal uit de verstuurde lijnen; betaalplan (pay.ts);
//   2. horeca_pay_begin: de server zet de rekening "in betaling" (claim) en legt lijnen en
//      totaal vast. Een tweede toestel kan ze dan niet wijzigen of tegelijk afrekenen, dus
//      een rekening wordt nooit twee keer getekend;
//   3. signSale (fiscaal); mislukt dat: claim vrijgeven (horeca_pay_release);
//   4. meteen na de handtekening: betaling op het toestel bewaren (write-ahead), dan
//      horeca_pay. Lukt dat: weg uit de wachtrij.
//
// Valt de verbinding weg na de handtekening, dan blijft de betaling op het toestel en gaat ze
// vanzelf opnieuw (zelfde id = idempotent). Weigert de server een getekende betaling (bv.
// claim verlopen en rekening intussen gewijzigd), dan blijft ze als "geweigerd" staan: de
// rekening blijft op dit toestel vergrendeld en het auditspoor meldt het; nooit stil opnieuw
// tekenen. Rechtzetten (terugname) gebeurt bewust, niet automatisch.
import { supabase } from '@/integrations/supabase/client';
import { buildSale } from '../../fiscal/builders';
import type { SaleInput, SignResult } from '../../fiscal/types';
import type { SignedEvent } from '../../print/types';
import { sendRound, type ActionCtx } from './actions';
import { consolidatedSpecs, costCenterOf, roundLines } from './fiscalLines';
import { normalizedTenders, paymentSpecs, planPayment, PaymentPlanError, type PaymentPlan, type Tender, type TipMethod } from './pay';
import { lineTotalCents, type Check } from './types';
import { FiscalUnavailableError } from '../runtime';

export interface PayPayload {
  id: string;
  check_id: string;
  terminal_id: string;
  staff_id: string;
  expected_total_cents: number;
  /** De verstuurde lijnen die afgerekend (en ondertekend) worden. */
  line_ids: string[];
  tenders: Tender[];
  rounding_cents: number;
  tip_cents: number;
  tip_method: TipMethod | null;
  fiscal_event_id: string | null;
}

/** Op het toestel bewaarde betaling: 'pending' = nog door te sturen; 'rejected' = getekend maar geweigerd. */
export interface PendingPay { payload: PayPayload; status: 'pending' | 'rejected'; error?: string; at: string }

export type PayFailure = 'offline' | 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'fdm_rejected' | 'fdm_unreachable'
  | 'server' | 'changed' | 'plan' | 'nothing' | 'pending_elsewhere' | 'nothing_sent' | 'being_paid' | 'signed_rejected';

export type PayOutcome =
  | { ok: true; pending: boolean; receiptNumber: string | null; plan: PaymentPlan; signed: SignedEvent | null; reason?: undefined; detail?: undefined }
  | { ok: false; reason: PayFailure; detail?: string; pending?: undefined; receiptNumber?: undefined; plan?: undefined; signed?: undefined };

/** Totaal dat de server rekent: alle verstuurde lijnen (na versturen zijn er geen ontwerpen). */
export function payableTotal(c: Pick<Check, 'lines'>): number {
  return c.lines.filter((l) => l.state === 'sent').reduce((s, l) => s + lineTotalCents(l), 0);
}

// ---------------------------------------------------------------- wachtende betalingen

const pendingKey = (tenantId: string) => `sq_kassa_pay|${tenantId}`;

function readAll(tenantId: string): PendingPay[] {
  try {
    const raw = JSON.parse(localStorage.getItem(pendingKey(tenantId)) ?? '[]') as (PendingPay | PayPayload)[];
    // Oudere vorm (enkel payload) blijft leesbaar.
    return raw.map((x) => ('payload' in x ? x : { payload: x, status: 'pending', at: new Date().toISOString() }));
  } catch { return []; }
}
function writeAll(tenantId: string, rows: PendingPay[]) {
  try { localStorage.setItem(pendingKey(tenantId), JSON.stringify(rows)); } catch { /* privémodus */ }
}
function upsert(tenantId: string, row: PendingPay) {
  writeAll(tenantId, [...readAll(tenantId).filter((x) => x.payload.id !== row.payload.id), row]);
}
function drop(tenantId: string, id: string) {
  writeAll(tenantId, readAll(tenantId).filter((x) => x.payload.id !== id));
}

/** Betalingen die nog naar de server moeten (zonder de geweigerde). */
export const readPendingPays = (tenantId: string): PayPayload[] => readAll(tenantId).filter((x) => x.status === 'pending').map((x) => x.payload);
/** Getekende betalingen die de server weigerde: blijven staan tot SellQo ze rechtzet. */
export const readRejectedPays = (tenantId: string): PendingPay[] => readAll(tenantId).filter((x) => x.status === 'rejected');

/** Is een getekende betaling van deze rekening door de server geweigerd (op dit toestel)? */
export const isRejectedPay = (tenantId: string, checkId: string) => readRejectedPays(tenantId).some((p) => p.payload.check_id === checkId);

/** Heeft deze rekening een getekende betaling op dit toestel (wachtend of geweigerd)? */
export const hasPendingPay = (tenantId: string, checkId: string) => readAll(tenantId).some((p) => p.payload.check_id === checkId);

interface RpcError { code?: string; message?: string }
type RpcResult<T> = { data: T | null; error: RpcError | null };

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  try {
    const { data, error } = await supabase.rpc(name as never, args as never);
    return { data: data as T, error: error as RpcError | null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Definitieve weigering = enkel de gekende businesscodes van de server. Al de rest (geen
 * antwoord, verlopen sessie PGRST301, 5xx, time-out 57014, …) = later opnieuw proberen:
 * een getekende betaling gooien we nooit weg op een twijfelachtige fout.
 */
const BUSINESS = new Set(['40001', '55000', '22023', '42501', 'P0002']);
export const isDefinitiveRejection = (e: RpcError | null) => !!e?.code && BUSINESS.has(e.code);

const inFlight = new Set<string>();
let retrying: Promise<RetryResult> | null = null;
type RetryResult = { done: number; rejected: { payment: PayPayload; error: string }[] };

async function submit(ctx: Pick<ActionCtx, 'runtime'>, p: PayPayload): Promise<RpcResult<{ ok: boolean; receipt_number?: string | null }>> {
  inFlight.add(p.id);
  try {
    if (!(await ctx.runtime.flushOutbox())) return { data: null, error: { message: 'outbox' } };
    return await rpc('horeca_pay', { p_tenant_id: ctx.runtime.device.tenantId, p_device_id: ctx.runtime.device.deviceUuid, p_payment: p });
  } finally {
    inFlight.delete(p.id);
  }
}

async function markRejected(ctx: Pick<ActionCtx, 'runtime'>, p: PayPayload, error: string) {
  upsert(ctx.runtime.device.tenantId, { payload: p, status: 'rejected', error, at: new Date().toISOString() });
  try { await ctx.runtime.audit('signed_sale_rejected', { payment_id: p.id, check_id: p.check_id, fiscal_event_id: p.fiscal_event_id, error }); } catch { /* offline: blijft op het toestel */ }
}

/** Wachtende betalingen opnieuw versturen (één run tegelijk). */
export function retryPendingPays(ctx: Pick<ActionCtx, 'runtime'>): Promise<RetryResult> {
  if (retrying) return retrying;
  retrying = (async () => {
    const out: RetryResult = { done: 0, rejected: [] };
    for (const p of readPendingPays(ctx.runtime.device.tenantId)) {
      if (inFlight.has(p.id)) continue;
      const r = await submit(ctx, p);
      if (r.error && !isDefinitiveRejection(r.error)) return out; // nog offline: later opnieuw
      if (r.error) {
        await markRejected(ctx, p, r.error.message ?? 'error');
        out.rejected.push({ payment: p, error: r.error.message ?? 'error' });
      } else {
        drop(ctx.runtime.device.tenantId, p.id);
        out.done += 1;
      }
    }
    return out;
  })().finally(() => { retrying = null; });
  return retrying;
}

// ---------------------------------------------------------------- afrekenen

const failFromCode = (e: RpcError): PayFailure => (e.code === '40001' ? 'changed' : e.code === '55000' ? 'being_paid' : 'server');

export async function payCheck(ctx: ActionCtx, checkId: string, tenders: Tender[], tip = 0, tipMethod: TipMethod | null = null): Promise<PayOutcome> {
  const tenantId = ctx.runtime.device.tenantId;
  if (hasPendingPay(tenantId, checkId)) return { ok: false, reason: 'pending_elsewhere' };
  try {
    await ctx.store.flush();
    if (ctx.store.pendingCount) return { ok: false, reason: 'offline' };
    const c0 = ctx.store.check(checkId);
    if (!c0) return { ok: false, reason: 'server', detail: 'check_missing' };
    if (roundLines(c0).length) {
      const sent = await sendRound(ctx, checkId);
      if (!sent.ok) return { ok: false, reason: sent.reason === 'nothing' ? 'nothing' : sent.reason, detail: sent.detail };
      await ctx.store.refresh();
    }
    const c = ctx.store.check(checkId);
    if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
    if (c.lines.some((l) => l.pending || l.state === 'draft')) return { ok: false, reason: 'offline' };
    if (!c.lines.some((l) => l.state === 'sent')) return { ok: false, reason: 'nothing_sent' };

    const total = payableTotal(c);
    let plan: PaymentPlan;
    try {
      plan = planPayment(total, tenders, tip, tipMethod);
    } catch (e) {
      if (e instanceof PaymentPlanError) return { ok: false, reason: 'plan', detail: e.code };
      throw e;
    }
    const lineIds = c.lines.filter((l) => l.state === 'sent').map((l) => l.id);
    const paymentId = crypto.randomUUID();

    // Claim vóór het tekenen.
    const claim = await rpc<{ ok: boolean; fiscal: boolean }>('horeca_pay_begin', {
      p_tenant_id: tenantId, p_device_id: ctx.runtime.device.deviceUuid,
      p: { check_id: c.id, payment_id: paymentId, line_ids: lineIds, expected_total_cents: total },
    });
    if (claim.error) return isDefinitiveRejection(claim.error) ? { ok: false, reason: failFromCode(claim.error), detail: claim.error.message } : { ok: false, reason: 'offline' };
    const release = () => rpc('horeca_pay_release', { p_tenant_id: tenantId, p_check_id: c.id, p_payment_id: paymentId });
    // Een GKS-zaak boekt nooit zonder handtekening, ook niet via een kassa op 'off'.
    if (claim.data?.fiscal && !ctx.runtime.isFiscal) { await release(); return { ok: false, reason: 'fiscal_not_configured' }; }

    // Fiscaal: één signSale over de geconsolideerde stand + alle betaalmiddelen (UC4119).
    let signed: SignedEvent | null = null;
    let eventId: string | null = null;
    if (ctx.runtime.isFiscal) {
      const fail = async (o: PayOutcome) => { await release(); return o; };
      if (!ctx.employeeId) return fail({ ok: false, reason: 'no_insz' });
      let data: SaleInput;
      try {
        data = buildSale(ctx.runtime.posContext(), await ctx.runtime.meta('signSale', ctx.employeeId, 'PAPER'), {
          lines: consolidatedSpecs(c),
          payments: paymentSpecs(plan),
          costCenter: costCenterOf(c, ctx.tableLabel(c.table_id)),
        });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) return fail({ ok: false, reason: e.message as 'fiscal_not_configured' });
        await release();
        throw e;
      }
      // Wat de FDM tekent, moet exact het bedrag zijn dat de server rekent.
      if (Math.round(data.transaction.transactionTotal * 100) !== total) return fail({ ok: false, reason: 'server', detail: 'total_mismatch' });
      let out;
      try {
        out = await ctx.runtime.sign('signSale', data, { staffId: ctx.staffId });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) return fail({ ok: false, reason: e.message as 'fdm_not_available' });
        await release();
        throw e;
      }
      if (out.kind === 'rejected') return fail({ ok: false, reason: 'fdm_rejected', detail: JSON.stringify(out.errors ?? '').slice(0, 200) });
      if (out.kind !== 'signed') return fail({ ok: false, reason: 'fdm_unreachable' });
      eventId = out.eventId ?? null;
      signed = { name: 'signSale', isTraining: false, data, result: out.result as SignResult };
    }

    const payload: PayPayload = {
      id: paymentId, check_id: c.id, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId,
      expected_total_cents: total, line_ids: lineIds, tenders: normalizedTenders(plan), rounding_cents: plan.rounding,
      tip_cents: plan.tip, tip_method: plan.tipMethod, fiscal_event_id: eventId,
    };
    // Write-ahead: getekend = bewaard, vóór het netwerk (app dicht, batterij leeg, herladen).
    if (signed) upsert(tenantId, { payload, status: 'pending', at: new Date().toISOString() });

    const r = await submit(ctx, payload);
    if (r.error && !isDefinitiveRejection(r.error)) {
      if (signed) return { ok: true, pending: true, receiptNumber: null, plan, signed };
      await release();
      return { ok: false, reason: 'offline' };
    }
    if (r.error) {
      if (signed) {
        await markRejected(ctx, payload, r.error.message ?? 'error');
        return { ok: false, reason: 'signed_rejected', detail: r.error.message };
      }
      await release();
      return { ok: false, reason: failFromCode(r.error), detail: r.error.message };
    }
    drop(tenantId, payload.id);
    await ctx.store.refresh();
    return { ok: true, pending: false, receiptNumber: r.data?.receipt_number ?? null, plan, signed };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

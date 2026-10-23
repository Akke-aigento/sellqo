// TAFEL-2 — een rekening afrekenen.
//
// Volgorde (FDM-04): open ronde eerst versturen → totaal uit de verstuurde lijnen →
// betaalplan (pay.ts) → signSale ondertekenen (fiscaal) → horeca_pay op de server, die het
// totaal zelf herberekent, de afronding narekent, het event controleert en de rekening in
// één transactie sluit.
//
// Valt de verbinding weg NA de handtekening, dan heeft de FDM de verkoop al. De betaling
// blijft dan op het toestel staan (localStorage, zelfde id = idempotent) en gaat opnieuw
// zodra er verbinding is; de rekening is intussen vergrendeld op dit toestel.
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

export type PayFailure = 'offline' | 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'fdm_rejected' | 'fdm_unreachable'
  | 'server' | 'changed' | 'plan' | 'nothing' | 'pending_elsewhere' | 'nothing_sent';

export type PayOutcome =
  | { ok: true; pending: boolean; receiptNumber: string | null; plan: PaymentPlan; signed: SignedEvent | null; reason?: undefined; detail?: undefined }
  | { ok: false; reason: PayFailure; detail?: string; pending?: undefined; receiptNumber?: undefined; plan?: undefined; signed?: undefined };

/** Totaal dat de server rekent: alle verstuurde lijnen (na versturen zijn er geen ontwerpen). */
export function payableTotal(c: Pick<Check, 'lines'>): number {
  return c.lines.filter((l) => l.state === 'sent').reduce((s, l) => s + lineTotalCents(l), 0);
}

// ---------------------------------------------------------------- wachtende betalingen

const pendingKey = (tenantId: string) => `sq_kassa_pay|${tenantId}`;

export function readPendingPays(tenantId: string): PayPayload[] {
  try { return JSON.parse(localStorage.getItem(pendingKey(tenantId)) ?? '[]') as PayPayload[]; } catch { return []; }
}
function writePendingPays(tenantId: string, rows: PayPayload[]) {
  try { localStorage.setItem(pendingKey(tenantId), JSON.stringify(rows)); } catch { /* privémodus */ }
}
function addPendingPay(tenantId: string, p: PayPayload) {
  writePendingPays(tenantId, [...readPendingPays(tenantId).filter((x) => x.id !== p.id), p]);
}
function dropPendingPay(tenantId: string, id: string) {
  writePendingPays(tenantId, readPendingPays(tenantId).filter((x) => x.id !== id));
}

/** Is er voor deze rekening een betaling die nog naar de server moet? */
export const hasPendingPay = (tenantId: string, checkId: string) => readPendingPays(tenantId).some((p) => p.check_id === checkId);

interface RpcError { code?: string; message?: string }
type RpcResult = { data: { ok: boolean; receipt_number?: string | null } | null; error: RpcError | null };

async function callPay(tenantId: string, deviceId: string, p: PayPayload): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('horeca_pay' as never, { p_tenant_id: tenantId, p_device_id: deviceId, p_payment: p } as never);
  return { data: data as RpcResult['data'], error: error as RpcError | null };
}

/** Netwerkfout (geen antwoord) of een echte weigering van de server? */
const isNetwork = (e: RpcError | null) => !!e && (!e.code || e.code === 'FETCH_ERROR' || /fetch|network|Failed to/i.test(e.message ?? ''));

/**
 * Wachtende betalingen opnieuw versturen. Weigert de server (bv. rekening intussen
 * gewijzigd), dan komt dat in het auditspoor: de FDM heeft de verkoop, de rekening niet.
 * Geeft de weigeringen terug zodat het scherm ze kan tonen.
 */
export async function retryPendingPays(ctx: Pick<ActionCtx, 'runtime'>): Promise<{ done: number; rejected: { payment: PayPayload; error: string }[] }> {
  const tenantId = ctx.runtime.device.tenantId;
  const rows = readPendingPays(tenantId);
  const out = { done: 0, rejected: [] as { payment: PayPayload; error: string }[] };
  if (!rows.length) return out;
  if (!(await ctx.runtime.flushOutbox())) return out;
  for (const p of rows) {
    const r = await callPay(tenantId, ctx.runtime.device.deviceUuid, p);
    if (r.error && isNetwork(r.error)) return out; // nog steeds offline: later opnieuw
    dropPendingPay(tenantId, p.id);
    if (r.error) {
      out.rejected.push({ payment: p, error: r.error.message ?? 'error' });
      try { await ctx.runtime.audit('signed_sale_rejected', { payment_id: p.id, check_id: p.check_id, fiscal_event_id: p.fiscal_event_id, error: r.error.message ?? null }); } catch { /* offline */ }
    } else {
      out.done += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- afrekenen

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

    // Fiscaal: één signSale over de geconsolideerde stand + alle betaalmiddelen (UC4119).
    let signed: SignedEvent | null = null;
    let eventId: string | null = null;
    if (ctx.runtime.isFiscal) {
      if (!ctx.employeeId) return { ok: false, reason: 'no_insz' };
      let data: SaleInput;
      try {
        data = buildSale(ctx.runtime.posContext(), await ctx.runtime.meta('signSale', ctx.employeeId, 'PAPER'), {
          lines: consolidatedSpecs(c),
          payments: paymentSpecs(plan),
          costCenter: costCenterOf(c, ctx.tableLabel(c.table_id)),
        });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as 'fiscal_not_configured' };
        throw e;
      }
      // Wat de FDM tekent, moet exact het bedrag zijn dat de server rekent.
      if (Math.round(data.transaction.transactionTotal * 100) !== total) return { ok: false, reason: 'server', detail: 'total_mismatch' };
      let out;
      try {
        out = await ctx.runtime.sign('signSale', data, { staffId: ctx.staffId });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as 'fdm_not_available' };
        throw e;
      }
      if (out.kind === 'rejected') return { ok: false, reason: 'fdm_rejected', detail: JSON.stringify(out.errors ?? '').slice(0, 200) };
      if (out.kind !== 'signed') return { ok: false, reason: 'fdm_unreachable' };
      eventId = out.eventId ?? null;
      signed = { name: 'signSale', isTraining: false, data, result: out.result as SignResult };
    }

    const payload: PayPayload = {
      id: crypto.randomUUID(), check_id: c.id, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId,
      expected_total_cents: total, line_ids: c.lines.filter((l) => l.state === 'sent').map((l) => l.id), tenders: normalizedTenders(plan), rounding_cents: plan.rounding,
      tip_cents: plan.tip, tip_method: plan.tipMethod, fiscal_event_id: eventId,
    };

    const outboxOk = await ctx.runtime.flushOutbox();
    const r: RpcResult = outboxOk ? await callPay(tenantId, ctx.runtime.device.deviceUuid, payload) : { data: null, error: { message: 'Failed to fetch' } };
    if (r.error && isNetwork(r.error)) {
      if (signed) {
        // Ondertekend = de verkoop bestaat. Bewaren en later doorzetten.
        addPendingPay(tenantId, payload);
        return { ok: true, pending: true, receiptNumber: null, plan, signed };
      }
      return { ok: false, reason: 'offline' };
    }
    if (r.error) {
      if (signed) {
        try { await ctx.runtime.audit('signed_sale_rejected', { payment_id: payload.id, check_id: c.id, fiscal_event_id: eventId, error: r.error.message ?? null }); } catch { /* offline */ }
      }
      return { ok: false, reason: r.error.code === '40001' ? 'changed' : 'server', detail: r.error.message };
    }
    await ctx.store.refresh();
    return { ok: true, pending: false, receiptNumber: r.data?.receipt_number ?? null, plan, signed };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

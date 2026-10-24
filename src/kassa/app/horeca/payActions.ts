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
import { isCounter, lineTotalCents, payableLines, type Check } from './types';
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
  /** TAFEL-3, enkel aan de toog: keukenbonnen maken (standaard ja). */
  kitchen?: boolean;
  /** TAFEL-3 (review M2), enkel aan de toog: btw-label per lijn zoals getekend; de server controleert het. */
  line_vats?: Record<string, string>;
}

/**
 * Op het toestel bewaarde betaling:
 * - 'unsigned': de zwarte doos antwoordde niet; misschien tekende ze wel. Het bericht (sale)
 *   wordt identiek opnieuw gestuurd tot er een antwoord is. Claim blijft, rekening vergrendeld.
 * - 'pending': getekend, nog naar de server te sturen.
 * - 'rejected': getekend maar door de server geweigerd; blijft tot SellQo het rechtzet.
 */
export interface PendingPay {
  payload: PayPayload; status: 'unsigned' | 'pending' | 'rejected'; sale?: SaleInput; error?: string; at: string;
  /** TAFEL-3: reference van het event als het bericht geen costCenter heeft (toog). */
  reference?: string;
}

export type PayFailure = 'offline' | 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'fdm_rejected' | 'fdm_unreachable'
  | 'server' | 'changed' | 'plan' | 'nothing' | 'pending_elsewhere' | 'nothing_sent' | 'being_paid' | 'signed_rejected';

export type PayOutcome =
  | { ok: true; pending: boolean; receiptNumber: string | null; plan: PaymentPlan; signed: SignedEvent | null; reason?: undefined; detail?: undefined }
  | { ok: false; reason: PayFailure; detail?: string; pending?: undefined; receiptNumber?: undefined; plan?: undefined; signed?: undefined };

/**
 * Totaal dat de server rekent: aan tafel alle verstuurde lijnen (na versturen zijn er geen
 * ontwerpen), aan de toog de ontwerp-lijnen (TAFEL-3).
 */
export function payableTotal(c: Pick<Check, 'lines' | 'kind'>): number {
  return payableLines(c).reduce((s, l) => s + lineTotalCents(l), 0);
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

/** Betalingen die nog moeten (tekenen of naar de server), zonder de geweigerde. */
export const readPendingPays = (tenantId: string): PayPayload[] => readAll(tenantId).filter((x) => x.status !== 'rejected').map((x) => x.payload);

// Eén betaling-id per rekening zolang ze niet afgerond is: een nieuwe poging na een verloren
// antwoord is dan dezelfde betaling (idempotent op de server; dezelfde claim).
const payIdKey = (tenantId: string, checkId: string) => `sq_kassa_payid|${tenantId}|${checkId}`;
function paymentIdFor(tenantId: string, checkId: string): string {
  try {
    const k = payIdKey(tenantId, checkId);
    const v = localStorage.getItem(k);
    if (v) return v;
    const id = crypto.randomUUID();
    localStorage.setItem(k, id);
    return id;
  } catch { return crypto.randomUUID(); }
}
function forgetPaymentId(tenantId: string, checkId: string) {
  try { localStorage.removeItem(payIdKey(tenantId, checkId)); } catch { /* niets */ }
}
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
    const tenantId = ctx.runtime.device.tenantId;
    for (const row of readAll(tenantId).filter((x) => x.status !== 'rejected')) {
      let p = row.payload;
      if (inFlight.has(p.id)) continue;
      // Claim verlengen zolang het toestel ermee bezig is (zelfde betaling = toegestaan).
      await rpc('horeca_pay_begin', { p_tenant_id: tenantId, p_device_id: ctx.runtime.device.deviceUuid,
        p: { check_id: p.check_id, payment_id: p.id, line_ids: p.line_ids, expected_total_cents: p.expected_total_cents, line_vats: p.line_vats } });
      if (row.status === 'unsigned' && row.sale) {
        // Zelfde bericht, zelfde bytes (ID-11): de FDM tekent het of geeft het eerdere antwoord.
        let out2;
        try { out2 = await ctx.runtime.sign('signSale', row.sale, { reference: row.reference }); } catch { continue; }
        if (out2.kind === 'unreachable') continue;
        if (out2.kind === 'rejected') {
          // Aantoonbaar niet getekend: claim vrijgeven, betaling vergeten.
          await rpc('horeca_pay_release', { p_tenant_id: tenantId, p_check_id: p.check_id, p_payment_id: p.id });
          drop(tenantId, p.id);
          forgetPaymentId(tenantId, p.check_id);
          continue;
        }
        p = { ...p, fiscal_event_id: out2.eventId ?? null };
        upsert(tenantId, { payload: p, status: 'pending', at: new Date().toISOString() });
      }
      const r = await submit(ctx, p);
      if (r.error && !isDefinitiveRejection(r.error)) return out; // nog offline: later opnieuw
      if (r.error) {
        await markRejected(ctx, p, r.error.message ?? 'error');
        out.rejected.push({ payment: p, error: r.error.message ?? 'error' });
      } else {
        drop(tenantId, p.id);
        forgetPaymentId(tenantId, p.check_id);
        out.done += 1;
      }
    }
    return out;
  })().finally(() => { retrying = null; });
  return retrying;
}

// ---------------------------------------------------------------- afrekenen

const failFromCode = (e: RpcError): PayFailure => (e.code === '40001' ? 'changed' : e.code === '55000' ? 'being_paid' : 'server');

export async function payCheck(ctx: ActionCtx, checkId: string, tenders: Tender[], tip = 0, tipMethod: TipMethod | null = null,
  opts: { kitchen?: boolean } = {}): Promise<PayOutcome> {
  const tenantId = ctx.runtime.device.tenantId;
  if (hasPendingPay(tenantId, checkId)) return { ok: false, reason: 'pending_elsewhere' };
  try {
    await ctx.store.flush();
    if (ctx.store.pendingCount) return { ok: false, reason: 'offline' };
    const c0 = ctx.store.check(checkId);
    if (!c0) return { ok: false, reason: 'server', detail: 'check_missing' };
    // Toog (TAFEL-3): geen ronde vooraf; de ontwerp-lijnen worden rechtstreeks afgerekend.
    const counter = isCounter(c0);
    if (!counter && roundLines(c0).length) {
      const sent = await sendRound(ctx, checkId);
      if (!sent.ok) return { ok: false, reason: sent.reason === 'nothing' ? 'nothing' : sent.reason, detail: sent.detail };
      await ctx.store.refresh();
    }
    const c = ctx.store.check(checkId);
    if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
    if (c.lines.some((l) => l.pending)) return { ok: false, reason: 'offline' };
    if (!counter && c.lines.some((l) => l.state === 'draft')) return { ok: false, reason: 'offline' };
    if (!payableLines(c).length) return { ok: false, reason: counter ? 'nothing' : 'nothing_sent' };

    const total = payableTotal(c);
    let plan: PaymentPlan;
    try {
      plan = planPayment(total, tenders, tip, tipMethod);
    } catch (e) {
      if (e instanceof PaymentPlanError) return { ok: false, reason: 'plan', detail: e.code };
      throw e;
    }
    const lineIds = payableLines(c).map((l) => l.id);
    // Toog: geen costCenter in het bericht (directe verkoop, UC M110); het event hangt aan de rekening.
    const reference = counter ? c.reference : undefined;
    const kitchen = counter ? opts.kitchen ?? true : undefined;
    const lineVats = counter ? Object.fromEntries(payableLines(c).map((l) => [l.id, l.vat_label])) : undefined;
    const paymentId = paymentIdFor(tenantId, c.id);

    // Claim vóór het tekenen.
    const claim = await rpc<{ ok: boolean; fiscal: boolean }>('horeca_pay_begin', {
      p_tenant_id: tenantId, p_device_id: ctx.runtime.device.deviceUuid,
      p: { check_id: c.id, payment_id: paymentId, line_ids: lineIds, expected_total_cents: total, line_vats: lineVats },
    });
    const release = () => rpc('horeca_pay_release', { p_tenant_id: tenantId, p_check_id: c.id, p_payment_id: paymentId });
    if (claim.error) {
      if (isDefinitiveRejection(claim.error)) return { ok: false, reason: failFromCode(claim.error), detail: claim.error.message };
      // Antwoord kwijt: misschien staat de claim er wel. Best effort vrijgeven (zelfde id
      // bij een nieuwe poging verlengt ze anders gewoon).
      void release();
      return { ok: false, reason: 'offline' };
    }
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
          costCenter: counter ? null : costCenterOf(c, ctx.tableLabel(c.table_id)),
        });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) return fail({ ok: false, reason: e.message as 'fiscal_not_configured' });
        await release();
        throw e;
      }
      // Wat de FDM tekent, moet exact het bedrag zijn dat de server rekent.
      if (Math.round(data.transaction.transactionTotal * 100) !== total) return fail({ ok: false, reason: 'server', detail: 'total_mismatch' });
      // Review M5: het bericht staat op het toestel vóór het naar de FDM gaat. Valt de app weg
      // terwijl de FDM tekent, dan stuurt de achtergrond hetzelfde bericht opnieuw (ID-11).
      const unsigned: PendingPay = {
        payload: { id: paymentId, check_id: c.id, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId,
          expected_total_cents: total, line_ids: lineIds, tenders: normalizedTenders(plan), rounding_cents: plan.rounding,
          tip_cents: plan.tip, tip_method: plan.tipMethod, fiscal_event_id: null, kitchen, line_vats: lineVats },
        status: 'unsigned', sale: data, reference, at: new Date().toISOString(),
      };
      upsert(tenantId, unsigned);
      inFlight.add(paymentId);
      let out;
      try {
        out = await ctx.runtime.sign('signSale', data, { staffId: ctx.staffId, reference });
      } catch (e) {
        if (e instanceof FiscalUnavailableError) { drop(tenantId, paymentId); return fail({ ok: false, reason: e.message as 'fdm_not_available' }); }
        // Review ronde 2 (n2): onbekende fout = misschien wel getekend. Bewaard laten (claim
        // houden); de achtergrond stuurt hetzelfde bericht opnieuw.
        throw e;
      } finally {
        inFlight.delete(paymentId);
      }
      if (out.kind === 'rejected') { drop(tenantId, paymentId); return fail({ ok: false, reason: 'fdm_rejected', detail: JSON.stringify(out.errors ?? '').slice(0, 200) }); }
      if (out.kind !== 'signed') {
        // Geen antwoord ≠ niet getekend. Claim houden, bericht bewaard (hierboven) en identiek
        // opnieuw sturen (retryPendingPays); de rekening blijft vergrendeld op dit toestel.
        return { ok: false, reason: 'fdm_unreachable' };
      }
      eventId = out.eventId ?? null;
      signed = { name: 'signSale', isTraining: false, data, result: out.result as SignResult };
    }

    const payload: PayPayload = {
      id: paymentId, check_id: c.id, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId,
      expected_total_cents: total, line_ids: lineIds, tenders: normalizedTenders(plan), rounding_cents: plan.rounding,
      tip_cents: plan.tip, tip_method: plan.tipMethod, fiscal_event_id: eventId, kitchen, line_vats: lineVats,
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
      forgetPaymentId(tenantId, c.id);
      return { ok: false, reason: failFromCode(r.error), detail: r.error.message };
    }
    drop(tenantId, payload.id);
    forgetPaymentId(tenantId, c.id);
    await ctx.store.refresh();
    return { ok: true, pending: false, receiptNumber: r.data?.receipt_number ?? null, plan, signed };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

// TAFEL-1 — handelingen die fiscaal iets betekenen: ronde versturen (P/ORDER), voorrekening
// (P/PRE_BILL) en verplaatsen/splitsen/samenvoegen van verstuurde lijnen (P/COST_CENTER_CHANGE).
//
// Volgorde (FDM-04): eerst ondertekenen, dan pas de server laten doorvoeren. Weigert of
// mist de zwarte doos, dan gebeurt er niets: de ronde blijft open en de gebruiker ziet waarom.
// In niet-fiscale modus valt de handtekening weg; de rest is identiek.
import { buildCostCenterChange, buildOrder, buildPreBill } from '../../fiscal/builders';
import type { KassaRuntime } from '../runtime';
import { FiscalUnavailableError } from '../runtime';
import { consolidatedSpecs, costCenterOf, roundLines, roundSpecs, transferSpecs } from './fiscalLines';
import type { Command, CommandResult, HorecaStore } from './store';
import type { Check, CheckLine } from './types';
import { releaseIds, sendableIds } from './courses';

export type ActionOutcome =
  | { ok: true; result?: CommandResult; reason?: undefined; detail?: undefined }
  | { ok: false; reason: 'nothing' | 'offline' | 'no_insz' | 'fiscal_not_configured' | 'fdm_not_available' | 'fdm_rejected' | 'fdm_unreachable' | 'server' | 'changed' | 'not_allowed'; detail?: string };

export interface ActionCtx {
  store: HorecaStore;
  runtime: KassaRuntime;
  staffId: string;
  /** Naam zoals op het kasticket (nooit het INSZ). */
  staffName: string;
  employeeId: string | null;
  tableLabel: (tableId: string | null) => string | null;
  /** VASTE-KLANT-1: true = vaste plek van een klant (fiscaal CUSTOMER). Optioneel. */
  isRegular?: (tableId: string | null) => boolean;
  /** KASSA-0.6: rol van de medewerker met de PIN (owner/manager mogen producten aanpassen). */
  staffRole?: string;
  /**
   * KASSA-RECHTEN-1 (review 1): sessietoken van de aanmelding (kassa_staff_login). Enkel daarmee doet een
   * eigenaar/verantwoordelijke korting, annuleren of kas uit zonder akkoord. Leeft enkel in het geheugen.
   */
  staffToken?: string | null;
  /** GANGEN-1: gangen staan aan in deze zaak (latere gangen wachten tot ze vrijgegeven worden). */
  coursesEnabled?: boolean;
}

/** Het sessietoken mee met de commando's waar de server het nodig heeft (enkel daar). */
export const tokenOf = (ctx: Pick<ActionCtx, 'staffToken'>) => (ctx.staffToken ? { staff_token: ctx.staffToken } : {});

async function signOrFail(ctx: ActionCtx, fn: () => Promise<{ kind: string; eventId?: string; errors?: unknown }>): Promise<{ eventId: string | null } | ActionOutcome> {
  if (!ctx.runtime.isFiscal) return { eventId: null };
  if (!ctx.employeeId) return { ok: false, reason: 'no_insz' };
  try {
    const out = await fn();
    if (out.kind === 'signed') return { eventId: out.eventId ?? null };
    if (out.kind === 'rejected') return { ok: false, reason: 'fdm_rejected', detail: JSON.stringify(out.errors ?? '').slice(0, 200) };
    return { ok: false, reason: 'fdm_unreachable' };
  } catch (e) {
    if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as 'fiscal_not_configured' | 'fdm_not_available' };
    throw e;
  }
}

const isOutcome = (x: unknown): x is ActionOutcome => typeof x === 'object' && x !== null && 'ok' in x;

function serverOutcome(r: CommandResult): ActionOutcome {
  if (r.ok) return { ok: true, result: r };
  // KASSA-RECHTEN-1: 42501 = akkoord van een eigenaar/verantwoordelijke ontbreekt of is verlopen.
  return { ok: false, reason: r.code === '40001' ? 'changed' : r.code === '42501' ? 'not_allowed' : 'server', detail: r.error };
}

/**
 * Na een handtekening MOET de server het commando doorvoeren, anders zegt de FDM iets anders
 * dan de rekening. Bij een netwerkfout gaat hetzelfde commando (zelfde id, dus idempotent) in
 * de wachtrij en blijft het proberen. Een weigering na ondertekenen komt in het auditspoor.
 */
async function commitSigned(ctx: ActionCtx, cmd: Command, eventId: string | null): Promise<ActionOutcome> {
  try {
    const r = await ctx.store.applyNow(cmd);
    if (!r.ok && eventId) await ctx.runtime.audit('signed_but_rejected', { command: cmd.kind, fiscal_event_id: eventId, error: r.error ?? null });
    return serverOutcome(r);
  } catch {
    ctx.store.enqueue(cmd);
    return { ok: true };
  }
}

/** Verstuur de open ronde naar keuken/bar (en de FDM). */
export async function sendRound(ctx: ActionCtx, checkId: string, only?: ReadonlySet<string>): Promise<ActionOutcome> {
  try {
    await ctx.store.flush();
    if (ctx.store.pendingCount) return { ok: false, reason: 'offline' };
    const c = ctx.store.check(checkId);
    if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
    // GANGEN-1: zonder expliciete keuze gaan wachtende gangen niet mee (ze blijven ontwerp, geen P/ORDER).
    const pick = only ?? (ctx.coursesEnabled ? sendableIds(c, true) : undefined);
    const lines = roundLines(c, pick);
    if (!lines.length) return { ok: false, reason: 'nothing' };
    const signed = await signOrFail(ctx, async () => {
      const data = buildOrder(ctx.runtime.posContext(), await ctx.runtime.meta('signOrder', ctx.employeeId as string, 'NONE'), {
        costCenter: costCenterOf(c, ctx.tableLabel(c.table_id), !!ctx.isRegular?.(c.table_id)),
        lines: roundSpecs(c, pick),
      });
      return ctx.runtime.sign('signOrder', data, { staffId: ctx.staffId });
    });
    if (isOutcome(signed)) return signed;
    return commitSigned(ctx, {
      id: crypto.randomUUID(), kind: 'send_round', check_id: c.id, round_id: crypto.randomUUID(),
      line_ids: lines.map((l) => l.id), fiscal_event_id: signed.eventId, staff_id: ctx.staffId,
    }, signed.eventId);
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * GANGEN-1 — gang vrijgeven: eerst de stand op de server (fire_course, niet fiscaal), dan de lijnen tot en
 * met die gang als gewone ronde (P/ORDER). Lukt het versturen niet, dan wachten ze niet meer en gaan ze
 * met de gewone knop "Versturen" mee.
 */
export async function fireCourse(ctx: ActionCtx, checkId: string, course: number): Promise<ActionOutcome> {
  try {
    const r = await ctx.store.applyNow({ id: crypto.randomUUID(), kind: 'fire_course', check_id: checkId, course, staff_id: ctx.staffId });
    if (!r.ok) return serverOutcome(r);
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
  const c = ctx.store.check(checkId);
  if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
  const ids = releaseIds(c, course);
  return ids.size ? sendRound(ctx, checkId, ids) : { ok: true };
}

/** Voorlopige rekening (EVT-07/08): eerst een open ronde versturen, dan de PRE_BILL. */
export async function requestBill(ctx: ActionCtx, checkId: string): Promise<ActionOutcome> {
  const c0 = ctx.store.check(checkId);
  if (c0 && roundLines(c0).length) {
    // GANGEN-1: de voorrekening vraagt alles verstuurd, ook gangen die nog wachtten.
    const sent = await sendRound(ctx, checkId, new Set(roundLines(c0).map((l) => l.id)));
    if (!sent.ok) return sent;
  }
  try {
    const c = ctx.store.check(checkId);
    if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
    const specs = consolidatedSpecs(c);
    if (!specs.length) return { ok: false, reason: 'nothing' };
    const signed = await signOrFail(ctx, async () => {
      const data = buildPreBill(ctx.runtime.posContext(), await ctx.runtime.meta('signPreBill', ctx.employeeId as string, 'PAPER'), {
        costCenter: costCenterOf(c, ctx.tableLabel(c.table_id), !!ctx.isRegular?.(c.table_id)),
        lines: specs,
      });
      return ctx.runtime.sign('signPreBill', data, { staffId: ctx.staffId });
    });
    if (isOutcome(signed)) return signed;
    return commitSigned(ctx, { id: crypto.randomUUID(), kind: 'request_bill', check_id: c.id, fiscal_event_id: signed.eventId, staff_id: ctx.staffId }, signed.eventId);
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

export interface MoveRequest {
  fromCheckId: string;
  /** Bestaande rekening (samenvoegen) of nieuwe (id + tafel of naam). */
  to: { checkId: string; existing: true; tableId?: undefined; name?: undefined; split?: undefined }
    | { checkId: string; existing: false; tableId: string | null; name: string | null; split?: undefined }
    /** TAFEL-2: apart afrekenen = nieuwe deelrekening van dezelfde tafel of naam. */
    | { checkId: string; existing: false; split: true; tableId?: undefined; name?: undefined };
  moves: { line: CheckLine; qty: number }[];
}

/** Lijnen of een hele rekening verplaatsen (TBL-03..05). Verstuurde lijnen = CCC-event. */
export async function moveLines(ctx: ActionCtx, req: MoveRequest): Promise<ActionOutcome> {
  try {
    await ctx.store.flush();
    if (ctx.store.pendingCount) return { ok: false, reason: 'offline' };
    const from = ctx.store.check(req.fromCheckId);
    if (!from) return { ok: false, reason: 'server', detail: 'check_missing' };
    const sentMoves = req.moves.filter((m) => m.line.state === 'sent');
    let target: Pick<Check, 'id' | 'table_id' | 'name' | 'reference' | 'split_of' | 'split_no' | 'parent_reference'>;
    if (req.to.split) {
      // Deel van een deel hangt aan de hoofdrekening (max. 2 niveaus, TBL-01). Het volgnummer
      // kent de server toe; fiscaal telt enkel de reference.
      target = {
        id: req.to.checkId, table_id: from.table_id, name: from.name, reference: req.to.checkId,
        split_of: from.split_of ?? from.id, split_no: null,
        parent_reference: from.split_of ? (from.parent_reference ?? from.reference) : from.reference,
      };
    } else if (req.to.existing) {
      const t = ctx.store.check(req.to.checkId);
      if (!t) return { ok: false, reason: 'server', detail: 'target_missing' };
      target = t;
    } else {
      target = { id: req.to.checkId, table_id: req.to.tableId, name: req.to.name, reference: req.to.checkId };
    }
    let eventId: string | null = null;
    if (sentMoves.length) {
      const signed = await signOrFail(ctx, async () => {
        const { from: fromLines, to: toLines } = transferSpecs(sentMoves);
        const data = buildCostCenterChange(ctx.runtime.posContext(), await ctx.runtime.meta('signCostCenterChange', ctx.employeeId as string, 'NONE'),
          [{ costCenter: costCenterOf(from, ctx.tableLabel(from.table_id), !!ctx.isRegular?.(from.table_id)), lines: fromLines }],
          [{ costCenter: costCenterOf(target, ctx.tableLabel(target.table_id), !!ctx.isRegular?.(target.table_id)), lines: toLines }]);
        return ctx.runtime.sign('signCostCenterChange', data, { staffId: ctx.staffId });
      });
      if (isOutcome(signed)) return signed;
      eventId = signed.eventId;
    }
    return commitSigned(ctx, {
      id: crypto.randomUUID(), kind: 'move_lines', check_id: from.id, to_check_id: req.to.checkId,
      ...(req.to.split ? { split: true } : req.to.existing ? {} : { to_table_id: req.to.tableId, to_name: req.to.name }),
      moves: req.moves.map((m) => ({ line_id: m.line.id, qty: m.qty, from_line_id: crypto.randomUUID(), to_line_id: crypto.randomUUID() })),
      fiscal_event_id: eventId, staff_id: ctx.staffId,
    }, eventId);
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Korting of "van het huis" (TX-11/13/14): enkel online, de server maakt de lijnen.
 * KASSA-RECHTEN-1: approvalId = akkoord van een eigenaar/verantwoordelijke (niet nodig als die zelf aan de kassa staat).
 */
export async function discountLine(ctx: ActionCtx, checkId: string, lineId: string, d: { percent?: number; amountCents?: number; name: string }, approvalId?: string): Promise<ActionOutcome> {
  try {
    return serverOutcome(await ctx.store.applyNow({
      id: crypto.randomUUID(), kind: 'discount_line', check_id: checkId, line_id: lineId,
      neg_line_id: crypto.randomUUID(), new_line_id: crypto.randomUUID(),
      ...(d.percent != null ? { percent: d.percent } : { amount_cents: d.amountCents }), name: d.name, staff_id: ctx.staffId,
      ...(approvalId ? { approval_id: approvalId } : tokenOf(ctx)),
    }));
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lijn annuleren (TX-07). Ontwerp-lijn of eigenaar/verantwoordelijke aan de kassa: zoals voorheen in de
 * wachtrij (optimistisch, werkt ook even offline). KASSA-RECHTEN-1: met een akkoord (verstuurde lijn,
 * andere medewerker) meteen naar de server, zodat het eenmalige akkoord niet in de wachtrij blijft hangen.
 */
export async function voidLine(ctx: ActionCtx, checkId: string, lineId: string, reason: string, qty: number, approvalId?: string): Promise<ActionOutcome> {
  const cmd = { id: crypto.randomUUID(), kind: 'void_line' as const, check_id: checkId, line_id: lineId, new_line_id: crypto.randomUUID(), reason, qty, staff_id: ctx.staffId };
  if (!approvalId) { ctx.store.enqueue({ ...cmd, ...tokenOf(ctx) }); return { ok: true }; }
  try {
    return serverOutcome(await ctx.store.applyNow({ ...cmd, approval_id: approvalId }));
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Hele rekening naar een lege tafel of op naam (TBL-03: de reference gaat mee). Zijn er al
 * verstuurde lijnen, dan registreert de FDM de verhuis als COST_CENTER_CHANGE met dezelfde
 * reference aan beide kanten.
 */
export async function moveCheck(ctx: ActionCtx, checkId: string, to: { tableId: string | null; name: string | null }): Promise<ActionOutcome> {
  try {
    await ctx.store.flush();
    if (ctx.store.pendingCount) return { ok: false, reason: 'offline' };
    const c = ctx.store.check(checkId);
    if (!c) return { ok: false, reason: 'server', detail: 'check_missing' };
    const moved = c.lines.filter((l) => l.state === 'sent' && l.qty > 0 && l.open_qty > 0).map((line) => ({ line, qty: line.open_qty }));
    let eventId: string | null = null;
    if (moved.length) {
      const signed = await signOrFail(ctx, async () => {
        const { from, to: toLines } = transferSpecs(moved);
        const target = { ...c, table_id: to.tableId, name: to.tableId ? c.name : to.name };
        const data = buildCostCenterChange(ctx.runtime.posContext(), await ctx.runtime.meta('signCostCenterChange', ctx.employeeId as string, 'NONE'),
          [{ costCenter: costCenterOf(c, ctx.tableLabel(c.table_id), !!ctx.isRegular?.(c.table_id)), lines: from }],
          [{ costCenter: costCenterOf(target, ctx.tableLabel(to.tableId), !!ctx.isRegular?.(to.tableId)), lines: toLines }]);
        return ctx.runtime.sign('signCostCenterChange', data, { staffId: ctx.staffId });
      });
      if (isOutcome(signed)) return signed;
      eventId = signed.eventId;
    }
    return commitSigned(ctx, { id: crypto.randomUUID(), kind: 'move_check', check_id: c.id, to_table_id: to.tableId, to_name: to.name, fiscal_event_id: eventId, staff_id: ctx.staffId }, eventId);
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

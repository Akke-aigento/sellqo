// TAFEL-3 — kas in/uit en shift openen/sluiten met telling (PAY-09).
//
// Fiscaal: signMoneyInOut met één contante lijn in lade 1 (UC M130 en M133). Kas uit = negatief
// bedrag. Een telling (begin of einde shift) is een DRAWER_DECLARATION. S-events, wisselgeld en
// "lade openen" vallen hierbuiten: een lade openen zonder verkoop kan pas met een kassalade die
// SellQo Kassa zelf aanstuurt (FDM-1/app-batch), dus daar is (nog) geen knop voor.
import { buildMoneyInOut } from '../fiscal/builders';
import { FiscalUnavailableError } from './runtime';
import type { ActionCtx } from './horeca/actions';
import { DRAWER } from './horeca/pay';
import { runFiscalOp, type FiscalOp, type FiscalOpOutcome } from './fiscalOps';

type Ctx = Pick<ActionCtx, 'runtime' | 'staffId' | 'employeeId'>;

export interface ShiftResult { session_id: string; opening_cents?: number; expected_cents?: number; counted_cents?: number; difference_cents?: number; duplicate?: boolean }

async function moneyOp(ctx: Ctx, amountCents: number, amountType: 'MONEY_IN_OUT' | 'DRAWER_DECLARATION') {
  const data = buildMoneyInOut(ctx.runtime.posContext(), await ctx.runtime.meta('signMoneyInOut', ctx.employeeId as string, 'NONE'), [
    { id: '1', name: 'CONTANT', type: 'CASH', inputMethod: 'MANUAL', amount: amountCents, amountType, drawer: { ...DRAWER } },
  ]);
  return [{ name: 'signMoneyInOut' as const, data }];
}

async function signsFor(ctx: Ctx, amountCents: number, amountType: 'MONEY_IN_OUT' | 'DRAWER_DECLARATION'): Promise<FiscalOp['signs'] | FiscalOpOutcome<never>> {
  if (!ctx.runtime.isFiscal) return [];
  if (!ctx.employeeId) return { ok: false, reason: 'no_insz' };
  try {
    return await moneyOp(ctx, amountCents, amountType);
  } catch (e) {
    if (e instanceof FiscalUnavailableError) return { ok: false, reason: e.message as 'fiscal_not_configured' };
    throw e;
  }
}

/** Geld in of uit de lade, met reden (bv. "wisselgeld", "brood bij de bakker"). */
export async function cashMove(ctx: Ctx, direction: 'in' | 'out', amountCents: number, reason: string): Promise<FiscalOpOutcome<{ ok: boolean; session_id: string }>> {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return { ok: false, reason: 'server', detail: 'amount' };
  const id = crypto.randomUUID();
  const signs = await signsFor(ctx, direction === 'in' ? amountCents : -amountCents, 'MONEY_IN_OUT');
  if (!Array.isArray(signs)) return signs;
  return runFiscalOp(ctx.runtime, {
    id, rpc: 'kassa_cash_move', eventField: 'fiscal_event_id', signs, staffId: ctx.staffId, status: 'unsigned', at: new Date().toISOString(),
    payload: { id, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId, direction, amount_cents: amountCents, reason: reason.trim() },
  });
}

/** Shift openen (begintelling) of sluiten (eindtelling): de server rekent de verwachte kas en het verschil. */
export async function shift(ctx: Ctx, action: 'open' | 'close', countedCents: number): Promise<FiscalOpOutcome<ShiftResult>> {
  if (!Number.isSafeInteger(countedCents) || countedCents < 0) return { ok: false, reason: 'server', detail: 'amount' };
  const id = crypto.randomUUID();
  const signs = await signsFor(ctx, countedCents, 'DRAWER_DECLARATION');
  if (!Array.isArray(signs)) return signs;
  return runFiscalOp<ShiftResult>(ctx.runtime, {
    id, rpc: 'kassa_shift', eventField: 'fiscal_event_id', signs, staffId: ctx.staffId, status: 'unsigned', at: new Date().toISOString(),
    payload: { id, action, terminal_id: ctx.runtime.device.terminalRowId, staff_id: ctx.staffId, counted_cents: countedCents },
  });
}

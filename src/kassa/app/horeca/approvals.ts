// KASSA-RECHTEN-1 — korting, "van het huis" en een verstuurde lijn annuleren: een eigenaar of
// verantwoordelijke doet het meteen; elke andere medewerker vraagt een akkoord met de PIN van een
// eigenaar/verantwoordelijke. De server reikt het akkoord uit (kassa_approve: PIN, rol, lockout,
// auditspoor) en controleert het in horeca_apply_one. Het scherm beslist niets.
// Zelfde patroon als "product snel aanpassen" (KASSA-0.6, productActions.ts).
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import type { ActionCtx } from './actions';
import { canApprove, type Approval } from './productActions';
import type { CheckLine } from './types';

/** Review 1: ook "kas uit" (cash_out). */
export type ApprovalAction = 'discount' | 'void_sent' | 'cash_out';

/** Waar het akkoord precies over gaat; de server vergelijkt het met het commando. */
export interface ApprovalBind { percent?: number; amountCents?: number; qty?: number }

/**
 * Moet deze handeling eerst langs een eigenaar/verantwoordelijke? Ja, tenzij de medewerker zelf
 * owner/manager is ÉN een sessietoken heeft (review 1: zonder token weigert de server de uitzondering;
 * dan keurt hij met zijn eigen PIN goed in hetzelfde venster).
 */
export function needsApproval(ctx: Pick<ActionCtx, 'staffRole' | 'staffToken'>, action: ApprovalAction | null): boolean {
  return action !== null && !(canApprove(ctx) && !!ctx.staffToken);
}

/** Welke goedkeuring een handeling op een lijn vraagt (null = geen). Ontwerp-lijnen weghalen blijft vrij. */
export function approvalFor(kind: 'discount' | 'void', line: Pick<CheckLine, 'state'>): ApprovalAction | null {
  if (kind === 'discount') return 'discount';
  return line.state === 'sent' ? 'void_sent' : null;
}

export type ApprovalOutcome =
  | { ok: true; approvalId: string; approverName: string; reason?: undefined }
  | { ok: false; reason: 'not_allowed' | 'invalid' | 'wrong_pin' | 'locked' | 'offline' | 'server'; detail?: string };

export async function requestApproval(ctx: ActionCtx, req: { action: ApprovalAction; checkId: string | null; lineId: string | null; bind: ApprovalBind }, approval: Approval): Promise<ApprovalOutcome> {
  try {
    const { data, error } = await supabase.rpc('kassa_approve' as never, {
      p_tenant_id: ctx.runtime.device.tenantId, p_device_id: ctx.runtime.device.deviceUuid,
      p: {
        staff_id: ctx.staffId, approver_id: approval.approverId, pin: approval.pin, action: req.action, check_id: req.checkId, line_id: req.lineId,
        ...(req.bind.percent != null ? { percent: req.bind.percent } : {}),
        ...(req.bind.amountCents != null ? { amount_cents: req.bind.amountCents } : {}),
        ...(req.bind.qty != null ? { qty: req.bind.qty } : {}),
      },
    } as never);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '42501') return { ok: false, reason: 'not_allowed', detail: error.message };
      if (code === '22023' || code === 'P0002') return { ok: false, reason: 'invalid', detail: error.message };
      return { ok: false, reason: code ? 'server' : 'offline', detail: error.message };
    }
    const r = data as unknown as { ok?: boolean; reason?: string; approval_id?: string; approver_name?: string };
    if (r?.ok === false || !r?.approval_id) return { ok: false, reason: r?.reason === 'locked' ? 'locked' : 'wrong_pin' };
    return { ok: true, approvalId: r.approval_id, approverName: r.approver_name ?? '' };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

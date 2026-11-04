// HORECA-NU-1 — "Nu" op de kassa: uitverkocht, keuken pauzeren, zone (terras) open/dicht en de dagschotel.
// Geen fiscaal bericht, geen prijs: het zijn instellingen van de zaak. Het toestel mag die tabellen enkel lezen
// (KASSA-ACCOUNT-1), dus alles gaat via één smalle serverfunctie (kassa_now_apply): kassa_can_operate(zaak,
// toestel) én een eigenaar/verantwoordelijke — met zijn eigen sessietoken, of met de PIN van een goedkeurder
// (zelfde controle en lockout als "product snel aanpassen", KASSA-0.6). Het scherm beslist niets.
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import type { ActionCtx } from './actions';
import { canApprove, type Approval } from './productActions';

export type NowChange =
  | { kind: 'pause'; minutes: 0 | 15 | 30 | 60 }
  | { kind: 'area'; area_id: string; open: boolean }
  | { kind: 'special'; product_id: string; on: boolean }
  | { kind: 'special_clear' }
  | { kind: 'sold_out'; product_id: string; sold_out: boolean };

export type NowOutcome =
  | { ok: true; data: Record<string, unknown>; reason?: undefined }
  | { ok: false; reason: 'not_allowed' | 'invalid' | 'wrong_pin' | 'locked' | 'offline' | 'server' | 'need_approval'; detail?: string };

/** Mag de medewerker op het toestel dit zelf, zonder PIN van iemand anders? (eigenaar/verantwoordelijke mét token) */
export const selfApproves = (ctx: Pick<ActionCtx, 'staffRole' | 'staffToken'>) => canApprove(ctx) && !!ctx.staffToken;

export async function applyNow(ctx: ActionCtx, change: NowChange, approval: Approval | null): Promise<NowOutcome> {
  if (!selfApproves(ctx) && !approval) return { ok: false, reason: 'need_approval' };
  const p: Record<string, unknown> = { ...change, staff_id: ctx.staffId };
  if (selfApproves(ctx)) p.staff_token = ctx.staffToken;
  else if (approval) { p.approver_id = approval.approverId; p.pin = approval.pin; }
  try {
    const { data, error } = await supabase.rpc('kassa_now_apply' as never, {
      p_tenant_id: ctx.runtime.device.tenantId, p_device_id: ctx.runtime.device.deviceUuid, p,
    } as never);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '42501') return { ok: false, reason: 'not_allowed', detail: error.message };
      if (code === '28000') return { ok: false, reason: 'locked', detail: error.message };
      if (code === '22023') return { ok: false, reason: 'invalid', detail: error.message };
      return { ok: false, reason: code ? 'server' : 'offline', detail: error.message };
    }
    const r = data as unknown as { ok?: boolean; reason?: string } & Record<string, unknown>;
    if (r?.ok === false) return { ok: false, reason: r.reason === 'locked' ? 'locked' : 'wrong_pin' };
    return { ok: true, data: r ?? {} };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

export interface NowState { online: boolean; pausedUntil: string | null }

/** Wat het toestel niet zelf mag lezen: staat online bestellen aan, en loopt er een pauze? */
export async function fetchNowState(tenantId: string): Promise<NowState> {
  const { data, error } = await supabase.rpc('kassa_now_state' as never, { p_tenant_id: tenantId } as never);
  if (error) throw error;
  const r = data as unknown as { online?: boolean; paused_until?: string | null } | null;
  return { online: r?.online === true, pausedUntil: r?.paused_until ?? null };
}

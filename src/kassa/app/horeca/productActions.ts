// KASSA-0.6 — product snel aanpassen op de kassa: "op voor vandaag" / terug en de prijs.
// Elke medewerker kan het starten; een eigenaar of verantwoordelijke keurt goed met zijn PIN.
// De server (kassa_product_quick_edit) controleert PIN en rol, met dezelfde lockout als het
// aanmelden, en schrijft elke wijziging in het audit-spoor. Geen fiscaal event: open rekeningen houden
// de prijs waaraan ze aangeslagen werden.
import { supabase } from '@/integrations/supabase/client';
import type { ActionCtx } from './actions';

export const PRODUCT_EDIT_ROLES = new Set(['owner', 'manager']);

/** Mag de medewerker op het toestel zelf goedkeuren (dan staat hij voorgeselecteerd)? */
export const canApprove = (ctx: Pick<ActionCtx, 'staffRole'>) => !!ctx.staffRole && PRODUCT_EDIT_ROLES.has(ctx.staffRole);

export type ProductEditOutcome =
  | { ok: true; price: number; soldOutUntil: string | null }
  | { ok: false; reason: 'not_allowed' | 'invalid' | 'wrong_pin' | 'locked' | 'offline' | 'server'; detail?: string };

export interface Approval { approverId: string; pin: string }

export async function quickEditProduct(ctx: ActionCtx, productId: string, approval: Approval, change: { price?: string; soldOut?: boolean }): Promise<ProductEditOutcome> {
  const p: Record<string, unknown> = { staff_id: ctx.staffId, approver_id: approval.approverId, pin: approval.pin, product_id: productId };
  if (change.price !== undefined) p.price = change.price;
  if (change.soldOut !== undefined) p.sold_out = change.soldOut;
  try {
    const { data, error } = await supabase.rpc('kassa_product_quick_edit' as never, {
      p_tenant_id: ctx.runtime.device.tenantId, p_device_id: ctx.runtime.device.deviceUuid, p,
    } as never);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '42501') return { ok: false, reason: 'not_allowed', detail: error.message };
      if (code === '28000') return { ok: false, reason: 'locked', detail: error.message };
      if (code === '22023') return { ok: false, reason: 'invalid', detail: error.message };
      return { ok: false, reason: code ? 'server' : 'offline', detail: error.message };
    }
    const r = data as unknown as { ok?: boolean; reason?: string; price: number | string; sold_out_until: string | null };
    if (r?.ok === false) return { ok: false, reason: r.reason === 'locked' ? 'locked' : 'wrong_pin' };
    return { ok: true, price: Number(r.price), soldOutUntil: r.sold_out_until };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: e instanceof Error ? e.message : String(e) };
  }
}

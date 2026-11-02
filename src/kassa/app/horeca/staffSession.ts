// KASSA-RECHTEN-1 (review 1) — sessietoken van de kassa. kassa_staff_login geeft het bij een juiste PIN;
// het leeft enkel in het geheugen (session.tsx). Bij elke vergrendeling (Wissel of inactiviteit) trekt het
// toestel het in. Lukt dat niet (offline), dan vervalt het op het einde van de bedrijfsdag.
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import { PRODUCT_EDIT_ROLES } from './productActions';

export function revokeStaffToken(tenantId: string | null | undefined, token: string): void {
  if (!tenantId) return;
  void Promise.resolve(supabase.rpc('kassa_staff_logout' as never, { p_tenant_id: tenantId, p_token: token } as never)).catch(() => { /* offline: vervalt vanzelf */ });
}

/**
 * Review 1: een eigenaar of verantwoordelijke kan meer (korting, annuleren, kas uit zonder akkoord), dus
 * vergrendelt zijn sessie altijd na hoogstens 2 minuten, ook als de zaak "nooit" of langer koos.
 */
export function effectiveLockMinutes(lockMinutes: number, role: string | null | undefined): number {
  if (!role || !PRODUCT_EDIT_ROLES.has(role)) return lockMinutes;
  return lockMinutes > 0 ? Math.min(lockMinutes, 2) : 2;
}

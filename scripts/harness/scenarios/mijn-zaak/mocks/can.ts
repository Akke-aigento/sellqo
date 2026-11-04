// Rechten per rol, vereenvoudigd: zaakvoerder mag alles; staff niet aan financiële instellingen, het plan
// of de algemene instellingen (zoals de permissiematrix).
import { H } from './h';
const STAFF_NO = ['settings_financial', 'platform_billing', 'settings_general', 'reports_financial'];
export function canWithRoles(roles: string[], _action: string, resource: string) {
  if (roles.includes('tenant_admin') || roles.includes('platform_admin')) return true;
  return !STAFF_NO.includes(resource);
}
export function useScopedRoles() { return [H.role]; }
export function useCan(action: string, resource: string) { return canWithRoles([H.role], action, resource); }
export function useCanWithReason(action: string, resource: string) { return { allowed: useCan(action, resource), reason: null }; }

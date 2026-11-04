// Rechten per rol, vereenvoudigd naar de permissiematrix (src/hooks/useCan.ts): zaakvoerder mag alles;
// staff niet aan financiële of algemene instellingen of het plan; viewer leest de algemene instellingen
// wel, maar niet het financiële of het plan.
import { H } from './h';
const NO: Record<string, string[]> = {
  staff: ['settings_financial', 'platform_billing', 'settings_general', 'reports_financial'],
  viewer: ['settings_financial', 'platform_billing', 'reports_financial'],
};
export function canWithRoles(roles: string[], _action: string, resource: string) {
  if (roles.includes('tenant_admin') || roles.includes('platform_admin')) return true;
  return !roles.some((r) => (NO[r] ?? NO.staff).includes(resource));
}
export function useScopedRoles() { return [H.role]; }
export function useCan(action: string, resource: string) { return canWithRoles([H.role], action, resource); }
export function useCanWithReason(action: string, resource: string) { return { allowed: useCan(action, resource), reason: null }; }

import { H } from './h';
// Zoals useCan: settings_general schrijven enkel voor zaakvoerder en platformbeheer.
export function useCan(action: string, resource: string) {
  if (resource === 'settings_general' && action === 'write') return ['tenant_admin', 'platform_admin'].includes(H.role);
  return true;
}
export function useCanWithReason(action: string, resource: string) { return { allowed: useCan(action, resource), reason: null }; }
export function useScopedRoles() { return [H.role]; }

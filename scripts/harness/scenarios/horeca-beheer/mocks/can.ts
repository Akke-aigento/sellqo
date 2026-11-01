import { H } from './h';
const ADMIN = ['tenant_admin', 'platform_admin'];
export function useCan(action: string, resource: string) {
  if (resource === 'product_costs') return ADMIN.includes(H.role) || (action === 'read' && ['accountant', 'warehouse'].includes(H.role));
  return true;
}
export function useCanWithReason(action: string, resource: string) { return { allowed: useCan(action, resource), reason: null }; }
export function useScopedRoles() { return [H.role]; }

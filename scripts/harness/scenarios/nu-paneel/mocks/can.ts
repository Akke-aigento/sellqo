import { H } from './h';
// Zoals de permissiematrix: products schrijven = admin/staff/marketing; prijzen = admin/staff.
export function useCan(action: string, resource: string) {
  if (resource === 'products' && action === 'write') return ['tenant_admin', 'staff', 'marketing'].includes(H.role);
  if (resource === 'product_prices') return ['tenant_admin', 'staff'].includes(H.role);
  return true;
}
export function useCanWithReason(action: string, resource: string) { return { allowed: useCan(action, resource), reason: null }; }
export function useScopedRoles() { return [H.role]; }

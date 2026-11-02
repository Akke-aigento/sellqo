// Bewust zoals de echte matrix voor de twee sleutels die dit scherm leest.
import { role } from './data';
const WRITE: Record<string, string[]> = {
  // products: zoals PERMISSION_MATRIX (warehouse, viewer, accountant: geen schrijfrecht).
  product_prices: ['platform_admin', 'tenant_admin', 'staff'],
  products: ['platform_admin', 'tenant_admin', 'staff', 'marketing'],
};
export type PermissionAction = 'read' | 'write' | 'correct';
export type Resource = string;
export function useScopedRoles() { return [role]; }
export function useCan(action: PermissionAction, resource: Resource) {
  if (action !== 'write') return true;
  return (WRITE[resource] ?? ['platform_admin', 'tenant_admin', 'staff']).includes(role);
}
export function useCanWithReason(action: PermissionAction, resource: Resource) {
  const allowed = useCan(action, resource);
  return { allowed, reason: allowed ? null : 'role' };
}

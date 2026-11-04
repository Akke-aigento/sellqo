import { H } from './h';
const auth = () => ({ user: { id: 'u1', email: 'zaak@dewissel.be' }, signOut: () => {}, isPlatformAdmin: false, roles: [{ role: H.role, tenant_id: 't1' }],
  userRole: H.role, isWarehouse: false, loading: false, rolesLoading: false, profile: { full_name: 'Zaakvoerder', email: 'zaak@dewissel.be' } });
export function useAuth() { return auth(); }
export function useOptionalAuth() { return auth(); }
export function AuthProvider({ children }: { children: unknown }) { return children; }

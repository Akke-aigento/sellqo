import { H } from './h';
export function useAuth() { return { roles: [{ role: H.role ?? 'tenant_admin', tenant_id: 't1' }], isPlatformAdmin: false }; }

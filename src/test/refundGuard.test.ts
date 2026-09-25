import { describe, expect, it } from 'vitest';
import { hasRequiredRole, type RoleCheckInput } from '../../supabase/functions/_shared/authRoles';

// De échte beslissing die `requireRole` (_shared/auth.ts) gebruikt — geen kopie.
type AuthResult = RoleCheckInput;

// HOTFIX-AUTH-1: process-order-refund deed een echte Stripe-refund zonder
// rolcheck. Lezen van een order mag elke rol, terugbetalen hoort bij de rollen
// die de order ook mogen bijwerken (tenant_admin, staff).
const TENANT = '169cf7b9-0000-4000-8000-000000000000';
const REFUND_ROLES = ['tenant_admin', 'staff'] as const;

const auth = (roles: string[], extra: Partial<AuthResult> = {}): AuthResult => ({
  user_id: 'user-1',
  is_platform_admin: false,
  roles_by_tenant: { [TENANT]: roles },
  ...extra,
});

const allowed = (a: AuthResult) => hasRequiredRole(a, TENANT, REFUND_ROLES);

describe('refund-guard — wie mag geld terugstorten', () => {
  it.each(['viewer', 'marketing', 'accountant', 'warehouse'])('%s wordt geweigerd vóór Stripe', (role) => {
    expect(allowed(auth([role]))).toBe(false);
  });

  it.each(['tenant_admin', 'staff'])('%s mag terugbetalen', (role) => {
    expect(allowed(auth([role]))).toBe(true);
  });

  it('platform-admin houdt zijn bypass', () => {
    expect(allowed(auth(['viewer'], { is_platform_admin: true }))).toBe(true);
  });

  it('service_role (cron, interne aanroepen) houdt zijn bypass', () => {
    expect(allowed(auth([], { user_id: 'service_role' }))).toBe(true);
  });

  it('een rol in een ándere winkel telt niet', () => {
    const other = auth([]);
    other.roles_by_tenant = { 'andere-winkel': ['tenant_admin'] };
    expect(allowed(other)).toBe(false);
  });

  it('geen rollen bekend → geweigerd', () => {
    expect(allowed(auth([]))).toBe(false);
  });
});

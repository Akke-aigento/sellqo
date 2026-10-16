// SEC-INVITE-1 — unit tests voor de rollen-allowlist van teamuitnodigingen (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/inviteRoles.test.ts
import { INVITE_ROLES, isInviteRole } from './inviteRoles.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

Deno.test('de zes rollen uit de team-UI zijn toegestaan', () => {
  for (const r of ['tenant_admin', 'staff', 'accountant', 'warehouse', 'marketing', 'viewer']) {
    eq(isInviteRole(r), true, r);
  }
  eq(INVITE_ROLES.length, 6, 'aantal');
});

Deno.test('platform_admin is nooit toegestaan', () => {
  eq(isInviteRole('platform_admin'), false);
  eq((INVITE_ROLES as readonly string[]).includes('platform_admin'), false);
});

Deno.test('onbekende waarden en varianten worden geweigerd', () => {
  for (const v of ['', 'admin', 'owner', 'Tenant_Admin', ' staff', 'staff ', 'platform_admin ', null, undefined, 1, {}, ['staff'], true]) {
    eq(isInviteRole(v), false, JSON.stringify(v) ?? String(v));
  }
});

import { describe, expect, it } from 'vitest';
import { INVITE_ROLES, isInviteRole, type InviteRole } from '../../supabase/functions/_shared/inviteRoles';
import type { InvitationRole } from '@/hooks/useTeamInvitations';

// SEC-INVITE-1 — de allowlist in de edge functions en de rollen die de team-UI
// aanbiedt moeten gelijk blijven. Een nieuwe rol in de UI zonder de allowlist bij te
// werken geeft anders een 400 bij uitnodigen; omgekeerd mag de allowlist nooit meer
// toelaten dan de UI.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const typesMatch: Same<InviteRole, InvitationRole> = true;

describe('rollen-allowlist teamuitnodigingen', () => {
  it('is exact de set van de team-UI (tsc bewaakt de types)', () => {
    expect(typesMatch).toBe(true);
    expect([...INVITE_ROLES].sort()).toEqual(
      ['accountant', 'marketing', 'staff', 'tenant_admin', 'viewer', 'warehouse'],
    );
  });

  it('laat platform_admin nooit toe', () => {
    expect(isInviteRole('platform_admin')).toBe(false);
  });

  it('weigert onbekende en niet-string waarden', () => {
    for (const v of ['admin', 'TENANT_ADMIN', '', null, undefined, 42, ['staff']]) {
      expect(isInviteRole(v)).toBe(false);
    }
  });
});

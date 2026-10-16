// SEC-INVITE-1 — welke rol mag een teamuitnodiging dragen?
//
// Bron: de rollen die de team-UI aanbiedt (InviteTeamMemberDialog en
// platform/TenantTeamTab, type InvitationRole in src/hooks/useTeamInvitations.ts).
// `platform_admin` staat hier bewust NOOIT in: die rol kent alleen SellQo toe,
// via de SQL-console (zie SEC-ROLE-1).
//
// Puur en zonder Deno-afhankelijkheden, zodat zowel deno test als vitest hem
// kunnen toetsen. Rol uit een request body of uit een DB-rij gaat altijd eerst
// door `isInviteRole` vóór hij ergens wordt weggeschreven.

export const INVITE_ROLES = [
  'tenant_admin',
  'staff',
  'accountant',
  'warehouse',
  'marketing',
  'viewer',
] as const;

export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_ROLE_ERROR = 'Ongeldige rol voor een teamuitnodiging';

export function isInviteRole(value: unknown): value is InviteRole {
  return typeof value === 'string' && (INVITE_ROLES as readonly string[]).includes(value);
}

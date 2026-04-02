

## Platform Admin: Team tab op TenantDetail pagina

### Wat wordt er gebouwd

Een "Team" tab toevoegen aan de TenantDetail pagina zodat je als platform admin direct teamleden kunt uitnodigen voor een tenant, zonder eerst naar die tenant te moeten switchen.

### Probleem

De bestaande `InviteTeamMemberDialog` en `useTeamInvitations` gebruiken `currentTenant` uit de tenant-context. Als platform admin bekijk je een tenant via `/admin/platform/tenants/:tenantId`, maar `currentTenant` is dan je eigen tenant — niet de tenant die je bekijkt.

### Wijzigingen

**1. `src/components/platform/TenantTeamTab.tsx`** — Nieuw component

- Toont huidige teamleden (query `user_roles` + `profiles` voor de specifieke `tenantId`)
- Toont openstaande uitnodigingen (query `team_invitations` voor die `tenantId`)
- Invite dialog met e-mail + rol-selectie (hergebruikt dezelfde rol-opties)
- Roept `send-team-invitation` edge function aan met de `tenantId` uit props (niet `currentTenant`)
- Annuleer/opnieuw versturen van uitnodigingen
- De edge function ondersteunt `platform_admin` autorisatie al — geen backend wijziging nodig

**2. `src/pages/platform/TenantDetail.tsx`** — Tab toevoegen

- Import `TenantTeamTab`
- Grid van 7 → 8 kolommen
- Nieuwe tab "Team" toevoegen
- Render `<TenantTeamTab tenantId={tenantId!} />` in TabsContent

### Geen database of edge function wijzigingen nodig

De `send-team-invitation` edge function checkt al of de gebruiker `platform_admin` is. RLS policies op `team_invitations` en `user_roles` zijn al toegankelijk voor platform admins via `get_user_tenant_ids()`.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/platform/TenantTeamTab.tsx` | Nieuw — teamleden, uitnodigingen, invite functionaliteit |
| `src/pages/platform/TenantDetail.tsx` | Team tab toevoegen |


# Sander onboarden als admin op Zona Dorata + Mancini

## Situatie

- Zona Dorata `owner_email` = `aaron-mercken@hotmail.com` (jouw anti-spoof anker, blijft staan).
- Mancini Milano `owner_email` = `info@mancinimilano.com` (idem, correct).
- Sander heeft geen `user_roles` en geen openstaande invites.
- Er staat nog een `tenant_access_revocations` rij (Sander @ Zona Dorata) uit onze eerdere cleanup.
- `AdminSidebar` toont een tenant-switcher zodra `tenants.length > 1` — dus zodra Sander beide invites accepteert, kan hij automatisch schakelen.

## Wat er in de weg zit

`accept-team-invitation` verwijdert de stale revocation-rij niet. Als Sander de Zona-invite accepteert, blijft die rij bestaan. Vandaag ongevaarlijk (invite-flow negeert de tabel), maar semantisch verwarrend en potentieel een toekomstige bug wanneer we ooit de revocation-tabel breder gebruiken.

## Wijzigingen

### 1. `accept-team-invitation` self-heal revocations

Aan het einde van de succesflow, na de `user_roles` insert en het bijwerken van de invitation, deleten we elke matching revocation-rij:

```ts
await supabase
  .from("tenant_access_revocations")
  .delete()
  .eq("tenant_id", invitation.tenant_id)
  .ilike("email", invitation.email);
```

Best-effort in try/catch — een failure hier mag de invite-acceptatie niet breken (audit-log pattern zoals elders in dezelfde functie).

Deployen: `supabase--deploy_edge_functions` met `["accept-team-invitation"]`.

### 2. Geen andere code-wijzigingen nodig

- **Tenant switcher**: al aanwezig in `AdminSidebar.tsx` (regel 313, `tenants.length > 1`). Sander ziet hem automatisch.
- **useTenant**: fetcht alle tenants waar de user een `user_roles` rij heeft en persisteert selectie in localStorage — multi-tenant switch werkt.
- **`repair-tenant-access`**: nu gehardened, blijft veilig — Sander accepteert via invite, niet via auto-repair.
- **Owner_email**: geen wijziging. Beide tenants hebben veilige owner_email-ankers.

## Jouw acties (in de UI)

1. **Zona Dorata (huidige context)** → Instellingen → Teamleden → Uitnodigen → `sander.mancini@hotmail.be` als Admin.
2. Wissel via de tenant-switcher naar **Mancini Milano** → zelfde flow → uitnodigen als Admin.
3. Sander ontvangt 2 aparte mails, opent ze in dezelfde browser met hetzelfde account, accepteert beide.
4. Na de 2e acceptatie verschijnt de tenant-switcher in zijn sidebar automatisch.

## Verificatie na uitrol

Ik voer na jouw invites deze checks uit:
- Beide `user_roles` rijen aanwezig voor Sander.
- Beide `team_invitations` op `status='accepted'`.
- Revocation-rij voor Zona Dorata is opgeruimd.
- `email_send_log` toont beide invite-mails als `sent`.

## Niet aangeraakt

- `send-team-invitation`, `fetch-invitation`, invite-frontend, `team_invitations` schema, `useTenant.tsx`, `AdminSidebar.tsx`.
- Owner_email van beide tenants.
- Mancini Milano's team.

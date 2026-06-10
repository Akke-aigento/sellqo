# Root-cause — Mancini Milano orphan tenant_admin (2026-06-10)

## Samenvatting

Op 2026-06-09 om 14:31 werd via een identity-spoofing test een
auth-user aangemaakt met email `aaron.mercken@hotmail.com`
(UUID `d020b521-0ab1-40cc-a13c-614cb879ae6d`). Om 16:03 verscheen
voor diezelfde user een `tenant_admin`-row op tenant Mancini Milano
(`2606c5b9-...`). Mancini bestaat al sinds 2026-04-01.

## Onderzochte triggers/functies

### 1. `trigger_assign_tenant_admin_on_insert` op `public.tenants`
Functie `assign_tenant_admin_role_on_tenant_insert()`:

```sql
INSERT INTO public.user_roles (user_id, tenant_id, role)
VALUES (auth.uid(), NEW.id, 'tenant_admin')
ON CONFLICT DO NOTHING;
```

- Vuurt **alleen bij INSERT** op `tenants`.
- Mancini's row is van april — geen recent INSERT.
- **Verworpen als oorzaak** van de 16:03 role-creation.

### 2. Triggers op `public.user_roles`
Query op `information_schema.triggers` waar `event_object_table = 'user_roles'`:
**0 rows.** Geen enkele trigger schrijft user_roles vanuit een ander event.

### 3. Database-functies die `INSERT INTO user_roles` doen
Query op `information_schema.routines` met definition LIKE `%INSERT INTO%user_roles%`:
**0 rows** in `public` schema. Alleen de trigger-functie hierboven (die staat
op tenants, niet user_roles).

### 4. Edge functions die `user_roles.insert/upsert` doen

| Function | Wanneer | Auth-check |
|---|---|---|
| `accept-team-invitation` | gebruiker accepteert een invite | server-side email-match + status checks |
| `create-tenant` | nieuwe tenant via signup-flow | upsert voor de caller |
| **`repair-tenant-access`** | **gebruiker-driven, op login** | **alleen email-match met `tenants.owner_email`** |
| `send-team-invitation` | enkel SELECT user_roles | n.v.t. |

## Meest waarschijnlijke oorzaak

**`repair-tenant-access`** is de smoking gun.

```ts
// repair-tenant-access/index.ts
const { data: tenant } = await supabase
  .from("tenants")
  .select("id, name")
  .eq("owner_email", userEmail)   // match op login-email
  .maybeSingle();
// ...
await supabase.from("user_roles").insert({
  user_id: user.id,
  tenant_id: tenant.id,
  role: 'tenant_admin',
});
```

Mancini's `owner_email` stond op `aaron.mercken@hotmail.com` (vermoedelijk
de originele signup-email uit april). Toen de spoof-account op 14:31
inlogde, heeft een client-side call naar `repair-tenant-access` (waarschijnlijk
vanuit `useTenant`/onboarding-route) de orphan stilletjes `tenant_admin`
op Mancini gegeven. Dit verklaart precies de timing (1.5 u na signup,
geen INSERT op `tenants`, geen trigger op `user_roles`).

## Hardening — aanbevelingen

1. **Pre-condition op `repair-tenant-access`**: weiger als
   `auth.users.email_confirmed_at` `NULL` is óf als de auth-user
   minder dan N uur oud is. Voorkomt dat fresh signups met "toevallig"
   matching email instant admin krijgen.
2. **`owner_email`-source-of-truth**: bij invite-accept van een
   `tenant_admin` met een ander email, óf bij ownership-transfer,
   moet `owner_email` mee-bijgewerkt worden (nu blijft die hangen
   op de originele signup).
3. **Audit-log uitbreiden**: log élke INSERT op `user_roles`
   (via trigger) met `current_setting('request.jwt.claim.email')` en
   `inet_client_addr()` zodat root-cause-analyses sneller gaan.
4. **`repair-tenant-access` zou een dry-run/notification kunnen tonen**
   in plaats van direct te schrijven, en de caller moet het bevestigen.

## Sander's missing role — mystery

Sander Mancini (`info@mancinimilano.com`, UUID `a183cd15-...`) had
op 9 april een uitnodiging als `tenant_admin` op Mancini geaccepteerd.
Vandaag (2026-06-10) staat zijn user_roles-row er **niet meer**.

Mogelijke verklaringen:

- **(a)** `accept-team-invitation` faalde silent in april (de role-insert
  errored, maar de invitation werd toch op `accepted` gezet). Geen audit-log
  bevestiging beschikbaar.
- **(b)** Een latere `remove-team-member` actie heeft hem verwijderd
  (zou audit-log entry geven, niet gevonden in eerste sweep).
- **(c)** Gedeeltelijke restore vanuit backup waarbij user_roles van die
  periode niet meegekomen is.
- **(d)** Een directe DB-mutatie vanuit een eerder cleanup-script.

**Niet conclusief op te lossen** zonder `admin_actions_log` of pg-audit-trail
van april. Op backlog gezet voor latere audit.

**Workaround toegepast** (2026-06-10): Sander handmatig toegevoegd als
`tenant_admin` op Mancini via `cleanup_orphan_spoof_user_and_link_sander.sql`
en `tenants.owner_email` gewijzigd naar `info@mancinimilano.com`.

## Open vragen

- Wordt `repair-tenant-access` automatisch aangeroepen bij élke login,
  of alleen tijdens onboarding? (callsite-audit nodig)
- Moet `repair-tenant-access` überhaupt nog bestaan zonder admin-confirmation
  in een wereld waar invites + trigger-on-create dit zouden moeten dekken?
- Welke andere tenants hebben een `owner_email` die niet matcht met de
  daadwerkelijke admin? Dat zijn potentiële spoof-vectors.

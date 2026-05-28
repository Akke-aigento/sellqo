# Plan: clean & smooth re-invite flow (multi-tenant safe)

## Uitgangspunt (correct)
Een auth-account = één persoon, los van tenants. Je nooit auth.users verwijderen wanneer iemand uit een team verwijderd wordt — die persoon kan nog bij 5 andere tenants horen of klant zijn. De huidige cleanup-flow (alleen `user_roles` rij weghalen) is dus juist. Wat ontbreekt is dat (a) toegang écht onmiddellijk wegvalt en (b) een herinvite voelt als een vers e-mailadres, zonder dat de gebruiker eerst tegen een muur loopt.

## Wat er nu fout/onaf is

1. **Geen pre-detectie van bestaand account** op `/invite/:token`. Gebruiker kiest "Account aanmaken", krijgt pas dan de melding "bestaat al" (lelijk, ook al vangen we 'm nu op).
2. **Sessies blijven actief**: als de verwijderde medewerker op dat moment ingelogd is in de admin van die tenant, blijft de UI draaien tot ze de pagina verversen — RLS blokkeert wel data, maar de tenant-selector toont hem nog.
3. **Sleeping pending invitations**: oude rij wordt al ge-deletet door `send-team-invitation` (goed) — verifiëren dat dit echt werkt bij `email` case-insensitive.
4. **`AcceptInvitation` weet niet of dit een **rejoin** is** (zelfde tenant, zelfde gebruiker, vroegere rol) → kan dat dan in één klik doen na login zonder verwarring.

## Strakke flow (na fix)

```text
Admin klikt "Verwijder uit team"
        │
        ▼
remove-team-member edge fn (service role)
  - DELETE user_roles WHERE user_id=X AND tenant_id=T
  - DELETE team_invitations WHERE email=X AND tenant_id=T AND accepted_at IS NULL  (opruim ghosts)
  - Audit log via log_admin_action
  - NIET: auth.users / profiles aanraken
        │
        ▼
Frontend van verwijderde gebruiker
  - useTenant hertest currentTenant tegen user_roles
  - Als currentTenant niet meer in lijst → redirect /admin → tenant-picker (of /login als geen enkele tenant meer)
```

```text
Admin nodigt zelfde e-mail opnieuw uit
        │
        ▼
send-team-invitation
  - DELETE bestaande open invites voor (tenant, email) (al aanwezig — case-insensitive verifiëren)
  - INSERT nieuwe row
  - Mail met /invite/<token>
        │
        ▼
/invite/:token (publieke pagina)
  - fetch-invitation → email, role, tenantName, status, **account_exists**, **already_member**
  - Routing per situatie ↓
```

| Situatie | UI default |
|---|---|
| `account_exists=false` | "Account aanmaken" form, email pre-filled & disabled |
| `account_exists=true`, niet ingelogd | "Log in om uitnodiging te accepteren" — login form, email pre-filled & disabled, link "Wachtwoord vergeten?" |
| ingelogd met **zelfde** email | Toon kaart "Welkom terug — accepteer uitnodiging voor {tenant}" + grote knop. Auto-accept enkel op klik (geen stille auto-accept meer, dat verwart bij rejoin). |
| ingelogd met **andere** email | Toon mismatch-kaart + "Uitloggen en doorgaan als {invite email}" (al gefixt) |
| `already_member=true` | "Je bent al lid van {tenant}" + knop → /admin |
| `status=accepted` of `expired` | huidige melding |

Auto-accept-on-mount weghalen voorkomt dat een rejoin "gewoon gebeurt" zonder dat de gebruiker beseft dat-ie er weer in zit (security-hygiëne + minder verwarring).

## Concrete wijzigingen

### A. Nieuwe edge function `remove-team-member`
Check eerst of die al bestaat — zo niet, maken. Gedrag:
- JWT-auth, valideer dat caller `tenant_admin` voor `tenantId` is (of `platform_admin`).
- Mag geen tenant_admin verwijderen tenzij minstens 1 andere tenant_admin bestaat (geen lock-out).
- DELETE `user_roles` (tenant_id, user_id).
- DELETE `team_invitations` waar (tenant_id, email ilike, accepted_at IS NULL) — voor zekerheid.
- `log_admin_action(tenantId, 'team_member_removed', {user_id, role})`.
- Géén auth.users delete.

### B. `fetch-invitation` uitbreiden
- Service-role: na ophalen invitation → `auth.admin.listUsers({ email })` of join met `profiles` (sneller) om te bepalen `account_exists`.
- Check `user_roles` voor (user_id, tenant_id) → `already_member`.
- Return ook deze 2 booleans. Geen PII van andere tenants lekken.

### C. `src/pages/AcceptInvitation.tsx`
- Verwijder stille auto-accept-on-mount; vervang door **expliciete** "Accepteer uitnodiging"-knop (alleen renderen als email matcht).
- Gebruik nieuwe booleans:
  - `account_exists=true` → start in `mode='signin'` (was `signup`).
  - `already_member=true` → toon "Je bent al lid" + redirect.
- Behoud bestaande mismatch-fix en "User already registered" fallback (vangnet).
- Voeg "Wachtwoord vergeten?" link toe in signin-mode met email pre-filled.

### D. `useTenant` / admin layout — sessie-invalidatie bij role-verlies
- Bij iedere admin route-mount: ververs `user_roles` lijst.
- Als `currentTenant` niet (meer) in lijst → toast "Je hebt geen toegang meer tot {tenant}" + reset naar tenant-picker of `/login`.
- Realtime listener op `user_roles WHERE user_id=auth.uid()` zodat hot-revoke binnen seconden werkt (nice-to-have, niet blokkerend voor PR).

### E. Eenmalige opruim voor Aaron
Niet zijn auth-account verwijderen. Wel:
- Eventuele oude `accepted_at IS NULL` invitation `1bd891c1…` laten staan — die is van vandaag en geldig.
- Aaron logt in met zijn april-wachtwoord; lukt dat niet → "wachtwoord vergeten" via nieuwe link op `/invite/:token`.
- Zijn `customers`-rij blijft staan (klant ≠ login).

## Bestanden / acties

| File | Actie |
|---|---|
| `supabase/functions/remove-team-member/index.ts` | nieuw (of update bestaand) |
| `supabase/functions/fetch-invitation/index.ts` | + `account_exists`, `already_member` |
| `supabase/functions/send-team-invitation/index.ts` | case-insensitive delete-pending bevestigen |
| `src/pages/AcceptInvitation.tsx` | mode-routing op nieuwe booleans, expliciete accept-knop, "wachtwoord vergeten" link |
| `src/hooks/useTenant.tsx` (of equivalent) | revalideer roles, kick uit ontoegankelijke tenant |
| Geen DB-migratie nodig — geen schemawijziging |

## Wat NIET in dit plan zit
- Geen auth.users verwijderingen ooit (jouw expliciete eis).
- Geen wijzigingen aan klantenrecords.
- Geen realtime-revocation als blocker (alleen optioneel).

# Team Invite-flow — Manuele regressie-checklist

Doorloop alle 7 paden + edge cases na deploy van Batch INV-1 t/m INV-5.
Test-tenant: Mancini Milano (`2606c5b9-caf8-4a42-94cd-80e3f3f31988`).

Per pad: noteer ✅ / ❌ + opmerkingen. Sluit af met audit-log-query.

---

## Pad A — already_member

**Setup:** gebruiker X is al lid van tenant Y.
**Stap:** tenant_admin verstuurt invite naar X voor tenant Y.
**Verwacht:**
- Dialog toont rode banner "Is al lid van dit team" — Verstuur-knop disabled.
- Indien toch verstuurd (via SQL): bij open invite-link → state `already_member`
  met "Je bent al lid van dit team" + knop "Naar dashboard".

## Pad B — expired

**Setup (SQL):**
```sql
UPDATE team_invitations
   SET expires_at = NOW() - INTERVAL '1 hour'
 WHERE id = '<test_id>';
```
**Stap:** open invite-link.
**Verwacht:** state `expired` met "Uitnodiging verlopen" + tekst "Vraag een
nieuwe uitnodiging aan de beheerder". Geen accept-knop.

## Pad C — revoked

**Setup:** tenant_admin verstuurt invite, daarna intrekken via
`TenantInvitationsList` (3-puntjes → Intrekken).
**Stap:** open invite-link na revocation.
**Verwacht:** state `revoked` met "Uitnodiging is ingetrokken".

## Pad D — login_required (bestaande account)

**Setup:** invite naar email met bestaand SellQo-account.
**Stap:** open invite-link in **incognito** (geen sessie).
**Verwacht:**
- State `login_required` — email is pre-filled en disabled.
- Na login → `accept` → success-screen → auto-redirect na 3s naar `/admin`.

## Pad E — OTP-flow (nieuwe account)

**Setup:** invite naar email zonder bestaand SellQo-account
(bv. `test+otpN@nomadix.be`).
**Stappen:**
1. Open invite-link in incognito.
2. State `otp_request` → klik "Verstuur code".
3. Check mailbox voor 6-cijferige OTP (Supabase default template tot Akke
   handmatig customizet — zie post-deploy-actie #1).
4. State `otp_verify` → vul code in.
5. State `set_password` → kies wachtwoord ≥ 8 tekens.
6. State `success`.

**Verwacht:** geen identity-spoofing mogelijk — email-ownership is
server-side bewezen via OTP.

## Pad F — one_click_accept (ingelogd, email match)

**Setup:** gebruiker X ingelogd. Invite verstuurd naar X.
**Stap:** klik invite-link.
**Verwacht:** state `one_click_accept` met "Eén-klik bevestigen" knop. Geen
password. Na klik → `success`.

## Pad G — wrong_account (ingelogd, email mismatch)

**Setup:** gebruiker A ingelogd. Invite verstuurd naar B.
**Stap:** klik invite-link.
**Verwacht:** state `wrong_account`. ENIGE actie: "Uitloggen en doorgaan
als <invite email>". GEEN "Naar dashboard" knop. Na uitlog → fallback
naar pad D of E.

---

## Edge cases

| # | Scenario | Verwacht |
|---|---|---|
| 1 | Invite-link 2× openen na succes | `already_member` (rol bestaat al) |
| 2 | Token bestaat niet | 404 "Uitnodiging niet gevonden" |
| 3 | Defensieve email-match: forceer pad F, wijzig `invite.email` via SQL → klik accept | `403 EMAIL_MISMATCH` in netwerk-tab; UI toont `wrong_account` |
| 4 | Tenant verwijderd terwijl invite pending | cascade-delete verwijdert invite (FK `ON DELETE CASCADE`) → 404 bij open |
| 5 | User removed via `remove-team-member` → opnieuw uitnodigen | Pad D (account bestaat) of E (account verwijderd) — beide moeten werken |
| 6 | Accepted invite resend-poging | 409 "Uitnodiging is reeds geaccepteerd" |
| 7 | Revoked invite "Opnieuw uitnodigen" via list | reset naar `pending`, nieuwe `expires_at` +7d, nieuwe email |

---

## Audit-log verificatie

Na elke run:
```sql
SELECT event_type, actor_email, created_at
  FROM invite_audit_log
 WHERE invitation_id = '<test_id>'
 ORDER BY created_at;
```

Verwachte event-sequenties:
| Pad | Events |
|---|---|
| D / E / F | `sent` → `accepted` |
| C | `sent` → `revoked` |
| G + vervolg | `sent` → (na D/E) `accepted` |
| Resend | `sent` → `resent` → (na accept) `accepted` |
| Pad B (auto-expire via cron) | `sent` → `expired` |

---

## Performance baseline (issue #5)

Profileer `accept-team-invitation`:

```bash
# In supabase edge function logs filter op function=accept-team-invitation
# Noteer 'execution_time_ms' over 5 acceptaties.
```

| Pad | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Gemiddeld |
|---|---|---|---|---|---|---|
| D | __ | __ | __ | __ | __ | __ |
| E | __ | __ | __ | __ | __ | __ |
| F | __ | __ | __ | __ | __ | __ |

**Drempel:** > 2 s = bottleneck — verdacht: `user_roles` INSERT met RLS
recursive lookup of de `fetch_invitation` round-trip. Documenteer baseline
+ bottleneck in `docs/team-invite-eindrapport.md` sectie Performance.
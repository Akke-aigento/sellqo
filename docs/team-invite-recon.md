# Team Invite Flow — Recon Rapport

**Datum:** 2026-06-09
**Status:** Recon-only. Geen code-wijzigingen. Voorbereidend document voor implementatie-batches INV-1 t/m INV-5.
**Scope:** Volledige team-invitation flow (tenant_admin → geadresseerde → lid van tenant), inclusief security, UX, performance en compliance.

---

## 1. Current-state inventory (bevestigd)

### 1.1 Database

- **Tabel `public.team_invitations`** — migration `20260120164753`
  - Kolommen: `id`, `tenant_id`, `email`, `role`, `invited_by`, `token`, `expires_at`, `accepted_at`, `created_at` (9 kolommen, 2 policies)
  - **Geen** `status` enum, geen `revoked_at`, geen `last_reminder_sent_at`
  - FK `tenant_id` cascade-delete via `tenants`
  - RLS: 2 policies — admin-scope + service_role. Anon-lookup via edge function (`fetch-invitation`), niet via directe SELECT (memory `invitation-lookup-pattern`).

- **Geen invite-audit-tabel.** `admin_actions_log` bestaat maar wordt nu niet gevuld voor invite-events.

### 1.2 Edge functions (bevestigd aanwezig)

| Function | Regels | Verify JWT | Doel |
|---|---|---|---|
| `send-team-invitation` | 207 | ja (`authenticateRequest`) | Insert invite + mail |
| `fetch-invitation` | ~95 | nee | Anon token-lookup, returnt status + accountExists + alreadyMember |
| `accept-team-invitation` | 117 | ja (Bearer JWT, `getUser`) | Insert user_roles + mark accepted |
| `remove-team-member` | n/a | ja | Verwijder user_role |

**Ontbrekend:** `revoke-team-invitation`, `resend-team-invitation`, `reminder-invitations` (cron).

### 1.3 Frontend

- `src/pages/AcceptInvitation.tsx` — 592 regels. Monolithisch, geen formele state-machine. Bevat registratie-form (signUp + auto-signIn), login-form, mismatch-state, accept-flow.
- `src/components/admin/settings/InviteTeamMemberDialog.tsx` — email + role picker. **Geen** real-time account-check, **geen** accountExists-banner.
- `src/components/admin/settings/TeamSettings.tsx` — lijst pending invites + bestaande leden. Acties: cancel, resend (delete+create, niet idempotent).
- `src/components/platform/TenantTeamTab.tsx` — platform-admin variant.
- `src/hooks/useTeamInvitations.ts` — fetch/send/cancel/resend.

---

## 2. Bevestigde issues

### 2.1 KRITIEK — Security: signUp zonder email-ownership-proof

**Locatie:** `AcceptInvitation.tsx` → `handleRegister` (~r153).
**Flow:** `supabase.auth.signUp({ email, password })` → meteen `signInWithPassword`. Geen mailbox-verificatie.
**Reproductie 2026-06-09:** `aaron-mercken@hotmail.com` (streepje-alias, geen toegang tot mailbox) succesvol geclaimd met verzonnen wachtwoord. Aanvaller met enkel kennis van invite-token + invite-email kan tenant binnenkomen.
**Classificatie:** **P0 — kritiek**, blokkeert launch voor enterprise.

### 2.2 UX — "Naar mijn dashboard" bij email-mismatch

Mismatch-state toont "Naar mijn dashboard"-knop. Suggereert dat user de invite mag negeren met huidig account. Enige correcte actie zou "Uitloggen en doorgaan als `<invite email>`" moeten zijn.

### 2.3 UX — Geen real-time accountExists-check in InviteDialog

Geen debounced lookup op `profiles.email ilike(...)`. Tenant_admin merkt typo-duplicates (`aaron.mercken` vs `aaron-mercken`) pas na verzending.

### 2.4 UX/Security — Ingelogde user moet wachtwoord her-invoeren

Ook als `auth.user.email === invitation.email`, vraagt UI password. Eén-klik-accept ontbreekt. Minor: verleidt password-hergebruik.

### 2.5 PERF — accept-team-invitation traag

**Symptoom (Akke 2026-06):** "lang aan het draaien".
**Hypothese-stack (te profileren in INV-2):**
1. Service-role client init binnen request (geen pool reuse)
2. RLS-recursive lookup bij `user_roles` INSERT
3. 4 sequentiële round-trips: fetch invitation → check existing role → insert role → update invitation
**Classificatie:** P1.

### 2.6 COMPLIANCE — Geen audit-log van invite-events

Geen trail voor sent / accepted / rejected / expired / revoked / reminded. Vereist voor enterprise-trail + Pieter-audit. **P1.**

---

## 3. Voorgestelde nieuwe flow

### 3.1 Tenant_admin verstuurt invite

`InviteTeamMemberDialog`:
1. Email input → debounced (~400ms) edge-call → `accountExists` indicator (✓ "Heeft al SellQo-account" / ○ "Nieuwe gebruiker")
2. Submit → `send-team-invitation`: INSERT `team_invitations` (`status='pending'`), verstuur mail, INSERT audit-log `invite_sent`
3. Toast + lijst-refresh

### 3.2 Geadresseerde klikt /invite/<token>

`fetch-invitation` returnt: `status`, `email`, `role`, `tenantName`, `expiresAt`, `accountExists`, `alreadyMember`.

**State-machine paden:**

| # | Conditie | UI |
|---|---|---|
| a | `alreadyMember=true` | "Je bent al lid" → redirect dashboard |
| b | `expires_at < now()` | "Verlopen" + knop "Vraag nieuwe invite" |
| c | `accepted_at != null` | "Al geaccepteerd" → redirect login |
| d | niet ingelogd + `accountExists=true` | Login-form (email gefixt) → na succes auto-accept |
| e | niet ingelogd + `accountExists=false` | **OTP-flow** (§3.3) → na verify auto-accept |
| f | ingelogd + email match (ilike) | **Eén-klik bevestigen** (geen password) → auto-accept |
| g | ingelogd + email mismatch | "Verkeerd account" — ENIGE actie: "Uitloggen en doorgaan als `<invite email>`" → fallback d/e |

### 3.3 OTP-flow voor nieuwe accounts (pad e)

1. "Bevestig je email — klik om 6-cijfer code te ontvangen"
2. Knop → `supabase.auth.signInWithOtp({ email, shouldCreateUser: true })`
3. 6-cijfer input → `supabase.auth.verifyOtp({ email, token, type: 'email' })`
4. Na verify → "Kies je wachtwoord" → `auth.updateUser({ password })`
5. Auto-call `accept-team-invitation`

**Storefront-checkout-signups blijven onaangetast.** OTP-laag enkel op invite-flow; geen wijziging in Supabase `confirm_email`.

### 3.4 Server-side defensieve checks (accept-team-invitation)

- Token bestaat, niet expired, niet accepted (DRY via gedeelde helper)
- `auth.uid()` email `ilike` `team_invitations.email` — anders **403**
- INSERT `user_roles`
- UPDATE `team_invitations`: `accepted_at`, `status='accepted'`
- INSERT audit-log `invite_accepted`

---

## 4. Schema-wijzigingen (voorstel INV-1)

### 4.1 `team_invitations` toevoegingen

```sql
CREATE TYPE public.invite_status AS ENUM
  ('pending','accepted','expired','revoked','rejected');

ALTER TABLE public.team_invitations
  ADD COLUMN status public.invite_status NOT NULL DEFAULT 'pending',
  ADD COLUMN last_reminder_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN revoked_at TIMESTAMPTZ NULL,
  ADD COLUMN revoked_by UUID NULL REFERENCES auth.users(id);
```

Back-fill: `accepted_at IS NOT NULL → 'accepted'`, `expires_at < now() → 'expired'`, anders `'pending'`. Cron-functie kan later `pending → expired` overzetten.

### 4.2 Audit-log (OB-INV-2 voorstel: aparte tabel)

```sql
CREATE TABLE public.invite_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NULL REFERENCES public.team_invitations(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  actor_user_id UUID NULL,
  event_type TEXT NOT NULL,
  email TEXT NULL,
  role TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- + GRANTs + RLS (tenant_admin SELECT, service_role ALL).
```

Reden voor aparte tabel: gerichter, geen schema-pollution op `admin_actions_log`, eenvoudige retention.

---

## 5. Edge-function changes

| Function | Wijziging |
|---|---|
| `send-team-invitation` | + `status='pending'`, + audit-log `invite_sent` |
| `fetch-invitation` | Behoud; `accountExists` al aanwezig |
| `accept-team-invitation` | + defensieve `ilike` email-check, + audit-log, + `status='accepted'`, profileer perf |
| `revoke-team-invitation` | **NIEUW** — tenant_admin only, `status='revoked'`, + audit-log |
| `resend-team-invitation` | **NIEUW** — reset `expires_at +7d`, `status='pending'`, hergebruik token, + audit-log |
| `reminder-invitations` (cron) | **NIEUW (MVP+1)** — 3-dagen-pending → reminder + `last_reminder_sent_at` |

---

## 6. Frontend components

- `InviteTeamMemberDialog` — real-time accountExists-check + banner.
- `AcceptInvitation.tsx` — **state-machine refactor** (paden a–g), splitsen in:
  `<InviteLoading/>`, `<InviteInvalid/>`, `<InviteAccepted/>`, `<InviteExpired/>`, `<InviteAlreadyMember/>`, `<InviteLoginForm/>` (d), `<InviteOtpClaim/>` (e), `<InviteOneClickConfirm/>` (f), `<InviteMismatch/>` (g)
- `TenantInvitationsList` — filters pending/accepted/expired/revoked, acties: intrekken, opnieuw versturen, handmatige reminder.

---

## 7. Email-templates

- `send-team-invitation` mail: + "Verstuurd door `<invited_by name>`", duidelijke CTA, tenant-naam in header.
- `reminder-invitation` (NIEUW, MVP+1): zachte herinnering 3 dagen.

---

## 8. Edge cases (gedocumenteerd)

- **Removed user → re-invite:** werkt. `remove-team-member` haalt enkel `user_roles` weg; user blijft in `auth.users`. Nieuwe invite → pad f als ingelogd, anders d.
- **Tenant verwijderd terwijl invites pending:** cascade-delete via FK bestaat.
- **Email-alias (`aaron.mercken` vs `aaron-mercken`):** echt verschillende auth-users. Bewust accepteren in MVP. Outlook-alias-normalisatie = backlog (OB-INV-8).
- **OTP-claim → later password reset:** standaard Supabase-flow.
- **User klikt invite, OTP start, sluit tab, opent later:** OTP-default 60 min. Documenteer in UI.
- **Twee gelijktijdige claims:** UNIQUE `(tenant_id, user_id)` op `user_roles` voorkomt dubbel. Catch + "al lid"-melding.

---

## 9. Open beslispunten

| ID | Vraag | Voorstel |
|---|---|---|
| OB-INV-1 | OTP-code vs magic-link? | **OTP** (geen tab-frictie, beter mobile) |
| OB-INV-2 | Audit in `admin_actions_log` of aparte tabel? | **Aparte `invite_audit_log`** |
| OB-INV-3 | Reminder-cron in MVP? | **MVP+1** |
| OB-INV-4 | Bulk-invite CSV in MVP? | **MVP+1** |
| OB-INV-5 | Domain-restrictie per tenant? | **MVP+2** (enterprise) |
| OB-INV-6 | Per-tenant branding op invite-pagina? | **MVP+1** |
| OB-INV-7 | Enum-naam `invite_status` botsing? | Geen verwacht conflict; te bevestigen in INV-1 |
| OB-INV-8 | Email-alias-normalisatie (dot/dash)? | **Backlog** — risico false-merge |

---

## 10. Sub-volgorde implementatie

| Batch | Scope |
|---|---|
| **INV-1** | Schema: `invite_status` enum, kolommen, `invite_audit_log` tabel + RLS/GRANTs |
| **INV-2** | Backend: edge-fns send/fetch/accept aangepast + revoke/resend nieuw + perf-profiling accept |
| **INV-3** | Frontend: state-machine refactor `AcceptInvitation`, `InviteTeamMemberDialog` real-time check, `TenantInvitationsList` filters |
| **INV-4** | Email-templates update + tenant-branding hooks (deel MVP+1) |
| **INV-5** | Regressie-test alle paden a–g + security-sanity (signUp-pad weg, OTP verplicht) |

---

## 11. Acceptatiecriteria (eindstaat)

- Geen pad meer waar `auth.signUp` zonder email-proof account claimt voor invite-email.
- Pad f (ingelogd + match) is 1 klik, geen password.
- Pad g toont alleen "uitloggen en doorgaan als …", geen dashboard-uitweg.
- Elke state-change (sent/accepted/revoked/expired/reminded) heeft audit-row.
- `accept-team-invitation` ≤ 500ms p95 lokaal (na profiling-fix).
- Tenant_admin ziet bij invoer of email al SellQo-account heeft, vóór versturen.

---

**Einde recon. Geen code gewijzigd. Wacht op go voor batch INV-1.**

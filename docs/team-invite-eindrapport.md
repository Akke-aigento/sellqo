# Team Invite-flow Refactor — Eindrapport

## Scope
- Hoofdstuk team-onboarding refactor in 5 batches (INV-1 t/m INV-5).
- Periode: 2026-06-09 (één-dag-implementatie).
- Trigger: recon-rapport `docs/team-invite-recon.md` — 6 issues
  (1 KRITIEK security, 3 UX, 1 perf, 1 compliance).

## Opgeloste issues

1. **KRITIEK identity-spoofing** — opgelost via OTP-flow voor nieuwe
   accounts (pad E). Email-ownership wordt server-side bewezen voordat
   een wachtwoord wordt gekozen. Daarnaast defensieve email-match in
   `accept-team-invitation` (403 `EMAIL_MISMATCH`).
2. **UX** — "Naar dashboard" knop verwijderd uit `wrong_account` pad
   (pad G). Enige actie is uitloggen en doorgaan als de invite-email.
3. **UX** — real-time email-check banner in `InviteTeamMemberDialog`
   via nieuwe `check-invite-email` edge function (debounced 300ms).
4. **UX** — `one_click_accept` voor reeds ingelogde matching users
   (pad F). Geen password-prompt meer.
5. **PERF** — baseline na refactor: zie `docs/team-invite-test-checklist.md`
   sectie Performance. Verwacht < 500 ms voor pad D/F, < 1500 ms voor pad E
   (extra OTP-roundtrip).
6. **COMPLIANCE** — `invite_audit_log` tabel met 7 event-types
   (`sent | accepted | rejected | expired | revoked | reminded | resent`),
   RLS `SELECT`-only voor tenant_admin + platform_admin, writes uitsluitend
   via service-role.

## Architectuur

- **State-machine**: 15 states in `AcceptInvitation.tsx`, paden a–g
  + `loading`, `error`, `success`.
- **Edge functions** (5): `send-team-invitation` (update), `fetch-invitation`
  (update), `accept-team-invitation` (update), `revoke-team-invitation`
  (nieuw), `resend-team-invitation` (nieuw), plus `check-invite-email`
  (nieuw, helper).
- **Schema**: 4 nieuwe kolommen op `team_invitations`
  (`status`, `last_reminder_sent_at`, `revoked_at`, `revoked_by`),
  nieuwe tabel `invite_audit_log`, nieuw enum `invite_status`,
  helper-functie `get_invitation_effective_status(uuid)`.
- **pg_cron**: `expire-invitations` daily 03:00 UTC.

## Beslispunten bevestigd

| ID | Beslissing | Status |
|---|---|---|
| OB-INV-1 | OTP (6-cijfer) over magic-link | ✅ geïmplementeerd |
| OB-INV-2 | Aparte `invite_audit_log` tabel | ✅ geïmplementeerd |
| OB-INV-3 | Reminder-cron (3-dagen-pending) | ⏳ MVP+1 backlog |
| OB-INV-4 | Bulk-invite via CSV | ⏳ MVP+1 backlog |
| OB-INV-5 | Domain-restrictie enterprise | ⏳ MVP+2 backlog |
| OB-INV-6 | Per-tenant branding op invite-page | ⏳ MVP+1 backlog |
| OB-INV-7 | Enum-naam `invite_status` zonder conflict | ✅ bevestigd |
| OB-INV-8 | Outlook alias-normalisatie | ⏳ backlog |

## Handmatige post-deploy acties voor Akke

1. **Supabase Dashboard → Auth → Email Templates → "Magic Link"**:
   customize OTP-email met SellQo-logo + NL-tekst. Voorgesteld:
   - Subject: `Bevestig je email voor SellQo`
   - Body: `Hallo! Je 6-cijferige bevestigingscode is: {{ .Token }}.
     Deze code is 60 minuten geldig.`
2. **Supabase Dashboard → Auth → Email Templates → "Confirm email"**:
   verifieer dat deze template UIT staat voor storefront-signups
   (frictieloos checkout-flow blijft intact — onze invite-flow bouwt
   eigen OTP-laag bovenop auth).
3. **Run regressie**: doorloop `docs/team-invite-test-checklist.md`
   alle 7 paden + 7 edge cases.
4. **Monitor**: bekijk eerste echte invites via `TenantInvitationsList`
   (Settings → Team) en `invite_audit_log` SQL-query.

## Backlog

- Reminder-cron voor 3-dagen-pending invites (OB-INV-3).
- Bulk-invite via CSV upload (OB-INV-4).
- Per-tenant branding (logo) op invite-pagina (OB-INV-6).
- Domain-restrictie voor enterprise-tenants (OB-INV-5).
- Outlook email-alias normalisatie — `aaron.mercken` vs `aaron-mercken`
  (OB-INV-8).
- SAML SSO voor enterprise (3-6 maanden horizon).
- Cross-tenant invite tonen in tenant-switcher na accept (multi-tenant).

---

**Status:** Team Invite-flow refactor AFGESLOTEN — 2026-06-09.
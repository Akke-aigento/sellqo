# Fix — OTP-mail komt niet aan bij invite (structureel)

## Nieuwe observaties uit de DB

- **Invitation** `48edba58-bcc8-48cb-98df-01b40a938772` → `aaron-mercken@hotmail.com`, tenant `05b419c3-…`, aangemaakt 11:43:53, nog niet accepted, verloopt 13 juli.
- **auth.users row** is aangemaakt om 11:45:35 (`8e4cf41a-…`) met `email_confirmed_at` direct gezet — dat betekent dat de "Nieuw account aanmaken"-flow op de invite-pagina de user al heeft aangemaakt en een `recovery`/OTP heeft aangevraagd om de session te openen.
- **Auth-log**: `user_recovery_requested` returnde 200 via Lovable's managed hook.
- **`email_send_log`**: geen enkele row voor dit adres, geen row überhaupt sinds 11 juni. Dus de managed default hook logt niets meer in `email_send_log` en de queue wordt niet aangeraakt.
- **`suppressed_emails`**: niks — geen bounce/complaint geregistreerd.

Conclusie: de auth-mail wordt door Lovable's default managed path niet betrouwbaar naar Hotmail bezorgd, en we hebben geen enkel forensisch spoor. Dat moet fixed worden vóór je klanten uitnodigt.

## Root cause

Er is **geen `supabase/functions/auth-email-hook/`** in dit project — nooit gescaffold. Alle auth-mails leunen dus op Lovable's default managed sender zonder queue, zonder retry, zonder log, zonder suppression-check. In `_shared/email-templates/` staan wel al SellQo-branded NL templates klaar (`magic-link.tsx`, `index.ts` met signup/recovery/invite/etc.), maar zonder hook worden die niet gebruikt.

## Plan (build mode)

### 1. Stale invite + user opruimen zodat retest schoon is
Migratie die het volgende doet voor `email = 'aaron-mercken@hotmail.com'` (zonder de June-account met punt aan te raken):

- `DELETE FROM team_invitations WHERE id = '48edba58-bcc8-48cb-98df-01b40a938772';`
- `DELETE FROM invite_audit_log WHERE invitation_id = '48edba58-…';` (om FK-cascade te voorkomen indien nodig — anders vóór de delete)
- `DELETE FROM auth.users WHERE id = '8e4cf41a-9546-4754-b902-aa6d404e4601';` (cascade ruimt profiles/user_roles op)

Zo kan dezelfde uitnodiging opnieuw verstuurd worden zonder "gebruiker bestaat al"/"invitation exists".

### 2. Custom `auth-email-hook` scaffolden + deployen

- `email_domain--scaffold_auth_email_templates` met `confirm_overwrite: true`.
- De scaffold genereert nieuwe React-Email `.tsx` templates + de `auth-email-hook/index.ts` die naar `enqueue_email` (queue `auth_emails`) schrijft.
- **SellQo-branding porten**: onze bestaande NL-copy en huisstijl uit `_shared/email-templates/index.ts` (magicLinkTemplate, recoveryTemplate, inviteTemplate, signupTemplate, emailChangeTemplate, reauthenticationTemplate — allemaal in NL, met support@sellqo.app, SellQo-tone, `renderSellqoEmail`) porten naar de nieuwe scaffold-templates. Kleuren/logo/footer identiek houden zoals nu.
- `supabase--deploy_edge_functions` met `["auth-email-hook"]`.

Resultaat: elke invite-recovery/magiclink/signup gaat via `q_auth_emails` → `process-email-queue` (cron 5s) → provider. Dus:
- `email_send_log` krijgt `status='sent'` of `failed` + `error_message`.
- Bij Hotmail-bounce: row in `suppressed_emails`.
- Automatische retry tot 5 pogingen / DLQ na TTL.

### 3. Verificatie

Na deploy verstuur ik opnieuw een invite naar `aaron-mercken@hotmail.com`:
- Auth-log toont `user_recovery_requested` → hook 200.
- Rij in `email_send_log` met `template_name='recovery'` en `status='sent'` binnen ~10s.
- Queue-worker log toont delivery.
- Als Hotmail alsnog dropt zien we dat nu direct in `error_message` of `suppressed_emails` (i.p.v. de huidige stilte).

## Wat ik NIET aanraak

- Niet de bestaande invite-frontend (`/invite/:token`), niet `send-team-invitation`, niet `fetch-invitation`, niet de `team_invitations` schema.
- Niet de DNS-delegatie van `auth.sellqo.app` (blijft verified via Lovable NS).
- Niet de June-account `aaron.mercken@hotmail.com` (met punt) en zijn invitations/tenant.
- Geen externe mail-provider (Resend/SendGrid).

## Technische details

- **Deletes** gebeuren via SQL-migratie (idempotent met `WHERE id = …`), niet via psql.
- **Scaffold overwrite** overschrijft `_shared/email-templates/*.tsx` en `auth-email-hook/index.ts`. De bestaande `_shared/email-templates/index.ts` (SellQo-strings) wordt **niet** overschreven door scaffold (andere bestandsnaam-pattern), maar we hergebruiken de copy erin voor de nieuwe React templates.
- Scaffold gebruikt `LOVABLE_API_KEY` (auto-provisioned), geen extra secrets nodig.
- DNS is al verified → emails activeren direct na deploy, geen wachttijd.

Akkoord om dit uit te voeren?

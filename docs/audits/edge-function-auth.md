# Auth-triage van de publieke edge functions

**Gestart:** 11 september 2026
**Aanleiding:** de gedeployede `verify_jwt`-default blijkt `false`. **227 van de 229 edge
functions zijn publiek bereikbaar**; alleen `nano-studio` en `process-email-queue` staan
expliciet op `true` en worden door de gateway geblokkeerd. Elke andere functie moet dus zijn
eigen autorisatie doen. Zie `sellqo-brede-diagnose.md` §4c en `role-audit.md` PUBLIC-FN-1.

---

## Methode — waarom dit met lezen gebeurt en niet met greppen

Drie grep-heuristieken gaven drie verschillende verkeerde antwoorden:

| Poging | Uitkomst | Werkelijkheid |
|---|---|---|
| Smalle markerlijst | "24 zonder check" | Bijna allemaal vals |
| Brede markerlijst | "0 zonder check" | Elke functie noemt érgens `401` |
| Guard vóór het eerste `.from()` | "76 kandidaten" | `get-document-url`, `refund-invoice` en `pos-refund-payment` zaten erin en zijn alle drie correct |

De oorzaak van die laatste misser is het gangbare — en juiste — patroon in deze codebase:

> **Resolve-then-authorize.** Eerst de rij ophalen met de service-role-client om te wéten bij
> welke tenant hij hoort, dán `authenticateRequest(req, tenant_id)`, en pas daarna het werk.
> `refund-invoice:65` noemt het met zoveel woorden: *"OWN-TENANT GUARD (hard): 403 voor
> niet-platform-admins buiten de tenant."*

Een grep die alleen naar de volgorde kijkt, ziet dat aan voor een gat.

**Er wordt ook niet geprobed om auth te testen.** Een probe voert de functie uit. Bij een
betaal- of mailfunctie is dat precies het scenario dat je wilt voorkomen. Probes bewijzen een
*deploy*, achteraf, bij een functie waarvan we weten wat hij doet.

Het scherpste statische filter is "roept nergens een autorisatieprimitief aan" — **68
functies**. Ook dat is indicatief: `storefront-api` staat erin en controleert wél een
API-key, alleen anders dan het filter verwacht.

**Drie uitkomsten per functie, geen tussenvorm:** vrijgesproken (mét regelverwijzing),
bewust publiek (mét reden), of gat (mét fix).

---

## Batch 1 — de vijf met de grootste blast radius

**Uitkomst: 4 vrijgesproken, 1 gat.**

### ✅ `create-invite-account` — bewust publiek, correct

De "accepteer je uitnodiging en kies een wachtwoord"-flow. De aanroeper heeft per definitie
nog geen account, dus auth eisen zou hem onmogelijk maken. **Het token is de autorisatie**,
en dat token deugt:

- `team_invitations.token` is `gen_random_uuid()` — niet te raden.
- `expires_at` staat standaard op `now() + 7 days` en wordt gecontroleerd (regel 76).
- `accepted_at` maakt hem eenmalig (regel 72); `revoked`/`rejected` worden afgevangen (73).
- Het wachtwoord wordt alleen gezet voor het e-mailadres dat aan dat token hangt.

### ✅ `fetch-invitation` — bewust publiek, correct

Zelfde UUID-token, toont "je bent uitgenodigd voor X". Bepaalt de effectieve status via de
RPC `get_invitation_effective_status` en houdt rekening met `tenant_access_revocations`. Wat
het teruggeeft — eigen e-mailadres, rol, tenantnaam — is precies wat de genodigde hoort te
zien.

### ✅ `resolve-tenant-action` — bewust publiek, gedocumenteerd

Regel 1 van het bestand zegt het zelf: *"PUBLIEKE resolver. Het token IS de autorisatie."*
Valideert bestaan, `completed` (410 `token_used`), `revoked`, `expired` en het actietype.

### ✅ `send-push-notification` — auth aanwezig

`X-Internal-Secret` tegen `internal_config.internal_webhook_secret`, op regel 106-114, vóór
enig werk. Vrijgesproken.

> **Wel een observatie:** dit is het **vierde** mechanisme voor hetzelfde doel, naast
> `x-cron-secret` (`_shared/cronAuth.ts`), het verwijderde `X-Sync-Secret` en de letterlijke
> sleutelvergelijking uit ADS-CRON-1. De vergelijking is hier bovendien niet constant-time.
> Kandidaat om te laten opgaan in `isAuthorizedCronRequest`; geen gat, dus geen spoedklus.

### ❌ `send-whatsapp-message` — gat, gerepareerd

**Geen enkele autorisatie.** Wie `{tenant_id, to_phone, template_type}` POSTte, verstuurde
een WhatsApp-bericht via het access token van die tenant naar een willekeurig nummer.

Wat het beperkte: de tenant moet een actieve `whatsapp_connections`-rij hebben en het
template moet `approved` zijn. **De inhoud lag dus vast, de ontvanger niet** — een
spam-/phishingkanaal vanaf een geverifieerd zakelijk nummer, op kosten van de tenant.

**Impact vandaag: nul, en dat is toeval.** Er zijn nul WhatsApp-connecties en nul
goedgekeurde templates, dus elke aanroep krijgt "WhatsApp not configured for this tenant".
Net als bij `automation-scheduler` wordt dit een echt gat zodra de functie in gebruik gaat.

**Fix.** `await authenticateRequest(req, tenant_id)` ná het uitlezen van de body, vóór het
ophalen van de connectie — exact het resolve-then-authorize-patroon van de rest van de
codebase. De functie heeft drie legitieme aanroepers in de UI
(`useWhatsAppMessages.ts:27`, `ComposeDialog.tsx:252`, `ReplyComposer.tsx:195`), dus
gebruikersauth met tenant-scope, géén cron-auth.

Daarbij: de `catch` gaf voor élke fout een 500, ook voor een auth-fout. Nu vangt hij
`AuthError` eerst af, zodat een onbevoegde aanroep een eerlijke 401 krijgt. En de import van
`supabase-js` is van `@2` naar `@2.57.2` gepind (**R2**).

---

## Nog te doen

| # | Functie | Reden |
|---|---|---|
| 6 | `send-payment-request-email` | bericht + geld |
| 7 | `create-invoice-payment-link` | geld |
| 8 | `create-cycle-payment-link` | geld |
| 9 | `create-checkout-session` | geld |
| 10 | `create-bank-transfer-order` | geld |
| 11 | `dispatch-payment-request` | geld |
| 12 | `create-credit-note-from-return` | geld terug |
| 13 | `process-gift-card-purchase` | geld |
| 14 | `generate-payment-request-pdf` | documentlek |
| 15 | `generate-subscription-invoice-pdf` | documentlek |

Daarna de resterende ~53 uit de 68, in batches van vijf.

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

> **Uitgerold en geverifieerd — 11 sep 2026.** POST zonder `Authorization`-header, met
> nep-`tenant_id` en nep-telefoonnummer:
> `401 {"success":false,"error":"Missing or invalid Authorization header"}`.
> Dat is de melding uit `_shared/auth.ts`, afgehandeld door de nieuwe `AuthError`-tak — dus
> zowel de guard als de statuscode-correctie zijn live. De probe ging bewust via POST met
> body: de guard staat ná het uitlezen daarvan, dus een lege GET zou op het JSON-parsen
> stranden en niets bewijzen.

---

## Batch 2 — de tien betaal- en documentfuncties (12 sep 2026)

**Uitkomst: 2 terecht publiek, 8 gaten. Alle tien hadden geen enkele autorisatie** — geen
enkele importeerde `_shared/auth.ts`, alle tien bouwden een service-role-client, en in geen
enkele werd de `Authorization`-header ook maar uitgelezen.

Dat is een slechtere verhouding dan batch 1 (1 gat op 5), en het patroon is consistent: het
*resolve*-deel van resolve-then-authorize stond er overal, het *authorize*-deel nergens.

**De gateway hielp niet.** Van de 154 functies in `config.toml` staan er twee op
`verify_jwt = true` (`process-email-queue`, `nano-studio`); de gedeployede default is `false`.
Vier van deze tien hadden bovendien een expliciete `verify_jwt = false`. Alle tien waren dus
met een kale POST bereikbaar.

### ✅ Terecht publiek — ongemoeid gelaten

**`create-checkout-session`** en **`create-bank-transfer-order`**. Een winkelbezoeker zonder
account moet kunnen afrekenen; auth eisen breekt de webshop. De begrenzing is inhoudelijk in
plaats van op identiteit, en dat is correct opgezet: prijzen uit de body worden genegeerd en
vervangen door DB-prijzen, producten moeten bij de opgegeven tenant horen, de tenant moet
bestaan en betaalklaar zijn, en er is VIES-blokkade waar de tenant dat eist.

> **Twee observaties voor de backlog, geen gat:** `create-checkout-session` zet `customer_id`
> uit de body ongecontroleerd op de order (r. 585) — een bestelling koppelen aan andermans
> klantrecord. En `create-bank-transfer-order` geeft `iban`, `bic` en `beneficiary_name` terug
> aan elke aanroeper die een order aanmaakt. Dat is het doel van de functie (QR-code voor
> overschrijving), maar het is wel een vrij uitleesbaar kanaal.

### ❌ Acht gaten — gerepareerd

| Functie | Wat een vreemde ermee kon | Resolve uit |
|---|---|---|
| `dispatch-payment-request` | betaallink + PDF + mail naar de klant, op kosten van de tenant | `billing_cycles` |
| `send-payment-request-email` | mail met factuur-PDF naar het adres uit de DB | `billing_cycles` |
| `create-cycle-payment-link` | Stripe-sessie aanmaken | `billing_cycles` |
| `create-invoice-payment-link` | idem; `verify_jwt = false` | `invoices` |
| `create-credit-note-from-return` | creditnota aanmaken, nummerreeks verbruiken, retour bijwerken, mail sturen; `verify_jwt = false` | `returns` |
| `process-gift-card-purchase` | cadeaubonnen met echt saldo aanmaken | `orders` |
| `generate-payment-request-pdf` | PDF hergenereren en overschrijven | `billing_cycles` |
| `generate-subscription-invoice-pdf` | idem; `verify_jwt = false` | `invoices` |

De id's zijn UUID's, dus raden is onhaalbaar. Maar dat is geen autorisatie: een id staat in
URL's, mails en supportberichten. Waar een token wél de autorisatie ís — `create-invite-account`
— heeft het een vervaldatum en is het eenmalig. Hier was daar niets van.

**De fix is één patroon**, na het ophalen van de rij en vóór het werk:
`await authenticateRequest(req, <rij>.tenant_id)`.

Dat breekt de bestaande keten niet, en dat is de kern: `authenticateRequest` heeft een
service-role-bypass (`_shared/auth.ts:48-56`), en élke interne aanroeper gebruikt een
service-role-client — nagetrokken voor `generate-subscription-invoices`,
`process-cycle-reminders`, `sync-tenant-plan`, `process-invoice-dunning`, `process-refund`,
`dispatch-payment-request` en `_shared/subscriptionCharge.ts`. (`_shared/mandateToken.ts` kwam
in de grep naar voren maar noemt de functies alleen in een comment.)

`create-credit-note-from-return` kreeg als enige ook een `requireRole` — dat is de enige met een
echte browser-aanroeper (`useReturns.ts:396`), en het maakt een financieel document:
`["tenant_admin", "staff", "accountant"]`, dezelfde lijst als `create-manual-invoice`.

In alle acht vangt de `catch` nu `AuthError` vóór de generieke tak af, anders wordt een 401 een
500 — dezelfde fout als in `send-whatsapp-message`. `process-gift-card-purchase` is bovendien
van `@2` naar `@2.57.2` gepind (**R2**).

**Cadeaubonnen kregen er iets bij.** Er was geen enkele controle of voor een `order_id` al
bonnen bestonden, dus twee aanroepen gaven twee sets kaarten met echt saldo. Nu geeft een
herhaalde aanroep de bestaande bonnen terug.

**Impact vandaag bij die laatste: nul, en dat is toeval.** Nul cadeaubonnen in de database, en
de functie wordt nergens in de codebase aangeroepen — net als bij `send-whatsapp-message` en
`automation-scheduler`. Het wordt een echt gat op de dag dat de feature aangaat.

> **Bijvangst, niet gerepareerd:** 181 facturen hebben een `pdf_url` in de
> `/object/public/`-vorm, terwijl de `invoices`-bucket `public = false` is en géén SELECT-policy
> heeft. Die links zijn dood. Nagetrokken op `storage.buckets` en `pg_policy` — het
> oorspronkelijke onderzoeksrapport beweerde het tegenovergestelde. De downloadknop gebruikt
> `get-document-url`, dus niemand merkt het. Naar de backlog, bij de bredere R1-opruiming.

---

## Nog te doen

Batch 1 en 2 zijn klaar: de vijftien met de grootste blast radius zijn behandeld.

Daarna de resterende ~53 uit de 68, in batches van vijf.

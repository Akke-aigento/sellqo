# NATIVE RETURN-FLOWS AUDIT — Stripe, OAuth en e-mail-redirects

**Datum**: 6 september 2026 · **Branch**: `main` · **HEAD bij recon**: `73a83a8`
**Type**: read-only recon. Bij het opstellen van dit rapport is geen code gewijzigd.

## Sectie 0 — De kern in één alinea

In de Capacitor-app is `window.location.origin` **`capacitor://localhost`** (iOS) of
**`https://localhost`** (Android), en op edge-functies is `req.headers.get("origin")`
datzelfde of afwezig. Vrijwel elke return-, redirect- en e-mail-URL in dit project
wordt uit één van die twee opgebouwd. Er is geen URL-scheme, geen `appUrlOpen`-listener
en dus geen enkele weg terug de app in.

Het fix-patroon staat al in de repo en wordt op deze paden nergens gebruikt:
`src/lib/siteUrl.ts:15` (`PUBLIC_SITE_URL`) — waarvan de docblock exact deze bug
beschrijft — en `src/lib/openExternal.ts`. Beide hebben precies één consument.

**Methode.** Alles hieronder is vastgesteld met `grep`/file-reads tegen de werkkopie,
niet uit herinnering. Regelnummers verwijzen naar `73a83a8`.

---

## Sectie 1 — Stripe-flows

### 1a. Edge-functies, ingedeeld naar hoe de URL ontstaat

**Categorie A — uit de `Origin`-header ⇒ kapot in native**

| Functie:regel | URL-opbouw | Bijzonderheid |
|---|---|---|
| `create-connect-account:56-57` | `` `${req.headers.get("origin")}/admin/settings?stripe=success` `` | 🔴 **geen enkele fallback** |
| `create-platform-mandate-setup:255-257` | `origin \|\| referer \|\| ""` → `` `${origin}/betaling/machtiging/${token}` `` | 🔴 lege fallback ⇒ relatief pad |
| `create-mandate-setup:76-83` | geeft `origin` door als `baseUrl` | helper heeft goede fallback, maar die is dood |
| `create-quote-payment-link:119,126-127` | `origin \|\| "https://sellqo.lovable.app"` | 🔴 **klantgericht** — link gaat per mail naar de koper |
| `create-ai-credits-checkout:107,125-126` | `origin \|\| "https://sellqo.lovable.app"` | stale fallback |
| `create-addon-checkout:119,142-143` | `origin \|\| "https://sellqo.lovable.app"` | stale fallback |
| `create-checkout-session:646,710-711` | `origin \|\| "https://id-preview--9932a7fe-…lovable.app"` | stale; **geen frontend-caller** — legacy |
| `create-tenant-action-link:78-108` | `origin \|\| referer \|\| ""` | platform-admin only |
| `resolve-tenant-action:91-105` | gevalideerd via `safeOrigin` | zie 1b |

**Categorie B — hardcoded/env ⇒ veilig in native. Dit is het na te volgen patroon.**

```ts
// create-invoice-payment-link:79  (idem create-cycle-payment-link:78)
const publicUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://sellqo.app';
```

Niet toevallig: beide worden server-to-server aangeroepen
(`dispatch-payment-request:41`, `process-invoice-dunning:500`), waar geen
request-origin bestaat. De dwang leverde het juiste ontwerp op.

`get-stripe-login-link:63` gebruikt `accounts.createLoginLink` — Stripe mint de hele
URL, geen return-URL in het spel. Ook veilig.

**Categorie C — uit de client-payload**: `storefront-api:2855-2856, 3064, 3111-3112`
neemt `success_url`/`cancel_url` letterlijk over, zonder scheme- of hostvalidatie.

### 1b. 🔴 Asymmetrische storing iOS vs Android

`resolve-tenant-action:36` — `safeOrigin` accepteert alleen `https:` (of
`http://localhost`):

```ts
if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) return null;
```

Android's origin is **`https://localhost`** en glipt er dus **doorheen** → er wordt
stilletjes `https://localhost/actie/<token>` gemunt. iOS' `capacitor://localhost`
wordt afgewezen → luide 400 `origin_unresolved`. Dezelfde bug faalt op de twee
platforms tegengesteld: één stil, één luid.

Hetzelfde geldt voor CORS. `_shared/cors.ts:6-11` bevat
`/^https?:\/\/localhost(:\d+)?$/` — Android matcht, iOS niet. Elke functie met
`getCorsHeaders` stuurt dus op iOS geen `Access-Control-Allow-Origin`.

### 1c. Frontend

**`useStripeConnect.ts:11-21` — eigen opener naast de bestaande helper:**

```ts
const openExternalUrl = (url: string) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) { window.location.href = url; return; }
  const win = window.open(url, '_blank');
  if (!win) { window.location.href = url; }
};
```

UA-sniffing ziet de WebView als "mobiel" en navigeert **de app zelf** naar
`connect.stripe.com`. Gecombineerd met de fallback-loze `return_url` uit
`create-connect-account` is dit een enkeltje. Gebruikt op `:157` (onboarding) en
`:205` (Express-dashboard); consumenten `PaymentSettings.tsx:333,409,549` en
`PaymentsStep.tsx:50`. Geen van beide invocaties stuurt een origin mee in de payload —
de functie leest de header.

**Overige aanroepplekken**

| Bestand:regel | Wat |
|---|---|
| `Billing.tsx:242,347` | `window.location.assign(res.url)` naar de mandaat-URL |
| `Billing.tsx:543,754` | checkout-URL uit categorie B — URL klopt, navigatie verlaat alsnog de app |
| `PeppolUpgradeCard.tsx:67` | `window.open(data.url, '_blank')`, niet `openExternal` |
| `CreditPurchaseDialog.tsx:84` | idem |
| `QuoteDetail.tsx:372` | `window.open` op de opgeslagen betaallink |
| `MandateLinkDialog.tsx:63` | `window.open(url, '_blank', 'noopener,noreferrer')` |
| `usePlatformBillingStatus.ts:70-85` | invoke zonder origin in de payload |
| `Subscriptions.tsx:163-176` | invoke `create-mandate-setup`, resultaat in een dialog |

**`TenantAction.tsx:59-62`** is de enige plek die de origin bewust als payload-veld
meestuurt — het goede idee, met de verkeerde waarde in native.

**`MandateActivation.tsx:45-56`** gebruikt embedded Stripe Elements met
`redirect: 'if_required'` en `return_url: window.location.href`. Kaartbetalingen
blijven dus in-app en werken vandaag. Het bijt alleen bij 3DS-challenges en
redirect-methodes — iDEAL en Bancontact, in NL/BE juist het normale geval.

**Informatief, hardcoded en ongevaarlijk**: `PlatformBilling.tsx:335,395`,
`TenantSubscriptionTab.tsx:139`, `TenantInvoicesTab.tsx:102-107` — deeplinks naar
het Stripe-dashboard, geen return-URL.

---

## Sectie 2 — OAuth- en redirect-flows

### 2a. 🔴🔴 `social-oauth-callback` is óók op web kapot

Alle zeven exits zijn **relatieve** `Location`-headers
(`:158, 165, 184, 192, 233, 296, 302`):

```ts
:296  headers: { Location: '/admin/settings?section=social&success=connected' },
```

Een relatieve `Location` resolvet tegen de **Supabase-functions-origin** →
`https://<project>.supabase.co/admin/settings?…` → 404. De tokenuitwisseling slaagt
en de koppeling wordt opgeslagen (`:214`), maar de gebruiker landt op een dode
pagina — op web net zo goed als in native. `social-oauth-init:113` schrijft netjes
`redirect_url` in `oauth_states`; **de callback leest dat veld nergens.**

Zes aanroepplekken bouwen hun `redirectUrl` uit `window.location.origin`:

| Bestand:regel | Opbouw | Navigatie |
|---|---|---|
| `SocialConnectionsManager.tsx:90` | `origin + '/admin/settings?section=social&oauth=callback'` | `window.location.href` (`:101`) |
| `UnifiedChannelList.tsx:255` | `origin + '/admin/connect?tab=channels'` | `window.location.href` (`:271`) |
| `MetaConnectWizard.tsx:107` | `origin + '/admin/connect?tab=channels'` | `window.open(…, '_blank')` (`:126`) |
| `MessagingChannelList.tsx:119` | `window.location.href` (rauwe huidige URL) | `window.location.href` (`:138`) |
| `MetaShopWizard.tsx:71` | `origin + '/admin/settings?section=social'` | popup-polling |
| `WhatsAppConnectWizard.tsx:101` | `origin + '/admin/connect?tab=channels'` | popup-polling |

De `state` die drie ervan in `sessionStorage` zetten wordt door niets uitgelezen; het
`?oauth=callback`-signaal evenmin.

`social-oauth-init:123,145,156` zet `redirect_uri` hardcoded op
`${supabaseUrl}/functions/v1/social-oauth-callback` — dat deel klopt en is
platform-onafhankelijk.

### 2b. Popup-polling — structureel onherstelbaar in een WebView

`MetaShopWizard.tsx:78-87` en `WhatsAppConnectWizard.tsx:117-125`:

```js
const popup = window.open(data.authUrl, 'meta_oauth', 'width=600,height=700');
const checkPopup = setInterval(() => { if (popup?.closed) { … } }, 500);
```

In de WebView worden de afmetingen genegeerd, gaat de URL naar de systeembrowser en
rapporteert de handle nooit `closed`. De interval lekt of vuurt meteen.

### 2c. Shopify — dode flow

`shopify-oauth-init:25` wijst hardcoded naar `https://sellqo.app/api/shopify/callback`,
een route die **niet meer bestaat** (`docs/role-audit.md:9882` legt de verwijdering
vast; bevestigd afwezig in `src/App.tsx`). `shopify-oauth-callback` is POST-only
(`:200` geeft 405 op GET) terwijl Shopify met GET terugkomt. Er is bovendien geen
frontend-caller van `shopify-oauth-init`.

### 2d. E-mail-redirects — de categorie die buiten de opdracht viel

| Bestand:regel | Constructie |
|---|---|
| `useAuth.tsx:533,539` | `` emailRedirectTo: `${window.location.origin}/` `` (signup) |
| `useAuth.tsx:578` | `` redirectTo: `${window.location.origin}/reset-password` `` |
| `AccountSettings.tsx:123` | `` emailRedirectTo: `${window.location.origin}/admin` `` |

Vraagt iemand vanuit de app een wachtwoord-reset aan, dan gaat er
`redirect_to=capacitor://localhost/reset-password` naar GoTrue. Die valt op de
allowlist terug of stuurt een link die niemand kan openen. Erger dan de
OAuth-gevallen, want het artefact belandt in een mailbox en leeft daar voort.

De docblock op `useAuth.tsx:95-97` motiveert de dynamiek expliciet ("zodat tenants op
custom domains niet naar de platform-URL gestuurd worden") — dat argument klopt voor
web en niet voor native. Een fix moet dus per platform splitsen, niet de dynamiek
domweg vervangen.

Server-kant is inconsistent: `auth-email-hook:41` heeft `ROOT_DOMAIN = "sellqo.app"`
(goed), `send-team-invitation:166` een stale `https://sellqo.lovable.app/invite/…`.

---

## Sectie 3 — Huidige native-infra

| Vraag | Antwoord | Bewijs |
|---|---|---|
| URL-scheme in `Info.plist`? | **Nee** — geen `CFBundleURLTypes` | grep |
| Android intent-filter? | **Nee** — alleen MAIN/LAUNCHER | `AndroidManifest.xml:20-23` |
| Universal / App Links? | **Nee** — geen `apple-app-site-association`, geen `assetlinks.json` | find |
| `appUrlOpen`-listener? | **Nee** — nergens | grep |
| `@capacitor/app` geïnstalleerd? | **Ja** — `package.json:20`, `bun.lock`, pod in `ios/App/Podfile:15` | native gelinkt, **niet bedraad** |

Twee dingen die al goed staan: `MainActivity` heeft `launchMode="singleTask"` en
`exported="true"` — precies wat een deep link nodig heeft om de bestaande task te
hergebruiken in plaats van een tweede instantie te starten.

Eén verouderd commentaar: `src/native/pushRegistration.ts:122` stelt dat
`@capacitor/app` niet geïnstalleerd is. Sinds fase 2A is dat onjuist.

---

## Sectie 4 — Voorgestelde fix-strategie

### (a) Scheme-keuze

| | Custom scheme `sellqo://` | Universal / App Links |
|---|---|---|
| Opzet | één plist-entry + één intent-filter | hosting van `apple-app-site-association` + `assetlinks.json`, Team ID, SHA-256 fingerprints |
| Stripe/OAuth-acceptatie | Stripe weigert non-https `return_url`; Meta/Google weigeren custom schemes in `redirect_uri` | overal geaccepteerd, want gewoon `https://` |
| Web-fallback | geen — de link doet niets in een browser | dezelfde URL werkt op web |
| Kaping | een andere app kan hetzelfde scheme claimen | domeinbezit is bewijs |

**Aanbeveling: Universal/App Links op `https://sellqo.app/app/...`.** De hosting-eisen
zijn eenmalig werk, en het beslissende argument is dat Stripe en Meta een custom
scheme simpelweg niet als return-URL accepteren — daar zou een tussenpagina voor nodig
zijn, wat de fix verdubbelt. Een custom scheme kan er als extra vangnet bij, maar niet
als hoofdweg.

### (b) `appUrlOpen` + router

Eén module, bedraad in `main.tsx`: `App.addListener('appUrlOpen', …)`, pad uit de URL
knippen, via de router navigeren, en de in-app browser sluiten met `Browser.close()`.
Losstaand testbaar met `xcrun simctl openurl` / `adb shell am start`, zonder één
betaalflow aan te raken.

### (c) Return-URL's ombouwen

Eén patroon, twee kanten:

- **Client**: `PUBLIC_SITE_URL` gebruiken in plaats van `window.location.origin`, en de
  origin **expliciet als payload-veld** meesturen — precies wat `TenantAction.tsx:59`
  al doet. Op web blijft de eigen origin gelden, zodat preview- en stagingdomeinen
  blijven werken.
- **Edge**: het patroon van `create-invoice-payment-link:79` overnemen — payload-veld
  ⇒ `Origin`-header ⇒ `PUBLIC_APP_URL` ⇒ `https://sellqo.app`, met een
  `safeOrigin`-achtige validatie die `capacitor://` én `https://localhost` afwijst.
  Dat sluit meteen het gat dat Android nu stil doorlaat (§1b).

### (d) Volgorde, per risico en los testbaar

| # | Sub-batch | Waarom hier |
|---|---|---|
| **0** | `social-oauth-callback` relatieve redirect + de vier stale hosts | Geen native-werk: dit is nú kapot op web. Losstaand, klein, en het opruimen maakt de rest leesbaar. |
| **1** | Deep-link-fundament: AASA + assetlinks + plist + intent-filter + `appUrlOpen` | Alles daarna hangt eraan. Testbaar zonder betaalflows. |
| **2** | **Betalen** — Connect (`create-connect-account`, geen fallback), mandaten, add-ons, credits, quotes | Hoogste bedrijfsrisico. `create-quote-payment-link` eerst: die URL gaat naar een externe koper. |
| **3** | **E-mail-redirects** — `useAuth`, `AccountSettings`, `send-team-invitation` | Artefact leeft buiten de app voort; vergt ook GoTrue-allowlist-werk. |
| **4** | **OAuth** — de zes social-callers, plus popup-polling vervangen door `openExternal` + `appUrlOpen` | Pas zinvol ná batch 0 en 1. |
| **5** | Shopify: herstellen of verwijderen | Nu volledig dood — eerst een besluit, dan pas code. |

---

## Sectie 5 — Risico's en de frozen frontends

**Wat de klant-betaling raakt en wat níet.** `ShopCheckout.tsx:391-393` bouwt
`success_url`/`cancel_url` uit `window.location.origin` en geeft ze mee aan
`storefront-api`. In de native app zou dat breken — **maar de native app is de
admin-app** (`app.sellqo.admin`, "SellQo Admin"). Een klant komt er nooit. Het enige
pad ernaartoe is de eigenaar-preview. Dit is dus geen klantgerichte betaalstoring,
maar een randgeval van die preview.

**De contractgrens.** `success_url` en `cancel_url` zijn onderdeel van het
`storefront-api`-contract, actie `checkout_complete` — gedocumenteerd in
`docs/checkout-api-contract.md:160`. De vijf custom frontends leveren die velden zelf
aan, vanuit hun eigen echte browser-origin.

- ✅ **Mag**: de client-side opbouw in `ShopCheckout.tsx` (SellQo-renderer, niet gedeeld).
- 🔴 **Mag niet**: de sleutels hernoemen, ze verplicht maken waar ze dat nu niet zijn,
  of server-side afdwingen dat ze van een bepaalde host komen — dat breekt de vijf
  custom frontends, want hun `success_url` is per definitie niet `sellqo.app`.
- Concreet: `storefront-api:3064` valideert nu alleen op *aanwezigheid*. Die validatie
  mag additief strenger op **scheme** (`https:` verplichten), maar **nooit** op host.

**Twee doc-correcties**, want de eerste wet steunt erop:

- **`checkout-engine` bestaat niet.** `CLAUDE.md:39` en `:98` en
  `docs/webshop-masterplan.md:13,16` noemen hem als een van de drie gedeelde
  contracten. In `supabase/functions/` staat hij niet — de checkout loopt via
  `storefront-api`. Een van de drie namen waarop §1 leunt, wijst naar niets.
- **`src/native/pushRegistration.ts:122`** beweert dat `@capacitor/app` niet
  geïnstalleerd is; dat klopt sinds fase 2A niet meer.

---

## Wat hier niet vast te stellen is

Of Stripe een `capacitor://`-`return_url` weigert bij aanmaak dan wel pas bij redirect,
en wat GoTrue precies doet met een niet-toegestane `redirect_to` — beide vergen een
echte call tegen de betreffende dienst. En het gedrag op toestel, zoals altijd.

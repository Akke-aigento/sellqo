# Voorstel MAIL-2e — ondertekende herstel-link "open je winkelmandje opnieuw"

Status: **voorstel, read-only recon van 20 okt 2026.** Niets gewijzigd: geen code, geen database, geen commit.
Bronnen: repo `sellqo` (werkkopie 20 okt), repo `sellqo-storefront` (`b52f843`, 17 okt), live-DB via `query_database`.

---

## 1. Huidige situatie

### 1.1 De mail linkt naar de homepage

- `supabase/functions/_shared/automationEngine.ts:241-247` — elke automationmail krijgt vijf variabelen, `cart_url` start leeg.
- `automationEngine.ts:268-297` — bij een run met `trigger_entity_type = 'cart'`: mandje lezen (`storefront_carts`), annuleren als het `converted` is of als er sinds `cart.created_at` een niet-geannuleerde bestelling op dat adres is.
- `automationEngine.ts:292-293` — *"Er bestaat (nog) geen veilige herstel-link voor een winkelwagen: de link gaat naar de winkel."* → `vars.cart_url = tctx.shopUrl`.
- `tctx.shopUrl` komt uit `_shared/mailPages.ts:52-63` (`resolveShopUrl`): website-URL van het merk → canoniek domein → `<slug>.sellqo.shop`.
- `automationEngine.ts:294` — `{{cart_items}}` toont de producten wél al in de mail (max. 10, `cartLines` op `:107`), met productlinks via `_shared/storefrontUrls.ts` (MAIL-2c).
- `_shared/automationVars.ts:9-16` — `cart_url` staat in `AUTOMATION_VAR_KEYS`; geen wijziging aan dit contract nodig.

### 1.2 Waar mandjes staan en hoe de scan ze vindt

- Tabel `public.storefront_carts` (live gecontroleerd): `id uuid`, `tenant_id`, `session_id text NOT NULL`, `customer_id` (live **nooit** gevuld: 0 van 207), `checkout_status` (`shopping` / `checkout` / `converted`), `expires_at` (default `now() + 30 days`), plus alle afrekengegevens: `customer_email`, naam, telefoon, `shipping_address`, `billing_address`, btw-velden, `customer_note`.
- Regels in `public.storefront_cart_items` (`product_id`, `variant_id`, `event_detail_id`, `quantity`, `unit_price`, `addons`, `addons_total`).
- Geen token of geheime sleutel op het mandje. **Het `cart_id` zelf is de sleutel**: elke storefront-api-actie neemt `cart_id` + `tenant_id` aan zonder verdere controle.
- Unieke index `idx_storefront_carts_session_active (tenant_id, session_id) WHERE checkout_status = 'shopping'`.
- RLS: enkel service_role, tenant-gebruikers (lezen) en platformadmins. Anon kan niets rechtstreeks.
- Scan: `supabase/migrations/20261019230000_mail_2a_automations.sql:605-703` (`automation_scan_triggers`). Mandjes op `checkout_status = 'checkout'` met een e-mailadres, `updated_at` tussen (vertraging + 48 u) en (vertraging) geleden, niet verlopen, geen bestelling sinds ontstaan, nog geen run. Een mandje komt dus pas in aanmerking **nadat de klant zijn e-mail in de checkout gaf** (`checkoutStart` zet `checkout_status: 'checkout'`, `storefront-api/index.ts:3542-3563`).
- **Let op:** live bestaat `automation_scan_triggers` nog niet (en `schedule_automation_run_v2` ook niet), terwijl `email_automations` en `automation_runs` wel bestaan. De MAIL-2a-migratie is dus nog niet (volledig) live gedraaid. Dit voorstel bouwt erop voort en kan pas na MAIL-2a live.
- Live volume (20 okt): 57 mandjes op `checkout` met e-mail, 64 regels: 24 met variant, 15 met `event_detail_id` (tickets), 0 met extra's.

### 1.3 Hoe de storefronts een mandje laden

`storefront-api/index.ts:5458-5467` — mandje-acties: `cart_create`, `cart_get`, `cart_add_item`, `cart_update_item`, `cart_remove_item`, `cart_set_seats`, `cart_apply_discount`, `cart_remove_discount`; daarna de `checkout_*`-acties (`:5469-5496`).

- `cartCreate` (`:2460-2501`): verplicht `session_id` (door de client gekozen), idempotent per (tenant, session) zolang `shopping`; geeft `{ cart_id }`.
- `cartGet` (`:2503-2562`): op `cart_id` **of** `session_id`, enkel `tenant_id` + `expires_at > now()` als filter — **niet** op `checkout_status`. Geeft regels + totalen, geen klantgegevens.
- `buildCartResponse` (`:3015`, klantblok `:3180-3195`): wat de `checkout_*`-acties teruggeven, bevat **e-mail, naam, telefoon, btw-gegevens, verzend- en factuuradres**. Wie een `cart_id` kent, kan via `checkout_start` dus de persoonsgegevens van die klant lezen.

**SellQo-storefront** (`sellqo-storefront/src/lib/cart.ts`): het `cart_id` zit in een httpOnly-cookie `sq_cart` per winkel-host, 30 dagen (`:7-9`). `currentCart` (`:61-68`) doet `cart_get` op dat id en wist de cookie bij `null`. Bij de eerste toevoeging: `cart_create` met `session_id: crypto.randomUUID()` (`:89`, `:128`). Routes: `src/routes/winkelmandje.tsx` (`/winkelmandje`, niet `/winkelwagen`) en `afrekenen.tsx`. Teksten zijn hardcoded Nederlands (geen i18n in deze repo).

**Custom frontends** — live gecontroleerd via `tenant_theme_settings.use_custom_frontend`: **Astra Sleep, Benny Rich, Loveke, Mancini Milano, VanXcel, Zona Dorata** (zes, klopt met CLAUDE.md §1). Volgens het runbook (`.agents/skills/sellqo-custom-frontend-runbook/SKILL.md`, patroon 1) bewaren ze het `cart_id` in **localStorage**: architectuur A (`src/integrations/sellqo/hooks.ts`, Loveke/VanXcel: `getStoredCartId`/`storeCartId`), architectuur B (`src/lib/storefrontApi.ts` + cart-context, Astra), en een TanStack server-function-variant. Ze roepen dezelfde `cart_*`- en `checkout_*`-acties aan. De code van de zes is in deze recon niet opnieuw per project gelezen; voor dit voorstel is dat niet nodig, want zij krijgen niets nieuws (zie §3).

### 1.4 Prijzen en voorraad in een bestaand mandje

- `cartGet` en `getCartForCheckout`: bij een variant geldt de **actuele** variantprijs, zonder variant de **opgeslagen** `unit_price` van het moment van toevoegen (`:2535`, `:2984`). Een oud mandje kan dus een verouderde prijs dragen. Dat is bestaand gedrag, los van dit voorstel.
- Voorraad: `in_stock` wordt bij elke `cart_get` vers berekend; `checkoutStart` weigert met `OUT_OF_STOCK` (`:3547-3552`).
- `cartAddItem` (`:2564-2770`) controleert actief, op-voor-vandaag, kanaal, variant, eventdatum, voorraad en extra's, en zet `unit_price` op de huidige prijs.

---

## 2. Voorstel

### 2.1 Kernidee: een **nieuw** mandje met enkel de producten, nooit het oude `cart_id`

Het oude `cart_id` naar buiten geven is geen optie: het is de sleutel tot de checkout-gegevens (§1.3). Een doorgestuurde of gelekte mail zou dan adres, telefoon en btw-nummer van de klant prijsgeven. Daarom:

1. De mail krijgt een link met een **ondertekend token dat naar de automation-run verwijst**, niet naar het mandje.
2. Bij openen maakt `storefront-api` een **nieuw mandje** (`checkout_status = 'shopping'`) en kopieert er de regels in via dezelfde validaties als `cart_add_item`. Klantgegevens, adressen, kortingscodes en verzendkeuze gaan **niet** mee.
3. Het oude mandje blijft ongemoeid. De engine annuleert de vervolgstap al op "intussen besteld op dat adres" (`automationEngine.ts:280-291`), dus een bestelling via het nieuwe mandje stopt de reeks gewoon.

### 2.2 Token — `_shared/cartRestoreToken.ts` (nieuw)

- Inhoud: `v1.<run_id>.<exp>.<sig>`; `sig` = HMAC-SHA256 over `cart-restore:v1:<tenant_id>:<run_id>:<exp>`, base64url, 32 tekens. Zelfde opbouw en constante-tijd-vergelijking als `_shared/marketingToken.ts:40-64`, maar met een **eigen context-prefix** zodat een uitschrijf-handtekening nooit als herstel-token geldt. Sleutel: `MARKETING_LINK_SECRET`, anders afgeleid van de service-role key (zelfde kanttekening bij rotatie als in `marketingToken.ts:10-13`).
- `run_id` (`automation_runs.id`) is via geen enkele publieke actie bruikbaar; anon heeft geen RLS-toegang tot `automation_runs`. Het token lekt dus niets bruikbaars.
- `exp` = min(verzending + 7 dagen, `cart.expires_at`).

### 2.3 Nieuwe actie `cart_restore` in `storefront-api` (strikt additief)

Eén `case 'cart_restore'` in de switch (`index.ts:~5463`) plus een functie `cartRestore`. Invoer `{ tenant_id, token }`. Stappen:

1. Token verifiëren (vorm, `exp > now`, handtekening). Fout → `{ success:false, error:{ code:'RESTORE_INVALID' } }` (verlopen: `RESTORE_EXPIRED`). Nooit uitleggen wat er precies mis was.
2. Run lezen: `tenant_id` moet gelijk zijn, `trigger_entity_type = 'cart'`. Oud mandje lezen: bestaat, zelfde tenant, niet verlopen.
3. Oud mandje `converted`, of intussen besteld op dat adres (zelfde query als de engine) → `RESTORE_ORDERED`: "je bestelling is al binnen".
4. Nieuw mandje met **deterministische** `session_id = 'restore:' || run_id` via de bestaande `cartCreate`. Door de unieke index op (tenant, session) zolang `shopping` geeft elke volgende klik **hetzelfde** herstelde mandje terug. Is het al gevuld, dan niet opnieuw kopiëren.
5. Per oude regel: `cartAddItem`-logica hergebruiken (product, variant, hoeveelheid). Faalt een regel (inactief, uitverkocht, kanaal, variant weg, eventdatum voorbij), dan overslaan en noteren.
6. Antwoord: `{ cart_id, restored: n, skipped: [{ name, reason }] }`. Geen e-mail, geen adres, geen oud `cart_id`.
7. IP-rate-limit zoals `newsletter_subscribe` (`index.ts:5401-5410`), bv. 20 per 10 min per tenant+IP.

**Prijzen:** het nieuwe mandje krijgt automatisch de **huidige** prijs (zoals elke `cart_add_item`). Gaat een prijs omhoog of omlaag, dan ziet de klant de juiste prijs; de mail toonde geen prijzen (`buildCartItemsHtml`), dus er is geen belofte die niet klopt. Geen kortingscode meenemen: die was nooit beloofd en kan intussen ongeldig zijn.

**Uitverkocht:** regel wordt niet toegevoegd, de storefront meldt "X is niet meer beschikbaar". Alles uitverkocht → leeg resultaat, storefront toont een korte melding en "Verder winkelen".

**Tickets (`event_detail_id`, 15 live regels):** gewone tickets kopiëren mét `event_detail_id` (de validatie in `cartAddItem` weigert verlopen data). Tickets met stoelkeuze (`cart_set_seats`) worden **niet** hersteld: de stoelen zijn vrijgegeven en een stille nieuwe keuze is fout. Zie beslispunt 3.

**Extra's (`addons`):** live 0 regels. `cartAddItem` verwacht keuze-id's, het mandje bewaart enkel `{group,name,price}`. V1: zulke regels overslaan met reden. Zie beslispunt 3.

### 2.4 Engine — `automationEngine.ts:292-293`

```ts
const sf = await storefrontFor(db, tctx, run.tenant_id);
const base = sellqoStorefrontBaseUrl(sf);           // null bij custom frontend
vars.cart_url = base
  ? `${base}/winkelmandje/herstel?t=${await signCartRestore(run.tenant_id, run.id, exp)}`
  : (tctx.shopUrl || "");                             // ongewijzigd voor de zes
```

`sellqoStorefrontBaseUrl` (`storefrontUrls.ts:66-74`) geeft al `null` bij `use_custom_frontend = true` en bij een winkel die niet online staat. De zes custom frontends houden dus exact de huidige homepage-link. `vars.cart_items` blijft ongewijzigd.

### 2.5 SellQo-storefront — route `/winkelmandje/herstel`

- Nieuw bestand `src/routes/winkelmandje_.herstel.tsx` (de underscore houdt hem **buiten** de layout van `winkelmandje.tsx`; anders wordt het een geneste child-route die nooit rendert zonder `<Outlet/>`).
- Server function `restoreCart({ token })` in `src/lib/cart.ts`: `api('cart_restore', tenantId, { token })`. Bij succes `setCookie(CART_COOKIE, cart_id, cookieOpts)` en redirect naar `/winkelmandje`, met de overgeslagen regels als korte melding. Bij `RESTORE_ORDERED` / `_EXPIRED` / `_INVALID`: een vriendelijke pagina met "Verder winkelen". `noindex` zoals `winkelmandje.tsx:11-14`.
- Had de bezoeker al een eigen mandje in de cookie: dat vervangen we **niet** stil. V1: is het huidige mandje leeg of hetzelfde → vervangen; heeft het producten → keuze "Gebruik je bewaarde mandje" / "Hou je huidige mandje". Zie beslispunt 4.
- Link-scanners (Outlook Safe Links, Gmail-prefetch) openen links vooraf. Daarom is de actie **idempotent** (stap 4) en niet "eenmalig": een scanner mag niets opgebruiken of een tweede mandje aanmaken. Het enige effect van een scanner is dat het herstelde mandje al bestaat.

### 2.6 Opt-in voor custom frontends (later, apart)

Wil een custom frontend dit ooit, dan additief: `tenants.cart_restore_url_template text` (bv. `https://loveke.be/cart/restore?t={token}`), naar het model van `tenants.product_url_template` (`storefrontUrls.ts:4-6`, migratie `20261012190000`). De engine gebruikt het template enkel als het gezet is; leeg = homepage zoals nu. De frontend roept dan zelf `cart_restore` aan en bewaart het `cart_id` in zijn localStorage. **Niet in deze batch.**

### 2.7 Wat er concreet verandert

| Bestand | Wijziging | Omvang |
|---|---|---|
| `supabase/functions/_shared/cartRestoreToken.ts` | nieuw: sign/verify + test | ~70 + ~60 regels |
| `supabase/functions/storefront-api/index.ts` | `case 'cart_restore'` + `cartRestore` + rate-limit | ~110 regels, additief |
| `supabase/functions/_shared/automationEngine.ts` | `cart_url` bij SellQo-theme | ~15 regels |
| `sellqo-storefront/src/lib/cart.ts` | `restoreCart` server function | ~40 regels |
| `sellqo-storefront/src/routes/winkelmandje_.herstel.tsx` | nieuwe route + melding/keuze | ~90 regels |
| Database | **geen migratie** | — |
| Slottaken | role-audit, changelog alle talen uit `SUPPORTED_LANGUAGES`, `doc_articles` (context `/admin/marketing/automations` of de bestaande MAIL-2a-route), newsletter-queue | standaard |

---

## 3. Eerste wet

- **Contracten:** `storefront-resolve` en `storefront-customer-api` niet aangeraakt. `storefront-api` krijgt één **nieuwe** actie; geen enkele bestaande actie, parameter of antwoordsleutel wijzigt. `cartCreate` en de `cartAddItem`-logica worden hergebruikt, niet aangepast (eventueel de kern van `cartAddItem` in een interne helper trekken zonder gedragswijziging; dan regressietest op `cart_add_item`). Dit valt onder "edge-functie raken" en vraagt dus jouw aparte akkoord (CLAUDE.md §1, vierde bullet).
- **Gedeelde tabellen:** geen wijziging aan `tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`. Geen migratie. `storefront_carts` krijgt enkel extra rijen via het bestaande insert-pad (`session_id` met prefix `restore:`); geen frontend leest `session_id` met een vorm-aanname (alle zes en de SellQo-winkel kiezen hun eigen willekeurige waarde).
- **De zes mails:** `sellqoStorefrontBaseUrl` geeft `null` bij `use_custom_frontend = true` → `cart_url` blijft byte-gelijk `tctx.shopUrl`. Te bewijzen in post-flight met een unit-test op de engine-tak plus een SQL-natrek op `campaign_sends.variables->>'cart_url'` per tenant.
- **Admin-mandjesoverzicht:** herstelde mandjes zijn gewone `shopping`-mandjes; ze komen niet in de scan (die kijkt enkel naar `checkout`). Wordt het herstelde mandje later verlaten in de checkout, dan kan het **een eigen** herinnering krijgen (nieuw `cart_id`, nieuwe run). Zie beslispunt 5.
- **Testbedden:** SellQo Speeltuin en Demo Bakkerij: mail van de automation openen, link volgen, mandje zien, afrekenen. Plus een custom-frontend-tenant controleren op een ongewijzigde `cart_url`.

---

## 4. Risico's

| Risico | Kans | Impact | Maatregel |
|---|---|---|---|
| Doorgestuurde mail geeft toegang tot persoonsgegevens | — | hoog | Uitgesloten door ontwerp: nieuw mandje, geen oud `cart_id`, geen klantvelden (§2.1) |
| Link-scanner "verbruikt" de link of maakt dubbele mandjes | hoog | laag | Idempotent via deterministische `session_id` + unieke index (§2.5) |
| Prijs veranderd sinds de mail | middel | laag | Nieuw mandje krijgt huidige prijs; mail toonde geen prijzen |
| Uitverkocht / product offline | middel | laag | Regel overslaan, melding met reden |
| Zaalplantickets of extra's niet hersteld | laag (live 0 extra's) | laag | Overslaan met reden; beslispunt 3 |
| Bestaand mandje van de bezoeker overschreven | middel | middel | Keuzescherm bij niet-leeg eigen mandje (beslispunt 4) |
| Sleutelrotatie maakt oude links ongeldig | laag | laag | Zelfde als MAIL-1a: `MARKETING_LINK_SECRET` zetten; ongeldige link = nette pagina |
| Regressie in `cart_add_item` door het hergebruik | laag | hoog | Geen gedragswijziging; zo nodig enkel extract-to-helper met test |
| MAIL-2a nog niet live (scanfunctie ontbreekt) | zeker | — | Dit voorstel pas na de live-gang van MAIL-2a |

**Omvang:** klein tot middel, ~1 dag werk incl. tests en slottaken, zonder migratie. **Risico:** laag. De enige gedeelde laag is één nieuwe actie in `storefront-api`, die geen bestaand pad wijzigt.

---

## 5. Beslispunten voor Akke

1. **Nieuw mandje (kopie) of het oude mandje heropenen?**
   *Aanbeveling: kopie.* Heropenen vraagt het oude `cart_id` in de cookie, en dat geeft via `checkout_start` adres, telefoon en btw-gegevens vrij aan wie de link heeft. Een kopie is iets minder comfortabel (adres opnieuw invullen), maar privacy gaat voor.

2. **Geldigheid en eenmalig gebruik.**
   *Aanbeveling:* 7 dagen (en nooit langer dan het mandje zelf), **niet eenmalig** maar idempotent. Eenmalig breekt door link-scanners en door klanten die twee keer klikken. Een herhaalde klik geeft hetzelfde herstelde mandje terug.

3. **Tickets met stoelkeuze en producten met extra's.**
   *Aanbeveling:* in v1 overslaan met een duidelijke reden ("kies je plaatsen opnieuw"). Gewone tickets wel kopiëren. Live zijn er nu 0 regels met extra's; herzien als er een horeca-winkel met verlaten mandjes bijkomt.

4. **Bezoeker heeft al een ander, gevuld mandje.**
   *Aanbeveling:* keuzescherm, geen stille vervanging en geen samenvoeging. Samenvoegen geeft dubbele regels en vragen over hoeveelheden.

5. **Mag een hersteld mandje opnieuw een herinnering krijgen?**
   *Aanbeveling:* nee. In de scan mandjes met `session_id like 'restore:%'` uitsluiten (één regel in de scanfunctie, mee te nemen in een MAIL-2a-vervolgmigratie). Anders krijgt een klant een tweede reeks voor hetzelfde mandje. Alternatief: de cooldown per ontvanger laten beslissen.

6. **Custom frontends.**
   *Aanbeveling:* nu niets, ze houden de homepage-link. De opt-in via `tenants.cart_restore_url_template` (§2.6) pas bouwen als een van de zes erom vraagt. Wie het eerst wil (Loveke of VanXcel, architectuur A) is dan een aparte batch in dat Lovable-project.

7. **Akkoord om `storefront-api` aan te raken** (CLAUDE.md §1: enkel na apart akkoord).
   *Aanbeveling:* ja. Eén nieuwe actie, geen bestaande actie gewijzigd, veilig voor alle tenants (§3).

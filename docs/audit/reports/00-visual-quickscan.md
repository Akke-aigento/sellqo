# Run 0 — Visuele quick-scan (laag 2)

**Pinned SHA:** `037819858ac875cba2a4c6c95e14d0d238546b59` · **Datum:** 2026-09-02 · **Runbook:** v2 §3/§5
**Dekking:** 124 unieke URL's × 3 viewports (375×812 / 768×1024 / 1440×900) = **372 scans**, 0 timeouts, 0 overgeslagen routes.
**Mail:** 4 talen × 108 tenant-strings + 6 auth-templates gerenderd naar `docs/audit/mail-renders/`. **Niets verzonden.**

## Verdict-samenvatting

🔴 **4** · 🟡 **7** · 🟢 **9**

---

## Hoe deze run gedraaid is (en wat dat beperkt)

Tegen een lokale `vite preview` op `dist/` van de gepinde SHA. Conform de kickoff-regel *"geen netwerk-calls naar productie-domeinen"* is **elke** niet-localhost request in Playwright onderschept:

| Bestemming | Behandeling | Waarom |
|---|---|---|
| `…supabase.co/rest/v1/*` | `200` met body `[]` | Simuleert lege data — precies wat runbook §3 wil weten: crasht de pagina daarop? |
| `…supabase.co/auth/v1/*` | `200` met `{}` | Geen sessie |
| `…supabase.co/functions/v1/*` | `200` met `{}` | Geen edge-function-verkeer |
| `fonts.googleapis.com`, `js.stripe.com` | geblokkeerd | Externe hosts |

**Nul requests hebben productie bereikt.** Dat kost wel scherpte, en dat moet je bij het lezen meenemen:

1. **Alle 124 routes tonen console-errors `net::ERR_BLOCKED_BY_CLIENT`.** Dat is mijn eigen blokkade, **geen defect**. Ze zijn uit de tellingen gefilterd; er bleven 0 echte console-errors over.
2. **Geen sessie ⇒ elke `/admin/*`- en `platform/*`-route valt terug op `ProtectedRoute`.** Wat daarachter zit is in deze run niet visueel getest → 🟡 M-1.
3. **Een gestubde `.single()` gedraagt zich niet als PostgREST.** Zie 🔴 V-1: de crash is echt, de trigger in productie is dat pas onder één voorwaarde.

Screenshots: `docs/audit/screenshots/<route-slug>/{mobile,tablet,desktop}.jpg` — JPEG q70 in plaats van de PNG uit runbook §3, om 372 bestanden op 16 MB te houden in plaats van ruwweg het tienvoudige. Alle meetwaarden (overflow, i18n-paden) komen uit DOM-metingen, niet uit de beelden, dus de compressie kost geen informatie.

---

## 🔴 Bevindingen

### 🔴 V-1 — Alle 7 juridische pagina's crashen naar een wit scherm op contentloze data
- **Wat:** `/terms`, `/privacy`, `/cookies`, `/sla`, `/acceptable-use`, `/dpa` en `/account-deletion` renderen **0 tekens** op alle drie viewports, met `TypeError: Cannot read properties of undefined (reading 'replace')`. Geen error boundary vangt het op — de bezoeker ziet een leeg wit scherm.
- **Waar:** `src/pages/SellqoLegal.tsx:84` — `page.content.replace(...)`, begin van een keten van 10 `.replace()`-aanroepen (regels 84-94).
- **Root cause:** de guard op regel 35 is `if (error || !page)`. Die dekt een *ontbrekende* pagina, maar niet een pagina die wél bestaat met een lege `content`. Elke waarde die truthy is maar geen `content` heeft, glipt door de guard heen en klapt op regel 84.
- **Eerlijk over de trigger:** in deze run was de truthy-lege waarde mijn gestubde `[]`. In productie draait `usePublicLegalPage` (`src/hooks/useSellqoLegal.ts:147`) een echte `.single()`, die bij 0 rijen een error gooit → dan vángt de guard het wél. **De crash in productie vereist dus een gepubliceerde rij met lege `content`.** Of dat kan, hangt op de nullability van de kolom → natrek 🟡 D-1.
- **Fixrichting:** guard verbreden naar `if (error || !page?.content)`. **Platform:** CC. **Frozen-path-risico:** nee.

### 🔴 V-2 — Auth-mails: Engelse onderwerpregel op een Nederlandse body
- **Wat:** alle zes auth-mails gaan buiten met een Engels subject en een volledig Nederlandse inhoud, inclusief `<html lang="nl">`. Gerenderd bewijs in `docs/audit/mail-renders/auth-*.html`:

| Template | Subject (`auth-email-hook/index.ts:19-26`) | `html lang` | Body begint met |
|---|---|---|---|
| signup | "Confirm your email" | `nl` | "Welkom bij … Bedankt voor je registratie" |
| invite | "You've been invited" | `nl` | "Je bent uitgenodigd …" |
| magiclink | "Your login link" | `nl` | "Inloggen bij … Klik op de knop hieronder" |
| recovery | "Reset your password" | `nl` | "Wachtwoord opnieuw instellen …" |
| email_change | "Confirm your new email" | `nl` | "Bevestig je e-mailadres …" |
| reauthentication | "Your verification code" | `nl` | "Bevestigingscode …" |

- **Waar:** `supabase/functions/auth-email-hook/index.ts:19-26` (`EMAIL_SUBJECTS`) tegenover `supabase/functions/_shared/email-templates/*.tsx`.
- **Root cause:** `EMAIL_SUBJECTS` is een losse, Engelstalige map naast de templates; er is geen enkele i18n-koppeling. De auth-mails kennen überhaupt geen taalkeuze — de body is hardcoded NL voor iedere ontvanger, ongeacht taal.
- **Fixrichting:** subject uit dezelfde bron halen als de body, en die bron meertalig maken. **Platform:** CC (+ deploy). **Frozen-path-risico:** nee.

### 🔴 V-3 — Duitstalige klanten krijgen nooit een Duitse retourmail
- **Wat:** `send-return-email` kent `type Locale = 'nl' | 'en' | 'fr'` (regel 17) — geen `de`. `resolveLocale` (regels 42-58) laat `de` op elke tak vallen en eindigt op de fallback `return 'nl'`. Een Duitse klant krijgt dus een **Nederlandse** retourmail.
- **Waar:** `supabase/functions/send-return-email/index.ts:17`, `42-58`, `84-131`.
- **Root cause:** deze functie houdt een **eigen** vertaaltabel aan (`subjects`, regel 84; `bodies`, regel ~131) in 3 talen, terwijl de gedeelde `_shared/tenantEmailI18n.ts` de `return.*`-keys in **4** talen definieert — inclusief volledig Duits. Dezelfde functie gebruikt op regels 245/247 wél `t(locale, 'return.heading')` uit die gedeelde tabel. Twee vertaalbronnen voor één mailfamilie, en de smallere wint.
- **Bijkomend:** `return.subject` bestaat in alle vier de talen in `tenantEmailI18n.ts` maar wordt **nergens** aangeroepen — dood, precies omdat de lokale map het overneemt. Regel 243 (`locale: locale as any`) maskeert het typeverschil.
- **Geen crash:** `resolveLocale` clampt op elke tak, dus `subjects[event][locale]` is nooit `undefined`. Dat vermoeden is expliciet getoetst en ontkracht.
- **Fixrichting:** de lokale `subjects`/`bodies`-maps vervangen door de bestaande 4-talige keys in `tenantEmailI18n.ts`. **Platform:** CC (+ deploy). **Frozen-path-risico:** nee.

### 🔴 V-4 — `/account-deletion` kan niet bestaan
- **Wat:** de route `/account-deletion` (`App.tsx:358`) rendert `SellqoLegal`, dat z'n inhoud uit `sellqo_legal_pages` haalt op slug. Maar `LEGAL_PAGE_TYPES` (`src/hooks/useSellqoLegal.ts:18-25`) telt **zes** types en `account-deletion` zit er niet bij. De platform-editor `PlatformLegal.tsx:129` itereert precies over die zes — een platform-admin kan de pagina dus niet aanmaken, vullen of publiceren.
- **Waar:** `src/App.tsx:358`, `src/hooks/useSellqoLegal.ts:18-25`, `src/pages/platform/PlatformLegal.tsx:129`.
- **Root cause:** route toegevoegd zonder het bijbehorende type in de constante; zeven routes tegenover zes beheerbare types.
- **Gevolg:** de pagina toont permanent "Pagina niet gevonden" — of het witte scherm uit V-1. Voor een account-verwijderpagina is dat ook een compliance-punt.
- **Let op:** er bestaan **twee** verschillende `LEGAL_PAGE_TYPES`. Die in `src/types/legal-pages.ts:55` is voor de tenant-storefront en staat hier los van.
- **Fixrichting:** `account-deletion` toevoegen aan `LEGAL_PAGE_TYPES` in `useSellqoLegal.ts` en de rij seeden. **Platform:** CC + migratie. **Frozen-path-risico:** nee.

---

## 🟡 Natrek voor laag 3 (chat-Claude via de Lovable-connector)

### 🟡 D-1 — Kan `sellqo_legal_pages.content` leeg zijn op een gepubliceerde rij? (hoort bij 🔴 V-1)
Bepaalt of V-1 in productie afvuurbaar is of alleen een latente bug.
```sql
SELECT column_name, is_nullable, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sellqo_legal_pages'
  AND column_name IN ('content','slug','is_published','title');

SELECT slug, is_published, (content IS NULL) AS content_null,
       COALESCE(length(content),0) AS content_len
FROM public.sellqo_legal_pages ORDER BY slug;
```
**Verwacht bij "veilig":** `is_nullable = 'NO'` én elke gepubliceerde rij `content_len > 0`.

### 🟡 D-2 — Bestaan alle zeven juridische slugs? (hoort bij 🔴 V-4)
```sql
SELECT s.slug, (p.id IS NOT NULL) AS bestaat, p.is_published, COALESCE(length(p.content),0) AS content_len
FROM unnest(ARRAY['terms','privacy','cookies','sla','acceptable-use','dpa','account-deletion']) AS s(slug)
LEFT JOIN public.sellqo_legal_pages p ON p.slug = s.slug
ORDER BY s.slug;
```
**Verwachting:** `account-deletion` ontbreekt of is ongepubliceerd.

### 🟡 D-3 — Wie mag `sellqo_legal_pages` schrijven? (XSS-oppervlak)
`SellqoLegal.tsx:83` zet `page.content` via `dangerouslySetInnerHTML` op de pagina, door een handgeschreven markdown-vervanger **zonder sanitisatie**. Wie die kolom kan schrijven, kan script injecteren op een publieke SellQo-pagina.
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy WHERE polrelid = 'public.sellqo_legal_pages'::regclass;

SELECT relrowsecurity, relforcerowsecurity FROM pg_class
WHERE oid = 'public.sellqo_legal_pages'::regclass;
```
**Verwacht bij "veilig":** RLS aan, en `INSERT`/`UPDATE` uitsluitend voor platform-admin.

### 🟡 D-4 — Storefront rendert 0 tekens op een onbekende tenant-slug
Alle 10 `/shop/*`-routes gaven 0 tekens op alle viewports — geen crash, maar ook geen "winkel niet gevonden". Onder een gestubde lege REST-laag is dat verwacht; of het ook zo oogt bij een échte tenant vraagt een run tegen een bestaande slug.
```sql
SELECT slug, name, is_demo, use_custom_frontend
FROM public.tenants WHERE id::text LIKE 'bc18b2e3%' OR is_demo = true;
```
Met de echte slug van SellQo Speeltuin herhaal ik de scan in batch 1.

### 🟡 D-5 — Zijn de 26 ongeguarde admin-routes intern afgeschermd?
26 routes onder `/admin` hebben geen `RouteGuard` terwijl directe buren die wel hebben — alle negen `promotions/*`-subpagina's, alle vier `orders/quotes*`, plus `categories`, `shipping` en `orders/subscriptions`. Ze zitten wél achter `ProtectedRoute` (inloggen vereist), maar zonder permissiecontrole. Volledige lijst: `reports/route-inventory.md`.
Statisch per pagina uit te zoeken in batch 3/4/6; wat de rol-matrix daarover zegt is een 🟡:
```sql
SELECT role, resource, can_read, can_write FROM public.role_permissions
WHERE resource IN ('discount_codes','orders','invoices','products','shipping')
ORDER BY resource, role;
```

### 🟡 D-6 — Zijn de edge functions achter de mail-bevindingen live gedeployed?
V-2 en V-3 gelden voor de repo-versie. Runbook §9: Lovable synct edge functions niet automatisch. Neveneffectvrije vingerafdruk nodig voor `auth-email-hook` en `send-return-email` vóór een fix wordt gepland.

### 🟡 M-1 — Handmatige spotcheck: alles achter de login
Geen sessie in de sandbox, dus 101 van de 124 routes zijn niet visueel gezien. Verzoek aan Akke: één ingelogde ronde over `/admin` (dashboard), `/admin/orders`, `/admin/products`, `/admin/settings` en `/admin/platform` op 375 px en 1440 px, met de console open. Meer is niet nodig — de rest komt per batch.

---

## 🟢 Geverifieerd correct

1. **0 horizontale overflow** over alle 372 scans. Op geen enkele route/viewport is `scrollWidth > clientWidth`.
2. **0 rauwe i18n-paden** in de zichtbare DOM, getoetst tegen alle 43 namespaces uit `nl.json` + `landing.nl.json`.
3. **0 echte console-errors** na aftrek van mijn eigen `ERR_BLOCKED_BY_CLIENT`-blokkades.
4. **0 lokale 4xx/5xx, 0 mislukte requests, 0 timeouts.** De SPA-fallback bedient alle 124 URL's met `200`.
5. **i18n-pariteit app:** 5165/5165 keys in alle 5 talen (de/en/fr/nl/uk), `scripts/i18n-parity.mjs` exit 0. Geen enkele failure om naar een pagina te mappen.
6. **i18n-pariteit e-mail:** 108 keys × 4 talen in `tenantEmailI18n.ts`, volledige pariteit. Runbook §2E vraagt hier expliciet om een handmatige grep omdat dit buiten `tsc` en `i18n-parity` valt — gedaan, en schoon.
7. **Mail-render-validatie:** 4 talen × 108 strings door de echte `renderTenantEmail`-layout. **Geen rauw key-pad, geen niet-vervangen `{placeholder}`.** Dat is belangrijk, want `t()` valt bij een missende key terug op het key-pad zelf (`tenantEmailI18n.ts:637`) — de klant zou dan `order.confirmation.heading` in z'n mailbox krijgen.
8. **`reminderLevel` is netjes begrensd.** De dynamische keys `invoice.{mandate,reminder}{Subject,Intro}${n}` en `paymentRequest.reminder*${n}` leken een gat, maar `send-invoice-email:63` en `send-payment-request-email:47` clampen allebei naar `1|2|3|null`. Vermoeden getoetst en ontkracht.
9. **`/admin/orders/creditnotes` → `/admin/orders/invoices?tab=creditnotes` werkt.** `Invoices.tsx:51` leest `?tab=` uit en kent `creditnotes` als waarde. De `?tab=`-valkuil uit CLAUDE.md §6 geldt specifiek voor `Settings.tsx`, niet generiek — apart nagetrokken.
10. **Toolchain-baseline groen:** `npm ci`, `npm run build`, `npx tsc --noEmit -p tsconfig.app.json` (**0 fouten**) en `i18n-parity` (exit 0). Latere bevindingen hoeven niet tegen bestaande ruis weggestreept te worden.

---

## Dood gewicht (as F)

**`supabase/functions/_shared/email-templates/index.ts` wordt door niemand geïmporteerd.** 6 KB aan een tweede, string-gebaseerde auth-mailrenderer bovenop `renderSellqoEmail`. De header van het bestand claimt zelf de bron te zijn — *"(geen .tsx) — geen React Email, consistent met de bestaande SellQo email-stack"* — maar `auth-email-hook/index.ts:6-11` importeert de `.tsx`-templates en rendert met `renderAsync`.

Runbook §2F waarschuwt om zoiets niet blind als cruft te schrappen. Dus als vraag, niet als conclusie: **was `index.ts` de bedoelde vervanger die nooit is aangesloten?** Als dat zo is, lost hij V-2 mogelijk deels op. Beslissing bij Akke; niet aanraken tot dan.

**Kleiner:** `auth-email-hook/index.ts:39` zet `SITE_NAME = "sellqo"` in kleine letters. Dat komt zo in elke auth-mail terecht ("Welkom bij sellqo"). Het merk is *SellQo*.

---

## Per batch-gebied

| Batch | Routes gescand | 🔴 | 🟡 | Opvallend |
|---|---|---|---|---|
| 1 — Storefront | 10 | — | D-4 | 0 tekens op onbekende slug; herhalen met echte tenant |
| 2 — Betaal & onboarding | 6 | — | — | Schoon; alle tokenpagina's renderen zonder crash |
| 3 — Orders & facturatie | 8 | — | D-5 | `orders/quotes*` (4×) zonder `RouteGuard` |
| 4 — Producten & voorraad | 14 | — | D-5 | `categories`, `shipping` zonder `RouteGuard` |
| 5 — Klanten & POS | 9 | — | D-5 | `badges`, `pos/:terminalId` zonder `RouteGuard` |
| 6 — Marketing & promoties | 23 | — | D-5 | alle 9 `promotions/*`-subpagina's zonder `RouteGuard` |
| 7 — Overig & instellingen | 12 | — | M-1 | niets zichtbaar zonder sessie |
| 8 — Platform-admin | 13 | — | M-1 | idem; `tenants/:tenantId` blijft overgeslagen (§7) |
| 9 — Publieke site | 22 | V-1, V-4 | D-1, D-2, D-3 | **alle 7 legal-routes wit** |
| 10 — Auth | 3 | — | — | `/auth`, `/reset-password`, `/no-access` renderen schoon |
| — Buiten batch | 5 | — | E-1 | `payments`, `orders/subscriptions` — zie AUDIT_STATE |
| E-mail (§3) | 6 + 108×4 | V-2, V-3 | D-6 | |

---

## De vijf ergste

1. **🔴 V-1** — alle zeven juridische pagina's kunnen naar een wit scherm klappen. Publiek, en juridisch de slechtst denkbare plek. Trigger hangt op D-1.
2. **🔴 V-4** — `/account-deletion` is onbeheerbaar en dus permanent stuk. Account-verwijdering is een compliance-verplichting.
3. **🔴 V-2** — élke auth-mail: Engels onderwerp, Nederlandse body, geen taalkeuze. Dit is de eerste mail die een nieuwe klant ooit ziet.
4. **🔴 V-3** — Duitse klanten krijgen Nederlandse retourmails, terwijl de Duitse vertalingen al bestaan en ongebruikt liggen.
5. **🟡 D-3** — ongesanitiseerde `dangerouslySetInnerHTML` op DB-content, op een publieke pagina. Ernst hangt volledig op de RLS-uitkomst.

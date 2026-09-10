# Audit — dode UI, nepdata en onaf-gebakken features

**Datum:** 10 september 2026
**Status:** recon-only. Geen code gewijzigd, geen commits. Dit document is de enige output.
**Scope:** `src/` (1.057 bestanden, ~242.000 regels). De Capacitor-shell draait dezelfde
`src/` als de web-app, dus een dode knop is standaard *beide* tenzij hij achter een
`isNativePlatform()`-tak of een `md:hidden`-nav zit.

**Bakken** (eerste gok, ter bespreking — niet besloten):

| Bak | Betekenis |
|---|---|
| **A** | Verbergen — affordance weg tot hij echt bestaat |
| **B** | Bekabelen — de achterkant bestaat al, alleen niet aangesloten |
| **C** | Bouwen — er is nog niets, echt werk |
| **D** | Nepdata → echt — vervang verzonnen cijfers door een echte bron, of label ze eerlijk |

---

## Samenvatting — wat er als eerste uitspringt

Drie dingen verdienen aandacht vóór de rest, en ze zijn van verschillende orde.

**1. Vier SEO-panelen schrijven verzonnen cijfers naar de database.** Dit is geen
placeholder in de UI: `Math.random()`-waarden worden ge-`insert`-ed in `seo_web_vitals`,
`seo_audit_results`, `seo_competitor_keywords` en `seo_search_console_data`, waarna de
tenant een toast krijgt die zegt dat de meting is voltooid. De nepdata is daarna niet meer
van echte data te onderscheiden en voedt historiegrafieken. Eén van de vier
(`SearchConsolePanel`) noemt zichzelf wél eerlijk "Demo data"; de andere drie niet.

> **Nagetrokken op de live database (10 sep, ná het schrijven van deze audit):** de vier
> tabellen bevatten samen **één rij**, in `seo_web_vitals`, van 25 maart 2026. De andere
> drie zijn leeg. Er staat dus geen berg verzonnen cijfers bij echte tenants. Dat maakt dit
> een codeprobleem — de knoppen liegen nog steeds — maar géén datamigratie en geen lopende
> schade. Zie §9f van [sellqo-brede-diagnose.md](sellqo-brede-diagnose.md).

**2. Twee storefront-elementen tonen verzonnen sociale bewijskracht aan kopers.**
"Iemand uit Amsterdam kocht X, 3 min geleden" en "N mensen bekijken dit nu" zijn beide
puur `Math.random()`. Ze staan achter een tenant-instelling die standaard uit staat, dus
ze zijn opt-in — maar wie ze aanzet, toont bezoekers verzonnen feiten. Gezien de
Belgische regels rond misleidende handelspraktijken die elders in dit project al leidend
zijn (zie de changelog-richtlijn in `CLAUDE.md` §4.2), is dit eerder een juridische dan
een cosmetische keuze. Ik markeer het, ik beslis het niet.

**3. De betalingsherinnering verstuurt geen e-mail — maar is ook niet bereikbaar.**
`usePaymentReminders.sendReminder` schrijft een `payment_reminders`-rij inclusief
`email_sent_to`, werkt `invoices.last_reminder_at` bij, berekent een aanmaningskost, en
meldt "Herinnering niveau X verstuurd". De regel die de e-mail verstuurt is een
uitgecommentarieerde `TODO`. **Nuance die de ernst verandert:** de enige UI die deze hook
importeert (`ReminderSettings.tsx`) gebruikt alleen `settings` en `updateSettings`, dus
`sendReminder` wordt op dit moment nergens aangeroepen. Het is dus dode code met een
landmijn erin, geen actief kapot proces. Wie hem ooit aansluit zonder de TODO te lezen,
zet een liegend spoor in de database.

---

## 1. Dode acties

| Bestand:regel | Wat | Web/native | Bak |
|---|---|---|---|
| [ShopLayout.tsx:800](src/components/storefront/ShopLayout.tsx:800) | Zoek-icoon in de desktop-storefrontheader, `onClick={() => {}}` | beide | B |
| [ShopLayout.tsx:877](src/components/storefront/ShopLayout.tsx:877) | Zoek-icoon in de mobiele storefrontheader, `onClick={() => {}}` | beide | B |
| [ConnectMarketplaceDialog.tsx:463](src/components/admin/marketplace/ConnectMarketplaceDialog.tsx:463) | Link "Waar vind ik mijn API credentials?" met `href="#"` en een ExternalLink-icoon — ziet eruit als hulp, doet niets | beide | B of A |
| [Quotes.tsx:64](src/pages/admin/Quotes.tsx:64) | Menu-item "Kopiëren" in de offerte-actielijst: `onClick: () => { /* TODO */ }` | beide | C |
| [FieldMappingStep.tsx:120](src/components/admin/import/FieldMappingStep.tsx:120) | Knop "auto-map": zet een spinner aan, wacht 1 seconde via `setTimeout`, zet hem uit. Doet niets. Simuleert actief werk | beide | C |
| [SEODashboard.tsx:332](src/pages/admin/SEODashboard.tsx:332) | Quick-win-actie `generate_faq` → `toast.info('FAQ generatie wordt binnenkort beschikbaar')` | beide | A of C |
| [useAIActions.ts:289](src/hooks/useAIActions.ts:289) | `default:` in de actie-switch logt alleen `console.log('Action type not implemented')` — onbekende AI-suggestie verdwijnt stil | beide | B |
| [pushRegistration.ts:127](src/native/pushRegistration.ts:127) | `openAppNotificationSettings()` is een gedocumenteerde no-op | native | zie §4 |

**De twee zoekknoppen zijn de opvallendste.** De mobiele bottom-nav van de storefront
*heeft* een werkende zoekactie (`onSearchClick` → `setSearchModalOpen(true)`), en die
modal bestaat. Het zoek-icoon in de header ernaast doet niets. De bekabeling is dus
letterlijk één regel: dezelfde `setSearchModalOpen(true)` aanroepen.

### Onderzocht en vrijgesproken

Deze kwamen uit de greps maar zijn geen dode affordance:

| Bestand:regel | Waarom niet dood |
|---|---|
| [SessionExpiredDialog.tsx:22](src/components/auth/SessionExpiredDialog.tsx:22) | `onOpenChange={() => {}}` maakt de dialog bewust niet-sluitbaar. Correct patroon |
| [Marketplaces.tsx:253-254](src/pages/admin/Marketplaces.tsx:253) | No-ops op de "integratie aanvragen"-kaart, waar instellen/loskoppelen niet van toepassing is. Wel te verifiëren of `MarketplaceCard` die knoppen daar überhaupt rendert |
| [Tenants.tsx:216](src/pages/admin/Tenants.tsx:216), [Messages.tsx:249](src/pages/admin/Messages.tsx:249) | Optionele callback-props waar de ouder niets hoeft te doen |
| [ProductGridView.tsx:343](src/components/admin/products/grid/ProductGridView.tsx:343) | `onSelect` no-op bij `isSelected={false}`: celselectie is voor varianten niet in gebruik |

---

## 2. Nepdata

### 2a. Verzonnen cijfers die naar de database worden geschreven

Dit is de zwaarste categorie: de data overleeft de sessie en wordt later als echt gelezen.

| Bestand:regel | Wat | Tabel | Web/native | Bak |
|---|---|---|---|---|
| [CoreWebVitalsPanel.tsx:185-193](src/components/admin/seo/CoreWebVitalsPanel.tsx:185) | LCP/FID/CLS/TTFB/INP + performance-score, allemaal `Math.random()`. Toast: "Performance meting voltooid" | `seo_web_vitals` | beide | D |
| [ScheduledAuditsPanel.tsx:202-217](src/components/admin/seo/ScheduledAuditsPanel.tsx:202) | `overall_score`, `issues_found` en drie issue-categorieën random. Toast: "Audit uitgevoerd". Zet ook `last_run_at` | `seo_audit_results`, `seo_scheduled_audits` | beide | D |
| [CompetitorAnalysisPanel.tsx:132-145](src/components/admin/seo/CompetitorAnalysisPanel.tsx:132) | Positie van jou én de concurrent, zoekvolume en moeilijkheidsgraad random. Comment zegt het eerlijk: "Simulate keyword data" | `seo_competitor_keywords` | beide | D |
| [SearchConsolePanel.tsx:96-121](src/components/admin/seo/SearchConsolePanel.tsx:96) | 30 dagen × ~7 queries aan clicks/impressies/CTR/positie. **Toast zegt wél eerlijk "Demo data gegenereerd"** | `seo_search_console_data` | beide | D |

De code is er open over — in `CoreWebVitalsPanel` staat letterlijk
`// Simulate measurement (in real app, would use PageSpeed Insights API)`. Het probleem is
niet de intentie maar de zichtbaarheid: de tenant leest alleen de toast en de grafiek.

### 2b. Verzonnen cijfers in de UI (niet gepersisteerd)

| Bestand:regel | Wat | Web/native | Bak |
|---|---|---|---|
| [ABTestingPanel.tsx:87-94](src/components/admin/marketing/ABTestingPanel.tsx:87) | `calculateWinnerStats()` geeft altijd `aRate = 24.5`, `bRate = 28.2`. Elke A/B-test toont dezelfde uitslag en B wint altijd. Getoond als `{stats.aRate}%` in een `text-2xl font-bold` | beide | D |
| [RecentPurchaseToast.tsx:20-29](src/components/storefront/RecentPurchaseToast.tsx:20) | "Iemand uit \<stad\> kocht \<product\> \<n\> min geleden" — stad, product en tijd alle drie random uit een lijst van 13 steden | beide | D |
| [ShopProductDetail.tsx:34](src/pages/storefront/ShopProductDetail.tsx:34) | `viewerCount = Math.floor(Math.random() * 8) + 2`, getoond als "N mensen bekijken dit nu" ([regel 309](src/pages/storefront/ShopProductDetail.tsx:309)) | beide | D |

Beide storefront-elementen zijn **opt-in per tenant** en staan standaard uit:
`show_recent_purchases` ([ShopLayout.tsx:157](src/components/storefront/ShopLayout.tsx:157))
en `showViewersCount`. Dat verzacht de blast radius maar verandert de aard niet.

Los daarvan: `RecentPurchaseToast` bouwt zijn tekst met een hardcoded Nederlandse
template-string in plaats van `t()`, wat botst met `sellqo-i18n-verplicht`. Een
Franstalige bezoeker van een meertalige storefront krijgt Nederlands.

### Onderzocht en vrijgesproken

- **35 van de 39 `Math.random()`-treffers zijn legitiem**: ID-generatie
  (`generateBlockId`, bestandsnamen bij uploads), kortingscode-generatie, confetti,
  skeleton-breedtes, en de roterende health-berichten in `config/healthMessages.ts`.
- [LiveThemePreview.tsx:56](src/components/admin/storefront/LiveThemePreview.tsx:56) —
  `mockProducts` ("Premium T-Shirt", "Canvas Sneakers") is een **thema-preview**-fallback
  wanneer de tenant nog geen secties heeft geconfigureerd. Dat is de juiste plek voor
  voorbeelddata; het wordt niet als tenantdata gepresenteerd.
- De grep op hardcoded object-arrays gaf **109 treffers in `src/components/admin` en
  `src/pages/admin`, vrijwel allemaal ruis**: statuslijsten, landenlijsten, btw-categorieën,
  kolomdefinities, platformkeuzes. Geen van de gecontroleerde exemplaren is nepdata. De
  echte vondsten in deze categorie kwamen uit de `Math.random()`- en `mock`-greps, niet
  hieruit.

---

## 3. Onaf

| Bestand:regel | Wat | Web/native | Bak |
|---|---|---|---|
| [usePaymentReminders.ts:123](src/hooks/usePaymentReminders.ts:123) | `// TODO: Send actual email via edge function`. Schrijft `payment_reminders.email_sent_to` en meldt "verstuurd" zonder te versturen. Niet bereikbaar vanuit de UI (zie samenvatting) | beide | B of C |
| [FieldMappingStep.tsx:122](src/components/admin/import/FieldMappingStep.tsx:122) | `// TODO: Call AI mapping edge function` — de nep-spinner uit §1 | beide | C |
| [autoDiscount.ts:48](src/lib/promotions/calculators/autoDiscount.ts:48) | `// TODO: Implement first order check` — een kortingsregel "alleen eerste bestelling" die die voorwaarde niet controleert | beide | B |
| [languages.ts:22](src/i18n/languages.ts:22) | `// TODO batch 1: es/it/pt/pl toevoegen` — bekend en gepland, sluit aan op `CLAUDE.md` §4.2 | n.v.t. | geen |

`autoDiscount` verdient aandacht bij de triage: een korting die ruimer uitdeelt dan
bedoeld kost direct geld. Ik heb niet nagetrokken of die regel in productie door een
tenant is geconfigureerd — dat is een SQL-vraag voor Akke.

### "Binnenkort beschikbaar" — bewust en correct

De 34 treffers op *coming soon / binnenkort* zijn overwegend het **juiste** patroon, geen
schuld. `MarketplaceCard`, `SocialChannelCard`, `UnifiedChannelList`,
`MessagingChannelList` en `useAdPlatforms.getPlatformStatus()` tonen een **label** in
plaats van een knop die niets doet. Changelog-entry `public.changelog` bevestigt dat dit
een bewuste eerdere batch was: *"Kanalen die nog niet beschikbaar zijn, krijgen een
duidelijk label in plaats van een knop die nog niets doet."* Dat is precies het model dat
bak A zou moeten volgen.

Uitzonderingen die géén label maar een dode actie zijn, staan in §1: `generate_faq` en
`Kopiëren`.

---

## 4. Native-gaten

| Bestand:regel | Wat | Bekabeld? | Bak |
|---|---|---|---|
| [pushRegistration.ts](src/native/pushRegistration.ts) | FCM-registratie: permissie, token ophalen, `device_tokens`-upsert, listener, opruimen bij uitloggen | **Ja, volledig** — met een uitvoerig gedocumenteerde Android-proxy-valkuil | geen |
| [pushRegistration.ts:127](src/native/pushRegistration.ts:127) | `openAppNotificationSettings()` — no-op, want geen enkele geïnstalleerde plugin kan de OS-instellingen openen. De UI toont in plaats daarvan handmatige instructies | **Bewust**, gedocumenteerd, met UI-fallback | geen |
| [deepLinks.ts](src/native/deepLinks.ts) | `@capacitor/app`-deeplinks | Ja, en er is een unit-test (`deepLinks.test.ts`) | geen |
| [openExternal.ts:44](src/lib/openExternal.ts:44) | `@capacitor/browser` voor externe links | Ja | geen |
| [NativeLandingRedirect.tsx](src/components/NativeLandingRedirect.tsx) | Marketing-landing overslaan in de app | Ja | geen |
| **`@capacitor/camera`** | **Nul aanroepen in heel `src/`** | **Nee** | A of C |
| [TicketCheckin.tsx:9](src/pages/admin/TicketCheckin.tsx:9) | QR-scannen via `html5-qrcode` → browser-`getUserMedia`, niet de Capacitor-camera | Web-API in de WebView | te verifiëren |
| [useBarcodeScanner.ts](src/hooks/useBarcodeScanner.ts) | Barcode-scanner voor de POS | Keyboard-wedge: luistert op snelle `keydown`-reeksen van een **hardware**-scanner | zie hieronder |

**`@capacitor/camera` is een lege plugin.** De grep op `@capacitor/camera` en op `Camera`
in heel `src/` geeft uitsluitend `lucide-react`-iconen en icoonnamen voor social-kanalen.
De plugin staat in `package.json`, in de Podfile en — sinds vandaag — in de Android-build,
maar geen enkele regel roept hem aan. Dat is direct relevant voor het werk van vanochtend:
we hebben een plugin de Android-build in gekabeld die niets doet. Bak A (dependency eruit
en opnieuw syncen) of C (alsnog gebruiken, bijvoorbeeld onder `TicketCheckin`).

**`useBarcodeScanner` is op een telefoon effectief dood.** De hook is goed geschreven en
werkt prima op een desktop-POS met een USB- of bluetooth-scanner. Op een telefoon zonder
extern apparaat komt er nooit een snelle keystroke-reeks binnen, dus de POS-scanfunctie
doet daar niets — zonder dat de UI dat vertelt. Als de POS bedoeld is voor gebruik in de
Capacitor-app, is dit bak C (camera-scan) of bak A (functie verbergen op native).

**Te verifiëren, niet vanuit `src/` te beantwoorden:** of `TicketCheckin` in de native
shell daadwerkelijk camera-toegang krijgt. `html5-qrcode` vraagt `getUserMedia` aan de
WebView, en dat vereist `NSCameraUsageDescription` in `Info.plist` en
`android.permission.CAMERA` in het manifest. Dat is een check in `ios/` en `android/`, en
uiteindelijk een test op een toestel. De code vangt de fout wel netjes af met
`toast.error('Camera niet beschikbaar: …')` ([regel 278](src/pages/admin/TicketCheckin.tsx:278)),
dus het faalt zichtbaar en niet stil.

---

## 5. Mobiele shell — navigatie-inventaris

Er zijn twee bottom-navs. Beide zijn `md:hidden`, dus ze verschijnen op elk smal scherm —
niet alleen in de app. Er is geen `isNativePlatform()`-tak in de navigatie zelf.

### Admin — [AdminMobileBottomNav.tsx](src/components/admin/AdminMobileBottomNav.tsx)

Onvoorwaardelijk gerenderd vanuit [AdminLayout.tsx:73](src/components/admin/AdminLayout.tsx:73).

| Tab | Doel | Route bestaat? | Werkt hij? |
|---|---|---|---|
| Dashboard | `/admin` | Ja, `index` | Ja |
| Bestellingen | `/admin/orders` | Ja | **Voorwaardelijk** — achter `RouteGuard requireRead="orders"` |
| Producten | `/admin/products` | Ja | **Voorwaardelijk** — achter `RouteGuard requireRead="products"` |
| Inbox | `/admin/messages` | Ja, ongeguard | Ja |
| Menu | `toggleSidebar()` | n.v.t. | Ja |

**Het gat: deze nav past géén enkele zichtbaarheidsregel toe.** Geen `useCan`, geen
`useTenantPageOverrides`, geen `useSidebarPreferences`. De sidebar doet dat wél — zie
`shouldHideItem()` in [AdminSidebar.tsx:136](src/components/admin/AdminSidebar.tsx:136),
dat voorkeur, rol, feature én `hidden_pages` combineert. Twee concrete gevolgen:

1. Een tenant die "Producten" verbergt via `hidden_pages` ziet het item verdwijnen uit de
   sidebar maar houdt de tab in de bottom-nav.
2. Een rol zonder leesrecht op orders of producten ziet die tabs, tikt erop, en wordt naar
   `/no-access` geredirect. Een affordance die gegarandeerd op een deur klopt die dicht is.

Dat is exact het "geen dode affordances"-punt uit `CLAUDE.md` §2, en op mobiel weegt het
zwaarder omdat de bottom-nav dáár de primaire navigatie is. Bak B: dezelfde filter als de
sidebar toepassen.

Kleiner: alle vijf labels zijn hardcoded Nederlands (`'Dashboard'`, `'Bestellingen'`,
`'Producten'`, `'Inbox'`, `'Menu'`) in plaats van `t()` — botst met
`sellqo-i18n-verplicht`. De storefront-nav doet dit wél goed.

### Storefront — [MobileBottomNav.tsx](src/components/storefront/MobileBottomNav.tsx)

Gerenderd achter de tenant-instelling `mobileBottomNav`
([ShopLayout.tsx:564](src/components/storefront/ShopLayout.tsx:564)).

| Tab | Doel | Werkt hij? |
|---|---|---|
| Home | `basePath` | Ja |
| Zoeken | `onSearchClick()` → zoekmodal | Ja |
| Categorieën | `basePath/products` | Ja — maar het label zegt "categorieën" en de link gaat naar de productenlijst |
| Winkelwagen | `basePath/cart`, met telling | Ja |

Volledig ge-i18n'd, alle doelen bestaan. Enige punt is de label/bestemming-mismatch bij
tab 3, en dat is een tekstkeuze, geen dode knop.

---

## 6. De bestaande gate-laag

Gevraagd was: bestaat er al iets om "verbergen" op te hangen? **Ja — drie mechanismen,
naast elkaar, met verschillende reikwijdte.** Geen ervan is een feature-flag-systeem in de
klassieke zin (geen `flags`-tabel, geen `useFeature`-hook, geen registry-bestand).

### 6a. `FeatureGate` — plan-features

- **Component:** [FeatureGate.tsx](src/components/FeatureGate.tsx), plus
  `useFeatureAccess(feature)` voor de UI-loze variant.
- **Motor:** `useUsageLimits().checkFeature(key)`
  ([useUsageLimits.ts:169](src/hooks/useUsageLimits.ts:169)). Volgorde: onbeperkte tenants
  en platform-admins krijgen alles → dan `subscription.pricing_plan.features[key] === true`
  → dan een actieve add-on met `addon_type === key` → anders `false`.
- **Registratie:** de sleutels staan als een getypeerde interface in
  [`PricingPlanFeatures`](src/types/billing.ts:1) — `customDomain`, `pos`,
  `webshop_builder`, `visual_editor`, `ai_marketing`, `peppol`, `facturX` en meer. De
  waarden komen uit de `features`-JSONB op `pricing_plans`.
- **Fallback bij weigering:** een nette kaart met een slot, uitleg en een knop naar
  `/pricing`.
- **Gebruik:** **7 aanroepen in de hele codebase**, over 4 sleutels (`ai_marketing` ×5,
  `customDomain`, `social_commerce`).

De interface telt 36 sleutels; alle vier de gebruikte gate-sleutels staan erin. De
dekking is dus niet het probleem — het bereik is dat: 36 gedefinieerde features tegenover
7 plekken in de UI die er iets mee doen.

Wel een zwakke plek: `checkFeature(featureKey: string)` neemt een losse string en cast
intern met `key as keyof typeof features`. Een typfout in een sleutel geeft daardoor geen
compileerfout maar stilzwijgend "geen toegang" — de feature verdwijnt dan zonder spoor.

### 6b. `tenant_feature_overrides` — per-tenant overrides

Twee kolommen, twee doelen:

- **`hidden_pages: string[]`** — per tenant nav-items/pagina's verbergen. Beheerd via
  [useTenantPageOverrides.ts](src/hooks/useTenantPageOverrides.ts) (`isPageHidden`,
  `togglePage`) en platform-zijde via
  [TenantModulesTab.tsx:194](src/components/platform/TenantModulesTab.tsx:194).
  **Toegepast in:** `AdminSidebar`, `DashboardGrid`, `QuickActionsWidget`.
  **Niet toegepast in:** `AdminMobileBottomNav` (zie §5).
- **`granted_features: string[]`** — een feature toekennen buiten het plan om.
  `isFeatureGranted` wordt gelezen in `AdminSidebar`, `Settings` en `Promotions`.

**Dit is de meest bruikbare bestaande haak voor bak A.** Hij bestaat, is per tenant
instelbaar vanaf de platformkant, en de sidebar respecteert hem al. Wat ontbreekt is
dekking: de bottom-nav en de meeste losse knoppen kijken er niet naar.

### 6c. `useCan` / `RouteGuard` — rollen en permissies

[useCan.ts](src/hooks/useCan.ts) met de permissiematrix, afgedwongen op routeniveau door
[RouteGuard.tsx](src/components/admin/RouteGuard.tsx) (`requireRead` / `requireWrite` /
`requireRole`, `platform_admin` bypasst). Bij weigering: redirect naar
`/no-access?from=…`. Dit is een **autorisatie**-laag, geen feature-laag — hij hoort niet
het antwoord te zijn op "deze knop is nog niet af", maar hij is wel de reden dat sommige
bottom-nav-tabs doodlopen.

### Wat er níet is

Geen `feature_flags`-tabel, geen omgevingsvariabele-flags, geen percentage-rollout, geen
kill-switch. Wie een half-afgebouwde feature vandaag wil verbergen, kiest tussen
`hidden_pages` (per tenant, handmatig, alleen voor nav-items die er al in zitten) of het
verwijderen van de JSX. Er is geen mechanisme voor "verberg dit voor iedereen tot het af
is" behalve code.

---

## 7. Wat ik níet heb onderzocht

Volledigheidshalve, zodat de lijst niet completer lijkt dan hij is:

- **`supabase/functions/**`** — buiten de opdrachtscope (`src/`). Dode of stub-edge-functions
  zijn dus niet in beeld.
- **`src/components/ui/`** — de shadcn-basiscomponenten. Bewust overgeslagen als
  vendorcode; de enige treffer daar was een `Math.random()`-skeletonbreedte.
- **Runtime-gedrag.** Alles hierboven is statische analyse. Of `TicketCheckin` op een echt
  toestel camera krijgt, of `autoDiscount` bij een tenant actief is, en of de bottom-nav
  in de praktijk doodloopt voor een bepaalde rol — dat vraagt een toestel of SQL.
- **De vijf custom-frontend tenants.** Die renderen hun eigen componenten; niets hierboven
  raakt hen. Geen enkele bevinding zit in `storefront-api`, `storefront-resolve` of
  `storefront-customer-api`.
- **Verweesde componenten** (bestanden die nergens geïmporteerd worden). Andere vraag,
  andere grep — zeg het als die er ook bij moet.

## Bijlage — gebruikte greps

```
rg '=\{\(\)\s*=>\s*\{\s*\}\}|=\{\(\)\s*=>\s*undefined\}|=\{\(\)\s*=>\s*null\}' src
rg 'href=["'"'"']#["'"'"']|to=["'"'"']#["'"'"']' src
rg 'onClick=\{\(\)\s*=>\s*console\.(log|warn|info)' src
rg -i 'coming soon|binnenkort beschikbaar|nog niet beschikbaar|not implemented|...' src
rg '\b(TODO|FIXME|HACK|XXX)\b' src
rg -i '\b(mock|dummy|fakedata|faker|lorem ipsum|sampledata)\w*' src
rg 'Math\.random\(\)' src
rg 'disabled=\{true\}' src
rg 'isNativePlatform|Capacitor\.' src
rg '@capacitor/camera|html5-qrcode|react-qr-code|BarcodeScanner' src
rg -i 'feature_flag|entitlement|useFeature|planFeature|hasFeature|isFeatureEnabled' src
```

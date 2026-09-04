# LAYOUT & NATIVE AUDIT — SellQo Admin (Capacitor iOS/Android)

**Datum**: 4 september 2026 · **Branch**: `claude/git-pull-k2yy85` · **HEAD bij recon**: `9585057`
**Type**: read-only recon. Bij het opstellen van dit rapport is geen code gewijzigd.

## Sectie 0 — Scope, methode en native-basis

**Methode.** Alles hieronder is vastgesteld met `grep`/file-reads tegen de werkkopie, niet
uit herinnering. Regelnummers verwijzen naar `9585057`.

**Native basis (geverifieerd).**

| Feit | Bron |
|---|---|
| `viewport-fit=cover` staat aan | `index.html:5` |
| `--safe-top` / `--safe-bottom` gedefinieerd | `src/index.css:64-65` |
| Utilities: `.pt-safe`, `.pb-safe`, `.top-safe` | `src/index.css:172-181` |
| **Geen** tegenhanger voor `bottom:` (offset i.p.v. padding) | idem — dit is de ontbrekende primitive |
| Android `targetSdkVersion = 36` | `android/variables.gradle:4` |
| Plugins geïnstalleerd: `core`, `android`, `ios`, `camera`, `firebase-messaging` | `package.json:18-22`, `android/capacitor.settings.gradle` |
| **Niet** geïnstalleerd: `@capacitor/browser`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/keyboard` | idem |
| `capacitor.config.ts` heeft alleen `appId`/`appName`/`webDir` — geen `server.allowNavigation` | `capacitor.config.ts:3-7` |

Twee gevolgen die het hele rapport dragen:

1. **targetSdk 36 = verplichte edge-to-edge op Android** (geen opt-out meer). De WebView
   loopt onder status- en navigatiebar. Op iOS doet `viewport-fit=cover` hetzelfde.
   `100vh` is dus de *hele* schermhoogte, inclusief notch en home-indicator.
2. **Geen `@capacitor/browser`** ⇒ elke `target="_blank"`, `window.open()` en absolute
   `https://`-navigatie verlaat de WebView naar Safari/Chrome.

**Buiten scope**: de vijf custom frontends (Loveke, VanXcel, Astra Sleep, Mancini Milano,
Zona Dorata) en de contracten `storefront-resolve` / `storefront-api` / `checkout-engine`.
`src/components/storefront/**` en `src/pages/storefront/**` worden wél gerapporteerd (het
is de SellQo-theme-renderer die in dezelfde app draait), maar staan als 🔒 gemarkeerd:
elke fix daar raakt gedeelde tabellen/JSON-sleutels en vergt een aparte go.

---

## Sectie 1 — Safe-area / fixed positioning

### 1a. 🔴 DE BLOCKER — "Onopgeslagen wijzigingen"-balk

**`src/components/admin/FloatingSaveBar.tsx:28`**

```
"fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg"
"lg:left-[var(--sidebar-width,280px)]"
```

Label op `:35` → `t('admin.floatingSaveBar.onopgeslagen_wijzigingen')` (NL: "Onopgeslagen
wijzigingen", `src/i18n/locales/nl.json:4729`). Geen `pb-safe`, geen `var(--safe-bottom)`.

**De rekensom die de bug verklaart:**

| | Waarde |
|---|---|
| `AdminMobileBottomNav.tsx:22` | `fixed bottom-0 … z-50 … pb-safe`, inner `<nav className="h-14">` (`:23`) |
| ⇒ werkelijke navhoogte | `3.5rem + var(--safe-bottom)` = **56px + 34px = 90px** (iPhone met home-indicator) |
| `FloatingSaveBar` onderkant | platte `bottom-14` = **56px** |
| **Overlap** | **exact `var(--safe-bottom)` = 34px** |
| **z-index** | save bar `z-40` **<** nav `z-50` |

De onderste 34px van de savebalk zit onder de nav, en omdat de nav hoger stapelt vangt die
de taps. Op een toestel zonder inset (oude Android, iPhone SE) is `--safe-bottom = 0` en
werkt het toevallig wél — vandaar dat dit in de browser nooit opvalt.

**Tweede, aparte fout in dezelfde component**: op `md:` en breder verdwijnt de nav
(`md:hidden`) en gaat de savebalk naar `md:bottom-0` — nog steeds zonder `pb-safe`. Op iPad
staat de knoppenrij daardoor onder de home-indicator.

**10 aanroepplekken** (alle 10 erven de bug):

| Bestand | Regel |
|---|---|
| `src/pages/admin/ProductForm.tsx` | 1911 |
| `src/pages/admin/POSTerminalSettings.tsx` | 384 |
| `src/components/admin/storefront/StorefrontSettings.tsx` | 297 |
| `src/components/admin/settings/TaxSettings.tsx` | 1049 |
| `src/components/admin/settings/TransactionFeeSettings.tsx` | 633 |
| `src/components/admin/settings/AIAssistantSettings.tsx` | 398 |
| `src/components/admin/settings/ReminderSettings.tsx` | 157 |
| `src/components/admin/settings/BrandingSettings.tsx` | 131 |
| `src/components/admin/settings/PeppolSettings.tsx` | 110 |
| `src/components/admin/events/EventCoreSettingsCard.tsx` | 215 |

**Derde effect (layout-shift)**: `AdminLayout.tsx:46` geeft `main` een vaste
`pb-[calc(5rem+var(--safe-bottom))]`. Die 5rem dekt de nav (3.5rem) plus 1.5rem lucht, maar
níet de ~57px die de savebalk er bovenop legt zodra `isDirty` waar wordt. Zodra je iets
wijzigt, dekt de savebalk de onderste ~57px van het formulier af.

### 1b. Fixed/sticky-inventaris — admin

| # | Bestand:regel | Wat het is | Positionering | Safe-area |
|---|---|---|---|---|
| 1 | `admin/AdminMobileBottomNav.tsx:22` | bottom nav | `fixed bottom-0 z-50` | ✅ `pb-safe` |
| 2 | `admin/AdminHeader.tsx:24` | top header | `sticky top-0 z-10` | ✅ `pt-safe` |
| 3 | `admin/FloatingSaveBar.tsx:28` | **save reminder** | `fixed bottom-14/md:bottom-0 z-40` | 🔴 **geen** |
| 4 | `pages/admin/Products.tsx:557` | bulk-actiebalk producten | `fixed bottom-14/md:bottom-0 z-40` | 🔴 geen |
| 5 | `admin/OrderBulkActions.tsx:251` | bulk-actiebalk orders | idem | 🔴 geen |
| 6 | `admin/FulfillmentBulkActions.tsx:246` | bulk-actiebalk fulfilment | idem | 🔴 geen |
| 7 | `admin/CategoryBulkActions.tsx:59` | bulk-actiebalk categorieën | idem | 🔴 geen |
| 8 | `admin/marketing/MediaAssetsLibrary.tsx:499` | zwevende selectie-pill | `fixed bottom-14 left-1/2 z-50` | 🔴 geen |
| 9 | `admin/help/AIHelpWidget.tsx:30` | AI-help FAB (container) | `fixed bottom-20 md:bottom-4 right-4 z-50` | 🔴 geen |
| 10 | `admin/help/AIHelpWidget.tsx:58` | AI-help sluitknop | idem | 🔴 geen |
| 11 | `admin/help/AIHelpChatWindow.tsx:181` | AI-chatvenster | `fixed bottom-20 right-4 z-[60]` | 🔴 geen |
| 12 | `visual-editor/QuickEditPanel.tsx:133` | rechterpaneel volle hoogte | `fixed top-0 right-0 h-full z-50` | 🔴 geen (top én bottom) |
| 13 | `visual-editor/StaticPageEditor.tsx:221` | fullscreen editor | `fixed inset-0 z-50` | 🔴 geen |
| 14 | `admin/TrialExpiredBlocker.tsx:70` | fullscreen blocker | `fixed inset-0 z-[100]` | 🟠 gecentreerd, laag risico |
| 15 | `visual-editor/AICopyButton.tsx:216,251` | laad-overlays | `fixed inset-0 z-50` | 🟠 gecentreerd |
| 16 | `onboarding/OnboardingWizard.tsx:282` | wizard-overlay | `fixed inset-0 z-50` | 🟠 gecentreerd |
| 17 | `SandboxBanner.tsx:24` | demo-banner | `sticky top-0 z-50` | 🟠 geen `pt-safe`; rendert onder de header (`AdminLayout.tsx:41`), dus geen praktisch probleem — wél een z-50 dat de header (z-10) overschrijdt |
| 18 | `dev/RoleSimulator.tsx:80` | dev-balk boven | `fixed top-0 z-[9999]` | 🟠 geen `pt-safe` (dev-only) |
| 19 | `dev/RoleSimulator.tsx:90` | dev-knop onder | `fixed bottom-3 z-[9999]` | 🟠 geen (dev-only) |

**De 🔴-groep 3 t/m 11 is één en dezelfde bug, negen keer gekopieerd**: een hardcoded
`bottom-14`/`bottom-20` die een nav probeert te ontwijken waarvan de hoogte variabel is.
`bottom-20` (80px) bij de AI-help is óók te laag: de nav is 90px op een iPhone.

### 1c. Fixed/sticky — gedeelde UI-primitives

| Bestand:regel | Wat | Safe-area |
|---|---|---|
| `ui/drawer.tsx:34` | DrawerContent (bottom sheet) | ✅ `pb-safe` |
| `ui/sonner.tsx:20` | toast mobileOffset top | ✅ `calc(var(--safe-top) + 12px)` |
| `ui/sheet.tsx:32` | SheetContent (alle zijden) | 🔴 geen — een `side="bottom"` sheet loopt onder de home-indicator. Gebruikt o.a. door `POSTerminal.tsx:1246` |
| `ui/dialog.tsx:39` | DialogContent | 🟠 `max-h-[90dvh]`, gecentreerd |
| `ui/alert-dialog.tsx:37` | idem | 🟠 idem |
| `ui/sidebar.tsx:195` | desktop sidebar | 🟠 `fixed inset-y-0 h-svh`, `md:flex` — desktop-only |

### 1d. Fixed/sticky — storefront-renderer 🔒 (rapport-only)

| Bestand:regel | Wat | Safe-area |
|---|---|---|
| `storefront/MobileBottomNav.tsx:18` | shop bottom nav | ✅ `pb-safe` |
| `storefront/CookieBanner.tsx:123,169` | cookiebalk | ✅ `calc(… + var(--safe-bottom))` |
| `storefront/ShopLayout.tsx:311,318,337` | shell + header | ✅ `--safe-bottom` / `--safe-top` / `top-safe` |
| `storefront/RecentPurchaseToast.tsx:44` | social-proof toast | 🟠 `fixed bottom-4 z-[90]` — geen safe-area |
| `storefront/reviews/ReviewsFloatingWidget.tsx:34,51` | reviews-widget | 🟠 positie uit props, geen safe-area |
| `storefront/NewsletterPopup.tsx:72`, `ExitIntentPopup.tsx:42`, `CookieBanner.tsx:76` | modals | 🟠 `fixed inset-0 z-[100]`, gecentreerd |
| `PlatformCookieBanner.tsx:98` | platform-cookiebalk | ✅ `pb-safe` |
| `landing/LandingNavbar.tsx:41` | landing navbar | ✅ `pt-safe` |

De storefront-kant is beter verzorgd dan de admin-kant. Verklaarbaar: die is in de
webshop-reeks aangeraakt, de admin-shell niet.

**Telling**: 8 componenten gebruiken safe-area correct, **13 fixed/sticky bars/overlays
doen dat niet**, waarvan **9 in de admin-onderbalk-band** de directe oorzaak zijn.

---

## Sectie 2 — z-index conflicten

### Feitelijke stapelvolgorde (fixed/sticky elementen)

| z | Element | Bestand:regel |
|---|---|---|
| `9999` | RoleSimulator (dev) | `dev/RoleSimulator.tsx:80,90` |
| `[200]` | Platform-cookiebalk | `PlatformCookieBanner.tsx:98` |
| `[100]` | TrialExpiredBlocker | `admin/TrialExpiredBlocker.tsx:70` |
| `[100]` | Storefront-modals + cookiebalk 🔒 | `storefront/NewsletterPopup.tsx:72`, `ExitIntentPopup.tsx:42`, `CookieBanner.tsx:76,123,169` |
| `[90]` | RecentPurchaseToast 🔒 | `storefront/RecentPurchaseToast.tsx:44` |
| `[60]` | AI-chatvenster | `admin/help/AIHelpChatWindow.tsx:181` |
| `50` | **AdminMobileBottomNav** | `admin/AdminMobileBottomNav.tsx:22` |
| `50` | Alle Radix-overlays (dialog, sheet, drawer, dropdown, select, popover, tooltip, context-menu) | `ui/*.tsx` |
| `50` | SandboxBanner | `SandboxBanner.tsx:24` |
| `50` | MediaAssetsLibrary selectie-pill | `admin/marketing/MediaAssetsLibrary.tsx:499` |
| `50` | AIHelpWidget FAB | `admin/help/AIHelpWidget.tsx:30,58` |
| `50` | QuickEditPanel / StaticPageEditor | `visual-editor/QuickEditPanel.tsx:133`, `StaticPageEditor.tsx:221` |
| **`40`** | **FloatingSaveBar** | `admin/FloatingSaveBar.tsx:28` |
| **`40`** | 4× bulk-actiebalk | `Products.tsx:557`, `OrderBulkActions.tsx:251`, `FulfillmentBulkActions.tsx:246`, `CategoryBulkActions.tsx:59` |
| `30` | VisualEditorCanvas toolbar | `visual-editor/VisualEditorCanvas.tsx:162` |
| `20` | SectionToolbar, sidebar-rail, calendar | `visual-editor/SectionToolbar.tsx:37`, `ui/sidebar.tsx:257`, `ui/calendar.tsx:31` |
| `10` | **AdminHeader** | `admin/AdminHeader.tsx:24` |
| `10` | Grid-kopregels | `products/grid/ProductGridView.tsx:516` |
| — | TaxSettings `<thead>` (geen z) | `admin/settings/TaxSettings.tsx:688` |

### Conflicten

**🔴 C1 — save/bulk-balken (z-40) onder de bottom nav (z-50).** Het geometrische probleem
uit §1a wordt hierdoor onherstelbaar: de 34px die visueel onder de nav vallen, zijn ook
niet aantikbaar.

**🔴 C2 — SandboxBanner (z-50) boven AdminHeader (z-10).** Beide `sticky top-0`, beide in
dezelfde flex-kolom (`AdminLayout.tsx:39-41`). Omdat de scroll-container `main` is (`:46`)
en niet de kolom, is `sticky top-0` op beide effectief een no-op — geen zichtbaar probleem
vandaag, wel een tijdbom zodra de kolom gaat scrollen.

**🟠 C3 — AdminHeader op z-10, gelijk aan gewone content.**
`products/grid/ProductGridView.tsx:516` en `DashboardWidgetWrapper.tsx:48` staan ook op
z-10; sticky tabelkoppen kunnen door de header prikken. `TaxSettings.tsx:688` heeft een
`sticky top-0 <thead>` zónder z-index — die valt onder alles met z ≥ 1.

**🟠 C4 — AI-help (z-50 / z-[60]) boven Radix-overlays (z-50).** Het chatvenster blijft
boven een geopende dialog zweven.

**🟠 C5 — Geen z-index-schaal.** Twaalf ad-hoc waarden (`1, 2, 10, 20, 30, 40, 50, 60, 90,
100, 200, 9999`) zonder centrale definitie; `src/index.css` bevat geen `--z-*`-tokens.

---

## Sectie 3 — Externe links / navigatie

### 3a. 🔴 DE BLOCKER — "Bekijk winkel"

**`src/components/admin/storefront/studio/StudioHeader.tsx`**

```tsx
// :29-33 — URL-opbouw
const storefrontUrl = canonicalDomain?.domain
  ? `https://${canonicalDomain.domain}`
  : currentTenant ? `/shop/${currentTenant.slug}` : null;

// :111 — de knop "Bekijk winkel"
<a href={storefrontUrl} target="_blank" rel="noopener noreferrer">

// :93-96 — dezelfde link nog eens, als domeinregel
<a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
```

**Waarom dit in native de app verlaat**, twee onafhankelijke oorzaken:

1. `target="_blank"` ⇒ WKWebView roept `createWebViewWith` aan; Capacitor's default
   `WKUIDelegate` opent dat in het systeem-browserproces. Idem op Android via
   `onCreateWindow`.
2. Met een geverifieerd canoniek domein is `href` een **absolute** `https://`-URL naar een
   andere origin dan `capacitor://localhost`. Zonder `server.allowNavigation` opent
   Capacitor die extern.

Zonder custom domein is `href` de relatieve `/shop/:slug` — die blijft binnen de origin,
maar `target="_blank"` gooit hem alsnog naar buiten. **En** `ShopLayout.tsx:189-199` doet
vervolgens een harde redirect:

```ts
// ShopLayout.tsx:186  → window.location.href = ts.custom_frontend_url;
// ShopLayout.tsx:199  → window.location.href = `https://${canonicalDomain.domain}`;
```

🔒 Dit is storefront-logica en `:186` is exact de custom-frontend-redirect — hier niet
aankomen zonder aparte recon.

**"Publiceren"** (`StudioHeader.tsx:123`) is een mutation, geen navigatie — geen
native-probleem. Losse observatie: `useStorefront.ts:203-224` zet alleen
`is_published`/`published_at` en laat `storefront_status` ongemoeid, dus een op `offline`
staande shop blijft na "Publiceren" een "binnenkort open"-pagina tonen
(`ShopLayout.tsx:281`). UX-bug, geen layout-bug.

### 3b. Alle storefront-open-acties (URL-opbouw is 6× gedupliceerd)

| Bestand:regel | Actie | Mechanisme | Native |
|---|---|---|---|
| `studio/StudioHeader.tsx:111` | **"Bekijk winkel"** | `<a target="_blank">` | 🔴 extern |
| `studio/StudioHeader.tsx:93` | domeinregel (klikbaar) | `<a target="_blank">` | 🔴 extern |
| `storefront/PreviewPanel.tsx:36` | "open in nieuw tabblad" | `window.open('/shop/'+slug, '_blank')` | 🔴 extern |
| `storefront/PreviewPanel.tsx:24` | preview-iframe | `<iframe src="/shop/:slug?preview=true">` | ✅ in-app |
| `onboarding/steps/LaunchStep.tsx:105` | "je webshop is LIVE" | `<a target="_blank">`, URL `${window.location.origin}/shop/${slug}` (`:18`) | 🔴 extern |
| `studio/CustomFrontendState.tsx:42` | custom-frontend-link 🔒 | `<a target="_blank">` | 🔴 extern |
| `settings/DomainSettings.tsx:609` | geverifieerd domein openen | `<a target="_blank">` | 🔴 extern |
| `pages/admin/Tenants.tsx:288` | "Naar winkel" | `<a target="_blank">` op `tenants.custom_domain` | 🔴 extern |
| `storefront/StorefrontSettings.tsx:110` | URL kopiëren | clipboard | — |

**Nevenbevinding**: er is geen gedeelde helper. Zes plekken bouwen de winkel-URL zelf op,
met vier verschillende uitkomsten — `canonicalDomain` (3×), `tenants.custom_domain` (1×),
kaal `/shop/:slug` (2×), en alleen `LaunchStep.tsx:18` zet er `window.location.origin` voor.
`StorefrontSettings.tsx:110` kopieert daardoor een onbruikbare relatieve `/shop/…`-string
naar het klembord wanneer er geen custom domein is. En `PreviewPanel.tsx:26,35` valt terug
op `/shop/preview` — een route die **niet bestaat** in `App.tsx:188-197`. Dat is een dode
affordance (CLAUDE.md §2).

### 3c. Volledige telling externe navigatie

| Mechanisme | Aantal | Native-gedrag |
|---|---|---|
| `window.open(…)` | **27** | 🔴 systeem-browser |
| `window.location.href = ` / `.assign()` / `.replace()` | **28** | 🔴 bij externe origin: app verlaten, geen weg terug |
| `<a target="_blank">` | **66** | 🔴 systeem-browser |
| **Totaal** | **121** | |

### 3d. Groepering per type

**A — Storefront-preview / publiceren (8×)** → §3b. **Blocker.**

**B — Betaal- en billingflows (12×) — 🔴🔴 het gevaarlijkst.** Deze verlaten de app en
komen er nooit meer in terug, want er is geen deep-link-handler (`@capacitor/app` ontbreekt):

| Bestand:regel | Wat |
|---|---|
| `pages/admin/Billing.tsx:242,347,543,754` | Stripe checkout-sessie (`window.location.assign`) |
| `hooks/useStripeConnect.ts:14,17,19` | Stripe Connect onboarding |
| `pages/admin/QuoteDetail.tsx:372` | betaallink offerte |
| `admin/MandateLinkDialog.tsx:63,76` | mandaatlink + `mailto:` |
| `pages/MandateActivation.tsx:116,252` | terug naar `/admin/billing` (intern, veilig) |
| `admin/billing/PeppolUpgradeCard.tsx:67` | Peppol-upgrade checkout |
| `admin/marketing/CreditPurchaseDialog.tsx:84` | credits kopen |
| `pages/storefront/ShopCheckout.tsx:407` 🔒 | checkout-URL |

Een tenant die in de app wil upgraden, wordt naar Safari geworpen; na betalen landt de
redirect in Safari, niet in de app. Dat is een verkoopblokkade, geen cosmetisch probleem.

**C — OAuth / marketplace-koppelingen (9×)** — Meta, WhatsApp, Shopify, Google, Pinterest.
`UnifiedChannelList.tsx:271`, `MessagingChannelList.tsx:138`,
`SocialConnectionsManager.tsx:101` doen `window.location.href = data.authUrl`;
`MetaConnectWizard.tsx:126`, `MetaShopWizard.tsx:78`, `WhatsAppConnectWizard.tsx:117` doen
`window.open(…, 'width=700,height=800')` — popup-afmetingen die native niets betekenen; de
popup-referentie wordt gebruikt om te pollen en is in native `null`. 🔴 Deze wizards zijn in
de app kapot, niet alleen lelijk.

**D — Track & trace (5×)** — `admin/TrackingInfoCard.tsx:87,107,192`,
`pages/admin/Fulfillment.tsx:311,435`, `admin/ServicePointCard.tsx:133` (Google Maps).
🟠 Extern openen is inhoudelijk juist, maar hoort in een in-app browser.

**E — Documenten / downloads (11×)** — `hooks/useDocumentDownload.ts:41,46,49`,
`hooks/useLabelPrinter.ts:355-382`, `utils/pdfMerge.ts:76`, `CreditNotesTable.tsx:65,78,170`,
`CreditNotes.tsx:46,59,157`, `Invoices.tsx:240,252,319`, `OrderCreditNotesSection.tsx:61,74`.
🔴 Het "popup-safe" patroon (`window.open('', '_blank')` en dan `win.location.href = url`)
is voor mobiele *browsers* geschreven (`useDocumentDownload.ts:21` documenteert dat) en
werkt in een WebView averechts: `window.open('')` levert vaak `null`, waarna de fallback op
`:49` het huidige venster wegnavigeert. `useLabelPrinter.ts:355` maakt bovendien een
`position:fixed` iframe voor printen — er is geen printdialoog in een Capacitor-WebView.

**F — Echt extern (documentatie, help, socials) (~40×)** — Google Rich Results
(`StructuredDataPreview.tsx:194`), peppol.be, calendly, provider-handleidingen, socials in
`ShopLayout.tsx:435-438` 🔒. 🟠 Extern openen is correct; alleen de manier moet anders.

**G — `mailto:` (2×)** — `Pricing.tsx:64`, `PlatformBilling.tsx:227`. ✅ Werkt in native.

### 3e. Wat de nette fix is

`@capacitor/browser` toevoegen betekent een plugin-install + `npx cap sync` + een **native
rebuild** (iOS `pod install`, Android Gradle-sync). Voorgestelde helper, één plek:

```ts
// src/lib/openExternal.ts
export async function openExternal(url: string): Promise<void>
// native: Browser.open() → in-app browser; web: nieuw tabblad; mailto:/tel: → systeem
```

Waarna:
- **A (winkel bekijken)** → op web `target="_blank"`; op native `Browser.open()`. De
  relatieve `/shop/:slug` mag níet via de router in-app zodra er een canoniek domein is,
  want `ShopLayout.tsx:189-199` redirect toch weg.
- **B (betalen)** → `Browser.open()` + `browserFinished`-listener. Vergt óók
  `@capacitor/app` + een deep-link-scheme, anders komt de Stripe-redirect nergens aan.
- **C (OAuth)** → idem, plus popup-polling vervangen door de listener.
- **D/E/F** → mechanisch door de helper heen.

---

## Sectie 4 — Viewport-hoogte

**Nuance vooraf.** In een Capacitor-WebView bestaat de inklappende adresbalk niet, dus de
`100vh ≠ 100dvh`-drift speelt daar *niet*. Wat wél speelt: door `viewport-fit=cover`
(`index.html:5`) is `100vh` de volledige schermhoogte **inclusief** notch en home-indicator.
`h-screen` betekent dus "loop onder de systeembalken door". Voor de web-/PWA-route is `dvh`
wél de juiste migratie. Beide fixes zijn nodig, om verschillende redenen.

### 4a. Telling

| Patroon | Aantal | Opmerking |
|---|---|---|
| `min-h-screen` | **26** | |
| bare `h-screen` | **1** | `pages/admin/POSTerminal.tsx:911` |
| `calc(100vh - …)` | **5** | |
| `dvh` (al goed) | **10** | |
| `svh` (al goed) | **5** | alleen `ui/sidebar.tsx` |
| `max-h-[NNvh]` in dialogs | **~55** | 🟠 laag risico, zie 4d |

### 4b. 🔴 Echte problemen

| Bestand:regel | Code | Probleem |
|---|---|---|
| `pages/admin/POSTerminal.tsx:911` | `h-screen flex flex-col` | Rendert **binnen** `AdminLayout` (`App.tsx:268`), dus binnen `main` met `pb-[calc(5rem+var(--safe-bottom))]`. Een `h-screen`-kind in een container die al 90px korter is ⇒ de POS-onderbalk valt onder de bottom nav. Header op `:913` heeft geen `pt-safe` ⇒ loopt onder de statusbar. Tweede, onafhankelijke instantie van de gemelde bug. |
| `pages/admin/Messages.tsx:273` | `h-[calc(100vh-4rem)]` | 4rem = 64px, hardcoded voor de header. Echte header = `min-h-14` (56px) **+ `--safe-top`** (47px op iPhone met Dynamic Island). Klopt op geen enkel toestel. |
| `pages/admin/Settings.tsx:297` | `h-auto lg:h-[calc(100vh-220px)]` | 220px is een gok. Alleen `lg:`, dus mobiel niet actief — 🟠. |
| `storefront/HomepageBuilder.tsx:243` | `style={{ height: 'calc(100vh - 200px)' }}` | 200px gok, inline style, geen safe-area. |
| `visual-editor/QuickEditPanel.tsx:149` | `h-[calc(100vh-65px)]` | 65px gok; paneel is `fixed top-0 h-full` (`:133`) zonder `pt-safe`. |
| `admin/help/AIHelpChatWindow.tsx:181` | `h-[500px] max-h-[calc(100vh-8rem)]` | 8rem = 128px; met `bottom-20` (80px) en een 90px nav past dit niet. |

### 4c. 🟠 `min-h-screen` — 26×, laag risico, één systematisch effect

`AdminLayout.tsx:36`, `NativeLandingRedirect.tsx:20`, `ProtectedRoute.tsx:25`,
`Auth.tsx:192,201,242`, `Index.tsx:5`, `NotFound.tsx:13`, `ResetPassword.tsx:14`,
`AcceptInvitation.tsx:49`, `MandateActivation.tsx:216`, `NoAccess.tsx:71`,
`Pricing.tsx:85,105`, `SellqoLegal.tsx:20,30,44`, `TenantAction.tsx:23`, `Landing.tsx:38`,
`PublicPageLayout.tsx:15`, `POSTerminal.tsx:685`, `ShopQRPayment.tsx:49`,
`ShopLayout.tsx:259,267,283,310` 🔒.

Omdat het `min-h` is knipt er niets af. Het merkbare effect zit bij de gecentreerde
varianten (`flex items-center justify-center`): het inlogscherm (`Auth.tsx:242`) centreert
tegen de volledige schermhoogte, dus het formulier staat optisch te laag.

### 4d. `max-h-[NNvh]` in dialogs — bewust géén actie

~55 dialogs gebruiken `max-h-[85vh]`/`[90vh]`. Deze zijn `fixed top-[50%]
translate-y-[-50%]` (`ui/dialog.tsx:39`) en dus gecentreerd; met 90vh blijft 5vh marge
boven en onder. `ui/dialog.tsx:39` en `ui/alert-dialog.tsx:37` staan zelf al op
`max-h-[90dvh]`. **Advies: niet aanraken** — 55 bestanden aanpassen voor een probleem dat
de centrering al opvangt is een slechte ruil.

---

## Sectie 5 — Samenvatting en fix-strategie

### 5a. Telling per categorie

| Categorie | Totaal | 🔴 blocker | 🟠 opruimen | ✅ al goed |
|---|---|---|---|---|
| Fixed/sticky bars & overlays | 32 | **9** (admin-onderbalk-band) + 4 | 11 | 8 |
| z-index-conflicten | 12 waarden | **1** (C1: z-40 < z-50) | 4 | — |
| Externe navigatie | **121** | **8** (winkel) + **12** (betalen) + **9** (OAuth) | 92 | — |
| Viewport-hoogte | 32 + ~55 dialogs | **2** (POSTerminal, Messages) | 4 + 26 | 15 (dvh/svh) |

### 5b. Vier generieke fixes

**FIX-1 — bottom-offset die de safe-area meerekent.** *Dekt 9 van de 9 blockers in §1.*

Het patroon bestaat al in de repo (`ShopLayout.tsx:311`, `CookieBanner.tsx:123`,
`AdminLayout.tsx:46`): `calc(3.5rem+var(--safe-bottom))`. Toepassen op de zes
admin-onderbalken, plus de z-index gelijktrekken zodat de strook klikbaar wordt.
`AdminLayout.tsx:46` moet zijn `pb` daarnaast afleiden van of er een bar actief is, anders
blijft de laatste formulierrij afgedekt.

Op termijn hoort dit in één `AdminBottomBar`-wrapper: de zes identieke klassenstrings zijn
precies het signaal dat er een component ontbreekt.

**FIX-2 — `openExternal()`-helper met `@capacitor/browser`.** *Dekt alle 121 punten,
gefaseerd.* Zie §3e. Rollout in drie golven: (a) winkel + betalen + OAuth (29 plekken,
blockers), (b) track&trace + documenten (16), (c) de rest (~76, mechanisch).

Voorwaarde die vaak vergeten wordt: voor betalen en OAuth is `@capacitor/browser` alléén
niet genoeg. Zonder `@capacitor/app` + een geregistreerd URL-scheme
(`app.sellqo.admin://`) komt de redirect na betalen nergens terug.

**FIX-3 — `100vh` → `100dvh` + safe-area op de full-height shells.** *Dekt §4.* De globale
zoek-vervang (5 plekken) is veilig. De echte fixes zijn puntfixes: `POSTerminal.tsx:911`
naar `h-full` plus `pt-safe` op `:913`, en `Messages.tsx:273` naar `h-full`. De 26
`min-h-screen` blijven staan behalve de gecentreerde auth-schermen.

**FIX-4 — z-index-tokens in `src/index.css`.** *Dekt §2.*

```css
--z-content: 10;  --z-sticky-header: 20;  --z-bottom-bar: 45;
--z-nav: 50;      --z-overlay: 60;        --z-modal: 100;  --z-toast: 200;
```

### 5c. Voorgestelde volgorde

| # | Batch | Inhoud | Waarom hier |
|---|---|---|---|
| **1** | **NATIVE-1 — savebalk** | FIX-1 volledig + de z-index-correctie | De gemelde blocker. Raakt geen gedeeld pad, geen DB, geen edge-functie. Volledig verifieerbaar op Speeltuin/Demo Bakkerij. |
| **2** | **NATIVE-2 — winkel bekijken** | `@capacitor/browser` + `openExternal()` + de storefront-open-plekken + één gedeelde `getStorefrontUrl()` | Blocker 2. Vereist plugin-install + native rebuild ⇒ apart houden zodat batch 1 daar niet op wacht. `ShopLayout.tsx:186-199` niet aanraken. |
| **3** | **NATIVE-3 — betalen & OAuth** | 12 billing- + 9 OAuth-plekken, mét `@capacitor/app` + deep-link-scheme | Grootste bedrijfsimpact én grootste native-risico. Verdient een eigen recon. |
| **4** | **NATIVE-4 — viewport** | FIX-3 | Merkbaar, niet blokkerend. |
| **5** | **NATIVE-5 — rest externe links** | 92 mechanische omzettingen | Hygiëne. |

### 5d. Losse meldingen (geen layout-bugs, wel dode affordances)

- `PreviewPanel.tsx:26,35` verwijst naar `/shop/preview`, een route die niet bestaat.
- "Publiceren" (`useStorefront.ts:203`) laat `storefront_status` op `offline` staan.
- `StorefrontSettings.tsx:110` kopieert een relatieve URL naar het klembord.

### 5e. Wat hier niet vastgesteld kan worden

- Gedrag op echt toestel: geen simulator/toestel in deze omgeving.
- Of de vijf custom frontends ongemoeid blijven: aparte Lovable-projecten (CLAUDE.md §5).
- Native rebuilds (`pod install`, Gradle-sync) lopen via Xcode Cloud / Akke.

---

## Bijlage — native-shell-observaties

| Observatie | Gevolg |
|---|---|
| `@capacitor/app` ontbreekt (bevestigd in `src/native/pushRegistration.ts:122`) | Geen Android-hardwareback-afhandeling, geen deep links, geen `appUrlOpen` voor OAuth/betaal-returns |
| `@capacitor/keyboard` ontbreekt | Geen controle over resize-gedrag; het toetsenbord kan `fixed bottom`-bars over invoervelden duwen — waarschijnlijke bron van "diverse layout-shifts" |
| `@capacitor/status-bar` ontbreekt | Statusbar-stijl volgt de OS-default |
| `capacitor.config.ts` heeft geen `server.allowNavigation` | Correct voor security; bevestigt dat elke absolute externe URL de app verlaat |
| Android `targetSdkVersion = 36` | Edge-to-edge verplicht; alle safe-area-gaten hierboven zijn op Android 15+ direct zichtbaar |

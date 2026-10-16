# Dode knoppen, nepdata en lege functies in de admin — inventaris (ADMIN-DEAD-1, 16 oktober 2026)

Recon read-only op `src/pages/admin`, `src/components/admin` (incl. `sidebar/`, de navigatie) en de
hooks die ze voeden. Een aparte map `src/components/layout` bestaat niet: de navigatie zit in
`src/components/admin/AdminSidebar.tsx`, `AdminMobileBottomNav.tsx` en `sidebar/sidebarConfig.ts`.

Vertrekpunt: APP-CLEAN-1 t/m 5 (12-13 oktober) ruimden al het grootste deel op, en sindsdien bewaakt
`scripts/check-dead-buttons.mjs` in CI knoppen zonder handler. Deze sweep zocht dus vooral wat die
check níet ziet.

Ernst: **misleidend** (toont iets wat niet waar is) > **dood** (doet niets) > **cosmetisch**.

## Hoe er gezocht is

| Scan | Uitkomst |
|---|---|
| `check-dead-buttons.mjs --list` (Button/DropdownMenuItem zonder handler) | 2, beide bekende baseline |
| Lege handlers `() => {}`, `console.log`/toast-only handlers | 1 dode (bol), rest legitieme callbacks |
| Alle letterlijke `/admin/...`-links en `navigate()`-doelen tegen de routes in `App.tsx` | 1 echte (inkooporders), rest geldig |
| Alle `?section=`-parameters tegen de sectie-id's van Settings en Storefront | alle geldig of bewust doorgestuurd |
| `TabsTrigger` zonder `TabsContent` | 0 |
| Selects, inputs, switches zonder `onChange`/`onValueChange`/`onCheckedChange` | 7 (allemaal bol-detail) |
| Permanent `disabled` zonder uitleg | 1 (profiel) + eerlijk gelabelde "Binnenkort"-items |
| `Math.random`, mock/faker/lorem, verzonnen namen/bedragen, nep-trends | 0 nepdata in admin; 1 nep-QR in kassa |
| Instellingen die opgeslagen worden maar door niets gelezen (src + edge functions + live `pg_proc` + `cron.job`) | 4 vertaal-schakelaars, 17TRACK-API-sleutel (retouropties waren al in APP-CLEAN-5) |

## Aantallen

| Categorie | Gevonden | Gefixt | Alleen inventaris |
|---|---|---|---|
| Misleidend | 5 | 2 | 3 |
| Dood | 12 | 3 | 9 |
| Cosmetisch | 5 | 0 | 5 |
| **Totaal** | **22** | **5** | **17** |

## Gefixt in ADMIN-DEAD-1

| # | Bestand:regel (vóór) | Wat de gebruiker zag | Ernst | Fix |
|---|---|---|---|---|
| 1 | `src/pages/admin/TranslationHub.tsx:1043-1101` | 4 schakelaars "Producten/Categorieën/SEO/Marketing automatisch vertalen", standaard aan. Live: 2 rijen in `translation_settings`, beide met minstens één aan. Geen functie, trigger of cron leest de kolommen (grep src + `supabase/functions`, `pg_proc.prosrc`, `cron.job`). | misleidend | Schakelaars weg; eerlijke tekst dat automatisch vertalen nog niet bestaat en hoe je wél vertaalt. Kolommen blijven. |
| 2 | `src/components/admin/pos/POSGiftCardPrint.tsx:90-111` | Gedrukte cadeaubon had een gestreept vlak dat op een QR-code leek, maar niet scanbaar was. | misleidend | Echte QR (`react-qr-code`, al in gebruik bij overschrijving) met de boncode. Printpad kopieert `innerHTML`, dus de SVG komt mee. |
| 3 | `src/hooks/useAIActions.ts:280-282` | AI-voorstel "inkooporder"/"voorraadalarm" → toast "maak de actie zelf aan in het volgende scherm" → `/admin/purchase-orders`, waar "Nieuwe inkooporder" en elke rij een 404 geven. | dood | Doel wordt `/admin/products?stock=low` (filter bestaat sinds APP-CLEAN-2b). |
| 4 | `src/components/admin/settings/AccountSettings.tsx:223-230` | Camera-knop op de profielfoto, altijd uitgeschakeld, zonder uitleg. Uploaden bestaat niet (`AvatarImage src=""`). | dood | Knop en lege `AvatarImage` weg. |
| 5 | `src/pages/admin/TranslationHub.tsx:1032-1039` | Doeltaal-badges met `cursor-pointer`, maar zonder klikactie. | dood | `cursor-pointer` weg. Badges tonen alleen nog. |

## Niet gefixt — voor Akke

### Bol / marketplace (bewust niet aangeraakt: bol is extreem gevoelig)

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 6 | `src/pages/admin/MarketplaceDetail.tsx:730,741` | Tabblad Orders: statusfilter en "Zoek order…" doen niets. | dood | Filter + zoek client-side op de geladen orders, of weghalen. Puur frontend, geen bol-verkeer. |
| 7 | `src/pages/admin/MarketplaceDetail.tsx:880,891` | Tabblad Producten: filter (actief/gepauzeerd/niet gekoppeld) en "Zoek product…" doen niets. | dood | Idem. Let op: de lijst toont alleen sync-aan-producten, dus "gepauzeerd" en "niet gekoppeld" geven altijd leeg. Weghalen is eerlijker. |
| 8 | `src/pages/admin/MarketplaceDetail.tsx:1283,1295,1306` | Tabblad Logs: type-, status- en datumfilter doen niets. | dood | Filteren op de geladen `sync_activity_log`-rijen, of weghalen. |
| 9 | `src/components/admin/marketplace/SyncRulesTab.tsx:180` | "Kopiëren naar koppeling" in de sync-regels: `console.log`, verder niets. | dood | Weghalen, of de bestaande `importRules` op de doelkoppeling toepassen (dan wel een bewuste go: schrijft sync-regels). |
| 10 | `src/components/admin/ads/CampaignCard.tsx:78-80,112-113` | Voortgangstekst bij "push naar bol" ("Campagne aanmaken…", "Producten toevoegen…") wisselt op vaste timers, niet op echte stappen. | cosmetisch | Eén neutrale tekst ("Bezig met versturen naar bol…"). |
| 11 | `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx:456` | Link "Waar vind ik mijn API credentials?" heeft `href="#"`. | dood | Per marketplace een echte help-URL, of weghalen. |
| 12 | `src/components/admin/marketplace/WhatsAppConnectWizard.tsx:156` | "WhatsApp Business verbonden!" na het invullen van alleen een telefoonnummer; er wordt geen API-koppeling gemaakt. | misleidend | Nagaan wat het inbox-WhatsApp-pad (`whatsapp_enabled`, WhatsAppSettings) gebruikt en de wizard daarop afstemmen. Eigen batch. |
| 13 | `src/pages/admin/Marketplaces.tsx:100` | Kaart "Integratie aanvragen" toont alleen een toast "Neem contact met ons op". | cosmetisch | Een `mailto:`/supportlink in de plaats. |

### Verzending / tracking

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 14 | `src/components/admin/settings/TrackingNotificationSettings.tsx:203-245` | Kaart "17TRACK Integratie · Premium" vraagt een 17TRACK API-sleutel. `poll-tracking-status` gebruikt de vlag `auto_poll_17track` alleen als aan/uit en haalt de status rechtstreeks bij de vervoerders (bpost, PostNL…). De sleutel wordt door niets gelezen. | misleidend | Sleutelveld weg en de kaart hernoemen naar "Automatisch trackingstatus ophalen". Raakt alleen tekst, niet de poller; toch apart, want de poller hangt aan `orders.sync_status` (bol, zie TRACK-SHIPPED-1). |

### Inkooporders

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 15 | `src/pages/admin/PurchaseOrders.tsx:74,180,225,249` | "Nieuwe inkooporder", "Eerste inkooporder" en elke rij linken naar routes die niet bestaan (404). | dood | Na fix #3 linkt niets in de UI nog naar deze pagina (alleen een getypte URL). Route laten doorsturen naar `/admin/suppliers`, of de pagina schrappen. Productkeuze. |

### Health-score / statistieken

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 16 | `src/hooks/useShopHealth.ts:159` | `pendingQuotes: 0` vast: de gezondheidsscore waarschuwt nooit voor openstaande offertes. | cosmetisch | Telling op `quotes` met status `sent` (bestaande hook `useQuotes`). |
| 17 | `src/hooks/useShopHealth.ts:125` | `productsWithoutAlt = 0` vast: de SEO-check op alt-teksten slaagt altijd. | cosmetisch | Weghalen uit de score, of `ImageAltTextPanel`-logica hergebruiken. |
| 18 | `src/hooks/useShopHealth.ts:212` | `todayStats.newCustomers: 0` vast; de regel "Nieuwe klanten vandaag" verschijnt daardoor nooit. | cosmetisch | Telling op `customers.created_at` vandaag, of het veld weghalen. |
| 19 | `src/hooks/useEmailCampaigns.ts:221` | `subscriberGrowth: 0` vast; de abonneekaart toont daardoor nooit groei. Geen valse waarde, wel een lege functie. | cosmetisch | Groei uit `customers` met `email_subscribed` en een datum, als die bestaat. |

### Vertaalhub

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 20 | `src/pages/admin/TranslationHub.tsx` (doeltalen) | Doeltalen zijn nergens in te stellen: de badges tonen alleen. Standaard en/de/fr (`useTranslations.ts:315`). | dood | Badges klikbaar maken met de bestaande `saveSettings` (minstens één taal verplicht). Kleine feature, dus apart. |
| 21 | `src/pages/admin/TranslationHub.tsx:325` | Knop "Bulk Vertalen" en verschillende toasts zijn hardgecodeerd Nederlands. | cosmetisch (i18n) | Meenemen in een i18n-pass. |

### Webshop-overzicht

| # | Bestand:regel | Wat de gebruiker ziet | Ernst | Voorstel |
|---|---|---|---|---|
| 22 | `src/pages/admin/Storefront.tsx:104` | Tegel "Eigen domein — Binnenkort", terwijl Instellingen → Domein al domeinen laat toevoegen en verifiëren. Bewust (de storefront-worker serveert alleen `*.sellqo.shop`), maar de tekst is hardgecodeerd NL. | dood (eerlijk gelabeld) | Laten staan; i18n meenemen. Voor custom-frontendwinkels naar `?section=domain` linken. |

## Gecontroleerd en in orde (geen actie)

- Zijbalk, mobiele onderbalk en platformmenu: elke `url` bestaat als route.
- "Binnenkort"-badges bij Amazon/Google/Meta-ads, sociale kanalen en marketplaces: eerlijk gelabeld, beslissing Akke (APP-CLEAN-2d).
- Uitgeschakelde retouropties: hebben al een uitlegregel (APP-CLEAN-5).
- AI-assistentinstellingen: elke sleutel wordt gelezen door `ReplyComposer` of een edge function.
- Creditpakketten in `CreditPurchaseDialog`: prijzen kloppen met `create-ai-credits-checkout`, kortingspercentages kloppen (10/20/30 %).
- `SyncTestModeDialog`: voorbeeldrecords komen echt uit `test-sync-rules`.

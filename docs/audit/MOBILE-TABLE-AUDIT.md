# Mobiele tabel-audit — welke admin-tabellen hebben écht een kaartweergave nodig

Read-only inventarisatie, 9 september 2026. Geen code gewijzigd.

Aanleiding: na de tenant-lijst (`a287dd8`) is de vraag welke van de resterende
admin-tabellen dezelfde behandeling verdienen. Niet allemaal. Een read-only
rapporttabel leest prima als tabel, en horizontaal scrollen is daar een normale
interactie in plaats van een noodgreep.

Referentiepatroon: `useIsMobile()` uit `src/hooks/use-mobile.tsx`, dan
`isMobile ? <kaartlijst> : <Table>`. Toegepast in Orders, Products, Customers en
Tenants.

---

## 0. Drie correcties op de aanname

**Het zijn er 25, niet 24.** De onderzochte lijst telt 25 bestanden.

**`PlatformBlog` heeft al een mobiele kaartweergave.** Niet via `useIsMobile`,
maar via CSS: de tabel staat op `hidden md:block` en daaronder zit een
`md:hidden`-kaartblok dat dezelfde `rowActions(post)` hergebruikt
(`src/pages/platform/PlatformBlog.tsx:268`). Een zoektocht op alleen `useIsMobile`
mist dit tweede patroon. Alle 25 bestanden zijn daarom op **beide** patronen
gescand; `PlatformBlog` is de enige met de CSS-variant.

**`GiftCardDetail.tsx` is dood.** 326 regels, geen route in `App.tsx`, en geen
enkele verwijzing elders in `src/`. De pagina is onbereikbaar. Er is dus geen
reden een batch aan te besteden; of hij opgeruimd wordt is een losse beslissing.

**Netto in scope: 23 pagina's.**

---

## 1. Meetmethode

Per bestand geteld:

- aantal `<TableHead>` per `<Table>`-blok;
- de hoogste `min-w-[…px]` in het bestand;
- welke interactieve elementen binnen `<TableBody>` staan;
- route uit `App.tsx`, en of die route in `sidebarConfig.ts` staat.

Die derde meting ging de eerste keer mis: een regex op `<TableBody>` matcht niet
op `<TableBody className=…>`, waardoor `PendingPlatformPayments`, `AdsProductMap`,
`AdsBolcomSearchTerms` en `PlatformBlog` ten onrechte als read-only werden
geteld. De cijfers hieronder komen uit een regelgebaseerde hertelling.

Twee factoren wegen zwaarder dan kolombreedte alleen:

**Acties aan de rechterrand.** Dat is wat werkelijk klemt. Een tabel die je moet
scrollen om te *lezen* is hinderlijk; een tabel die je moet scrollen om een knop
te *bereiken* is stuk. Een klikbare rij is iets anders — die tap je overal, dus
`AdsBolcom` weegt lichter dan zijn 900 px doet vermoeden.

**Wie de pagina ziet.** Vijf pagina's zitten achter `requirePlatformAdmin` en
worden alleen door platformbeheerders bekeken, vrijwel altijd op desktop. Die
wegen lichter dan een tenant met een telefoon in de hand.

---

## 2. De inventaris

| Pagina | Route | In nav | Kol | min-w | Acties per rij | Type | Cat |
|---|---|---|---|---|---|---|---|
| Subscriptions | `orders/subscriptions` | ✓ | 8 | 820 | menu | hoofdlijst | ✅ |
| BogoPromotions | `promotions/bogo` | ✓ | 8 | 650 | menu + switch | hoofdlijst | ✅ |
| GiftCards | `promotions/gift-cards` | ✓ | 7 | 650 | menu | hoofdlijst | ✅ |
| TranslationHub | `marketing/translations` | ✓ | 5 | – | 2 knop + checkbox + link | hoofdlijst | ✅ |
| AdsProductMap | `ads/products` | ✓ | 6 | – | knop + switch | hoofdlijst | ✅ |
| Billing | `billing` | ✓ | 5 | – | 2 knop | hoofdlijst | ✅ |
| StackingRules | `promotions/stacking` | – | 7 | 650 | menu + switch | sublijst | 🟡 |
| MarketplaceDetail | `connect/:connectionId` | – | 6 | 640 | menu + 3 knop | detail | 🟡 |
| AdsBolcomCampaignDetail | `ads/bolcom/campaigns/:id` | – | 9 | 800 | switch | detail | 🟡 |
| AdsBolcom | `ads/bolcom` | ✓ | 5 | 900 | rij klikbaar | hoofdlijst | 🟡 |
| Payments | `payments` | ✓ | 6 | – | geen | hoofdlijst | 🟡 |
| CustomerDetail | `customers/:customerId` | – | 5 | – | knop + link | detail | 🟡 |
| PlatformBilling | `platform/billing` | ✓ | 6 | 640 | 4 knop | platform | 🟡 |
| PlatformCoupons | `platform/coupons` | ✓ | 7 | 640 | menu | platform | 🟡 |
| PendingPlatformPayments | `platform/payments` | – | 7 | 700 | 2 knop | platform | 🟡 |
| ChannelFieldMappingAdmin | `platform/field-mappings` | – | 6 | 640 | 2 knop | platform | 🟡 |
| StockReport | `reports/stock` | ✓ | 9 | – | geen | rapport | 🟢 |
| OrderDetail | `orders/:id` | – | 4 | 640 | geen | subtabel | 🟢 |
| QuoteDetail | `orders/quotes/:id` | – | 5 | 550 | geen | subtabel | 🟢 |
| CampaignDetail | `marketing/campaigns/:id` | – | 6 | 650 | geen | subtabel | 🟢 |
| LoyaltyPrograms | `promotions/loyalty` | ✓ | 4 | 640 | geen | hoofdlijst | 🟢 |
| AdsBolcomKeywords | `ads/bolcom/keywords` | – | 5 | 200 | checkbox | sublijst | 🟢 |
| AdsBolcomSearchTerms | `ads/bolcom/search-terms` | – | 2 | 200 | 2 knop | sublijst | 🟢 |

Buiten de telling: `PlatformBlog` (heeft al kaarten) en `GiftCardDetail` (dood).

Legenda: 🔴 kaart nodig, klemt nu — 🟡 kaart nuttig, niet urgent — 🟢 laten staan — ✅ gedaan.

---

## 3. Prioriteit en batches

Gesorteerd op wie de pagina hoe vaak ziet: tenant-hoofdlijsten eerst,
platformschermen laatst.

> **Stand per 9 september 2026 — batch M1 afgerond.**
> `Subscriptions` bleek al een kaartweergave te hebben via het `xl`-breekpunt
> (`Subscriptions.tsx:260`, `xl:hidden`); deze audit scande alleen op
> `useIsMobile` en op `md:`-breekpunten en miste hem daardoor. `BogoPromotions`
> en `GiftCards` zijn gedaan in `b876eb7` en `867298f`.
>
> **Aanvulling, 9 september 2026 — batch M2 afgerond.** Daarmee is er geen 🔴
> meer over; wat rest zijn de 🟡's van batch M3.

### Batch M1 — promoties en abonnementen

`Subscriptions`, `BogoPromotions`, `GiftCards`

Drie hoofdlijsten met een drie-puntjesmenu aan de rechterrand — letterlijk
hetzelfde geval als de tenant-lijst. Het patroon ligt er al, inclusief de
`renderActions()`-aanpak die voorkomt dat mobiel en desktop uit elkaar lopen.
De goedkoopste drie, en meteen de ergste: `Subscriptions` is met `min-w-[820px]`
de breedste hoofdlijst met een menu.

### Batch M2 — de eigenaardige drie

`TranslationHub`, `AdsProductMap`, `Billing`

Geen van drieën heeft een drie-puntjesmenu, en elk vraagt daardoor een eigen
kaartindeling:

- **TranslationHub** — bulkselectie met een selecteer-alles-checkbox in de kop.
  De kaart moet die selectie behouden, zoals de productkaart doet.
- **AdsProductMap** — een switch én een opslaan-knop per rij. Twee bedieningen
  naast elkaar in een kaart is een ontwerpkeuze, geen kopieerwerk.
- **Billing** — twee downloadknoppen per factuurregel.

Deze batch kost meer denkwerk per pagina; splits hem gerust in tweeën.

> **Uitkomst, 9 september 2026 — alle drie ✅, alle drie als kaart.**
>
> Sinds deze audit bestaat er een tweede uitweg: `ScrollHint`
> (`src/components/ui/scroll-hint.tsx`) laat een tabel scrollen mét een
> zichtbare hint. Per pagina is afgewogen of dat beter was dan een kaart. Het
> antwoord was drie keer nee, maar niet om dezelfde reden.
>
> Eerst de meting op 375 px met de echte componenten en de volledige
> paddingketen (`main` > `div p-4`). De tabellen scrollen wel degelijk: sinds
> `table.tsx` een eigen `overflow-x-auto`-wrapper heeft, meet je 0 px overflow
> als je de `CardContent` meet in plaats van die wrapper.
>
> | Pagina | Tabel | Zichtbaar | Verborgen | Rijhoogte |
> |---|---|---|---|---|
> | `TranslationHub` | 628 px | 341 | 287 px | 159 px (3× normaal) |
> | `AdsProductMap` | 657 px | 293 | 364 px | 73–93 px |
> | `Billing` facturen | 434 px | 341 | 93 px | 93 px |
> | `Billing` creditnota's | 425 px | 341 | 84 px | 93 px |
>
> - **TranslationHub** 📇 — bulkselectie met een actie per rij; precies het
>   Products/GiftCards-geval. De selecteer-alles zat in de tabelkop en is op
>   mobiel een balk boven de lijst geworden, met dezelfde `setSelectedIds`.
> - **AdsProductMap** 📇 — het enige echte grensgeval, en bewust besloten. Je
>   *typt* hier waarden in; met een scrollende tabel verdwijnt de productnaam
>   uit beeld precies terwijl je de min-voorraad invult. Kaart wint van
>   `ScrollHint` omdat naam, voorraad, schakelaar en veld samen zichtbaar
>   blijven.
> - **Billing** 📇 — korte regels met één downloadknop, het archetype van een
>   kaartlijst. De `Tooltip` om die knop is in de kaart een zichtbaar label
>   geworden: op touch opent een tooltip nooit.
>
> **Correctie op dit rapport.** `Billing` heeft geen "twee downloadknoppen per
> factuurregel" maar **twee tabellen** — facturen en creditnota's — met elk één
> downloadknop per rij. Beide zijn omgezet.
>
> Na de omzetting valt geen bediening meer buiten beeld: de rechterrand van de
> buitenste knop, schakelaar of veld ligt op 329 (TranslationHub), 321
> (AdsProductMap) en 345 px (Billing), tegen een viewport van 375. De
> desktoptabellen zijn letterlijk onaangeroerd — de diff bevat nul verwijderde
> regels.

### Batch M3 — de 🟡's, pas als M1 en M2 landen

Eerst de tenant-kant (`StackingRules`, `MarketplaceDetail`,
`AdsBolcomCampaignDetail`), daarna pas platform (`PlatformBilling`,
`PlatformCoupons`, `PendingPlatformPayments`, `ChannelFieldMappingAdmin`).
`AdsBolcom`, `Payments` en `CustomerDetail` staan onderaan: geen van drieën heeft
een actie die buiten beeld valt.

---

## 4. De 🟢's — bewust met rust laten

Deze zeven kosten tijd zonder iets op te lossen.

**StockReport** (9 kolommen). Een voorraadrapport met kostprijs, voorraadwaarde,
verkoopprijs en verkoopwaarde lees je juist in kolommen naast elkaar — dat is de
functie van het scherm. Een kaart per SKU maakt vergelijken tussen producten
moeilijker, niet makkelijker. Horizontaal scrollen is hier het verwachte gedrag,
zoals in een spreadsheet.

**OrderDetail, QuoteDetail, CampaignDetail.** Orderregels, offerteregels en
campagnestatistieken: read-only subtabellen binnen een detailpagina, zonder
acties. Er valt niets te bereiken, dus er klemt niets. De omliggende pagina is
belangrijker dan de tabel erin.

**LoyaltyPrograms** (4 kolommen, geen acties). Past binnen 375 px.

**AdsBolcomKeywords en AdsBolcomSearchTerms.** `min-w` van 200 px met twee tot
vijf kolommen — smal genoeg. AdsBolcomSearchTerms heeft wel twee knoppen per rij,
maar bij twee kolommen vallen die niet buiten beeld.

---

## 5. Wat dit rapport niet doet

De categorieën komen uit gemeten structuur — kolomtelling, `min-w`, interactieve
elementen binnen `<TableBody>`, route en navigatie — niet uit een gerenderde
meting per pagina. Dat laatste vereist voor alle 23 echte data en voor vijf
ervan een ingelogde platformbeheerder, en dat kan hier niet.

Wijkt een categorie af van wat op een toestel te zien is, dan wint het toestel.

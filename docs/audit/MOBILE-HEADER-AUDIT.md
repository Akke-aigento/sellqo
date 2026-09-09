# Mobiele header-audit — welke page-header actieknoppen klemmen

Read-only inventarisatie, 9 september 2026. Geen code gewijzigd.

Aanleiding: op mobiel lijken page-headers stuk te gaan — de titel wordt geplet en
in sommige gevallen verdwijnt de actieknop. Dit rapport zoekt uit waardoor dat
komt, welke pagina's het treft, en welke voorkomens juist met rust moeten blijven.

Het goede patroon staat in `Products.tsx:426`:
`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between` — stapelt op
mobiel, rij op desktop.

---

## 0. Twee correcties op de aanname

### `justify-between` is niet de oorzaak

De oorzaak zit in twee eigenschappen die elkaar versterken:

1. Een titelblok in een flexrij heeft `min-width: auto` en kan daardoor **niet
   krimpen onder zijn langste woord**.
2. `Button` heeft `whitespace-nowrap` (`src/components/ui/button.tsx:8`) en wordt
   dus nooit smaller dan zijn label.

Zodra *langste woord + knopbreedte* niet meer in de rij past, loopt de rij over.
En omdat `<main>` op `overflow-x-hidden` staat (`AdminLayout.tsx:46`) wordt dat
niet scrollbaar maar **geclipt**: de knop is dan onbereikbaar.

Gemeten op 375 px met de echte klassenketens en de gebouwde CSS:

| Vorm | Titelkolom (van 343 px) | Knop |
|---|---|---|
| terugknop + `flex-1` titel + knop | **143 px** | past |
| `flex items-center justify-between` | 200 px | past |
| idem met `flex-wrap` | 200 px, breekt netjes af | past |
| `flex-col sm:flex-row` (goed) | 343 px | past |

Onder de overloopdrempel is de schade dus cosmetisch — een titel die tot een
reepje geplet wordt en over meerdere regels breekt. Erboven verdwijnt de knop
echt. Met een lang, onbreekbaar woord in de titel:

```
lang woord + "Exporteren naar CSV"       knop op 625  => 250px BUITEN BEELD
justify-between + "+ Nieuwe herinnering" knop op 451  =>  76px BUITEN BEELD
```

**Wat dit betekent voor de zoekterm.** `flex items-center justify-between` geeft
65 treffers in de onderzochte bestanden, waarvan er **8 een page-header** zijn en
57 onschuldige inline-rijen. Belangrijker: die term **mist 14 kapotte headers**
die `flex items-center gap-N` gebruiken. Een detector op "een `<h1>` en een
tekstknop in een rij zonder `flex-col`" vindt ze wel; die is over heel
`src/pages` gedraaid en levert 22 kandidaten in admin/platform.

### Storefront is niet kapot

`StudioHeader.tsx:87` gebruikt **al** het goede patroon:
`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`. Gemeten op
375 px staat "Opnieuw publiceren" op rechterrand 305 en de hele knoppenrij op
334 — ruim binnen beeld. De binnenste knoppenrij heeft `shrink-0`, wat een risico
blijft bij langere labels, maar in het Nederlands past het.

`BogoPromotions.tsx` en `Storefront.tsx` hebben allebei **nul** voorkomens van
`flex items-center justify-between`.

---

## 1. Gemeten met de echte teksten

Per kandidaat de werkelijke `h1` en het werkelijke knoplabel uit `nl.json`,
gerenderd op 375 px in de vorm die het bestand zelf gebruikt:

| Pagina | Titelkolom | Uitkomst |
|---|---|---|
| `admin/LoyaltyPrograms.tsx:76` | 270 px | knop op **508 — 133 px buiten beeld** 🔴 |
| `admin/BogoPromotions.tsx:132` | 110 px | titel over 2 regels, geplet 🔴 |
| `admin/POSTerminalSettings.tsx:157` | 164 px | titel over 2 regels 🔴 |
| `platform/PlatformChangelog.tsx:123` | 169 px | titel over 2 regels 🔴 |
| `admin/StackingRules.tsx:99` | 150 px | past, maar broos 🟡 |
| `admin/reports/StockReport.tsx:187` | 188 px | past, maar broos 🟡 |
| `platform/PlatformCoupons.tsx:112` | 208 px | past, maar broos 🟡 |
| `platform/PlatformHealth.tsx:120` | 177 px | past, maar broos 🟡 |
| `platform/PlatformSupport.tsx:133` | 163 px | past, maar broos 🟡 |

`LoyaltyPrograms` breekt onvoorwaardelijk: "Loyaliteitsprogramma's" is één woord
van 270 px dat niet kan afbreken, en er staat "Nieuw Programma" naast.

### Dertien pagina's met een dynamische titel

Deze tonen een ordernummer, klantnaam, campagnenaam of marketplace-naam in de
`h1`. De titellengte is daar onbegrensd, dus de vraag is niet óf het past maar
wannéér het misgaat:

`OrderDetail`, `QuoteDetail`, `QuoteForm`, `ReturnDetail`, `CustomerDetail`,
`CampaignDetail`, `MarketplaceDetail`, `GiftCardDetail`, `GiftCardDesigns`,
`AdsBolcomCampaignDetail`, `POSTerminal`, `SyncConflicts`, `AdsBolcom`.

Vier ervan — `OrderDetail:142`, `QuoteDetail:123`, `ReturnDetail:200` en
`CustomerDetail:196` — hebben `flex-wrap` en degraderen netjes: de knop zakt naar
de volgende regel in plaats van uit beeld te lopen. De overige negen niet.

### Buiten scope

`storefront/ShopOrderConfirmation.tsx:112` valt onder de eerste wet
(custom-frontend tenants) en blijft ongemoeid.

---

## 2. Prioriteit en batches

De fix is per geval `flex flex-col gap-4 sm:flex-row sm:items-center
sm:justify-between`, of — waar een terugknop naast het titelblok staat — een
`min-w-0` op dat titelblok zodat het wél kan krimpen. Welke van de twee, hangt af
van of de terugknop op mobiel naast de titel hoort te blijven staan.

**Batch H1 — bewezen kapot, tenant-zichtbaar** (5) — ✅ gedaan
`LoyaltyPrograms`, `BogoPromotions`, `StackingRules`, `POSTerminalSettings`,
`GiftCardDesigns`.

> **Correctie, 9 september 2026.** `StockReport` stond hier eerst ook in, in
> tegenspraak met de tabel in §1 die hem op 🟡 zet. De tabel had gelijk: zijn rij
> is `flex flex-wrap items-start justify-between` met een `flex flex-wrap`
> knopgroep, en die wrapt netjes — gemeten op 375, 360 en 320 px staat de laatste
> knop op rechterrand 234 en zakt de rij naar een tweede regel. Hij hoort dus
> niet in H1 en is niet aangepast.
>
> Ook nagemeten: `StudioHeader.tsx:87` (Storefront) is op geen enkele breedte tot
> 320 px kapot — "Bekijk winkel" (104 px) en "Opnieuw publiceren" (148 px) houden
> hun breedte en clippen niet.

**Batch H2 — dynamische titel zonder `flex-wrap`** (7)
`MarketplaceDetail`, `GiftCardDetail`, `CampaignDetail`, `QuoteForm`,
`POSTerminal`, `SyncConflicts`, `AdsBolcomCampaignDetail`.

**Batch H3 — dynamische titel mét `flex-wrap`, plus platform** (9)
`OrderDetail`, `QuoteDetail`, `ReturnDetail`, `CustomerDetail`,
`PlatformChangelog`, `PlatformCoupons`, `PlatformHealth`, `PlatformSupport`,
`PlatformLegal`.
De eerste vier degraderen al netjes; de platformpagina's worden vrijwel alleen op
desktop bekeken.

---

## 3. De 57 inline-rijen — bewust overslaan

De overige `justify-between`-treffers zijn geen headers maar inline-rijen binnen
een kaart: een label links, een waarde of klein icoon rechts. Die horen naast
elkaar te staan; `flex-col` zou ze juist slechter maken. Geen van deze blokken
bevat een `<h1>`.

Verdeling: `MarketplaceDetail` 9×, `POSTerminal` 6×, `POSTerminalSettings` 5×,
`AIActionCenter` 4×, `QuoteDetail` 3×, `ReturnDetail` 3×, `PlatformLegal` 3×,
`Ads` 2×, `PlatformBilling` 2×, en 1× in elk van: `AdsAiRules`, `Marketplaces`,
`QuoteForm`, `Orders`, `CreditNotes`, `OrderDetail`, `EventDashboard`,
`AIMarketingHub`, `Returns`, `CampaignDetail`, `TicketCheckin`, `CustomerDetail`,
`Quotes`, `SyncConflicts`, `EventDetail`, `Customers`, `SEODashboard`,
`PlatformHealth`, `PlatformCoupons`, `PlatformDashboard`.

---

## 4. Wat dit rapport niet doet

De metingen gebruiken de Nederlandse strings. Andere talen kunnen langer zijn en
een "past" alsnog omslaan — de labels die zijn nagekeken verschilden nauwelijks
per taal, maar dat is geen garantie voor de rest. De dynamische titels zijn per
definitie niet vooraf te meten; die staan hier als risico, niet als bevestigde
bug.

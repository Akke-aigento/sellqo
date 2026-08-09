# Newsletter-wachtrij — tenant-zichtbare fixes en features

Items die in de eerstvolgende SellQo-newsletter naar tenants meegenomen worden. Zodra een item verstuurd is: verplaats naar de "Verzonden" sectie met datum.

## Openstaand

### 2026.09g + 2026.09h — Printful print-on-demand koppeling (feature, 09-08-2026)

> **Bundeling:** dit item dekt POD-1a (verbinding) én POD-1b (bestellingen doorsturen).
> Niet apart versturen — één gezamenlijk Printful-bericht in de eerstvolgende newsletter.

**Printful print-on-demand koppeling (beta)** (september 2026)
SellQo Connect heeft een vierde tabblad: Fulfilment. Daar verbind je je Printful-winkel
met een private token, zodat je producten op aanvraag kunt laten printen en verzenden —
geen voorraad, geen inpakken.
Wat betekent dit voor jou? In deze bètafase leg je de verbinding en de koppeling tussen
je varianten en je Printful-varianten. Het automatisch doorsturen van bestellingen naar
Printful volgt in een volgende release; de schakelaars daarvoor staan al klaar en blijven
tot dan uit. Je vindt het bij SellQo Connect → Fulfilment.

**Bestellingen doorsturen naar Printful** (september 2026)
Aanvulling op bovenstaande: je koppelt nu je varianten aan Printful-producten en stuurt
een bestelling met één klik door. Op de orderpagina zie je de status — concept bij
Printful, bevestigd of mislukt — met een knop om het opnieuw te proberen. Cadeaukaarten
worden nooit doorgestuurd, en ontbreekt er een variant-koppeling of een adresveld, dan
vertelt SellQo precies wat er mist voordat er iets verstuurd wordt.

**i18n-keys.** `public.changelog.changes.printful_pod`, `public.changelog.changes.printful_order_forwarding` — NL/EN/FR/DE aanwezig.

### 2026.09d — Verbeterde meldingen-instellingen in de app (improvement, 07-08-2026)

**Verbeterde meldingen-instellingen in de app** (september 2026)
Staan meldingen op je telefoon uit? Dan zag je dat nergens — je miste stil nieuwe
bestellingen. De app toont dit nu bovenaan, met het exacte pad om ze weer aan te zetten
(iPhone: Instellingen → Meldingen → SellQo; Android: Instellingen → Apps → SellQo →
Meldingen).
Wat betekent dit voor jou? Weigerde je de melding-vraag ooit, dan vraagt je telefoon dat
nooit meer opnieuw. Deze balk is je herstelpad. Welke gebeurtenissen een melding sturen,
regel je zoals altijd via Instellingen → Meldingen.

**i18n-keys.** `public.changelog.changes.app_notification_settings` — NL/EN/FR/DE aanwezig.

### 2026.08e — Verzendklassen instelbaar met voorrangsregel (feature, 02-08-2026)

**Verzendklassen instelbaar met voorrangsregel** (augustus 2026)
Verzendklassen waren een vrij tekstveld dat je op twee plekken foutloos moest intikken.
Nu maak je ze aan bij Instellingen → Verzending, zie je per klasse hoeveel producten en
verzendmethodes eraan hangen, en koppel je producten in één doorzoekbaar overzicht. Bij
een verzendmethode kies je de klasse uit een lijst in plaats van te typen.
Wat betekent dit voor jou? Geen stille typefouten meer, en bij een bestelling met
verschillende verzendklassen bepaal je zelf de regel: de duurste levering geldt voor de
hele bestelling (aanbevolen), of de kosten worden opgeteld. Voorheen kon de klant in zo'n
gemengde bestelling de goedkoopste methode kiezen en draaide jij op voor de rest.

**i18n-keys.** `public.changelog.changes.shipping_classes_entity` — NL/EN/FR/DE aanwezig.

### 2026.08d — Verzendkosten al zichtbaar in het winkelmandje (improvement, 02-08-2026)

**Verzendkosten al zichtbaar in het winkelmandje** (augustus 2026)
Is er voor de inhoud van het mandje maar één verzendmethode mogelijk, dan toont de
checkout die prijs nu al in het overzicht — nog voor de klant een adres invult. Voorheen
stond daar "wordt berekend", ook wanneer de prijs feitelijk al vastlag.
Wat betekent dit voor jou? Klanten zien een toeslag (bv. €100 levering en montage) of
gratis verzending meteen, en haken minder snel af in de laatste stap. Zijn er meerdere
verzendmethodes mogelijk, dan blijft het "wordt berekend" tot de klant kiest. Je hoeft
hiervoor niets in te stellen.

**i18n-keys.** `public.changelog.changes.shipping_cost_preview` — NL/EN/FR/DE aanwezig.

### 2026.08c — Meerdere foto's per variant (feature, 02-08-2026)

**Meerdere foto's per variant** (augustus 2026)
Een variant kan nu een eigen fotogalerij dragen. Naast de hoofdfoto voeg je extra
beelden toe per kleur of uitvoering — bijvoorbeeld een detailfoto van het hoofdbord
naast het volledige bed. Je kiest ze uit je fotobibliotheek en bepaalt zelf de volgorde.
Wat betekent dit voor jou? Klanten zien enkel de beelden van de combinatie die ze
gekozen hebben, niet alle uitvoeringen door elkaar. Je regelt het via
Producten → een product → Varianten → Extra foto's.

**i18n-keys.** `public.changelog.changes.variant_photo_gallery` — NL/EN/FR/DE aanwezig.

### 2026.07ak — Kortingscodes per teamlid vrijgeven (feature, 31-07-2026)

**Kortingscodes per teamlid vrijgeven** (juli 2026)
Een kortingscode van 100% is direct geld. Daarom is "kortingscodes beheren" nu geen
onderdeel meer van de marketingrol als geheel, maar een recht dat je per persoon
toekent. Beheerders zien in de ledenlijst bij elk lid met de marketingrol een
schakelaar "Mag kortingscodes beheren".
Wat betekent dit voor jou? Werk je met een externe marketier? Dan bepaal je zelf of
die persoon codes mag aanmaken en wijzigen. Beheerders en medewerkers houden dit
recht onvoorwaardelijk. Je regelt het via Instellingen → Teamleden.

**i18n-keys.** `public.changelog.changes.per_user_discount_rights` — NL/EN/FR/DE aanwezig.

### 2026.07ad — Verzendklassen (feature, 25-07-2026)

**Slimmer keuzemenu bij verzenden** (juli 2026)
Producten kunnen nu een verzendklasse dragen. Verzendmethodes met dezelfde klasse verschijnen enkel wanneer zo'n product in het winkelmandje zit; universele methodes vallen dan weg uit de keuze. Zo krijgt een klant met een boxspring geen "Gratis verzending" meer aangeboden, en een klant met alleen een matras geen speciale leveringsoptie van €100.
Wat betekent dit voor jou? Je stelt per verzendmethode én per product een klasse in (bv. `boxspring`). SellQo filtert de checkout automatisch. Servers valideren dit ook aan hun kant, dus verkeerde combinaties zijn niet meer via een omweg af te dwingen.
[Beschikbaar vanaf Starter]

**i18n-keys.** `public.changelog.changes.shipping_classes` — NL/EN/FR/DE aanwezig.

### 2026.07z — Hulpassistent gratis op elk abonnement (17-07-2026)

**Hulpassistent gratis op elk abonnement** (juli 2026)
De AI-hulpassistent staat nu open voor elk abonnement — ook Free — zonder credits te verbruiken. De assistent kent bovendien de features van jouw plan en geeft gerichter advies wanneer een upgrade zin heeft.
Wat betekent dit voor jou? Vragen stellen over SellQo mag altijd, ongeacht welk plan je gebruikt.

**i18n-keys.** `public.changelog.changes.help_assistant_free` — NL/EN/FR/DE aanwezig.

### 2026.07x — Formulieren blijven staan bij tab-wissel (bugfix, 17-07-2026)

**Voor tenants merkbaar.** Wie een instellingsscherm invulde, kort naar een ander tabblad switchte en terugkwam, verloor soms de ingevulde waarden en werd teruggestuurd naar de parent-pagina. Achterliggend gaf de sessie-refresh een volledige "her-authenticatie" af waardoor de route-guard de subtree unmountte.

**Fix.** De sessie ververst nu stil op de achtergrond: verse access-token wordt overgenomen zonder user-object of rollen opnieuw te laden. Formulieren blijven bewaard, geen tussentijdse spinner, geen ongewenste navigatie. Volledige login (hard refresh, deep-link, uitloggen) werkt onveranderd.

**i18n-keys.** `public.changelog.changes.auth_refresh_fix` — NL/EN/FR/DE aanwezig.

## Verzonden

_(nog leeg)_

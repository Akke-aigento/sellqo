# Newsletter-wachtrij — tenant-zichtbare fixes en features

Items die in de eerstvolgende SellQo-newsletter naar tenants meegenomen worden. Zodra een item verstuurd is: verplaats naar de "Verzonden" sectie met datum.

## Openstaand

### 2026.10o — Geen dubbele check-ins, en scannen staat bij Events (bugfix, 20-08-2026)

**Geen dubbele check-ins meer aan de deur** (oktober 2026)
Bleef een ticket-QR voor de camera hangen, dan kon dezelfde bezoeker soms een tweede keer worden
ingecheckt. Dat gebeurt niet meer: na een scan wacht de scanner vier seconden voordat hij dezelfde
code opnieuw verwerkt. Ticket check-in staat nu in het menu onder Events, samen met Alle events.
En op het tabblad Instellingen van een event blijven je wijzigingen staan als je even naar een
ander tabblad kijkt; opslaan kan alleen wanneer je echt iets hebt aangepast.
Wat betekent dit voor jou? Je scan-log en de teller Nu binnen kloppen weer met wat er echt aan de
deur gebeurt, en je verliest geen ingevulde eventinstellingen meer door tussendoor te kijken.

**i18n-key.** `public.changelog.changes.event_checkin_double_scan_and_menu` — KLAARZETTEN, nog
niet verstuurd.

**Bundel:** hoort bij de event-reeks 2026.10i t/m 2026.10o. Bundelen met de nog niet verstuurde
event-items hieronder; niet los versturen.

### 2026.10m — Kortingscodes niet meer hoofdlettergevoelig (bugfix, 19-08-2026)

**Hoofdletters in kortingscodes maken niet meer uit** (oktober 2026)
Typt een klant "welkom10" terwijl jouw code "WELKOM10" heet, dan wordt hij nu gewoon geaccepteerd.
Hoofdletters, kleine letters en extra spaties maken geen verschil meer. In je webshop en op je
facturen blijft de code staan zoals jij hem hebt aangemaakt.
Wat betekent dit voor jou? Minder klanten die afhaken bij het inwisselen van een code.
i18n-key: `public.changelog.changes.discount_code_case_insensitive`

### 2026.10l — Event bewerken op één plek + live bezetting (feature, 19-08-2026)

**Je event bewerk je nu op de eventpagina** (oktober 2026)
Datum, tijd, status, locatie en capaciteit pas je aan in het nieuwe tabblad Instellingen op de
eventpagina. Capaciteit mag ook ongelimiteerd zijn, en de teller Nu binnen loopt live mee terwijl
er aan de deur gescand wordt.
Wat betekent dit voor jou? Eén plek voor alles rond een event, met een bevestiging voordat je een
event uit je webshop haalt of de capaciteit onder het aantal verkochte tickets zet.

**i18n-keys.** `public.changelog.changes.event_core_fields_and_live_counter` — KLAARZETTEN, nog
niet verstuurd.

**Bundel:** hiermee is fase 4 van het event-systeem compleet (2026.10i t/m 2026.10l). De bundel
is klaar om te versturen na bevestiging van Akke.

### 2026.10k — Deurtoegangen en scan-QR's per event (feature, 19-08-2026)

**Geef elke vrijwilliger zijn eigen scan-link** (oktober 2026)
Op de eventpagina staat een nieuw tabblad Toegangen. Daar maak je per deur of vrijwilliger een
eigen scan-toegang aan, met een zone, een richting (in, uit of beide), een scanmodus en
optioneel een beperking tot bepaalde tickettypes en een vervaldatum. Je krijgt meteen een
QR-code en een link die je doorstuurt naar de persoon aan de deur. In de lijst zie je hoe
vaak elke toegang gebruikt is en wanneer voor het laatst.
Wat betekent dit voor jou? Je hoeft niemand je eigen inloggegevens te geven: elke toegang
heeft een eigen code die je met één klik intrekt, waarna scannen met die code onmiddellijk
stopt. De ingetrokken toegang blijft in de lijst staan, zodat je later nog ziet wie wat
gescand heeft. Een toegang die nog nooit gebruikt is kun je definitief verwijderen.

**i18n-keys.** `public.changelog.changes.event_scanner_access_management` — KLAARZETTEN, nog
niet verstuurd.

### 2026.10j — Tickettypes beheren op de eventpagina (feature, 19-08-2026)

**Je stelt je tickettypes nu zelf in** (oktober 2026)
Op de eventpagina staat een nieuw tabblad Tickettypes. Daar maak je tickettypes aan,
bewerk je ze en zet je ze aan of uit. Per tickettype koppel je een ticketproduct — daaruit
komen de naam en de prijs — en stel je een sub-capaciteit, een verkoopvenster met start- en
einddatum, het heringang-beleid en de sorteervolgorde in. In de lijst zie je meteen hoeveel
tickets per type verkocht zijn en hoeveel plaatsen er nog vrij zijn.
Wat betekent dit voor jou? Zet je een tickettype met verkopen uit, of verlaag je de
capaciteit onder het al verkochte aantal, dan vragen we eerst om bevestiging: nieuwe
verkoop stopt, maar bestaande tickets blijven geldig en die bezoekers kunnen nog inchecken.
Een tickettype met verkopen kun je niet verwijderen — deactiveren is dan de juiste weg.

**i18n-keys.** `public.changelog.changes.event_ticket_types_management` — KLAARZETTEN, nog
niet verstuurd.

### 2026.10i — Eventpagina met deelnemers en check-in-overzicht (feature, 19-08-2026)

**Elk event heeft nu zijn eigen pagina** (oktober 2026)
Klik in het eventoverzicht op een datum en je opent een eigen eventpagina. Op het
tabblad Overzicht zie je de capaciteit, het aantal verkochte tickets, wie er nu binnen
is en hoeveel plaatsen er nog vrij zijn, plus je tickettypes met prijs en verkoopstatus.
Het tabblad Deelnemers toont per bezoeker de naam, het e-mailadres, het tickettype, het
bestelnummer en of die persoon binnen of buiten is. Het tabblad Scan-log toont elke scan
met tijd, richting, zone en resultaat.
Wat betekent dit voor jou? Je hoeft niets in te stellen. De pagina is voorlopig
alleen-lezen: bewerken doe je nog via het product.

**i18n-keys.** `public.changelog.changes.event_detail_page` — KLAARZETTEN, nog niet verstuurd.

### 2026.10e — Mails dragen nu jouw eigen merk (bugfix, 19-08-2026)

**Je klanten zien jouw logo en naam in elke mail** (oktober 2026)
Bestel- en ticketbevestigingen, facturen, creditnota's, offertes, retourupdates,
cadeaubonnen, klantberichten, campagnes en betaalverzoeken toonden het SellQo-logo en
"SellQo" als afzender, ook wanneer je eigen logo en naam netjes waren ingevuld. Dat is
opgelost: alle tien de klant-mails gebruiken nu jouw logo, jouw winkelnaam als
afzendernaam, jouw huisstijlkleuren en jouw support-adres voor antwoorden. Heb je een
eigen domein ingesteld, dan linkt het logo naar jouw webshop.
Wat betekent dit voor jou? Je hoeft niets in te stellen; het geldt meteen voor alle mails
die vanaf nu verstuurd worden. Zonder eigen logo blijft het SellQo-logo staan.

**i18n-keys.** `public.changelog.changes.tenant_email_branding` — KLAARZETTEN, nog niet
gepubliceerd (meenemen in de gebundelde slottaakronde: entry in
`src/pages/public/PublicChangelog.tsx` + `landing.{nl,en,fr,de,uk}.json`).

### 2026.10d — Marketingrol kan producten bewerken (improvement, 18-08-2026)

**Je marketeer kan nu zelf productteksten bijwerken** (oktober 2026)
Teamleden met de marketingrol konden geen enkel product bewerken, ook geen
beschrijving of SEO-tekst. Dat kan nu wel: teksten, SEO-velden, tags, categorieën
en afbeeldingen zijn bewerkbaar. Prijzen, inkoopprijzen, btw-tarief, artikelnummer,
barcode en voorraad blijven voorbehouden aan beheerders — die velden staan grijs
met de melding dat een beheerder ze beheert. Ook de magazijnrol kan geen prijzen
meer wijzigen; die kan alleen nog de voorraad bijwerken.
Wat betekent dit voor jou? Je hoeft niets in te stellen; het geldt meteen voor je hele team.

**i18n-keys.** `public.changelog.changes.marketing_product_editing` — NL/EN/FR/DE aanwezig.

### 2026.10c — Persoonlijke instellingen voor iedereen, rapporten opgesplitst (improvement, 18-08-2026)

**Iedereen bij zijn eigen profiel, rapporten netjes gescheiden** (oktober 2026)
Teamleden zonder beheerdersrol konden hun eigen naam, taal en wachtwoord niet wijzigen:
de volledige instellingenpagina zat achter een beheerdersrecht. Dat is opgelost —
"Mijn profiel" is nu voor elke rol bereikbaar, en binnen de instellingen zie je enkel
wat bij jouw rol hoort. Daarnaast zijn de rapporten opgesplitst: financiële overzichten
blijven voorbehouden aan wie daar toegang toe hoort, commerciële analyses blijven breed
beschikbaar, en het voorraadrapport is nu ook bereikbaar voor magazijnmedewerkers.
Wat betekent dit voor jou? Je hoeft niets in te stellen; het geldt meteen voor je hele team.

**i18n-keys.** `public.changelog.changes.personal_settings_and_reports` — NL/EN/FR/DE aanwezig.

### 2026.10b — Recht op kortingen dekt nu ook promoties (security, 18-08-2026)

**Eén schakelaar voor alle kortingen en promoties** (oktober 2026)
Je kon al per teamlid instellen of iemand met de marketingrol kortingscodes mag beheren.
Dat recht dekte tot nu toe enkel de codes zelf: automatische kortingen, volumekortingen,
1+1-acties, cadeaupromoties, stapelregels en loyaliteitsprogramma's stonden er los van open.
Vanaf nu vallen die allemaal onder dezelfde schakelaar. Eén bevoegdheid, geen achterdeurtjes.
Wat betekent dit voor jou? Je hoeft niets te doen: heb je het recht al toegekend, dan dekt
het meteen ook de promoties. Beheerders en medewerkers houden hun rechten onveranderd.
Daarnaast beperkten we de inzage in enkele gevoelige gegevens verder tot de rollen die ze
werkelijk nodig hebben.

**i18n-keys.** `public.changelog.changes.promotion_permission_scope` — NL/EN/FR/DE aanwezig.

### 2026.10a — SEPA-machtigingen tonen bedrag, reden en interval (improvement, 17-08-2026)

**Je klant ziet nu precies waarvoor hij een machtiging geeft** (oktober 2026)
Vroeg je een klant om een doorlopende SEPA-machtiging, dan zag die enkel een betaalformulier
zonder verdere uitleg. Vanaf nu staat bovenaan de machtigingspagina wie de machtiging krijgt,
waarvoor het is, welk bedrag inclusief btw en hoe vaak er wordt afgeschreven. Het bedrag komt
uit het abonnement zelf, dus het is exact wat er later geincasseerd wordt.
Wat betekent dit voor jou? Je hoeft niets in te stellen: maak de mandaatlink aan zoals altijd
via het menu bij het abonnement. Is er geen bedrag bekend, dan ziet de klant nog steeds
duidelijk dat het om een doorlopende SEPA-machtiging voor jouw bedrijf gaat.

**i18n-keys.** `public.changelog.changes.sepa_mandate_context` — NL/EN/FR/DE aanwezig.

### 2026.09t — Knoppen in homepage-secties werken nu overal (bugfix, 13-08-2026)

**Knoppen in je homepage-secties werken nu overal** (september 2026)
Een knop in je hero- of tekstsectie bracht bezoekers soms op een pagina die niet bestond,
omdat de link niet aan je winkel werd gekoppeld. Dat is opgelost: knoppen leiden nu altijd
naar de juiste plek in je webshop. Verwijs je naar een externe website, dan opent die
voortaan in een nieuw tabblad in plaats van te stranden.
Wat betekent dit voor jou? Je hoeft niets aan te passen. Bestaande knoppen blijven werken
en verwijzen voortaan naar de juiste pagina.

**i18n-keys.** `public.changelog.changes.storefront_section_buttons` — NL/EN/FR/DE aanwezig.

### 2026.09p — Kassa berekent btw nu correct (bugfix, 10-08-2026)

**Kassa berekent btw nu correct** (september 2026)
Bij shops die met prijzen inclusief btw werken (de standaardinstelling) telde de kassa de
btw nog een tweede keer bovenop de prijs. Een artikel van € 299 werd daardoor als
€ 361,79 afgerekend. De kassa haalt de btw nu uit de prijs, exact zoals je webshop dat al
deed.
Wat betekent dit voor jou? Kassa, webshop en bon tonen nu hetzelfde bedrag. Werk je met
prijzen exclusief btw, dan blijft de btw netjes bovenop komen. Je hoeft niets in te stellen.

**i18n-keys.** `public.changelog.changes.pos_vat_calculation_fix` — NL/EN/FR/DE aanwezig.

### 2026.09n — Kassa vlot op tablet en telefoon (improvement, 10-08-2026)

**Kassa werkt nu vlot op tablet en telefoon** (september 2026)
De kassa was op smalle schermen nauwelijks te gebruiken: de winkelwagen nam bijna het
hele beeld in. Nu vult het productpaneel het scherm en schuift de winkelwagen van onderen
uit via een vaste balk met je totaal en een knop "Afrekenen".
Wat betekent dit voor jou? Je kunt een verkoop volledig afhandelen op een tablet of
telefoon — betaalknoppen inbegrepen. Op laptop en desktop blijft alles exact zoals je het
kent. Je hoeft niets in te stellen.

**i18n-keys.** `public.changelog.changes.pos_mobile_layout` — NL/EN/FR/DE aanwezig.

### 2026.09g + 2026.09h + 2026.09i — Printful print-on-demand koppeling (feature, 09-08-2026)

> **Bundeling:** dit item dekt POD-1a (verbinding), POD-1b (bestellingen doorsturen) én
> POD-1c (automatische verzendupdates).
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

**Automatische verzendupdates van Printful** (september 2026)
Sluitstuk: zodra Printful verzendt, komt de trackinginformatie automatisch binnen. De
bestelling gaat op verzonden en je klant krijgt automatisch de verzendmail. Annuleringen
en wachtstatussen bij Printful zie je terug op de orderpagina. Je hoeft niets in te
stellen — de koppeling regelt dit zelf bij het verbinden.

**i18n-keys.** `public.changelog.changes.printful_pod`, `public.changelog.changes.printful_order_forwarding`, `public.changelog.changes.printful_shipping_updates` — NL/EN/FR/DE aanwezig.

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

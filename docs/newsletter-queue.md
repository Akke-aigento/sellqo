# Newsletter-wachtrij — tenant-zichtbare fixes en features

Items die in de eerstvolgende SellQo-newsletter naar tenants meegenomen worden. Zodra een item verstuurd is: verplaats naar de "Verzonden" sectie met datum.

## Openstaand

### 2026.14w — Zelf een webshop, horeca of events bijnemen (feature, 31-10-2026)

**Status:** wacht op go: push, deploy sync-tenant-plan, docs-migratie, publish.

**Een webshop bij je café? Of horeca bij je winkel? Zet het zelf aan** (oktober 2026)
In Instellingen › Modules zet je als beheerder zelf een extra onderdeel aan. Je ziet vooraf exact wat je vandaag betaalt, enkel voor de resterende dagen van je periode, en wat het daarna per maand kost. Het staat aan zodra de betaling binnen is; in je proefperiode is het gratis. Uitzetten kan altijd, tot het einde van wat je al betaalde.
Wat betekent dit voor jou? Groeien zonder te wachten op SellQo, en nooit een verrassing op je factuur.

i18n: `public.changelog.changes.addon_self_serve`

### 2026.14v — Printful-bestellingen gaan vanzelf in productie (feature, 31-10-2026)

**Status:** wacht op go: push, migratie, deploy, publish (PRINTFUL-AUTO-1 live sinds 31-10, PRINTFUL-AUTO-2 volgt).

**Verkoop je via Printful? Dan hoef je niets meer door te sturen** (oktober 2026)
Zodra een klant betaalt, staat de bestelling binnen enkele seconden bij Printful. Annuleer of terugbetaal je ze, dan annuleert SellQo ze ook bij Printful zolang er nog niets gedrukt is. En loopt er iets mis, of houdt Printful een bestelling tegen, dan hoor je het meteen: een pushbericht op je gsm en een mail.
Wat betekent dit voor jou? Geen bestelling die blijft liggen, en geen productie van iets dat je al terugbetaalde.

i18n: `public.changelog.changes.printful_auto_forward`

### 2026.14u — Productpagina zonder valse "niet opgeslagen" (bugfix, 31-10-2026)

**Status:** wacht op publish (samen met 2026.14s/14t).

Opende je een product, dan stond er meteen "niet opgeslagen" zonder dat je iets had gewijzigd. Dat is opgelost. Ook het plandetail bij Abonnement, de meldingen bij AI-afbeeldingen en de slogan in het SellQo-logo staan nu in jouw taal.
i18n: `public.changelog.changes.product_form_fixes`

### 2026.14t — Vraag je assistent naar je cijfers (feature, 30-10-2026)

**Status:** wacht op go: push, migraties, deploy, publish (AI-AGENT-2).

**"Wat was mijn omzet vorige zaterdag?"** (oktober 2026)
Je assistent kent nu je cijfers: omzet, winst, je best verkopende producten en lijsten die je als Excel-bestand downloadt. En hij doet meer voor je: een nieuw product klaarzetten, prijzen van een hele categorie aanpassen of een kortingscode maken. Altijd pas na jouw ja.
Wat betekent dit voor jou? Geen rapporten meer zoeken: vraag het gewoon, in je eigen taal.

i18n: `public.changelog.changes.ai_agent_2`

### 2026.14r — De hulpassistent zet wijzigingen voor je klaar (feature, 30-10-2026)

**Status:** live sinds 30-10-2026 (AI-AGENT-1, PRODUCT-FORM-1).

**Je assistent steekt nu zelf de handen uit de mouwen** (oktober 2026)
Typ "vul de voorraad van de zwarte hoodie M aan met 10" of "zet de lasagne op uitverkocht voor vandaag", en de hulpassistent zet het voor je klaar. Je ziet meteen wat er verandert; pas als jij op Uitvoeren tikt, gebeurt het. Eén AI-credit per actie, in alle betaalde plannen.
Wat betekent dit voor jou? Minder klikken tussen de klanten door, zonder dat er iets verandert zonder jouw ja.

Ook nieuw: je productpagina toont enkel wat bij je product past. Allergenen zie je enkel bij eten en drinken.

i18n: `public.changelog.changes.ai_actions`, `product_form_sections`

### 2026.14q — Foto's herschikken en echte transparantie (feature + bugfixes, 30-10-2026)

**Status:** live sinds 30-10-2026 (MEDIA-FIX-1).

**Jouw foto's, in jouw volgorde** (oktober 2026)
Sleep de foto's van een product in de volgorde die jij wil, of gebruik de pijltjes op je gsm. De eerste foto is de hoofdfoto, en je webshop volgt dezelfde volgorde. En kies je "Transparant" bij AI-achtergrond, dan krijg je nu een PNG met een echt doorzichtige achtergrond in plaats van een ingetekend dambord.
Wat betekent dit voor jou? Je productpagina's tonen meteen de foto die jij het sterkst vindt, en vrijstaande productfoto's zonder extra programma.

Ook opgelost: scrollen in "Kies uit bibliotheek", de hulpassistent antwoordt in de taal waarin je hem aanspreekt, plannamen in je eigen taal, en het gsm-menu op sellqo.app is weer leesbaar.

i18n: `public.changelog.changes.photo_order`, `bg_remove_transparent`, `photo_library_scroll`, `ai_help_language`, `plan_names_i18n`, `landing_menu_contrast`

### 2026.14p — Online reserveren: gasten vragen zelf een tafel aan (feature, 30-10-2026)

**Status:** live sinds 30-10-2026 voor webshop en beheer; kassa-app 0.19.0 volgt met de volgende native build (RESERVATIE-2).

**Reserveren terwijl jij tapt** (oktober 2026)
Zet online reserveren aan en je webshop krijgt een knop "Reserveren". Gasten kiezen een dag, een uur en het aantal personen; jij bevestigt met één tik in de kassa of het beheer, en zij krijgen meteen een mail.
Wat betekent dit voor jou? Minder telefoontjes in de drukte, en jij houdt de laatste beslissing.

i18n: `public.changelog.changes.reservations_online`

### 2026.14o — Vaste klanten krijgen een eigen plek op je zaalplan (feature, 30-10-2026)

**Status:** wacht op push, migratie en publish (VASTE-KLANT-1).

**Jef heeft zijn plek** (oktober 2026)
Zet je vaste klanten met hun naam op het zaalplan. Op de kassa tik je op "Jef" en zijn rekening opent, altijd op dezelfde plek. Namen mogen nu tot 20 tekens, ook met accenten.
Wat betekent dit voor jou? Geen zoeken meer tussen de rekeningen op naam.

i18n: `public.changelog.changes.regulars_1`

### 2026.14n — Reservaties: tafels reserveren in je beheer en op de kassa (feature, 30-10-2026)

**Status:** wacht op push, migratie en publish (RESERVATIE-1).

**Voor wie:** alle horecazaken (in elk horecapakket).

**Je zaalplan weet wie er komt** (oktober 2026)
Noteer een reservatie onder Bestellen › Reservaties of op de kassa met lang drukken op een tafel. Een uur vooraf kleurt de tafel paars met naam en uur. Zitten er nog gasten, dan blijft hun rekening gewoon open: een reservatie verandert nooit iets aan een rekening.
Wat betekent dit voor jou? Geen papieren boekje meer naast de kassa, en geen dubbel verkochte tafel.

i18n: `public.changelog.changes.reservations_1`

### 2026.14m — SellQo Kassa: + en − op elke lijn, vegen, en een rekening-vraag intrekken (improvement, 30-10-2026)

**Status:** wacht op push, publish en de migraties (KASSA-UX-4).

**Voor wie:** horecazaken met SellQo Kassa.

**Sneller corrigeren in de drukte** (oktober 2026)
Elke lijn op de rekening heeft nu een − en een +, en naar links vegen haalt een lijn weg. Ook in het formaatvenster (25, 33, 50 cl) staat een −. Staat een tafel per ongeluk op "rekening gevraagd", dan zet je ze met lang drukken terug op bezet. En per product kies je waar het bereid wordt: de salami aan de toog, de rest van de hapjes in de keuken.
Wat betekent dit voor jou? Minder tikken, en geen tafel meer die blauw blijft door één misser.

i18n: `public.changelog.changes.kassa_quick_tap_3`

### 2026.14l — Een nog korter menu voor horeca en events (improvement, 30-10-2026)

**Status:** wacht op push en publish (TRACKS-3).

**Voor wie:** horeca- en eventzaken.

**Tien knoppen, niet meer** (oktober 2026)
Een horecazaak ziet in de zijbalk nog Vandaag, Bestellingen, Kassa, Zaal, Kaart, Betalingen, Rapporten, Abonnement, Instellingen en Help. Wat uit de zijbalk ging, staat nog altijd klaar onder Instellingen › Meer onderdelen.
Wat betekent dit voor jou? Een rustig menu, en niets kwijt.

i18n: `public.changelog.changes.menu_per_track_2`

### 2026.14k — Je menu toont alleen wat bij jouw zaak hoort (improvement, 30-10-2026)

**Status:** wacht op push en publish (TRACKS-2).

**Voor wie:** alle zaken; horeca het meest merkbaar.

**Een korter menu** (oktober 2026)
Een horecazaak ziet Kassa, Zaal, Kaart, Bestellingen en Keuken, zonder webshop-, marketing- of eventonderdelen. Instellingen toont alleen de onderdelen die bij je zaak horen.
Wat betekent dit voor jou? Minder zoeken, geen onderdelen die je niet gebruikt.

i18n: `public.changelog.changes.menu_per_track`

### 2026.14j — SellQo Kassa: sneller tikken aan de bar en lang drukken op tafels (improvement, 29-10-2026)

**Status:** wacht op push, publish van de admin en de helpartikels (KASSA-UX-3).

**Vijf pinten, vijf tikken** (oktober 2026)
Kies je een formaat zoals 25, 33 of 50 cl, dan blijft het venster open: elke tik is er één bij, en alles komt op één lijn. Lang drukken op een tafel geeft een menu om de rekening te openen, een voorlopige rekening te maken, te verplaatsen of samen te voegen. Tabs op naam staan op één rij, en in Keuken en Bar blijft het scherm open.
Wat betekent dit voor jou? Minder tikken in de drukte, en geen per ongeluk gemaakte voorlopige rekening meer.

i18n: `public.changelog.changes.kassa_quick_tap_2`

### 2026.14i — SellQo Kassa: barscherm, keuken en zaalplan op je gsm (feature, 29-10-2026)

**Status:** wacht op push, publish van de admin en de helpartikels (KASSA-UX-2).

**Voor wie:** horecazaken met SellQo Kassa.

**De toog, de bar en de keuken op één toestel** (oktober 2026)
Bovenaan de kassa wissel je met één tik tussen Zaal, Bar en Keuken. Onder Bar zie je wat er binnenkomt: bestellingen via de QR aan tafel en de bonnen voor je bar. Op een tablet staat die kolom naast je zaalplan. Keuken toont het keukenscherm in de kassa zelf. Op je gsm vult het zaalplan nu je scherm, en de kassa spreekt de taal van je zaak.
Wat betekent dit voor jou? Eén tablet aan de toog volstaat om te bestellen, QR-bestellingen te aanvaarden en de drankjes af te werken.

i18n: `public.changelog.changes.kassa_bar_kitchen`

### 2026.14h — SellQo Kassa: sneller tikken en altijd de weg terug (improvement, 29-10-2026)

**Status:** wacht op push, publish van de admin en de helpartikels (KASSA-UX-1).

**Voor wie:** horecazaken met SellQo Kassa.

**Tikken zoals achter de toog** (oktober 2026)
Tik je een product nog eens, dan telt het op dezelfde lijn op: 3× Pils in plaats van drie lijnen. Op de knop zie je hoeveel er in deze ronde staan, en met − haal je er één af. De kaart opent op je meest verkochte producten, en op je gsm zie je onderaan altijd het aantal en het totaal. De toog is een vaste knop bovenaan je tafels; Kas, Rapporten en de weg terug naar je beheer staan in het menu rechtsboven.
Wat betekent dit voor jou? Minder tikken per ronde, een duidelijkere keukenbon en nooit meer vastzitten in de kassa.

i18n: `public.changelog.changes.kassa_quick_tap`

### 2026.14g — Een kassa aanmaken vanuit de kassa-app (improvement, 29-10-2026)

**Status:** wacht op push, publish van de admin en het helpartikel (KASSA-START-1).

**Voor wie:** horecazaken die SellQo Kassa voor het eerst openen.

**Meteen aan de slag op je tablet** (oktober 2026)
Heeft je zaak nog geen kassa, dan maak je er als zaakvoerder een aan op het eerste scherm van SellQo Kassa. Het toestel hangt er meteen aan.
Wat betekent dit voor jou? Eén stap minder bij de start, zonder heen en weer naar het beheer.

i18n: `public.changelog.changes.kassa_first_terminal`

### 2026.14f — Kies zelf je snelkoppelingen onderaan op je gsm (feature, 29-10-2026)

**Status:** gaat mee met de uitrol van WANDELING (merge, migratie onderbalk_1, publish, daarna het helpartikel).

**Voor wie:** iedereen die SellQo op de gsm gebruikt.

**Jouw balk, jouw volgorde** (oktober 2026)
In Instellingen › Mijn onderbalk kies je zelf welke 2 tot 5 plekken onderaan op je gsm staan, en in welke volgorde. Elke collega stelt zijn eigen balk samen; wie niets kiest, houdt de standaard die bij de zaak past.
Wat betekent dit voor jou? De kok heeft Keuken en Kaart onder de duim, de zaakvoerder Vandaag en Rapporten.

i18n: `public.changelog.changes.bottom_nav_choice`

### 2026.14e — Je horecadag: sneller schakelen en alles op één overzicht (improvement, 29-10-2026)

**Status:** wacht op merge van branch night-wandeling naar main, publish van de admin, migraties PRINT-2b + docs en deploy van horeca-print en horeca-device-push (WANDELING).

**Voor wie:** horecazaken.

**Schakelen zonder zoeken** (oktober 2026)
Onderaan op je gsm staan nu de vier plekken waar je de hele dag tussen wisselt: Vandaag, Kassa, Keuken en Kaart. In Instellingen › Horeca zie je al je horeca-instellingen met hun stand, en zonder posten kies je één printer voor alle keukenbonnen.
Wat betekent dit voor jou? Minder tikken in de rush, en nooit meer zoeken waar iets ingesteld staat.

i18n: `public.changelog.changes.horeca_walkthrough`

### 2026.14d — Bonprinters en betaalbewijs per mail (feature, 28-10-2026)

**Status:** wacht op migratie, deploy van horeca-print en horeca-receipt-mail, publish van de admin en het helpartikel (PRINT-2). Een test met een echte Star-printer staat nog open.

**Voor wie:** horecazaken met SellQo Kassa (Kassa › Bon & printers).

**De bon komt vanzelf uit de printer** (oktober 2026)
Koppel een Star-bonprinter en kies per post welke printer de bonnen afdrukt: rondes van de kassa, QR-bestellingen en webshoporders komen er meteen uit, zonder dat er een tablet of pc aan moet staan. Na het afrekenen kan het betaalbewijs automatisch afgedrukt worden, na een online betaling via de QR aan tafel krijgt de gast het per mail, en met de knop Mail bon stuur je het naar een klant die erom vraagt.
Wat betekent dit voor jou? Geen bonnenblok en geen printvenster meer in de rush, en de kassa vraagt nooit zelf om een e-mailadres.

i18n: `public.changelog.changes.horeca_printers_receipts`

### 2026.14c — Een overzichtelijkere kaart, ook op je gsm (improvement, 28-10-2026)

**Status:** live sinds 28-10 (admin gepubliceerd, helpartikel bijgewerkt); klaar voor de nieuwsbrief.

**Voor wie:** horecazaken (Bestellen › Kaart).

**Je kaart in één oogopslag** (oktober 2026)
Op de Kaart staan naam en prijs nu groot bovenaan, met daaronder twee duidelijke knopjes: Op de kaart en Beschikbaar of Op. Toevoegen via foto, lijst of startkaart zit samen onder één knop, en selecteren of de volgorde aanpassen doe je via een knop bovenaan.
Wat betekent dit voor jou? Aan de toog met één tik iets op "op" zetten, zonder te zoeken wat een icoontje betekent.

i18n: `public.changelog.changes.horeca_menu_layout`

### 2026.14b — Meldingen per toestel voor kassa, keuken en bar (feature, 28-10-2026)

**Status:** wacht op migratie, deploy van horeca-device-push en send-push-notification, en publish van de admin (MELDING-1); de native Kassa-app volgt met de volgende build.

**Voor wie:** horecazaken met SellQo Kassa en/of een keukenscherm.

**Elke post zijn eigen melding** (oktober 2026)
Elk toestel in je zaak krijgt nu enkel wat het nodig heeft. De kassa krijgt een melding bij een QR-bestelling, een bon die klaar is en een online betaling. Het keuken- of barscherm krijgt elke nieuwe bon voor die post, ook als het scherm dicht is. Nieuwe bonnen komen samen in één melding, op het open scherm klinkt een belletje, en het scherm kan wakker blijven. Op een gedeelde kassa staan jouw persoonlijke meldingen standaard uit. Alles beheer je onder Kassa (POS) › Kassa's.
Wat betekent dit voor jou? Geen bestelling meer die blijft liggen omdat niemand op het scherm keek, en geen facturen van de eigenaar op het keukenscherm.

i18n: `public.changelog.changes.horeca_device_alerts`

### 2026.14a — Gasten betalen de tafelrekening online, ook gesplitst (feature, 28-10-2026)

**Status:** wacht op migratie, deploy van storefront-api en stripe-connect-webhook, publish van de admin en deploy van het QR-menu (REKENING-ONLINE-1); de native Kassa-app volgt met de volgende build.

**Voor wie:** horecazaken met het QR-menu op de tafelrekening, Stripe gekoppeld en zonder geregistreerde kassa (GKS).

**Vrienden aan tafel? Iedereen betaalt zijn deel** (oktober 2026)
Via de QR-code op tafel zien je gasten hun rekening en betalen ze zelf: alles, enkel hun eigen items, of gelijk gedeeld. Fooi kan met 5, 10 of 15 % of een eigen bedrag. Het komt meteen op de rekening; is alles betaald, dan sluit de tafel vanzelf. Betaalt maar een deel online, dan rekent de kassa de rest af. Aanzetten doe je onder Kassa › Betalen.
Wat betekent dit voor jou? Minder wachten op de rekening aan het einde van de avond, en geen gedoe met splitsen aan de toog.

i18n: `public.changelog.changes.horeca_check_online_pay`

### 2026.13z — Bestellen aan tafel via de QR, op de tafelrekening (feature, 28-10-2026)

**Status:** wacht op migratie, storefront-api-deploy, publish van de admin en deploy van het QR-menu (QR-REKENING-1); de native Kassa-app volgt met de volgende build.

**Voor wie:** horecazaken met het QR-menu en SellQo Kassa.

**Je gasten bestellen aan tafel, jij houdt het overzicht** (oktober 2026)
Onder Bestellen › QR-menu kies je of een bestelling via de QR-code op tafel meteen betaald wordt, of op de tafelrekening komt. Op de tafelrekening geeft de gast zijn bestelling door zonder te betalen. Op de kassa verschijnt een oranje knop met het aantal wachtende bestellingen; met één tik zet je alles van een tafel op de rekening en gaat het naar keuken en bar. Weiger je, dan ziet de gast waarom. Op het einde betaalt de tafel alles samen.
Wat betekent dit voor jou? Gasten wachten niet op de bediening om te bestellen, en jij betaalt geen transactiekost per drankje: één rekening, één betaling.

Kleine aanvulling (QR-REKENING-1b): onder Bestellen › QR-menu zie je meteen als je menu nog niet zichtbaar is omdat je zaak offline staat, met een link om ze online te zetten.

i18n: `public.changelog.changes.horeca_qr_tab`, `public.changelog.changes.horeca_qr_menu_visible`

### 2026.13y — Betalen instellen per zaak, en afrekenen met een overschrijving (feature, 28-10-2026)

**Status:** wacht op migratie + publish (BETAAL-1); de native Kassa-app volgt met de volgende build.

**Voor wie:** horecazaken met SellQo Kassa.

**Geen terminal? Laat je klant betalen met een QR-code** (oktober 2026)
Onder Kassa › Betalen kies je wat je zaak aanbiedt: contant, overschrijving, maaltijdcheques, bonnen, een betaalterminal en fooi. Kies je overschrijving, dan toont de kassa een QR-code met het bedrag en je rekeningnummer. Je klant scant die met zijn bankapp, jij bevestigt, klaar. In je dagrapport staat overschrijving apart.
Wat betekent dit voor jou? Geen terminal nodig om elektronisch betaald te worden, en een kassa die enkel toont wat jij aanbiedt.

i18n: `public.changelog.changes.horeca_payments_transfer`

### 2026.13x — Een rustige werkplek voor horeca (improvement, 28-10-2026)

**Status:** wacht op de publish van de admin (WERKPLEK-1, commit 08bfc7d); daarna klaar voor verzending.

**Voor wie:** horecazaken zonder webshop- of eventspakket.

**Enkel wat je zaak nodig heeft** (oktober 2026)
In je menu en instellingen staat nu alleen wat een zaak gebruikt: bestellingen, je kaart, de keuken, de kassa, betalingen en rapporten. Klanten, kortingen, marketing en webshopinstellingen zijn weg; neem je een webshop erbij, dan komen ze vanzelf terug. Op je gsm staan de kaart en de keuken onderaan, en een kassa openen gaat altijd naar SellQo Kassa.
Wat betekent dit voor jou? Minder zoeken, sneller vinden, ook voor wie maar af en toe in het beheer komt.

i18n: `public.changelog.changes.horeca_workspace`

### 2026.13w — Muntenkaart-status op de bestelling, geen ticketmail na annuleren (improvement, 26-10-2026)

**Status:** klaar voor verzending (EVENT-409-1 live sinds 27-10-2026: send-ticket-confirmation, storefront-api, admin en helpartikel; de native app volgt met de volgende build).

**Voor wie:** winkels met de module Events (ook Events Flex).

**Je ziet meteen of een muntenkaart nog werkt** (oktober 2026)
Op een bestelling staat bij de muntenkaart nu ook de status: Actief, Geblokkeerd, Terugbetaling gevraagd of Terugbetaald. En is een bestelling geannuleerd of volledig terugbetaald, dan kan je de tickets niet meer opnieuw mailen: die gelden toch niet meer.
Wat betekent dit voor jou? Geen verwarring aan de bar of de deur over een kaart of ticket van een geannuleerde bestelling.

i18n: `public.changelog.changes.order_tickets_status_resend`

### 2026.13v — Kaart: toevoegen en slepen werkt weer, Bestellen opent op je kaart (bugfix + improvement, 25-10-2026)

**Status:** klaar voor verzending (live 25-10-2026, KAART-FIX-1 + KAART-4).

**Voor wie:** horecazaken (horeca-module).

**Tekst:** Sinds 24 oktober gaven snel toevoegen, een lijst plakken, de startkaart, de foto-import, slepen en "Maat of kopie toevoegen" op Bestellen › Kaart een foutmelding. Dat is opgelost: alles werkt weer. Bestellen opent nu ook meteen op je kaart, en in het productpaneel zie je bij "Waar te koop" duidelijk wat aan staat.

**i18n:** `public.changelog.changes.horeca_menu_add_fix` en `public.changelog.changes.horeca_menu_first`

### 2026.13u — Je kaart nog sneller: alles in één paneel, en de volgorde kies je zelf (improvement, 24-10-2026)

**Status:** klaar voor verzending (live 24-10-2026, KAART-3 + kassa 0.6.1).

**Voor wie:** horecazaken (horeca-module).

**Alles van een product in één tik** (oktober 2026)
Tik op een product op de Kaart en alles staat in één paneel: prijs ±10 cent, op, foto met je camera, extra's en allergenen. Met "Maat of kopie toevoegen" zet je Pils 33cl in één keer naast Pils 25cl. En je sleept je kaart in de volgorde die je wil: zo staat ze ook op de kassa.
Wat betekent dit voor jou? Je meest getapte dranken bovenaan op de kassa, en geen gezoek meer in formulieren.

i18n: `public.changelog.changes.horeca_menu_panel`

### 2026.13t — Op of nieuwe prijs, rechtstreeks op SellQo Kassa (improvement, 24-10-2026)

**Status:** klaar voor verzending (KASSA-0.6, live sinds 24-10-2026).

**Voor wie:** zaken die SellQo Kassa gebruiken.

**Op of nieuwe prijs, rechtstreeks op de kassa** (oktober 2026)
Druk lang op een product op SellQo Kassa om het op te zetten voor vandaag, terug te koop te zetten of de prijs aan te passen. Dat mag enkel de eigenaar of een verantwoordelijke, en elke wijziging wordt bewaard met wie ze deed en op welk toestel.
Wat betekent dit voor jou? Midden in de drukte hoef je niet naar de computer: het geldt meteen voor je kassa, QR-menu en webshop, en open rekeningen houden hun prijs.

i18n: `public.changelog.changes.kassa_product_quick_edit`

### 2026.13s — Je kaart in een paar minuten: de nieuwe tab Kaart (feature, 24-10-2026)

**Status:** klaar voor verzending (KAART-1 + KAART-2, live sinds 24-10-2026).

**Voor wie:** horecazaken (horeca-module): cafés, bars, frituren, restaurants.

**Je kaart in een paar minuten** (oktober 2026)
Onder Bestellen › Kaart staan al je producten per categorie op één scherm. Typ een naam en een prijs, druk op Enter en het staat op de kaart; prijs, op voor vandaag en waar het te koop is pas je aan in de lijn zelf. De btw stel je één keer per categorie in. Heb je al een kaart? Vink de klassiekers aan in de startkaart, plak een lijst uit Excel, of neem een foto van je menukaart en laat de AI hem lezen (5 AI-credits per foto, enkel als het lukt).
Wat betekent dit voor jou? Van overstap naar eerste verkoop in minuten in plaats van een avond producten intikken. Je ziet altijd eerst een voorbeeld, en wat al op je kaart staat, wordt niet dubbel aangemaakt.

i18n: `public.changelog.changes.horeca_menu_editor`

### 2026.13r — Toogverkoop, kas en X/Z-rapporten op SellQo Kassa (feature, 24-10-2026)

**Status:** klaar voor verzending (TAFEL-3, live sinds 24-10-2026).

**Voor wie:** horecazaken (horeca-module), vooral frituren, snackbars en cafés die aan de toog verkopen.

**Verkopen aan de toog, je kas en je dagafsluiting** (oktober 2026)
SellQo Kassa heeft nu vier tabbladen: Tafels, Toog, Kas en Rapporten. Aan de toog tik je producten aan, kies je ter plaatse of meenemen en reken je meteen af; bij meenemen geldt het btw-tarief dat je bij het product invult (bv. 6 % voor een afhaalmaaltijd). Onder Kas boek je geld in of uit de lade en tel je je kas bij het openen en sluiten van een shift. Onder Rapporten maak je een X-rapport (tussenstand) of een Z-rapport (dag afsluiten, doorlopend genummerd).
Wat betekent dit voor jou? Je hele dag staat op één kassa: tafels, toog, kas en afsluiting. Vergeet je een dag af te sluiten, dan maakt de kassa het Z-rapport de volgende dag zelf.

i18n: `public.changelog.changes.kassa_counter_reports`

### 2026.13q — Zie of je kassatoestellen nog meedraaien (improvement, 24-10-2026)

**Status:** klaar voor verzending (LIVE-1, live sinds 24-10-2026).

**Voor wie:** zaken die SellQo Kassa gebruiken.

**Elk kassatoestel in het oog** (oktober 2026)
Onder Kassa › Kassa's zie je per kassa wanneer elk SellQo Kassa-toestel zich het laatst meldde en of er nog iets op dat toestel wacht om doorgestuurd te worden. Een toestel dat langer dan vijf minuten stil is, of waar nog iets wacht, kleurt oranje.
Wat betekent dit voor jou? Je ziet een vastgelopen toestel voor het een probleem wordt.

i18n: `public.changelog.changes.kassa_device_status`

### 2026.13p — Afrekenen op SellQo Kassa (feature, 24-10-2026)

**Status:** klaar voor verzending (live sinds 24-10-2026, zie role-audit "LIVEGANG horeca-reeks").

**Voor wie:** horecazaken (horeca-module).

**Afrekenen zoals je gewend bent, ook per persoon** (oktober 2026)
Reken een tafel af met contant, kaart, maaltijdcheques of een mix, deel gelijk in 2 tot 6, of laat één klant apart betalen: wat hij nam gaat naar een eigen deel van de rekening, de rest blijft staan. Contant wordt op 5 cent afgerond met het wisselgeld erbij, fooi boek je apart.
Wat betekent dit voor jou? Het bedrag komt altijd uit wat er besteld is, nooit uit het toestel, en twee obers kunnen nooit dezelfde tafel tegelijk afrekenen. Elke betaling staat meteen in je kassaverkopen, shift en voorraad.

i18n: `public.changelog.changes.table_payment`

### 2026.13o — Tafels en rekeningen op SellQo Kassa (feature, 23-10-2026)

**Status:** klaar voor verzending (live sinds 24-10-2026, zie role-audit "LIVEGANG horeca-reeks").

**Voor wie:** horecazaken (horeca-module).

**Je zaal live op de kassa** (oktober 2026)
Op SellQo Kassa zie je je zaalplan: vrije tafels, bezette tafels met bedrag en minuten sinds de laatste bestelling, en tafels die de rekening vroegen. Je bestelt per tafel of op naam, stuurt de ronde door, en keuken en bar krijgen elk hun eigen bon. Annuleren, korting, verplaatsen en samenvoegen zitten erin; onder Bestellen › Posten kies je wat naar de bar en wat naar de keuken gaat.
Wat betekent dit voor jou? Al je obers werken op dezelfde rekeningen, ook als het internet even hapert.

i18n: `public.changelog.changes.table_checks`

### 2026.13n — Kassapersoneel met eigen pincode en de kassa-app (feature, 23-10-2026)

**Status:** klaar voor verzending (live sinds 24-10-2026, zie role-audit "LIVEGANG horeca-reeks").

**Voor wie:** zaken met een kassa, vooral horeca.

**Je personeel meldt zich aan met een pincode** (oktober 2026)
Voeg je medewerkers toe onder Kassa › Personeel, met een rol en een pincode. Op SellQo Kassa (ook via /kassa in je browser) kiest iedereen zijn naam en tikt zijn code; de kassa vergrendelt vanzelf na twee minuten. Medewerkers klokken er ook in en uit.
Wat betekent dit voor jou? Je ziet wie wat aanslaat, zonder dat iedereen een eigen account nodig heeft, en je kassa staat klaar voor een geregistreerde kassa (GKS).

i18n: `public.changelog.changes.kassa_staff_pin`

### 2026.13m — Zaalplan met een eigen QR-code per tafel (feature, 23-10-2026)

**Status:** klaar voor verzending (live sinds 24-10-2026, zie role-audit "LIVEGANG horeca-reeks").

**Voor wie:** horecazaken (horeca-module).

**Je zaak op het scherm, elke tafel een eigen QR-code** (oktober 2026)
Onder Bestellen → Zaalplan teken je je ruimtes en tafels na, met naam, vorm en stoelen; een rij barkrukken of een terras zet je er met een sjabloon in één keer bij. Per tafel druk je een QR-sticker af (12 per A4).
Wat betekent dit voor jou? Bestellingen komen gegarandeerd van de tafel waar de sticker hangt: een tafelnummer intypen van thuis uit werkt niet meer, en een verloren sticker vervang je met één klik.

i18n: `public.changelog.changes.floor_plan_tables`

### 2026.13l — Horeca: bestellen aan tafel zonder verwarring, keukenscherm op elk toestel (bugfix/verbetering, 23-10-2026)

**Status:** klaar voor verzending (live sinds 24-10-2026, zie role-audit "LIVEGANG horeca-reeks").

**Voor wie:** horecazaken (keuken, QR aan tafel, kassa).

**Bestellen aan tafel blijft aan tafel** (oktober 2026)
Gasten die via de QR-code aan tafel bestellen, zien geen levering of verzendkosten meer, en een online bestelling neemt nooit meer een tafelnummer mee. Het keukenscherm werkt nu ook op tablet en gsm, de kassa verliest geen contante verkoop meer als de wifi even wegvalt, en een fout geeft een herstelscherm in plaats van een wit scherm.
Wat betekent dit voor jou? Geen verwarde gasten, een keuken die op elk toestel meekan, en een kassa die je in de rush niet in de steek laat.

i18n: `public.changelog.changes.horeca_table_order_clean`, `kitchen_screen_responsive`, `no_white_screen`, `pos_offline_queue_safe`

### 2026.13k — Herinneringsmail op de dag van je event, met je WhatsApp-groep (feature, 23-10-2026)

**Status:** klaar voor verzending (functie, cron en adminveld live sinds 23-10).

**Voor wie:** winkels die tickets verkopen.

**Je deelnemers krijgen een herinnering op de dag zelf** (oktober 2026)
Vul bij een eventdatum de link van je WhatsApp-groep in. Om 10 uur 's ochtends krijgt elke tickethouder een mail met het startuur, het verzamelpunt en een knop om de groep te joinen.
Wat betekent dit voor jou? Minder "waar zijn jullie?"-telefoontjes: laatkomers vinden je via de groep. Nieuwe datums nemen de link vanzelf over.

i18n: `public.changelog.changes.event_reminder_whatsapp`

### 2026.13j — Een nieuw dashboard: je cockpit (feature, 21-10-2026)

**Status:** klaar voor verzending zodra DASH-2b live staat (frontend gepubliceerd, tabel `tenant_cockpit_settings` live sinds 21-10).

**Voor wie:** alle winkels; extra kaarten voor events en horeca.

**Je dashboard toont nu wat er vandaag gebeurt** (oktober 2026)
Bij het openen van SellQo zie je meteen je omzet van vandaag, per uur naast dezelfde dag vorige week. Je zet een maanddoel voor de hele winkel en ziet je reeksen en records. Daaronder staat wat er te doen is, je kanaalmix, wat er net binnenkwam en je toppers van de week. Verkoop je tickets, dan staat je volgende event bovenaan met de knop Tickets scannen. Heb je een horecazaak, dan zie je de keuken, de verwachte spits en zet je een gerecht met één tik op uitverkocht.
Wat betekent dit voor jou? Eén blik en je weet hoe je dag loopt en wat er nog moet gebeuren. Via Cockpit aanpassen kies je zelf welke kaarten je ziet en in welke volgorde.

i18n: `public.changelog.changes.cockpit_dashboard`

### 2026.13h — Duidelijke, gecontroleerde maattabellen voor Printful-producten (feature, 20-10-2026)

**Status:** klaar voor verzending zodra SIZECHART-1 live staat (edge functions storefront-api en apply-printful-import, frontend gepubliceerd, migratie `20261020223000_sizechart_1_docs.sql` toegepast).

**Voor wie:** winkels die producten uit Printful importeren, ook met een eigen webshop.

**Maattabellen die je klant meteen snapt** (oktober 2026)
De maatgids van Printful kwam tot nu toe ruw in je winkel: kommagetallen uit inch, lichaamsmaten die de kledingmaten herhaalden en geen uitleg waar je meet. Nu zet SellQo elke maatgids om naar één vaste tabel in hele cm: breedte van oksel tot oksel, lengte van schouder tot zoom, mouw en de borstomtrek waarvoor de maat bedoeld is. Bij elke import controleert SellQo de cijfers, en een tabel met foute data komt niet online.
Wat betekent dit voor jou? Minder twijfel over de maat bij je klanten, minder retours, en je ziet in het product onder de tab Maattabel meteen of er iets nagekeken moet worden.

i18n: `public.changelog.changes.size_chart_standard`

### 2026.13g — Mandje en betaling volgen altijd je actuele prijs (bugfix, 20-10-2026)

**Status:** klaar voor verzending zodra CART-PRICE-1 live staat (edge function storefront-api).

**Voor wie:** alle winkels, ook met een eigen webshop.

**Je actuele prijs geldt, ook in een mandje van gisteren** (oktober 2026)
Wijzig je een prijs terwijl een klant het product al in zijn mandje heeft, dan rekenden mandje en afrekenen tot nu toe soms nog met de oude prijs. Dat gold voor producten zonder variant, varianten zonder eigen prijs, early-birdtickets na afloop van de early bird en de prijs van extra's. Nu tonen mandje en betaling altijd de prijs die op dat moment in je winkel geldt, en betaalt de klant exact dat bedrag.
Wat betekent dit voor jou? Een prijsverhoging of een afgelopen early bird kost je geen omzet meer, en een klant betaalt na een prijsverlaging nooit te veel. Heb je een eigen webshop, dan kan die met de velden price_changed en previous_unit_price tonen dat een prijs veranderde.

i18n: `public.changelog.changes.cart_current_price`

### 2026.13e — PDF's lukken nu ook met emoji en Cyrillische namen (bugfix, 20-10-2026)

**Status:** klaar voor verzending zodra PDF-EMOJI-1 live staat (edge functions generate-invoice, generate-credit-note, generate-payment-request-pdf, generate-subscription-invoice-pdf, export-vat-pdf; frontend gepubliceerd voor de pakbon).

**Voor wie:** alle winkels die facturen, creditnota's, betalingsverzoeken, btw-exports of pakbonnen maken; vooral winkels met klanten buiten het Westerse alfabet.

**PDF's lukken nu ook met emoji en Cyrillische namen** (oktober 2026)
Bevatte een productnaam, klantnaam of adres een emoji of een teken buiten het Westerse alfabet, dan mislukte de PDF van je factuur, creditnota, betalingsverzoek, btw-export of pakbon. Dat gebeurt niet meer: emoji worden weggelaten, Cyrillische tekst (zoals Oekraïense namen) wordt in Latijnse letters geschreven en tekens die het lettertype niet kent (bijvoorbeeld Chinees) verschijnen als vraagteken.
Wat betekent dit voor jou? Elke factuur komt er, ook voor je klant uit Kyiv of met een emoji in de productnaam.

i18n: `public.changelog.changes.pdf_special_characters`

### 2026.13d — Marketing → E-mail overzichtelijker, en een mailversie van je bestaande logo (improvement, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-UX-1 live staat (edge functions automation-scheduler en ai-business-coach, migratie 20261020130000, frontend gepubliceerd). Liefst samen met of na 2026.13b (logo in je mails).

**Voor wie:** alle winkels die e-mailmarketing gebruiken.

**E-mail met tabbladen bovenaan** (oktober 2026)
In Marketing → E-mail staan de tabbladen nu meteen bovenaan: Overzicht, Campagnes, Automatiseringen, Templates, Segmenten en Abonnees. Automatiseringen is geen apart menu-item meer maar een tabblad van E-mail; oude links komen vanzelf op de juiste plek uit. De dubbele blokken met snelle acties en recente campagnes zijn weg, en het aantal abonnees op het overzicht is altijd gelijk aan dat op het tabblad Abonnees. Op je gsm schuiven de tabbladen opzij en blijven de knoppen van de campagnevensters in beeld.
Had je je logo al geüpload voordat SellQo er een versie voor e-mails van maakte? Dan gebeurt dat nu vanzelf zodra je als beheerder Marketing of Instellingen opent. Lukt het niet, dan staat bij je logo de knop "Mailversie maken van je huidige logo".
Wat betekent dit voor jou? Minder zoeken en scrollen, en je logo staat ook in je mails zonder dat je het opnieuw moet uploaden.

i18n: `public.changelog.changes.email_page_tabs`, `public.changelog.changes.email_logo_existing`

### 2026.13c — Je welkomstmail verhuist naar de Welkomstreeks; inschrijven altijd met bevestiging (improvement, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-CLEAN-1 live staat (eerst edge functions process-campaign-queue, send-campaign-batch, automation-scheduler, render-campaign-preview; dan migratie 20261020110000; dan frontend) en een testinschrijving op SellQo Speeltuin goed oogt.

**Voor wie:** alle winkels met e-mailmarketing; vooral winkels die een eigen welkomstmail hadden.

**Je welkomstmail staat nu in de Welkomstreeks** (oktober 2026)
De instellingen voor de nieuwsbrief zijn opgeruimd. Had je daar een eigen welkomstmail, dan staat die nu als eerste mail in Marketing → E-mail → Automatiseringen → Welkomstreeks, met je eigen onderwerp en ontwerp. De reeks staat aan: je nieuwe abonnees krijgen dezelfde welkomstmail als voorheen, meteen na hun bevestiging. Inschrijven gebeurt altijd met bevestiging (double opt-in). Onder Instellingen → E-mailinschrijving vind je de weg naar je abonnees en je welkomstmail.
Wat betekent dit voor jou? Al je automatische mails staan op één plek, en je past je welkomstmail aan waar je ook de rest van je reeksen beheert.

i18n: `public.changelog.changes.email_signup_cleanup`

### 2026.13b — Je logo in je mails: scherp, bijgesneden en met een link naar je webshop (improvement, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-LOGO-1 live staat (migratie 20261020100000, de 23 edge functions uit de role-audit, frontend gepubliceerd) en een testmail op SellQo Speeltuin goed oogt. Liefst na de backfill van de bestaande logo's.

**Voor wie:** alle winkels die mails naar klanten sturen.

**Je logo bovenaan je mails** (oktober 2026)
Upload je je logo, dan maakt SellQo er automatisch een versie voor e-mails van: lege en witte randen gaan eraf, het formaat is afgestemd op de kop van je mails en het bestand blijft licht. Je ziet bij het uploaden meteen hoe het eruitziet, in lichte en donkere modus, en je krijgt een waarschuwing als je logo te klein is. Heb je geen logo, dan staat de naam van je winkel er in tekst. Het logo of de naam linkt naar je eigen webshop.
Wat betekent dit voor jou? Je klanten zien jouw merk bovenaan elke mail, nooit het logo van SellQo, en komen met één klik in je winkel.

i18n: `public.changelog.changes.email_logo_header`

### 2026.13a — Herinnering bij een verlaten winkelwagen opent het winkelmandje opnieuw (feature, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-3 live staat (migratie 20261020094000, edge functions storefront-api en automation-scheduler, deploy van sellqo-storefront) en de smoketest op SellQo Speeltuin groen is.

**Voor wie:** winkels op de SellQo-webshop die de herinnering bij een verlaten winkelwagen gebruiken. Winkels met een eigen webshop buiten het SellQo-thema merken niets.

**De knop opent het winkelmandje opnieuw** (oktober 2026)
De knop in de herinnering bij een verlaten winkelwagen opent nu een winkelmandje met dezelfde producten, in plaats van je homepage. De link werkt 7 dagen. Je klant ziet de prijs en voorraad van dat moment en vult zijn gegevens opnieuw in. Tickets met een vaste plaats, producten met extra's, cadeaubonnen en uitverkochte producten komen niet mee; je klant ziet welke en waarom.
Wat betekent dit voor jou? Je klant rondt zijn bestelling af zonder alles opnieuw te zoeken, en wie de mail doorgestuurd krijgt, ziet nooit het adres of telefoonnummer van je klant.

i18n: `public.changelog.changes.email_cart_restore`

### 2026.12z — Je limiet voor marketingmails in één oogopslag (improvement, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-LIMIT-UI live staat (migraties 20261020092000 en 20261020093000 + frontend). Bundelen met 2026.12y.

**Voor wie:** alle winkels die e-mailmarketing gebruiken.

**Hoeveel marketingmails heb je nog?** (oktober 2026)
Bovenaan Marketing → E-mail zie je nu hoeveel marketingmails je deze maand verstuurde en hoeveel je plan toelaat, automatiseringsmails inbegrepen. In het overzicht van de plannen en op de prijzenpagina staat per plan hoeveel marketingmails per maand inbegrepen zijn.
Wat betekent dit voor jou? Je ziet op tijd dat je aan je limiet komt, in plaats van pas bij het versturen.

i18n: `public.changelog.changes.email_limit_visible`

### 2026.12y — Producten in je mail en A/B-test van het onderwerp (feature, 20-10-2026)

**Status:** klaar voor verzending zodra MAIL-2a, 2c en 2d live staan (migraties 20261020000000 en 20261020010000 na 20261019230000, edge functions process-campaign-queue, send-campaign-batch, automation-scheduler, render-campaign-preview + frontend) en de smoketest op SellQo Speeltuin groen is.

**Voor wie:** alle winkels die e-mailmarketing gebruiken.

**Producten in je mail** (oktober 2026)
Met de nieuwe knop Product invoegen zet je 1 tot 4 producten in een campagne, template of automatische mail: met foto, naam, prijs en een knop naar je productpagina, naast elkaar of onder elkaar. De prijs is die op het moment dat je het blok invoegt. Ook de herinnering bij een verlaten winkelwagen linkt de producten nu naar je winkel.

**Twee onderwerpen testen** (oktober 2026)
Geef een campagne een tweede onderwerp. Een testgroep krijgt half het ene, half het andere onderwerp; na een paar uur krijgt de rest van je lijst het onderwerp waarop het meest geklikt werd. In het rapport zie je per onderwerp hoeveel mails geopend en aangeklikt zijn.
Wat betekent dit voor jou? Je toont je producten zonder knip- en plakwerk, en je hoeft niet meer te raden welk onderwerp het best werkt.

i18n: `public.changelog.changes.email_product_blocks`, `public.changelog.changes.email_ab_subject`

### 2026.12x — Automatische e-mails: welkomstreeks, na aankoop, win-back en verlaten winkelwagen (feature, 19-10-2026)

**Status:** klaar voor verzending zodra MAIL-2a live staat (migratie 20261019230000 + edge functions automation-scheduler, process-campaign-queue, send-campaign-batch, newsletter-confirm, render-campaign-preview + frontend) en de smoketest op SellQo Speeltuin groen is.

**Voor wie:** alle winkels die e-mailmarketing gebruiken.

**Automatische e-mails in Marketing → E-mail → Automatiseringen** (oktober 2026)
Zet met één schakelaar vier automatische mails aan: een welkomstreeks van twee mails voor nieuwe abonnees, een bedankmail na een betaalde bestelling met later een vraag om een review, een mail voor klanten die al een tijd niets bestelden, en een herinnering als iemand bij het afrekenen afhaakt. De teksten staan klaar in het Nederlands, Engels, Frans en Duits en je past ze aan in je huisstijl. Alles staat standaard uit.
Wat betekent dit voor jou? Je blijft in contact met je klanten zonder elke mail zelf te versturen. De mails gaan enkel naar klanten die ingeschreven zijn op je nieuwsbrief, en de winkelwagenherinnering ook naar wie eerder bij je kocht. Ze tellen mee voor je maandelijkse aantal marketingmails.

i18n: `public.changelog.changes.email_automations`

### 2026.12w — Abonnees beheren, voorbeeld in je huisstijl (feature + improvement, 19-10-2026)

**Status:** klaar voor verzending zodra MAIL-1b live staat (migratie 20261019220000 + edge functions newsletter-invite en render-campaign-preview + frontend). Samen met 2026.12v versturen.

**Voor wie:** alle winkels die e-mailcampagnes gebruiken.

**Je abonnees beheren in Marketing → E-mail** (oktober 2026)
In het nieuwe tabblad Abonnees zie je wie je nieuwsbrief krijgt, wie nog moet bevestigen en wie uitgeschreven is. Je kan zoeken, filteren en de lijst als CSV exporteren. Nodig mensen uit met een bevestigingsmail: pas na hun klik krijgen ze je campagnes. Je kan ook iemand uitschrijven of zijn marketinggegevens wissen op verzoek, terwijl bestellingen en facturen bewaard blijven.

**Voorbeeld in je huisstijl en afbeeldingen uit je mediabibliotheek** (oktober 2026)
Het voorbeeld van een campagne of template toont je mail nu zoals je klanten hem krijgen, in de stijl van je winkel, op computer of op mobiel. Afbeeldingen voeg je toe vanuit je mediabibliotheek, en links via een eigen venster. Templates open je met een klik om ze te bewerken, en je kan ze verwijderen.
Wat betekent dit voor jou? Je ziet vóór het versturen hoe je mail eruitziet, en je hebt je lijst zelf in handen.

i18n: `public.changelog.changes.email_subscribers_tab`, `public.changelog.changes.email_editor_improvements`

### 2026.12v — Nieuwsbrieven bereiken al je klanten; inschrijven met bevestiging (bugfix + security, 19-10-2026)

**Status:** klaar voor verzending zodra MAIL-1a live staat (migraties + edge functions + frontend).

**Voor wie:** alle winkels die e-mailcampagnes of het nieuwsbriefformulier gebruiken.

**Nieuwsbrieven bereiken nu al je ingeschreven klanten** (oktober 2026)
Een campagne ging tot nu toe naar maximaal 50 ontvangers, en een ingeplande campagne vertrok niet. Nu gaat elke campagne in de achtergrond naar al je ingeschreven klanten, ook op het geplande moment. Vóór het versturen zie je naar hoeveel mensen ze gaat, en je kan eerst een testmail naar jezelf sturen. Per plan geldt een maandelijks aantal marketingmails.

**Inschrijven op je nieuwsbrief met bevestiging** (oktober 2026)
Wie zich inschrijft, krijgt eerst een mail om te bevestigen. Klanten die bestellen, zijn niet langer vanzelf ingeschreven. Zo stuur je marketing enkel naar wie daar uitdrukkelijk voor koos.
Wat betekent dit voor jou? Je lijst is kleiner maar echt, en je campagnes komen beter aan.

i18n: `public.changelog.changes.email_campaigns_reliable`, `public.changelog.changes.newsletter_double_optin`

### 2026.12u — Herinnering om zelf te posten komt op het moment zelf (improvement, 19-10-2026)

**Status:** niet in de algemene nieuwsbrief. Social is sinds SOCIAL-GATE-1 enkel voor ontgrendelde winkels (de eigen merken). Pas opnemen wanneer Social breder opengaat.

**Herinnering op het moment zelf** (oktober 2026)
Moet je een story of reel zelf posten, dan krijg je de melding nu op het geplande moment in plaats van een uur vooraf, met de link van de link-sticker erbij.

i18n: `public.changelog.changes.social_reminder_on_time`

### 2026.12o — Eén knop voor een post met AI (improvement, 16-10-2026)

**Status:** klaar voor verzending zodra MARKETING-3 live staat. Hoort bij 2026.12n.

**Voor wie:** winkels die AI-tools gebruiken.

**Eén knop voor een post met AI** (oktober 2026)
De aparte tab "Maken" met promo-wizard, toolraster en menukaart is weg. Wil je een post laten schrijven, klik dan op "Post met AI" bovenaan Social. De post komt in je planning en gaat pas online als je hem goedkeurt.
Wat betekent dit voor jou? Eén plek voor je posts, zonder extra scherm.

i18n: `public.changelog.changes.social_ai_one_button`

### 2026.12n — Marketing als één geheel; AI-posts altijd via goedkeuring (improvement + bugfix, 16-10-2026)

**Status:** live op 16-10 (migraties, `social-oauth-init`, sellqo.app). Tekst aangepast aan MARKETING-3 (2026.12o): de tab "Maken" bestaat niet meer. Best samen met 2026.12o versturen.

**Voor wie:** alle winkels die Marketing gebruiken.

**Marketing, maar overzichtelijk** (oktober 2026)
Marketing heeft nu vaste plekken: Social, E-mail, Media, SEO en Ads. AI is geen aparte plek meer, maar een knop waar je hem nodig hebt: posts met "Post met AI" bovenaan Social, e-mails met "Maak met AI" in E-mail. Een post die je met AI maakt, gaat bovendien nooit meer meteen online: hij wacht in de planning op jouw goedkeuring.
Wat betekent dit voor jou? Minder zoeken in het menu, en geen post die online gaat voor je hem gezien hebt.

**i18n-keys.** `public.changelog.changes.marketing_one_whole` en `public.changelog.changes.social_ai_needs_approval` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12m — Leren wat werkt, ook qua inhoud (improvement, 16-10-2026)

**Status:** migraties `20261016230000_social_6_learning.sql` en `20261016230100_social_6_doc_article.sql` live, `social-insights-sync` (SOCIAL-6) gedeployd. Kan mee met 2026.12l in dezelfde nieuwsbrief.

**Voor wie:** winkels die de Social planning met een gekoppeld Instagram-account gebruiken.

**Eerlijk vergelijken, slimmer rangschikken** (oktober 2026)
De tab Resultaten rangschikt je posts nu op een score waarin bewaren, delen en nieuwe volgers zwaarder wegen dan een like, gemeten 48 uur na publicatie. Zo vergelijk je een post van gisteren eerlijk met een post van vorige maand. Hebben je posts labels (pijler, format, soort opening, lengte, oproep tot actie), dan zie je ook welke inhoud het best scoort.
Wat betekent dit voor jou? Je ziet niet alleen wanneer je best post, maar ook wat je best post.

**i18n-keys.** `public.changelog.changes.social_results_content` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12l — Resultaten in de Social planning (feature, 16-10-2026)

**Status:**
- De migraties `20261016210000_social_5a_publish_every_5min.sql`, `20261016220000_social_5_insights.sql` en `20261016220100_social_5_doc_article.sql` worden live gedraaid.
- De edge functies `social-insights-sync` (nieuw) en `social-oauth-init` worden gedeployd.
- Voor de volledige cijfers moet een winkel Instagram één keer opnieuw koppelen.

**Voor wie:** winkels die de Social planning met een gekoppeld Instagram-account gebruiken.

**Zie wat werkt, en wanneer** (oktober 2026)
Onder elke geposte post zie je nu de cijfers van Instagram: bereik, likes, reacties, bewaard en gedeeld. In de nieuwe tab Resultaten zie je welk dagdeel, welke weekdag en welk soort post het best werkt bij jouw volgers, je beste posts en de groei van je volgers. Geplande posts gaan bovendien binnen enkele minuten na het gekozen uur online.
Wat betekent dit voor jou? Je kiest je posttijden op basis van je eigen cijfers in plaats van op gevoel. Koppel Instagram één keer opnieuw om ook bereik, bewaard en gedeeld te zien.

**i18n-keys.** `public.changelog.changes.social_results` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12k — AI-beelden en social-beelden ook in je mediabibliotheek (improvement, 16-10-2026)

**Status:** live sinds 16-10-2026 (migratie `20261016200000_media_2_ai_social.sql` gedraaid en nagemeten, publish sellqo.app). Kan mee in dezelfde nieuwsbrief als 2026.12j.

**Voor wie:** winkels die AI-beelden of de Social planning gebruiken.

**Alles op één plek** (oktober 2026)
Beelden die je met AI maakt of bewerkt, en de beelden van je social posts, staan nu ook in je mediabibliotheek, met een eigen tab voor AI-beelden. Onder Producten → Foto's zie je bovenaan alleen nog je losse foto's, zodat geen enkele foto dubbel staat.

**i18n-keys.** `public.changelog.changes.media_library_ai_social` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12j — Al je foto's in één mediabibliotheek, een fotostandaard en gratis bijsnijden (feature + improvement, 16-10-2026)

**Pas versturen na** het draaien van `20261016190000_media_1_one_library.sql` (+ natrek: unieke index, drie triggers, backfill-telling), `20261016191000_photo_std_1_tenant_media_settings.sql` en daarna `20261016192000_media_1_doc_article.sql`, plus de publish van sellqo.app (Lovable-hosted: pas live na `deploy_project`; voor de app pas na de volgende native build). Recept: `docs/prepared/MEDIA-1-deploy.md`.

**Voor wie:** alle winkels met producten.

**Al je productfoto's in dezelfde vorm** (oktober 2026)
Elke foto die je oplaadt, staat nu automatisch in je mediabibliotheek, ook de foto's die al aan je producten hingen. Met de nieuwe fotostandaard leg je één vorm vast, bijvoorbeeld staand 3:4: SellQo knipt de lege rand weg en zet elk product gecentreerd op hetzelfde canvas. In de fotobewerker snij je gratis bij, draai je en kies je de achtergrond.
Wat betekent dit voor jou? Al je producten ogen even groot in je webshop, er wordt niets meer afgesneden, en je hoeft foto's niet meer zelf op maat te maken. Foto's die nog op de server van een oude Shopify-shop staan, haal je met één klik naar je eigen opslag.

**i18n-keys.** `public.changelog.changes.media_library_all_photos`, `public.changelog.changes.photo_standard` en `public.changelog.changes.photo_editor_frame` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12i — Munten vervallen mee als je een bestelling annuleert (improvement, 16-10-2026)

**Pas versturen na** het draaien van `20261016180000_event_coin_1.sql` + de md5-natrek van de functie, en daarna `20261016181000_event_coin_1_doc_article.sql` (recept: `docs/prepared/EVENT-COIN-1-deploy.md`). Geen edge-deploy en geen publish nodig: het gedrag zit volledig in de database. Bundelen met 2026.12d/2026.12b (zelfde onderwerp: annuleren van ticketbestellingen).

**Voor wie:** winkels met de module Events die munten verkopen.

**Munten vervallen mee bij annuleren** (oktober 2026)
Annuleer je een bestelling of betaal je ze volledig terug, dan wordt de muntenkaart nu automatisch geblokkeerd, net zoals de tickets vervallen.
Wat betekent dit voor jou? Geen munten meer die na een annulering nog aan de bar gebruikt worden, en je hoeft niets meer met de hand te blokkeren. Wat al gebruikt is, blijft gebruikt.

**i18n-keys.** `public.changelog.changes.token_wallet_cancel_order` — 5 talen (nl, en, fr, de, uk; geteld tegen `SUPPORTED_LANGUAGES`).

### 2026.12h — Opzeggen gaat in op het einde van je betaalde periode, en je kunt het ongedaan maken (bugfix + feature, 16-10-2026)

**Pas versturen na** de deploy van `sync-tenant-plan` en `subscription-lifecycle-sweep`, de publish van sellqo.app (Lovable-hosted: pas live na `deploy_project`; voor de app pas na de volgende native build) én nadat de sweep op de echte modus staat (anders blijft een opgezegde winkel na de einddatum op zijn betaalde plan staan; dat is in het voordeel van de winkel, maar de tekst "daarna ga je naar Free" klopt dan nog niet).

**Voor wie:** alle winkels met een betaald SellQo-abonnement.

**Opzeggen kost je geen betaalde dagen meer** (oktober 2026)
Zeg je je abonnement op of kies je Free, dan houd je je plan tot het einde van de periode waarvoor je al betaalde.
Wat betekent dit voor jou? Je verliest niets van wat je betaald hebt, en tot de einddatum kun je de opzegging met één klik ongedaan maken.

**i18n-keys.** `public.changelog.changes.subscription_cancel_period_end` en `public.changelog.changes.subscription_cancel_undo` — 5 talen.

### 2026.12g — Mediabibliotheek in de beeldkiezer (feature, 16-10-2026)

**Pas versturen na** de publish van sellqo.app met EDITOR-MEDIA-1 (Lovable-hosted: pas live na `deploy_project`; voor de app pas na de volgende native build). Bundelen met 2026.12f: de beeldkiezer zelf komt uit die release.

**Voor wie:** winkels op het SellQo-thema (Webshop → Aanpassen).

In de beeldkiezer van Aanpassen staat nu een tabblad Mediabibliotheek met de afbeeldingen die je eerder uploadde:
in de beeldkiezer zelf, je productfoto's, categorie- en eventbeelden en je mediabibliotheek bij Marketing. Zoek op
bestandsnaam en kies met één klik, zonder opnieuw te uploaden.

**i18n-keys.** `public.changelog.changes.image_picker_media_library` — 5 talen.

### 2026.12f — Vier nieuwe homepage-secties, video die pas laadt na een klik en een beeldkiezer (feature, 16-10-2026)

**Pas versturen na** de deploy van de storefront (`f627800` SHOP-SECTIONS-1, `7bb056a` SHOP-POLISH-2) én de publish van sellqo.app met EDITOR-SECTIONS-1 (sellqo.app is Lovable-hosted: pas live na `deploy_project`; voor de app pas na de volgende native build).

**Voor wie:** winkels op het SellQo-thema (Webshop → Aanpassen). Winkels met een eigen frontend zien deze secties niet.

In Aanpassen voeg je nu een diavoorstelling, een strook met logo's en merken, kolommen (twee tot vier blokken naast
elkaar) en een los tekstblok toe aan je homepage. Een videosectie toont eerst alleen een afspeelknop: de speler van
YouTube of Vimeo laadt pas als je bezoeker erop klikt, en tot dan gaat er geen verzoek naar YouTube of Vimeo. Met de
sectie Winkelreviews toon je je reviews van Google, Trustpilot en andere platformen, met je gemiddelde score. De
vragen uit je FAQ-sectie staan nu ook als gestructureerde gegevens in je homepage, zodat zoekmachines ze kunnen
lezen. Afbeeldingen kies of upload je met de beeldkiezer, in plaats van een link te plakken.

**i18n-keys.** `public.changelog.changes.homepage_sections_slideshow_logos_columns` — 5 talen.

### 2026.12e — Minder schijnknoppen in de vertaalhub, je profiel en de kassa (improvement, 16-10-2026)

**Pas versturen na de publish** van sellqo.app (puur frontend; voor de app pas na de volgende native build).

**Voor wie:** iedereen die de vertaalhub of de kassa (cadeaubonnen) gebruikt.

In de vertaalhub staan geen schakelaars meer om automatisch te vertalen: ze werden opgeslagen, maar er gebeurde
niets mee. Vertalen doe je per item of in bulk. Een cadeaubon die je in de kassa afdrukt, krijgt nu een echte
QR-code met de boncode. In je profiel is de camera-knop weg die altijd uitgeschakeld stond, en een AI-voorstel over
voorraad brengt je naar je producten met lage voorraad.

**i18n-keys.** `public.changelog.changes.admin_dead_controls_cleanup` — 5 talen.

### 2026.12d — Ticketbestellingen annuleren na de ticketmail, gratis tickets sneller afgerekend (improvement, 16-10-2026)

**Pas versturen na de deploy** van `update-order-fulfillment-status` en `storefront-api` (EVENT-ORDER-1).

**Voor wie:** iedereen die tickets verkoopt (events-module); het snellere gratis afrekenen geldt voor elke winkel met €0-bestellingen.

Een bestelling met alleen tickets, combitickets of munten kan je nu ook na de ticketmail nog gewoon annuleren:
kies Geannuleerd bij de orderstatus, en de tickets die nog niet gescand zijn vervallen meteen. Gratis bestellingen
(bijvoorbeeld met een kortingscode van 100%) krijgen de bevestiging meteen in plaats van na zo'n tien seconden.

**Samen versturen met** 2026.12b en 2026.12c (event-items).

**i18n-keys.** `public.changelog.changes.ticket_order_cancel_delivered`, `public.changelog.changes.free_checkout_faster` — 5 talen.

### 2026.12c — De deurscanner blijft werken bij slecht bereik (improvement, 16-10-2026)

**Voor wie:** iedereen die tickets scant aan de deur (events-module).

De scanner wacht nooit meer eindeloos: na 8 seconden probeert hij één keer opnieuw, en je ziet wanneer hij bezig is.
Zonder verbinding krijg je een grijze melding met "Opnieuw proberen" in plaats van een rode "ongeldig", en bovenaan
zie je of je gsm online is. Geannuleerde en terugbetaalde tickets krijgen voortaan die tekst.

**Samen versturen met** 2026.12b en de andere event-items.

**i18n-keys.** `public.changelog.changes.door_scanner_bad_network` — 5 talen.

### 2026.12b — Geannuleerde tickets vervallen, geen dubbele bestelnummers meer (bugfix, 16-10-2026)

**Voor wie:** iedereen die tickets verkoopt; het bestelnummer geldt voor alle winkels.

Annuleer je een bestelling of betaal je ze volledig terug, dan vervallen de tickets die nog niet gescand zijn en
komen de plaatsen vrij. Gelijktijdige bestellingen krijgen altijd elk een eigen nummer, en betaalt iemand net
terwijl je event volzet raakt, dan krijg je meteen een dringende melding.

**i18n-key:** `public.changelog.changes.ticket_cancel_ordernumbers`

### 2026.12b — Elk ticket apart in de bestelling (improvement, 16-10-2026)

**Voor wie:** iedereen die tickets verkoopt (events-module).

Op een bestelling met tickets zie je nu elk ticket apart: event en datum, tickettype, houder, het einde van de
ticketcode en de status (geldig, ingecheckt met tijdstip, geannuleerd). Een vraag van een bezoeker beantwoord je
zo zonder de scanner te openen.

**Samen versturen met** 2026.11s en 2026.11t (event-items).

**i18n-keys.** `public.changelog.changes.event_admin_tickets` — 5 talen.

### 2026.12a — Nu posten vanuit de Social planning (feature, 16-10-2026)

**Voor wie:** iedereen die de Social planning gebruikt.

"Nu posten" zet een post meteen online, zonder op het geplande uur te wachten. Lukt het niet meteen, dan
probeert SellQo het binnen het uur opnieuw.

**Samen versturen met** 2026.11w t/m 2026.11z.

**i18n-keys.** `public.changelog.changes.social_post_now` — 5 talen.

### 2026.11z — Elk beeld bekijken en downloaden, taal van een post veranderen (improvement, 15-10-2026)

**Voor wie:** iedereen die de Social planning gebruikt.

Bekijken en Downloaden onder elke post (elk beeld apart, ook video). "Taal veranderen" vertaalt caption en
tekst in de beelden (1 AI-credit), met nakijken en resultaat vóór bewaren.

**Samen versturen met** 2026.11w t/m 2026.11y.

**i18n-keys.** `public.changelog.changes.social_media_language` — 5 talen.

### 2026.11y — De tekst in je beeld zelf aanpassen (feature, 15-10-2026)

**Voor wie:** iedereen die posts laat klaarzetten in de Social planning.

Nieuw: "Tekst in beeld". Pas de titel, prijs of onderregel in het beeld zelf aan, met een voorbeeld dat
meeverandert. Voor je bewaart, zie je het beeld precies zoals het online gaat.

**Samen versturen met** 2026.11w en 2026.11x.

**i18n-keys.** `public.changelog.changes.social_image_text` — 5 talen.

### 2026.11x — Songvoorstellen bij reels en opnieuw maken in een andere taal (improvement, 15-10-2026)

**Voor wie:** iedereen die social posts plant.

Bij een reel stelt de Social planning nu concrete nummers voor om in Instagram te zoeken. Bij "Opnieuw maken"
kies je ook de taal van de nieuwe versie, bv. Engels voor internationale volgers.

**Samen versturen met** 2026.11w.

**i18n-keys.** `public.changelog.changes.social_songs_language` — 5 talen.

### 2026.11w — Social planning: reels en een herinnering voor wat je zelf post (feature, 15-10-2026)

**Voor wie:** iedereen die social posts plant.

Reels staan nu ook in de Social planning, met videovoorbeeld en muziekvoorstel. Per reel kies je: automatisch
posten in de versie met muziek, of zelf een nummer kiezen in de Instagram-app (video downloaden en caption
kopiëren met één tik). Voor alles wat je zelf post krijg je ongeveer een uur vooraf een melding.

**Niet versturen vóór** de eerste reel via de planning online stond (Loveke, 25-10).

**i18n-keys.** `public.changelog.changes.social_reels_reminders` — 5 talen.

### 2026.11v — Social planning: je posts per week goedkeuren (feature, 15-10-2026)

**Voor wie:** iedereen die social posts plant.

Nieuw onder Marketing → Social planning: al je geplande posts per week, met het beeld zoals op Instagram,
de tekst en het uur. Goedkeuren per post of per week, tekst en uur aanpassen, schrappen. Goedgekeurde posts
gaan vanzelf online. Stories met stickers staan er ook, om zelf te posten en af te vinken.

**Niet versturen vóór** de eerste echte posts via de planning online stonden (Loveke, launchweek).

**i18n-keys.** `public.changelog.changes.social_planning_approval` — 5 talen.

### 2026.11u — Ingeplande social posts worden nu echt gepubliceerd (feature, 15-10-2026)

**Voor wie:** iedereen die social posts maakt (SellQo Connect → Kanalen, social commerce).

Ingeplande posts voor Facebook en Instagram gaan nu automatisch online, binnen het uur na het gekozen
tijdstip. Instagram-posts komen echt op Instagram (voorheen op de Facebook-pagina), met carrousels
(2–10 beelden; PNG-productfoto's worden automatisch omgezet naar JPEG). Instagram koppel je rechtstreeks in SellQo Connect → Kanalen. Mislukt iets, dan
volgt een melding met de reden.

**Niet versturen vóór** SOCIAL-1 gedeployed is en minstens één echte post via de scheduler online stond.

**i18n-keys.** `public.changelog.changes.social_posts_published` — 5 talen.

### 2026.11t — De scanner herkent zelf het event (feature, 15-10-2026)

**Voor wie:** iedereen die tickets scant (events-module).

Geen eventkeuze meer: het ticket wijst het event aan, de deur bewaakt het scanvenster (standaard 1u vóór
tot 1u na, instelbaar onder Events → Deur). Buiten het venster: oranje met de juiste datum + Toch inchecken.
Vaste deurlink per winkel: één beginscherm-icoon voor al je events.

**i18n-keys.** `public.changelog.changes.door_scanner_auto` — 5 talen.

### 2026.11s — Ticketbestellingen ronden zichzelf af (improvement, 15-10-2026)

**Voor wie:** iedereen die tickets of munten verkoopt (events-module).

De ticketmail ís de levering: een betaalde bestelling met alleen tickets/combi's/munten gaat
automatisch naar Geleverd, met de maildatum als leverdatum. Event-taal in de orderlijst
(Wacht op betaling / Tickets verstuurd). Gemengde bestellingen (ticket + fysiek product)
volgen de gewone flow.

**i18n-keys.** `public.changelog.changes.ticket_orders_auto_complete` — 5 talen.

> Teaser-kanaal: zodra de blogdrafts van 15-10 gepubliceerd zijn, linkt elk item naar zijn
> artikel (`/blog/<slug>`). Niet versturen vóór publicatie en go van Akke.

### 2026.11r — Verzending, Shop Health en je dashboard in je eigen taal (improvement, 15-10-2026)

**Voor wie:** iedereen die SellQo in het Engels, Frans, Duits of Oekraïens gebruikt.

Verzendmethodes, regio-keuzes, Shop Health en de dashboardwidgets volgen nu je eigen taal, inclusief landnamen en datums.
Lees meer → /blog/sellqo-spreekt-nu-ook-oekraiens

**i18n-keys.** `public.changelog.changes.shipping_health_dashboard_translated` — 5 talen.

### 2026.11q — "Eén keer per klant" bij kortingscodes werkt nu echt (bugfix, 15-10-2026)

**Voor wie:** iedereen die kortingscodes gebruikt.

Een code met een limiet per klant wordt nu afgedwongen op e-mailadres, ook voor gasten. Gebruik telt vanaf de betaling;
annuleren of terugbetalen geeft het gebruik terug.
Wat betekent dit voor jou? Welkomstcodes en eenmalige acties kunnen niet meer herhaald worden door dezelfde klant.

**i18n-keys.** `public.changelog.changes.discount_once_per_customer` — 5 talen.

### 2026.11p — Combitickets en Munten in het menu, teksten in je eigen taal (improvement, 15-10-2026)

**Voor wie:** eventorganisatoren en anderstalige teamleden.

Combitickets en Munten staan nu onder Events in het menu. Printful-, OSS-btw- en meldingteksten verschijnen in je eigen taal.
Lees meer → /blog/combitickets-en-munten-voor-festivals
[Menukaart in Sellqo AI: nu ook in het Horeca-abonnement → /blog/sellqo-ai-merk-dna-en-dagmenu]

**i18n-keys.** `public.changelog.changes.translated_labels_and_event_menu` — 5 talen.

### 2026.11o — Ticketmail ook na betaling per overschrijving (bugfix, 14-10-2026)

**Voor wie:** winkels die tickets of munten verkopen met overschrijving.

De ticketmail gaat nu ook uit als je een bestelling handmatig op betaald zet (knop, bankafstemming, bulkactie).
Nieuwe kaart Tickets en munten bij de bestelling, met verzenddatum en Tickets opnieuw mailen.

**i18n-keys.** `public.changelog.changes.ticket_mail_after_manual_payment` — 5 talen.

### 2026.11n — Combitickets en munten voor festivals (feature, 14-10-2026)

**Voor wie:** festivals, meerdaagse events, iedereen met een bar of foodstand (events-module).

**Combitickets.** Weekendticket, combi met camping, VIP-weekend: één aankoop, per dag een eigen ticket met QR.
**Munten.** Muntenpakketten in de webshop, één QR per koper, afschrijven aan de bar met een barlink (geen account),
terugdraaien binnen 10 minuten. Ongebruikte munten laat de klant zelf terugstorten (retour, jij keurt goed).
Demo: demo-festival.sellqo.shop.

**i18n-keys.** `public.changelog.changes.festival_combos_and_tokens` — 5 talen.

### 2026.11m — Acht nieuwe thema's en voorbeeldwinkels (feature, 14-10-2026)

**Voor wie:** iedereen met een SellQo-webshop.

**Nieuwe thema's.** Concertzaal & theater, Festival, Tech & gadgets, Beauty & verzorging, Bar & café, Restaurant & bistro,
Wijn & delicatessen en Koffie & thee. Elk thema met een echte voorbeeldwinkel; alles samen op sellqo.app/voorbeelden.
Nieuwe homepagesectie Agenda voor events.

**i18n-keys.** `public.changelog.changes.themes_and_examples` — 5 talen.

### 2026.11l — Zaalplannen met stoelkeuze (feature, 14-10-2026)

**Voor wie:** zalen, theaters, concertorganisatoren (events-module).

**Kies je stoel.** Zaal tekenen onder Events → Zalen, koppelen aan een datum, en je bezoekers kiezen zelf hun stoel
in de webshop. Stoel op het ticket en in de mail; annulatie geeft de stoel vrij. Demo: demo-concertzaal.sellqo.shop.

**i18n-keys.** `public.changelog.changes.seating_plans` — 5 talen.

### 2026.11i — Elke eventdatum meteen te koop (improvement, 14-10-2026)

**Voor wie:** winkels die tickets verkopen (Events Flex en elk plan met tickets).

**Geen vergeten stap meer.** Een nieuwe datum is meteen verkoopbaar; tickettype en ingang maakt SellQo
zelf aan. Bij elke datum staat "Klaar voor verkoop" of waarom niet.

**Minder klikken.** Eindtijd, locatie en verzamelpunt vul je in bij het aanmaken, vooraf ingevuld met je
laatste datum. Zonder verzamelpunt krijg je een waarschuwing, want dan staat er geen plaats in de ticketmail.

**i18n-key.** `public.changelog.changes.event_dates_ready_to_sell` — vijf talen, volledige pariteit.

### 2026.11h — Verzendmail in de taal van je klant (improvement, 14-10-2026)

**Voor wie:** winkels die verzenden.

**In de taal van je klant.** De verzendmail met tracknummer gaat in het Nederlands, Engels, Frans of Duits,
in de huisstijl van je winkel. Hij staat ook in je inbox bij de bestelling.

**Ook automatisch.** Zendingen die Printful of je vervoerder op verzonden zetten, krijgen dezelfde mail.
Dezelfde zending wordt nooit twee keer gemaild.

**i18n-key.** `public.changelog.changes.shipping_email_customer_language` — vijf talen, volledige pariteit.

### 2026.11g — Pushmeldingen in de webapp (feature, 10-10-2026)

**Voor wie:** alle winkels, vooral teamleden die de SellQo-app niet mogen installeren (bedrijfstelefoons).

**Meldingen zonder de app.** Zet SellQo op je beginscherm en zet meldingen aan onder Instellingen → Mijn
meldingen. Op iPhone en iPad doe je dat vanuit Safari via Deel → Zet op beginscherm; meldingen werken
daar alleen vanuit het beginscherm.

**Geen dubbele meldingen.** Onder Mijn toestellen zie je alle toestellen die jouw meldingen krijgen, en
koppel je er één los. Staat de app en de webapp op dezelfde telefoon, dan vraagt SellQo om de webapp uit
te zetten: de app heeft voorrang.

**i18n-key.** `public.changelog.changes.web_app_push` — vijf talen, volledige pariteit.

### 2026.11f — Al je klantberichten in je SellQo-inbox (improvement, 29-09-2026)

**Voor wie:** alle winkels.

**Berichten via het contactformulier van je webshop komen nu altijd in je SellQo-inbox**, net als
antwoorden van klanten op je mails. Komt er een nieuw bericht binnen, dan krijg je een e-mail met wie het
stuurde en het begin van het bericht, en een knop om het meteen te openen.

**Liever je eigen adres?** Wil je antwoorden van klanten op je eigen e-mailadres ontvangen, kies dat dan
onder Instellingen → Email Inbox bij Klantcontact-e-mail.

**i18n-key.** `public.changelog.changes.all_messages_in_inbox` — vijf talen, volledige pariteit.

### 2026.11e — Een melding opent meteen het juiste item (improvement, 19-09-2026)

**Voor wie:** alle winkels, in de app en in de browser.

**Tik op een melding en je komt meteen bij de bestelling of het bericht.** Ook producten, offertes,
klanten en campagnes openen rechtstreeks; bij een factuur toont de factuurlijst meteen die factuur.
Tot nu toe kwam je soms op het dashboard of op een foutpagina terecht.

**Meerdere winkels?** Hoort de melding bij een andere winkel die je beheert, dan wisselt SellQo eerst
naar die winkel en opent daarna het item.

**i18n-key.** `public.changelog.changes.notification_opens_item` — vijf talen, volledige pariteit.

### 2026.11d — Meldingen staan standaard aan (improvement, 18-09-2026)

**Voor wie:** alle winkels, iedereen met de SellQo-app op de telefoon.

**Je krijgt nu standaard pushmeldingen; zet uit wat je niet wil in Instellingen → Mijn
meldingen.** Tot nu toe moest je elke soort melding zelf aanzetten, en wie dat niet wist, kreeg
niets. Nu staat alles wat bij je rol hoort meteen aan.

**Berichten van klanten ook per e-mail.** Een nieuw bericht van een klant — per e-mail,
contactformulier, WhatsApp, Facebook, Instagram of Bol.com — krijg je standaard ook in je
mailbox. Stuurt dezelfde klant kort na elkaar meerdere berichten via hetzelfde kanaal, dan krijg
je hooguit één e-mail per kwartier. Uitzetten kan per soort bericht onder Instellingen → Winkel
Notificaties.

**i18n-key.** `public.changelog.changes.notifications_on_by_default` — vijf talen, volledige pariteit.

### 2026.11c — Een melding bij elk contactbericht uit je webshop (improvement, 18-09-2026)

**Voor wie:** winkels met een contactformulier in hun webshop.

**Je mist geen contactbericht meer.** Vult een bezoeker het contactformulier in, dan krijg je
een melding onder het belletje, net als bij een inkomende e-mail. Het bericht zelf staat in je
inbox.

**Ook op je telefoon.** Zet "Contactformulier" aan onder Instellingen → Mijn meldingen, dan
krijg je er een pushmelding van in de SellQo-app.

**i18n-key.** `public.changelog.changes.contact_form_notification` — vijf talen, volledige pariteit.


### 2026.11b — Antwoorden van klanten komen in je SellQo-inbox (feature, 18-09-2026)

**Voor wie:** elke winkel die mails naar klanten stuurt.

**Je eigen SellQo-adres.** Mails van je winkel aan klanten komen voortaan van
jouwwinkel@mail.sellqo.app, met de naam van je winkel als afzender.

**Antwoorden in je inbox.** Antwoordt een klant op een orderbevestiging, factuur of
nieuwsbrief, dan komt dat antwoord rechtstreeks in je SellQo-inbox, met een melding erbij. Geen
gemiste klantvragen meer tussen je andere mail.

**Liever je eigen adres?** Onder Instellingen → Email Inbox kies je bij Klantcontact-e-mail voor
"Eigen adres". Dan gaan antwoorden daarheen, buiten SellQo om.

**i18n-key.** `public.changelog.changes.customer_replies_inbox` — vijf talen, volledige pariteit.


### 2026.11a — Stel zelf je klantcontactadres in (feature, 18-09-2026)

**Voor wie:** elke winkel die mails naar klanten stuurt — dus iedereen.

**Jouw adres, jouw keuze.** Onder Instellingen → Email Inbox kies je voortaan zelf het
e-mailadres dat je klanten zien in orderbevestigingen, facturen, offertes en nieuwsbrieven.
Antwoordt een klant op zo'n mail, dan komt dat antwoord op dit adres binnen.

**Niets ingevuld?** Dan komen antwoorden in je SellQo-inbox (zie 2026.11b). _Bijgewerkt
18-09, vóór verzending: in de eerste versie stond hier het adres van de eigenaar._

**Je meldingsadres blijft van jou.** Het adres dat je bij Winkel Notificaties instelt voor
je eigen meldingen, zien klanten niet meer.

**i18n-key.** `public.changelog.changes.customer_contact_email` — vijf talen, volledige pariteit.


### 2026.10z — Meldingen houden rekening met je rol (security, 13-09-2026)

**Voor wie:** winkels met teamleden in een andere rol dan beheerder (magazijn,
marketing, boekhouder, medewerker, kijker). Als beheerder verandert er niets.

**Wat er veranderde.** Tot nu toe zag elk teamlid alle meldingen van de winkel in het
belletje, ook over facturen en betalingen — terwijl diezelfde persoon de facturen zelf
niet mocht openen. Voortaan volgen meldingen dezelfde rechten als de rest van SellQo. Een
magazijn- of marketingmedewerker ziet geen meldingen meer over facturen, offertes,
abonnementen of betalingen.

**Ook voor push.** Pushmeldingen op de telefoon volgen dezelfde regel. Wie van rol
veranderde, krijgt geen push meer voor wat hij niet meer mag zien, ook als hij die eerder
had aangezet.

**Moet je iets doen?** Nee.

**i18n-key.** `public.changelog.changes.notifications_follow_role` — vijf talen, volledige
pariteit.


### 2026.10x + 2026.10y — Pushmeldingen op je telefoon (feature, 13-09-2026)

> Bijgewerkt voor PUSH-2 (13-09-2026), nog vóór verzending. De eerste versie beschreef
> push als winkelinstelling voor het hele team; die werking bestaat niet meer. Eén item
> in plaats van twee, zodat tenants niet eerst de oude en dan de nieuwe werking lezen.

**Voor wie:** iedereen die de SellQo-app op zijn telefoon gebruikt.

**Nieuwe bestellingen als melding op je telefoon.** In Instellingen → Mijn meldingen zet
je per soort melding push aan. Je krijgt dan een seintje op je telefoon, ook als de app
dicht is.

**Wees eerlijk tegen je lezers over het verleden.** De app vroeg al een tijd om toestemming
voor meldingen, en een helpartikel beloofde dat je bestellingen op je telefoon zou krijgen.
Dat werkte niet: er was geen manier om push aan te zetten. Wie zich afvroeg waarom er nooit
iets binnenkwam, lag het dus niet aan zijn telefoon.

**Push is persoonlijk.** Wat je aanzet, komt alleen op jouw telefoon binnen. Je teamleden
kiezen elk zelf wat zij willen ontvangen, en je ziet alleen de soorten meldingen die bij
je rol horen. De magazijnmedewerker krijgt dus geen trillende telefoon omdat de eigenaar
push aanzette.

**Push start uit.** Voor elke soort melding moet je hem zelf aanzetten. Dat is een bewuste
keuze: een melding op je scherm is opdringeriger dan een mail, en je wilt niet overvallen
worden door tachtig soorten tegelijk. Begin met de handvol die je echt meteen wilt weten.

**Zag je de schakelaar al in Winkel Notificaties?** Die stond daar een paar uur, en is
verhuisd. Zet push opnieuw aan in Mijn meldingen.

**Meerdere winkels?** Je instellingen gelden voor de winkel die open staat; wissel van
winkel om een andere in te stellen. Wie meldingen van meer dan één winkel krijgt, ziet de
winkelnaam vóór de melding. En een melding aantikken opent meteen het juiste scherm — ook
als dat bij een andere winkel hoort dan die je open had.

**Er komt niets binnen?** Kijk eerst of push aan staat voor die soort melding, met de
juiste winkel open; dat is verreweg de meest voorkomende oorzaak. Pas daarna: of je
telefoon meldingen van SellQo toestaat.

**i18n-keys.** `public.changelog.changes.push_notifications_live`,
`.push_notifications_multi_shop` en `.push_per_user` — vijf talen, volledige pariteit.


### 2026.10w — De navigatie op je telefoon (improvement + security, 12-09-2026)

**Voor wie:** iedereen die de admin op een telefoon gebruikt. Op desktop verandert
er niets.

**De onderste balk zweeft.** De navigatie onderaan is nu een zwevende, afgeronde
balk in plaats van een strook over de volle breedte. De vier snelkoppelingen zijn
Dashboard, Bestellingen, Producten en Inbox. Het volledige menu opent nog steeds
met de knop linksboven — daar verandert niets aan.

**Je ziet nu waar je bent.** Opende je een bestelling of een product, dan lichtte
geen enkel tabblad meer op. Dat is rechtgezet: de actieve pagina blijft gemarkeerd,
ook op een detailpagina.

**En hij houdt rekening met je rol.** Dit is het belangrijkste deel. De balk toonde
aan iedereen dezelfde tabbladen — ook als je rol of je abonnement die pagina
helemaal niet bevat. Voortaan volgt hij dezelfde regels als het menu aan de zijkant.
Voor de inbox lag dat het gevoeligst: medewerkers met een magazijn- of
boekhoudrol konden via die balk bij klantberichten komen. Die pagina is nu
afgeschermd.

**Wat je kunt merken.** Werk je met medewerkers in een beperkte rol, dan zien die
vanaf nu minder tabbladen onderaan dan voorheen. Dat is de bedoeling — ze zagen
knoppen naar pagina's waar ze niet hoorden te komen.

**i18n-keys.** `public.changelog.changes.admin_floating_bottom_nav` en
`.admin_bottom_nav_permissions` — vijf talen, volledige pariteit.


### 2026.10v — Vier dingen die stuk waren, weer heel (bugfix, 12-09-2026)

**Voor wie:** iedereen. De vier onderdelen hieronder staan los van elkaar; kies
gerust alleen wat voor jouw lezers relevant is.

**Retourmails gingen niet de deur uit.** De e-mails rond een retour — aanvraag
ontvangen, goedgekeurd, pakket binnen, bedrag terugbetaald — werden niet verstuurd.
In plaats daarvan verscheen de melding dat de retour niet gevonden was, terwijl die
er wel degelijk was. Wie retouren verwerkt en zich afvroeg waarom klanten niets
hoorden: dat was dit. Het is opgelost.

**Uitbetalingen en transacties laadden niet.** De schermen met je Stripe-uitbetalingen,
je saldo en je transacties gaven een foutmelding in plaats van je gegevens. Ze werken
weer. Deze schermen zijn bedoeld voor de rollen beheerder en boekhouder.

**Het winkelvoorbeeld in de app sloot zichzelf op.** Tikte je in het voorbeeld van je
winkel op een product, dan sprong de app naar je eigen domein — zonder terugknop, zodat
je de app moest afsluiten om terug te komen. Het voorbeeld blijft nu een voorbeeld,
inclusief de balk waarmee je terugkeert.

**De periodekeuze bij Bol-advertenties deed niets.** Wisselen tussen 7, 30 en 90 dagen
liet steeds dezelfde zeven dagen zien. Grafieken en kengetallen volgen nu de periode
die je kiest.

**Wat je mag verwachten bij die laatste.** Bol.com levert hoogstens dertig dagen
historie. De weergave van negentig dagen is daarmee niet meteen gevuld: die groeit mee
naarmate er dagen bijkomen. Een linkerhelft die nog leeg is, is dus geen storing.

**i18n-keys.** `public.changelog.changes.return_emails_delivered`,
`.merchant_payout_pages`, `.app_shop_preview_stays`, `.bol_ads_period_filter` —
vijf talen, volledige pariteit (`scripts/i18n-parity.mjs` groen).


### 2026.10u — Abonnementsfacturen nemen het btw-regime van je klant over (bugfix, 25-08-2026)

**Voor wie:** elke tenant die met abonnementen factureert, en in het bijzonder wie
zakelijke klanten in andere EU-landen bedient.

Facturen die uit een abonnement ontstaan, behandelden elke klant als particulier.
Ze kregen altijd het binnenlandse btw-regime — ook als het om een zakelijke klant
met een geldig Europees btw-nummer ging. Dat is rechtgezet.

Abonnementsfacturen volgen nu dezelfde btw-bepaling als je webshopfacturen. Staat
een klant als zakelijk geregistreerd, dan wordt dat ook zo op de factuur
vastgelegd. Heeft die klant een geldig btw-nummer uit een ander EU-land, dan wordt
de btw verlegd: 0% op de factuur, met de wettelijk verplichte vermelding erbij.

**Wat er niet verandert.** Binnenlandse tarieven blijven staan zoals ze waren, ook
de verlaagde van 6% en 12%. Een Belgische zakelijke klant betaalt gewoon Belgische
btw — bij een klant in hetzelfde land als jij verandert er niets aan het bedrag.

**Wat je zelf moet controleren.** De btw-behandeling volgt uit de klantgegevens.
Klopt het klanttype niet, of ontbreekt het btw-nummer, dan valt de factuur terug op
binnenlandse btw. Het nummer wordt bij het aanmaken van de factuur gecontroleerd bij
de Europese VIES-databank; wordt het daar afgekeurd, dan rekenen we liever btw aan
die achteraf verrekend wordt dan een verlegging die niet standhoudt.

**Facturen van vóór deze wijziging worden niet automatisch aangepast.** Reeds
verstuurde of betaalde facturen blijven staan zoals ze zijn.

**i18n-keys.** `public.changelog.changes.subscription_invoice_vat_regime` —
NL/EN/FR/DE/UK aanwezig, KLAARZETTEN, nog niet verstuurd.

**In-app documentatie:** doc-artikel "BTW op abonnementsfacturen"
(slug `btw-op-abonnementsfacturen`, context `/admin/orders/subscriptions`).

### 2026.10t — Je klanten bevestigen hun e-mailadres (security, 24-08-2026)

**Voor wie:** elke tenant met klantaccounts in de webshop.

**Afweging vooraf:** een security-hardening hoort meestal níet in de nieuwsbrief.
Deze wél, want hij voegt een zichtbare stap toe voor jóuw klanten — er komt een
extra mail, en wie hem negeert ziet zijn bestelgeschiedenis niet. Daar krijg je
supportvragen over. Het item gaat dus over de nieuwe stap, niet over wat we
hebben dichtgezet.

Klanten die een account aanmaken in je webshop krijgen voortaan een
bevestigingsmail. Pas na die klik kunnen ze hun bestelgeschiedenis inzien.

Winkelen, bestellen en afrekenen veranderen niet. Alleen het overzicht "Mijn
bestellingen" blijft afgeschermd tot het adres bevestigd is. De link is 48 uur
geldig; komt de mail niet aan, dan kan de klant hem opnieuw laten sturen vanuit
zijn account.

**Klanten die al een account hadden hoeven niets te doen.** Die zijn eenmalig als
bevestigd gemarkeerd en houden gewoon toegang.

Wat betekent dit voor jou? Vrijwel niets in de dagelijkse praktijk. Krijg je een
klant aan de lijn die zijn bestellingen niet meer ziet: laat hem in zijn spammap
kijken en de bevestigingsmail opnieuw versturen.

**i18n-keys.** `public.changelog.changes.storefront_customer_email_verification` —
NL/EN/FR/DE/UK aanwezig, KLAARZETTEN, nog niet verstuurd.

**In-app documentatie:** doc-artikel "Klanten bevestigen hun e-mailadres"
(slug `klant-e-mailverificatie`, context `/admin/customers`).

### 2026.10s — De marketingwerkplek in vijf talen (improvement, 24-08-2026)

**Voor wie:** elke tenant die met een marketingcollega werkt, en zeker wie
teamleden heeft die geen Nederlands spreken.

Werk je met een marketingcollega die geen Nederlands spreekt? Elk scherm dat de
marketingrol kan openen staat nu volledig in het Nederlands, Engels, Frans,
Duits en Oekraïens: het dashboard, de inbox, bestellingen, producten, klanten,
campagnes, SEO, advertenties, promoties, de vertaalhub en analytics. Dat gaat om
ruim 200 schermen en zo'n 2.500 teksten — knoppen, labels, tabbladen,
foutmeldingen en de meldingen die na een actie verschijnen. Ook de teksten in
keuzelijsten, statusbadges en formuliervalidatie zijn meegenomen.

Je stelt de taal per gebruiker in bij je profiel. Iedereen ziet de admin dus in
zijn eigen taal, ongeacht de taal van je webshop.

En passant is een oud ongemak weg: datums in de admin stonden altijd in het
Nederlands, ook als je de admin in het Frans of Duits gebruikte. Je zag dan
"maandag 4 maart" of "3 dagen geleden" midden in een Franse pagina. Dag- en
maandnamen en relatieve tijdsaanduidingen volgen nu de taal die je zelf hebt
ingesteld.

Bedragen blijven wél in het Nederlandse formaat staan, met een komma als
decimaalteken. Dat is bewust: je facturen, exports en boekhoudkoppeling
gebruiken hetzelfde formaat, en dat mag niet per gebruiker verschillen.

**i18n-keys:** `public.changelog.changes.marketing_role_multilingual` en
`public.changelog.changes.admin_dates_follow_language` in
`src/i18n/locales/landing.{nl,en,fr,de,uk}.json`.

**In-app documentatie:** het doc-artikel "De taal van je admin instellen"
(slug `admin-taal-instellen`, context `/admin/settings`).

### 2026.10r — De menukaart maakt nu je posts (feature + security, 21-08-2026)

**Eén klik en je ochtendmenu ligt uitgewerkt op tafel** (oktober 2026)
Boven in het tabblad Menukaart staat nu "Menu van vandaag". Sellqo AI werkt je ochtendmenu in één
keer uit tot kant-en-klare kaarten: per categorie een tekst met hashtags, in het formaat dat er het
beste bij past — post, reel, verhaal of carrousel. Elke kaart zie je als preview zoals hij op het
kanaal zou landen, dus een te lange tekst voor een verhaal valt meteen op. De categorie "verras me"
kiest zelf een invalshoek op basis van je merk-DNA en wat er in je winkel speelt, en vertelt erbij
waarom. Per kaart kies je: klaarzetten als concept, bijstellen of weggooien.
Wat betekent dit voor jou? Een heel menu kost 5 credits, ongeacht het aantal kaarten. Beeld wordt
niet automatisch gemaakt — dat vraag je per kaart aan voor 5 credits, zodat je alleen betaalt voor
wat je gebruikt.

**Twee AI-functies strenger afgeschermd** (oktober 2026)
Beeldgeneratie en de marketinginzichten controleerden wel of je ingelogd was, maar niet bij welke
winkel je hoort. Dat is dichtgezet: beide controleren nu je toegang tot de winkel én je rol. Aan het
gebruik verandert niets.

**i18n-keys.** `public.changelog.changes.ai_daily_menu_generator` en
`public.changelog.changes.ai_image_tenant_check` — KLAARZETTEN, nog niet verstuurd.

**LET OP bij verzending.** Niet schrijven dat het menu zichzelf elke ochtend klaarzet: er is nog
géén planning of automatische ronde, het blijft voorlopig een knop. De tekst hierboven vermijdt die
claim bewust. Ook niet beloven dat posts automatisch gepubliceerd worden — kiezen levert een
concept, publiceren doet de tenant zelf via het gekoppelde kanaal.

**Beschikbaarheid.** Alleen Pro en Enterprise (`social_commerce`).

**Bundel:** hoort bij 2026.10q. Die twee samen versturen als één verhaal over de menukaart — het
q-item is het fundament, dit item maakt het bruikbaar.

### 2026.10q — Merk-DNA en ochtendmenu in Sellqo AI (feature, 20-08-2026)

**Je merk-DNA en ochtendmenu leg je nu zelf vast** (oktober 2026)
Sellqo AI heeft een nieuw tabblad: Menukaart. Daar beschrijf je één keer wie je merk is — missie,
doelgroep, tone of voice, sterke punten, vaste thema's, wat je wel en niet wilt zeggen, en
hashtag-sets die je per thema hergebruikt. Er is ook een vrij veld voor alles wat in geen hokje
past. Daaronder stel je je ochtendmenu samen: per categorie kies je hoeveel posts je wilt, van
productpost en klantverhaal tot "verras me", en je legt vast of de nadruk op korte, uitgebreide,
beeldgedreven of carrousel-posts ligt. Mist er een categorie, dan maak je er zelf een aan met een
eigen instructie — die instructie is verplicht, zodat er geen categorie ontstaat waar de generator
niets mee kan.
Wat betekent dit voor jou? Je legt de basis vast waarop de dagelijkse contentgeneratie straks
draait, in plaats van elke post opnieuw uit te leggen wie je bent.

**i18n-key.** `public.changelog.changes.ai_content_menu_brand_dna` — KLAARZETTEN, nog niet
verstuurd.

**LET OP bij verzending.** Dit is batch 1: het fundament. Er wordt **nog niets gegenereerd** —
het invullen werkt, de dagelijkse generatie komt in batch 2. Niet schrijven dat je nu al elke
ochtend content krijgt. De tekst hierboven vermijdt die claim bewust ("legt de basis vast waarop
… straks draait").

**Beschikbaarheid.** Alleen Pro en Enterprise (`social_commerce`). De bestaande
product-promowizard blijft op Starter en hoger (`ai_marketing`) — dat verandert niet.

**Bundel:** eerste item van de menukaart-reeks; wacht bij voorkeur op batch 2 zodat het
één verhaal wordt.

### 2026.10p — Snelacties per event + dashboardfilter (feature, 20-08-2026)

**Alles wat je met een event doet, zit nu achter drie puntjes** (oktober 2026)
Op elke eventkaart staat een menu: bewerken, de scanner openen, dupliceren, afronden, annuleren
en verwijderen. Dupliceren neemt je capaciteit, locatie, tickettypes en zones over naar een nieuwe
datum, zodat een wekelijkse ronde in een paar klikken staat. Annuleren haalt het event uit je
webshop; bestaande tickets blijven geldig. Verwijderen kan alleen bij een event zonder tickets,
tickettypes of zones — in de andere gevallen staat de knop grijs met uitleg erbij.
Het dashboard toont voortaan alleen aankomende events; met de schakelaar Toon afgelopen haal je
de historie erbij.
Wat betekent dit voor jou? Minder klikken voor terugkerende events, en een verwijderknop die
nooit met een onduidelijke foutmelding eindigt.

**i18n-key.** `public.changelog.changes.event_quick_actions_and_dashboard_filter` — KLAARZETTEN,
nog niet verstuurd.

**LET OP bij verzending.** Niet schrijven dat een **afgerond** event uit de webshop verdwijnt.
`storefront-api` sluit alleen `cancelled`, `skipped` en `merged` uit
(`supabase/functions/storefront-api/index.ts:601`); `completed` valt daar niet onder en verdwijnt
pas via `isEventStillOpen()` op tijdbasis. Die storefront-api-fix (helft B) is nog niet gebouwd.
Pas als helft B live is, mag die claim erbij. De tekst hierboven vermijdt hem bewust.

**Bundel:** hoort bij de event-reeks 2026.10i t/m 2026.10p.

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

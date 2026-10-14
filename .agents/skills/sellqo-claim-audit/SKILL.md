---
name: sellqo-claim-audit
description: Claim-audit voor de publieke SellQo-site (landing, /pricing, /horeca,
  /events, publieke pagina's, onboarding). Toepassen bij elke wijziging aan
  marketingcopy, planregels of prijzen, en vóór een marketing-batch klaar heet.
  Elke claim moet een aanwijsbare bron hebben in code of live-DB.
---

# SellQo claim-audit: alles wat we beloven, moet kloppen

**Herkomst (MKT-4, 14 okt 2026):** de site beloofde cadeaubonnen (saldo daalt
niet), een eigen domein (de worker serveert alleen *.sellqo.shop), white-label,
een visuele editor en meerdere magazijnen (die vlaggen doen niets), "facturen in
vier talen" (de labels zijn alleen Nederlands) en verzonnen cijfers en citaten.
Akke: "alles wat we zeggen op de marketingspagina moet 100% correct staan."

## Regel
Elke claim krijgt één bron:
- een **vlag of limiet** in `pricing_plans`, die ook ergens wordt afgedwongen
  (grep op de vlagnaam buiten `planLines.ts` en de types);
- een **functie of route** in de code die het echt doet;
- een **cron** (`cron.job`) voor elke frequentieclaim ("elk half uur");
- een **telling in de live-DB** voor elk cijfer of elke "draait al op SellQo".
Geen bron = de claim gaat eruit, of krijgt "(binnenkort)". Verzonnen klanten,
citaten of cijfers kunnen nooit, ook niet als placeholder.

## Werkwijze
1. Dump de gebruikte copy: alleen keys die een component echt rendert (grep de
   keyprefix in `src/`). Oude subtrees zoals `landing.features.items`,
   `landing.comparison` en `landing.social` zijn dood; daar hoef je niet aan te zitten.
2. Loop per claim de bron na: code-grep, `query_database` voor plannen, cron en
   tellingen, en `net.http_get` voor externe sites die je noemt (status 200).
3. Grep de vijf `landing.*.json`'s plus `onboarding.*` op gevaarwoorden:
   `eigen domein|cadeaubon|white.?label|magazijn|editor|talen|track|uptime|99[.,]9|\+ (winkels|klanten)|garantie|support`.
4. De FAQ (`landing.faq.items`) en `planLines.ts` zijn de plekken waar
   overbeloven het eerst insluipt; kijk die altijd na.
5. Pas alle vijf talen tegelijk aan, met dezelfde inhoud.
6. Zet productgaten die je vindt in de role-audit als "gevonden, niet gefixt",
   en stel aparte fix-batches voor. Fix geen product stilletjes binnen een
   copy-batch.

## Bekende stand (14 okt 2026)
- Waar: kassa (Pro, Enterprise, Horeca), bol.com-voorraad elke 30 min,
  facturen met btw/OSS, Odoo + Peppol (Pro), kortingscodes, 5 adminlocales,
  klantmails in nl/en/fr/de, Events Flex €0,49 per betaald ticket,
  scanlink voor crew, ticketmail in tenant-huisstijl, verzendmail
  met tracking in nl/en/fr/de (SHIP-MAIL-1).
- Niet waar of nog niet af: eigen domein (DOMAIN-1), cadeaubonsaldo (GIFT-1),
  factuurlabels i18n, afdwingen van orderlimieten,
  loyalty inwisselen in de storefront.
- Na elke fix-batch: werk deze lijst en de copy bij.

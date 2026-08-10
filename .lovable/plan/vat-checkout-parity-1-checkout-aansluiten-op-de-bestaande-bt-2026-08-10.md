# VAT-CHECKOUT-PARITY-1 — checkout aansluiten op de bestaande btw-regime-engine

## Kort antwoord op je vraag

Ja, het spel is opgezet. De fiscale logica is compleet en hoeft niet herbouwd te worden: de regime-resolver kent alle regimes, inclusief uitvoer buiten de EU (0%, vak 47) en OSS-B2C met tarieven per bestemmingsland, activatiedatum en de vereenvoudigde-btw-override. Facturen, creditnota's, de btw-aangifte, de IC-listing, Peppol en de Odoo-export gebruiken die codes al.

Wat ontbreekt is één schakel: de winkelwagen/checkout gebruikt die resolver niet. Die heeft een eigen, beperkte versie die alleen intracommunautaire verlegging kent. Daardoor kan het bedrag dat de klant betaalt afwijken van het regime dat later op de factuur staat.

## Het concrete gat

Bestelling naar de VS, artikel van 121 inclusief 21% btw:

```text
checkout   -> rekent 21% btw aan          -> klant betaalt 121
factuur    -> classificeert als uitvoer   -> 121 exclusief btw, 0 btw
```

De aangifte is correct, maar de klant betaalde 21% te veel en je omzet staat 21% te hoog in vak 47. Hetzelfde geldt voor OSS: de checkout rekent altijd het tarief van je eigen land, terwijl de factuur bij actieve OSS het tarief van het bestemmingsland gebruikt.

Voor zakelijke EU-klanten is die brug vorige maand wel gelegd (netto bedrag naar de betaalprovider). Voor buiten de EU en voor OSS niet, omdat verzenden buiten de EU tot vorige week nog niet mogelijk was. Sinds de verzendlanden-functie is dat wel het geval.

## Wat we bouwen

1. **Eén beslissingspunt in de checkout.** De winkelwagen bepaalt het btw-regime via dezelfde resolver die de factuur gebruikt, in plaats van via de eigen beperkte verleggingscheck. Bepalend zijn het bezorgland, de zakelijke status en het gevalideerde btw-nummer.
2. **Uitvoer buiten de EU: 0%.** Bezorgland buiten de EU betekent netto prijzen in de winkelwagen, netto bedrag naar de betaalprovider, en de wettelijke uitvoervermelding op de bestelling en factuur.
3. **OSS-B2C binnen de EU.** Staat OSS aan en ligt de besteldatum op of na de activatiedatum, dan rekent de checkout het tarief van het bestemmingsland. De vereenvoudigde-btw-modus blijft voorrang houden, precies zoals de resolver dat nu al doet.
4. **Herkenbaar in de winkel.** De winkelwagen geeft naast het bedrag ook mee welk regime geldt en welke tekst erbij hoort, zodat zowel onze eigen winkel als de drie eigen frontends de juiste melding kunnen tonen.
5. **Geen wijziging voor binnenlandse en gewone EU-verkoop.** Dat pad blijft rekenkundig identiek.

## Technische aanpak

- `supabase/functions/storefront-api/index.ts`: `resolveCartReverseCharge` vervangen door een aanroep van `resolveVatRegimeSafe` uit `_shared/regimeResolver.ts`, met het bezorgland als `customer_country`. Resultaat: `{ regime, rate, text }` in plaats van een boolean.
- Prijsberekening: waar nu `netFromGross(..., vat_rate)` staat bij verlegging, wordt dat een generieke hertarifering naar het resolver-tarief (0 bij uitvoer/verlegging, OSS-tarief bij OSS, ongewijzigd bij binnenland). Eén helper, gebruikt door `buildCartResponse`, `checkoutComplete` (Stripe `line_items`, verzendkosten, totaal) en `createOrderFromCart`.
- `reverseChargeOrderFields` wordt `vatRegimeOrderFields(regime, rate, text)` en zet `vat_regime`, `vat_rate`, `vat_text` en `vat_type` voor alle regimes; ordervelden bestaan al.
- Regimeteksten uit de bestaande `vat_regimes`-tabel, niet hardcoderen. De huidige hardcoded `REVERSE_CHARGE_TEXT` verdwijnt.
- Cart-respons: `vat_regime`, `vat_rate` en `vat_text` altijd meegeven, `reverse_charge` behouden als afgeleide boolean zodat Loveke, VanXcel en Astra blijven werken.
- `generate-invoice` blijft ongewijzigd: de resolver-uitkomst zal dan gelijk zijn aan wat de checkout al aanrekende.
- Geen migratie nodig: `orders.vat_regime`, `invoices.vat_regime` en `vat_regimes` bestaan.
- Verificatie met de test-tenant: bestelling naar de VS (verwacht 0% en netto bedrag naar de betaalprovider), naar Nederland als consument met OSS aan (verwacht 21% NL), naar Nederland zakelijk met geldig btw-nummer (verlegging, ongewijzigd), en binnenlands (ongewijzigd).

## Buiten scope

- Terugwerkend herstel van bestaande bestellingen of facturen.
- Wijzigingen aan de aangifte, IC-listing, Peppol of Odoo-export.
- Btw-instellingen in de beheerinterface; OSS-activatie bestaat al.

## Sporen na oplevering

Role-audit entry, publieke changelog met vertalingen in vier talen, blogconcept en een helpartikel over btw bij verkoop buiten de EU.

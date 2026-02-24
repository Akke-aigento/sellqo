
## Fix: Variant-systeem volledig opschonen

### Kernprobleem

Het variant-systeem heeft een fundamenteel UX-probleem in de admin: de gebruiker voert elke maat/kleur als een **aparte optie** in (optienaam "XS" met waarde "Extra Small") in plaats van **een optie "Maat"** met meerdere waarden ("XS, S, M, L, XL").

Dit veroorzaakt een kettingreactie van problemen:
- De variant-generator maakt 1 variant met 5 attributen i.p.v. 5 varianten met elk 1 attribuut
- De storefront toont 5 losse keuzegroepen (elk met 1 knop) i.p.v. 1 groep "Maat" met 5 knoppen

### Oplossing: Admin UX verbeteren + voorbeelden duidelijker maken

**Bestand: `src/components/admin/products/ProductVariantsTab.tsx`**

1. **Betere placeholders en uitleg bij het toevoegen van opties**
   - Placeholder optienaam: `"bijv. Maat"` (nu al correct maar nadruk verhogen)
   - Placeholder waarden: `"bijv. XS, S, M, L, XL"` (duidelijker dat ALLE waarden in 1 regel)
   - Toevoegen van een helptext onder de optie-invoervelden: *"Tip: Voeg alle waarden voor 1 eigenschap toe in een enkele optie. Voorbeeld: Optienaam 'Maat' met waarden 'XS, S, M, L, XL'. Voor kleuren: Optienaam 'Kleur' met waarden 'Rood, Blauw, Groen'."*

2. **Visuele waarschuwing bij verdachte opties**
   - Als een optie maar 1 waarde heeft, toon een waarschuwingsbadge: "Slechts 1 waarde -- bedoelde je dit als waarde van een andere optie?"
   - Dit helpt toekomstige fouten voorkomen

3. **Verbeterde optie-weergave in de lijst**
   - Toon het aantal waarden bij elke optie: bijv. "Maat (5 waarden)"

**Bestand: `src/components/storefront/VariantSelector.tsx`**

4. **MAX_TOGGLE_VALUES verhogen**
   - Verhogen van 5 naar 8, zodat de meeste maat/kleur-opties als buttons getoond worden in plaats van een dropdown

5. **Quantity reset bij variant-wissel** (al geimplementeerd in ShopProductDetail, bevestigen)

### Huidige foutieve data opruimen

De bestaande data voor het Loveke-product moet handmatig worden opgeschoond. Dit kan ik niet automatisch doen, maar ik kan de admin-interface zo verbeteren dat:
- De huidige verkeerde opties makkelijk te verwijderen zijn
- Nieuwe opties correct worden aangemaakt

### Technische details

```text
Wijzigingen in ProductVariantsTab.tsx:
- Regel ~225-247: Helptext toevoegen onder de invoervelden
- Regel ~162-222: Waarschuwingsindicator bij opties met slechts 1 waarde
- Optienaam-label aanpassen: "{option.name} ({option.values.length} waarden)"

Wijzigingen in VariantSelector.tsx:
- Regel 16: MAX_TOGGLE_VALUES van 5 naar 8
```

### Wat dit oplost
- Nieuwe tenants begrijpen direct hoe ze opties correct moeten invoeren
- Bestaande foutieve opties worden visueel gemarkeerd
- Kleuren toevoegen werkt correct: optie "Kleur" met waarden "Rood, Blauw, Groen" genereert 3 varianten
- Combinatie Maat + Kleur genereert correct het cartesisch product (bijv. 5 maten x 3 kleuren = 15 varianten)

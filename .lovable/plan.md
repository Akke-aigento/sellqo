
# Fix: Adres autocomplete zoekbalk + Landkeuze toevoegen

## Probleem
1. De adres autocomplete is gekoppeld aan het straatveld zelf, waardoor het conflicteert met browser autofill. Er is geen aparte zoekbalk zichtbaar.
2. Er ontbreekt een landkeuze (country selector) op de checkout pagina.

## Oplossing

### 1. Aparte adres zoekbalk boven de adresvelden
Een apart zoekveld toevoegen boven de adresvelden (Straat, Huisnummer, etc.) dat:
- Alleen suggesties toont wanneer de gebruiker actief typt in dit zoekveld
- Bij selectie van een suggestie automatisch alle adresvelden invult (straat, stad, postcode, land)
- Niet reageert op browser autofill (dat vult alleen de individuele velden in)
- Placeholder tekst toont zoals "Zoek je adres..." (via i18n)

### 2. Landkeuze dropdown
Een Select dropdown toevoegen onder de postcode/stad rij met landopties:
- Belgie (BE), Nederland (NL), Duitsland (DE), Frankrijk (FR), Luxemburg (LU)
- Standaard: BE (zoals nu al ingesteld)

### 3. i18n vertalingen
Nieuwe keys toevoegen aan alle 4 taalbestanden:
- `checkout.searchAddress`: "Zoek je adres" / "Search your address" / "Rechercher votre adresse" / "Adresse suchen"
- `checkout.country`: "Land" / "Country" / "Pays" / "Land"
- `checkout.shippingAddress`: "Verzendadres" / "Shipping address" / etc.

## Technische details

### Bestanden die worden aangepast:

1. **`src/pages/storefront/ShopCheckout.tsx`**
   - Verwijder de autocomplete-logica van het straatveld
   - Voeg een apart zoekveld toe boven de adres grid, alleen zichtbaar als `addressAutocomplete` aan staat
   - Verplaats de suggesties-dropdown naar dit nieuwe zoekveld
   - Voeg een landkeuze Select component toe als nieuwe rij onder postcode/stad
   - Verwijder de `isManualTypingRef` / `autofillCheckTimerRef` logica (niet meer nodig met apart zoekveld)

2. **`src/i18n/locales/nl.json`**, **`en.json`**, **`fr.json`**, **`de.json`**
   - Checkout keys uitbreiden met `searchAddress`, `country`, `shippingAddress`

### Layout van adressectie (na wijziging):

```text
+--------------------------------------------------+
| Verzendadres                                      |
+--------------------------------------------------+
| [Zoek je adres...                    ] (zoekbalk) |  <-- alleen als autocomplete aan
+--------------------------------------------------+
| Straat *                    | Huisnummer          |
| [________________]          | [____]              |
+--------------------------------------------------+
| Postcode *       | Stad *                         |
| [________]       | [________________]             |
+--------------------------------------------------+
| Land *                                            |
| [Belgie              v]  (Select dropdown)        |
+--------------------------------------------------+
```

### Gedrag
- Gebruiker typt in zoekbalk -> TomTom suggesties verschijnen -> klik vult alle velden
- Browser autofill vult individuele velden -> zoekbalk blijft leeg, geen suggesties
- Land selectie stuurt ook de country parameter mee naar de TomTom API voor betere resultaten



## Fix: Betalingsknoppen tekst past niet in vakken

### Probleem
De 4 betalingsknoppen (Contant, PIN, Bank, Meer) staan in een `grid-cols-4` met `h-14`. Elke knop heeft een icoon met `mr-2` + tekst naast elkaar. In de smalle cart-kolom (w-96 = 384px) is dat te krap — "Contant" wordt afgesneden.

### Oplossing
Maak de knoppen verticaal: icoon boven de tekst, in plaats van naast elkaar. Dit past beter in smalle kolommen.

- Verwijder `mr-2` van de iconen
- Voeg `flex-col` toe aan de knoppen
- Maak tekst kleiner (`text-xs`) zodat alles past
- Behoud `h-14` hoogte

### Bestand

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/pos/POSCartPanel.tsx` | Betalingsknoppen layout: icoon + tekst verticaal stapelen |


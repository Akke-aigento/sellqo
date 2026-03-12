

## Analyse: Varianten niet bewerkbaar

Ik heb de code en database grondig onderzocht:
- **RLS policies**: OK (permissive ALL policy)
- **Database schema**: OK (alle kolommen bestaan, inclusief `internal_reference`, `price`, etc.)
- **React state management**: Code ziet er logisch correct uit
- **Button type="button"**: Correct doorgegeven, zou form submit niet moeten triggeren

### Meest waarschijnlijke oorzaak

De tabel heeft 10 kolommen, waardoor de **"Acties" kolom** (met de bewerkknop ✏️) op smallere schermen **buiten beeld scrollt**. De cellen zelf zijn niet klikbaar voor bewerken — je moet eerst de potlood-knop vinden.

Daarnaast ontbreken `e.preventDefault()` calls op de save/cancel/edit knoppen, wat in sommige browsers onverwacht gedrag kan veroorzaken binnen een `<form>`.

### Plan

**1. Directe inline editing op celklik** (betere UX)
Maak de waarde-cellen (Prijs, SKU, Barcode, Interne ref., Voorraad, Actief) direct klikbaar. Klik op "—" bij Prijs → input verschijnt direct in die cel. Geen pencil-knop meer nodig.

**2. Events beveiligen**
Voeg `e.preventDefault()` toe aan alle buttons in de varianten tabel (save, cancel, edit, delete) om onverwachte form submissions te voorkomen.

**3. Acties kolom compacter**
Verplaats delete naar een dropdown menu of verklein de kolom, zodat de actieknoppen altijd zichtbaar zijn.

### Bestanden
- `src/components/admin/products/ProductVariantsTab.tsx` — Herschrijf de variant rij zodat individuele cellen klikbaar worden om die ene cel te bewerken (vergelijkbaar met het bestaande `GridTextCell`/`GridNumberCell` patroon). Behoud de pencil-knop als fallback maar maak elke cel ook direct klikbaar.


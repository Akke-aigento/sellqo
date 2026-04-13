
# Fix: varianten blijven onbewerkbaar op 14" laptop

## Wat er nu echt misgaat
De vorige responsive fix schakelt de variantenlijst over naar de desktop-tabel vanaf `lg`. Dat kijkt naar de volledige viewportbreedte, maar deze pagina heeft binnen het productformulier pas vanaf `xl` een 2-koloms layout. Daardoor zit `ProductVariantsTab` op veel laptops in een smalle linkerkolom, terwijl hij toch de brede desktop-tabel rendert. Resultaat: de actieknoppen vallen rechts buiten beeld.

Je screenshot bevestigt dat exact: de tabel staat in de linkerkolom en de rechterkant is afgesneden.

## Aanpak

### 1. Breakpoint van de variantenweergave aanpassen
**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`

- De huidige split:
  - mobiel/cards: `lg:hidden`
  - desktop tabel: `hidden lg:block`
- Dit wijzigen naar:
  - mobiel/cards: `xl:hidden`
  - desktop tabel: `hidden xl:block`

Zo blijft op 14" laptops en smallere desktopbreedtes de card-layout actief, wat beter past in de smalle contentkolom.

### 2. Desktop-tabel compacter maken voor echte brede schermen
In dezelfde component:
- kolommen compacter maken waar mogelijk
- action-kolom `whitespace-nowrap` geven
- linked product badge laten truncaten i.p.v. uitrekken
- varianttitel-cel `min-w-0`/truncate-vriendelijk maken

Zo voorkomen we dat zelfs op grotere schermen de tabel onnodig breed wordt.

### 3. Mobiele/card-layout verder optimaliseren voor editability
In de card-layout:
- actieknoppen altijd rechtsboven zichtbaar houden
- bij edit-modus de velden onder elkaar of in 2 compacte kolommen tonen
- stock stepper en image picker niet laten duwen tegen de actieknoppen

Doel: bewerken/verwijderen moet op elke breedte zichtbaar én klikbaar blijven.

### 4. Kleine copy/UX cleanup
Ik zag ook een typefout in de beschrijving:
- `productbkoppelingen` → `productkoppelingen`

## Bestanden
- `src/components/admin/products/ProductVariantsTab.tsx`

## Verwacht resultaat
- Op 14-inch MacBook en vergelijkbare schermen zie je de veilige card-layout in plaats van de afgeknotte tabel.
- Bewerken en verwijderen zijn weer direct bereikbaar.
- Op echt brede schermen blijft de tabelweergave beschikbaar.

## Technische noot
Dit is geen backendprobleem en ook geen permissieprobleem. Het is puur een responsive layout-mismatch tussen:
- `ProductForm.tsx`: 2-koloms layout vanaf `xl`
- `ProductVariantsTab.tsx`: desktopweergave nu al vanaf `lg`

Die breakpoints moeten op elkaar afgestemd worden.

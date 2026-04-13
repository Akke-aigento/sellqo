
# Fix: bestaande varianten-sectie écht responsive maken

Je hebt gelijk: het probleem zit in de sectie met de reeds bestaande varianten, niet in het aanmaken van opties.

## Wat ik nagekeken heb
In `src/components/admin/products/ProductVariantsTab.tsx` staat de bestaande variantenlijst nu zo:
- card-layout: `xl:hidden`
- tabel-layout: `hidden xl:block`

In `src/pages/admin/ProductForm.tsx` zit die component binnen een 2-koloms layout:
- `xl:grid-cols-[1fr_350px]`

Daardoor gebeurt dit op een 14" MacBook:
- de viewport is breed genoeg om `xl` te halen
- dus de variantenlijst schakelt naar de tabel
- maar de tabel zit ondertussen in de smallere linkerkolom van het formulier
- resultaat: de tabel van bestaande varianten wordt afgesneden en de edit/delete acties blijven onbereikbaar

Dus: de vorige fix zat wel in de juiste component, maar nog steeds op het verkeerde beslismoment.

## Aanpak

### 1. Variants-sectie laten reageren op échte beschikbare breedte
**Bestand:** `src/components/admin/products/ProductVariantsTab.tsx`

Ik zal de bestaande variantenweergave niet langer laten afhangen van viewport-breakpoints (`xl`), maar van de werkelijke breedte van de container van die sectie.

Concreet:
- een `ref` + `ResizeObserver` toevoegen op de bestaande varianten-card
- op basis van die gemeten breedte kiezen tussen:
  - compacte card/list layout voor smallere contentbreedtes
  - tabel-layout alleen wanneer er echt genoeg ruimte is

Zo blijft op 14" laptops de bestaande variantenlijst in de veilige bewerkbare layout, ook al is de totale viewport groter dan `xl`.

### 2. Alleen de sectie met bestaande varianten aanpassen
De wijziging richt zich expliciet op:
- `Varianten ({variants.length})`
- dus de reeds aangemaakte varianten
- niet op het blok “Variant opties” / genereren van varianten

### 3. Bestaande varianten-card verder optimaliseren voor bewerken
In dezelfde component:
- edit- en deleteknoppen vast bovenaan rechts houden
- edit-modus van bestaande varianten compacter stapelen
- stock stepper, prijs, SKU en actief-status zo plaatsen dat ze de acties niet wegduwen
- linked product informatie onder de kernvelden tonen i.p.v. horizontaal ruimte op te eten

### 4. Desktop-tabel alleen tonen als die ook echt bruikbaar is
Voor de brede layout:
- tabel compacter maken met smallere paddings
- titel- en gekoppelde productvelden laten truncaten
- actiekolom `whitespace-nowrap` geven
- eventueel `table-fixed`/strakkere kolombreedtes toepassen zodat edit/delete zichtbaar blijven

## Bestanden
- `src/components/admin/products/ProductVariantsTab.tsx`

## Verwacht resultaat
- Op een 14" MacBook blijft de lijst met bestaande varianten bewerkbaar
- Editeren/verwijderen van reeds aangemaakte varianten blijft altijd zichtbaar
- De tabel verschijnt alleen nog op schermen waar die sectie ook echt voldoende breed is

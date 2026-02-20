
# Horizontaal scrollen definitief verwijderen

## Oorzaak

Het probleem zit dieper dan de `min-w` wrappers die we eerder verwijderd hebben. De `Table` UI-component zelf bevat een wrapper `<div className="relative w-full overflow-auto">` die horizontaal scrollen mogelijk maakt. Daarnaast bevatten sommige tabelcellen lange tekst (e.g. emailadressen) die de tabel breder maken dan het scherm.

## Oplossing (twee stappen)

### Stap 1: Table component aanpassen

In `src/components/ui/table.tsx` de `overflow-auto` vervangen door `overflow-hidden` zodat tabellen nooit horizontaal scrollen maar altijd binnen hun container passen.

### Stap 2: Per pagina tabelcellen met lange content afkappen

Op elke pagina waar lange tekst (emails, namen, omschrijvingen) voorkomt, `truncate` en `max-w-[...]` toepassen zodat de inhoud wordt afgekapt met "..." in plaats van de tabel breder te maken.

## Wijzigingen per bestand

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ui/table.tsx` | `overflow-auto` naar `overflow-hidden` in de Table wrapper |
| `src/pages/admin/Orders.tsx` | `truncate max-w-[200px]` op Klant-kolom (emails); verwijder `overflow-x-auto` van CardContent |
| `src/pages/admin/Quotes.tsx` | `truncate max-w-[180px]` op Klant-kolom; verwijder dubbele `overflow-x-auto` wrapper div |
| `src/pages/admin/Invoices.tsx` | `truncate max-w-[180px]` op Klant email; verwijder `overflow-x-auto` van CardContent |
| `src/pages/admin/CreditNotes.tsx` | `truncate max-w-[180px]` op Klant-kolom; verwijder `overflow-x-auto` |
| `src/pages/admin/PurchaseOrders.tsx` | `truncate` op Leverancier-kolom; `overflow-x-auto` verwijderen van CardContent |
| `src/pages/admin/Fulfillment.tsx` | `truncate` op Klant-kolom; `overflow-x-auto` verwijderen |
| `src/pages/admin/Payments.tsx` | `truncate` op Omschrijving; `overflow-x-auto` verwijderen van beide CardContent containers |
| `src/pages/admin/Subscriptions.tsx` | `truncate max-w-[150px]` op Klant en Naam kolommen; `overflow-x-auto` verwijderen |

## Technische details

### Table component (`src/components/ui/table.tsx`)

De wrapper div verandert van:
```
<div className="relative w-full overflow-auto">
```
naar:
```
<div className="relative w-full overflow-hidden">
```

Dit voorkomt dat tabellen ooit horizontaal scrollen. In combinatie met de al bestaande `hidden sm:table-cell` classes op kolommen zorgt dit ervoor dat tabellen altijd binnen het scherm passen.

### Tabelcellen met lange tekst

Cellen die emails of lange namen bevatten krijgen `truncate` en een `max-w` class. Voorbeeld:
```
<TableCell className="truncate max-w-[200px]">
```

Dit kapt de tekst netjes af met "..." als deze te lang is, in plaats van de tabel breder te maken.

### CardContent overflow verwijderen

Alle `className="overflow-x-auto px-0 sm:px-6"` worden vereenvoudigd naar `className="px-0 sm:px-6"` omdat de overflow niet meer nodig is.

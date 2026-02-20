
# Horizontaal scrollen verwijderen op alle bestellingen-pagina's

## Probleem

Alle tabellen in de bestellingen-sectie hebben een `min-w-[600px]` / `min-w-[700px]` / `min-w-[750px]` wrapper die horizontaal scrollen forceert, zelfs op desktop. Dit moet nooit voorkomen.

## Oplossing

Alle `min-w-[...]` wrappers rondom tabellen verwijderen. De tabellen hebben al voldoende kolommen verborgen via `hidden sm:table-cell` / `hidden md:table-cell` / `hidden lg:table-cell`, waardoor ze op elk schermformaat passen zonder horizontaal scrollen.

## Bestanden en wijzigingen

| Bestand | Huidige min-w | Actie |
|---------|--------------|-------|
| `src/pages/admin/Orders.tsx` (regel 144) | `min-w-[700px]` | Verwijderen |
| `src/pages/admin/Quotes.tsx` (regel 146) | `min-w-[600px]` | Verwijderen |
| `src/pages/admin/Invoices.tsx` (regel 183) | `min-w-[750px]` | Verwijderen |
| `src/pages/admin/CreditNotes.tsx` (regel 134) | `min-w-[600px]` | Verwijderen |
| `src/pages/admin/PurchaseOrders.tsx` (regel 154) | `min-w-[600px]` | Verwijderen |
| `src/pages/admin/Fulfillment.tsx` (regel 355) | `min-w-[600px]` | Verwijderen |
| `src/pages/admin/Payments.tsx` (regel 246) | `min-w-[600px]` | Verwijderen |
| `src/pages/admin/Payments.tsx` (regel 322) | `min-w-[400px]` | Verwijderen |
| `src/pages/admin/Subscriptions.tsx` (regel 152) | `min-w-[700px]` | Verwijderen |

Bij elke tabel wordt de `<div className="min-w-[...]">` wrapper verwijderd of vervangen door een simpele `<div>` zonder min-width, zodat de tabel altijd 100% breed is en nooit horizontaal scrollen vereist.

## Technische aanpak

Per bestand: de `min-w-[XXX]` class verwijderen van de wrapper-div rondom de Table-component. De bestaande responsive column-hiding (`hidden sm:table-cell` etc.) zorgt ervoor dat de tabel altijd past.

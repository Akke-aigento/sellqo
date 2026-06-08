## Probleem

1. **Sidebar-label wrapt over 2 regels.** "Facturen & creditnota's" is te lang voor de sidebar-kolom en breekt naar "Facturen & / creditnota's".
2. **Gecombineerd overzicht-tabel valt uit z'n container** op middelgrote schermen (~1185px met sidebar open): factuurnummers (`INV-2026-0142`) en datums (`8 jun. 2026`) wrappen lelijk over meerdere regels, terwijl er rechts nog een brede "Creditnota"-actieknop staat.

## Fix

### 1. Sidebar — korter label
`src/components/admin/sidebar/sidebarConfig.ts`: label van `orders-invoices` terugbrengen naar **`"Facturen"`** (1 regel). De page-titel toont al `"Facturen & creditnota's"` en de tabs (Alle / Facturen / Creditnota's) maken meteen duidelijk dat CN's hier ook leven. Geen aparte CN-sidebar-entry meer nodig.

### 2. Gecombineerd overzicht — responsive tabel
In `src/pages/admin/Invoices.tsx`, TabsContent `value="all"`:

- Vervang de huidige losse `<Table>` door `<ResponsiveDataTable>` (zelfde component als CreditNotesTable gebruikt) met `cardModeBreakpoint="compact"` → onder ~1024px valt 'ie automatisch terug naar card-layout in plaats van uitlopen.
- Voor desktop-tabel zelf:
  - `whitespace-nowrap` op Nummer/Datum-kolommen zodat ze niet wrappen.
  - Compactere actie-knop: icon-only "Creditnota" (Minus-icoon in een ghost-button + tooltip) i.p.v. de volledige `Creditnota`-tekstknop. Spaart ~80px per rij.
  - Klant-kolom: krijg `priority: 'lg'` (verborgen onder lg-breakpoint) zodat hij niet samenpropt met andere kolommen.
- Mobile card render: kind-badge, nummer, klant, datum, bedrag, status, en een ActionsMenu (☰) met "Creditnota aanmaken" / "Open creditnota".

### 3. Verificatie
- Sidebar: "Facturen" past op 1 regel, zowel in open als smalle sidebar-states.
- `/admin/orders/invoices` op 1185px en 1024px: tabel blijft binnen container, geen wrappende cellen.
- Onder 1024px: tabel wordt cards (zelfde patroon als CreditNotesTable).
- Tab "Creditnota's" en "Facturen" ongewijzigd (al responsive).

## Technische details
- Hergebruik `ResponsiveDataTable` / `ColumnDef` / `ActionsMenu` uit `src/components/ui/`.
- `CreateCreditNoteFromInvoiceButton` accepteert al een onSuccess-callback; we wrappen 'm in een icon-only variant of voegen een prop `compact` toe (alleen icon + tooltip). Inspectie van die component bepaalt of we 'm uitbreiden of de aanroep gewoon door een `ActionsMenu`-item vervangen.
- Geen wijzigingen aan migraties, backend, of CreditNotesTable.
- Geen wijzigingen aan de "Facturen" of "Creditnota's" tab — die zijn al responsive.

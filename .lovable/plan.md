## Probleem

Bij ~1185px schermbreedte is het content-gebied (na 256px sidebar) ongeveer 929px. De `ResponsiveDataTable` switcht echter pas naar cards op basis van **window**-breedte (`matchMedia`, lg=1024px), niet container-breedte. Dus:

- **Alle**-tab en **Creditnota's**-tab: tabellen blijven in "full" modus terwijl ze maar ~929px ruimte hebben → Status-kolom + acties lopen uit het kader.
- **Facturen**-tab: gebruikt nog de legacy hand-gerolde `<Table>` met 8 kolommen (factuurnummer, klant, order, bron, datum, bedrag, status, acties) + `sm:hidden` mobile cards die pas <640px aanslaan → Status klapt af, acties verdwijnen.

## Oplossing

### 1. `src/components/ui/responsive-data-table.tsx` — container-aware switching

Vervang de window-based `useViewMode()` door een lokale `ResizeObserver` op een wrapper-`div`. Drempels gelijk aan huidige breakpoints:

- `cardModeBreakpoint="mobile"` → cards bij container < 640px
- `cardModeBreakpoint="compact"` → cards bij container < 1024px

Kolom-prio classes (`hidden md:table-cell`, `lg:table-cell`, `xl:table-cell`) blijven werken op window-basis, of we vervangen ze ook door container-based zichtbaarheid (zelfde ResizeObserver state). Voor consistentie: kolommen verbergen op zelfde container-drempels (md=768, lg=1024, xl=1280) i.p.v. window — voorkomt dat kolommen verschijnen die in de smalle container niet passen.

Geen API-wijziging voor callers; alle bestaande tabellen profiteren automatisch.

### 2. `src/pages/admin/Invoices.tsx` — Facturen-tab naar `ResponsiveDataTable`

Vervang het hele blok `{isLoading ? … : invoices.length === 0 ? … : <> mobile cards + desktop Table </>}` (regels ~395-…) door één `<ResponsiveDataTable<Invoice>>` met:

- Kolommen: `nummer` (always), `klant` (always, truncate), `order` (priority `lg`, met ExternalLink), `bron` (priority `xl`, `OrderMarketplaceBadge`), `datum` (priority `md`, `whitespace-nowrap`), `bedrag` (always, right, `whitespace-nowrap`), `status` (always, `InvoiceStatusBadge` + `getPeppolStatusBadge`), `acties` (always, `ActionsMenu` met PDF/UBL/E-mail/Creditnota aanmaken).
- `cardModeBreakpoint="compact"` → cards bij <1024px container.
- `mobileCardRender`: pakt huidige inhoud van de `sm:hidden` cards (al aanwezig).

De bestaande `sm:hidden` / `hidden sm:block` blokken vervallen.

### 3. Geen wijzigingen aan

- `CreditNotesTable.tsx` — al op `ResponsiveDataTable` met `cardModeBreakpoint="compact"`; profiteert direct van fix #1.
- "Alle"-tab — idem.
- Sidebar, routes, backend, migraties.

## Verificatie

- 1280×800: alle drie tabs in vol tabel-formaat zonder afkappen.
- 1185×800 (huidige situatie): "Alle", "Facturen" en "Creditnota's" switchen naar card-layout → geen overflow.
- <768px: cards (al ok).
- Geen TS-fouten, geen regressies op andere pagina's die `ResponsiveDataTable` gebruiken (productgrid, klanten, fulfillment, etc.) — die kunnen alleen *eerder* naar cards switchen op kleine containers, wat een verbetering is.

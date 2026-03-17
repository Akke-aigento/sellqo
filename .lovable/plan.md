

## Plan: Mobiele Card-Layout voor Admin Tabellen

### Probleem
Op 390px viewport zijn tabellen met `overflow-x-auto` technisch werkend maar slecht bruikbaar — je moet horizontaal scrollen, verliest context, en het voelt niet als een app.

### Aanpak
Voor de **4 meest gebruikte pagina's** (Orders, Customers, Invoices, CreditNotes) vervangen we de tabel op mobiel door een **card-based lijst**. De `useIsMobile()` hook bestaat al en gebruiken we als switch.

**Patroon per pagina:**
- `{isMobile ? <MobileCardList /> : <DesktopTable />}`
- Elke card toont 3-4 key velden compact, is volledig klikbaar naar detail
- Minder info dan de tabel, maar scanbaar en touch-friendly

### Per pagina

| Pagina | Card toont | Verborgen tot detail |
|--------|-----------|---------------------|
| **Orders** | Ordernummer, klantnaam, status-badge, totaal, datum | Betaalstatus, bron, artikelaantal, acties |
| **Customers** | Naam + avatar, email, bestellingen-count, uitgegeven | Type, telefoon, sinds-datum |
| **Invoices** | Factuurnummer, klant, bedrag, status-badge | Datum, vervaldatum, acties |
| **CreditNotes** | Nummer, klant, bedrag, status-badge | Type, originele factuur, datum |

### Card-design (consistent patroon)
Elke card: `rounded-lg border p-3`, klikbaar met `cursor-pointer active:bg-muted/50`. Layout:
- **Bovenrij**: primaire identifier (bold) + status badge rechts
- **Middenrij**: secundaire info (klant, email) in `text-sm text-muted-foreground`
- **Onderrij**: bedrag (bold, rechts) + datum of count (links)
- Optioneel: swipe of long-press voor acties (maar voor nu gewoon klik → detail)

### Bestanden

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/pages/admin/Orders.tsx` — mobiele card list + `useIsMobile` switch |
| Wijzig | `src/pages/admin/Customers.tsx` — mobiele card list |
| Wijzig | `src/pages/admin/Invoices.tsx` — mobiele card list |
| Wijzig | `src/pages/admin/CreditNotes.tsx` — mobiele card list |

Elke pagina krijgt een inline `MobileList` component (of section) die de bestaande data hergebruikt. De desktop tabel blijft 100% ongewijzigd.


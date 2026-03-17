

## Plan: Mobiele Card-Layout voor Overige Admin Tabellen

Dezelfde aanpak als Orders/Customers/Invoices/CreditNotes: `useIsMobile()` switch, card-based lijst op mobiel, desktop tabel ongewijzigd.

### 9 pagina's die nog aangepast moeten worden

| Pagina | Card toont | Verborgen tot detail |
|--------|-----------|---------------------|
| **Products** | Afbeelding, naam, prijs, voorraadstatus | SKU, categorie, zichtbaarheid, checkbox |
| **Quotes** | Offertenummer, klant, status-badge, totaal, datum | Vervaldatum, acties |
| **PurchaseOrders** | Ordernummer, leverancier, status, totaal | Orderdatum, verwachte levering |
| **Fulfillment** | Ordernummer, klant, fulfillment-status, items-count | Tracking, checkbox, acties |
| **Shipping** | Naam, prijs, actief-toggle | Gratis-boven, levertijd, status |
| **GiftCards** | Code, saldo, status-badge | Ontvanger, oorspronkelijk bedrag, aangemaakt |
| **Payments** | Datum, type, bedrag (netto) + Payouts: datum, status, bedrag | Fee, omschrijving, methode |
| **Subscriptions** | Klant, abonnementsnaam, bedrag, status | Billing cycle, volgende factuur |
| **SupplierDocuments** | Documentnaam, leverancier, bedrag, status | Type, datum, vervaldatum |

### Card-design
Zelfde patroon als de eerder geïmplementeerde pagina's:
- `rounded-lg border bg-card p-3 cursor-pointer active:bg-muted/50`
- Bovenrij: identifier (bold) + status badge rechts
- Middenrij: secundaire info in `text-sm text-muted-foreground`
- Onderrij: bedrag rechts + datum links
- Klik → navigeer naar detail (waar beschikbaar)

### Bestanden

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/pages/admin/Products.tsx` |
| Wijzig | `src/pages/admin/Quotes.tsx` |
| Wijzig | `src/pages/admin/PurchaseOrders.tsx` |
| Wijzig | `src/pages/admin/Fulfillment.tsx` |
| Wijzig | `src/pages/admin/Shipping.tsx` |
| Wijzig | `src/pages/admin/GiftCards.tsx` |
| Wijzig | `src/pages/admin/Payments.tsx` |
| Wijzig | `src/pages/admin/Subscriptions.tsx` |
| Wijzig | `src/pages/admin/SupplierDocuments.tsx` |

Elke pagina krijgt `useIsMobile()` import + inline mobiele card-sectie. Desktop tabellen blijven 100% ongewijzigd.




## Responsive Layout voor Alle Admin Pagina's

### Het probleem
De huidige `useIsMobile()` hook schakelt over bij 768px: kaarten op mobiel, tabellen op alles daarboven. Op tablets (768-1024px) worden tabellen met `min-w-[600-750px]` getoond die krap zijn of horizontaal scrollen vereisen.

### Aanpak

**Stap 1: Nieuwe `useIsCompact()` hook toevoegen**
Maak een helper die `true` retourneert onder 1024px (tablet + mobiel). De bestaande `useIsMobile()` blijft ongewijzigd zodat andere code niet breekt.

```typescript
// src/hooks/use-mobile.tsx — nieuw export
export function useIsCompact() {
  // true voor schermen < 1024px (mobiel + tablet)
}
```

**Stap 2: 13 pagina's met bestaande card-layouts updaten**
Vervang `isMobile` door `isCompact` voor de tabel/card switch op deze pagina's:

| Pagina | Bestand |
|--------|---------|
| Bestellingen | `Orders.tsx` |
| Klanten | `Customers.tsx` |
| Facturen | `Invoices.tsx` |
| Verzending | `Shipping.tsx` |
| Abonnementen | `Subscriptions.tsx` |
| Offertes | `Quotes.tsx` |
| Inkooporders | `PurchaseOrders.tsx` |
| Creditnota's | `CreditNotes.tsx` |
| Cadeaubonnen | `GiftCards.tsx` |
| Producten | `Products.tsx` |
| Leveranciersdocumenten | `SupplierDocuments.tsx` |
| Betalingen | `Payments.tsx` |
| Order Detail | `OrderDetail.tsx` |

Eenvoudige wijziging per bestand: `const isCompact = useIsCompact();` en gebruik dat voor de card/tabel conditie.

**Stap 3: 6 pagina's zonder card-layouts — card-layout toevoegen**
Deze pagina's tonen nu altijd een tabel, ook op mobiel:

| Pagina | Bestand |
|--------|---------|
| BOGO Promoties | `BogoPromotions.tsx` |
| Stapelregels | `StackingRules.tsx` |
| Campagne Detail | `CampaignDetail.tsx` |
| Cadeaubon Detail | `GiftCardDetail.tsx` |
| Offerte Detail | `QuoteDetail.tsx` |
| Platform Betalingen | `PendingPlatformPaymentsPage.tsx` |

Per pagina: voeg een compacte card-layout toe voor `< 1024px`, tabel voor desktop.

### Resultaat
- **Mobiel (< 768px)**: kaarten — geen verandering
- **Tablet (768-1024px)**: kaarten i.p.v. krappe tabellen — **nieuw**
- **Desktop (> 1024px)**: volledige tabel met alle kolommen — geen verandering

Totaal: ~19 bestanden, 1 nieuwe hook. Geen database-wijzigingen.


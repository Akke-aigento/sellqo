
# Responsiveness Fix - Alle Admin Pagina's

## Probleem

Na inspectie op mobile (375px) en tablet (768px) viewports blijkt dat **24 van de 26 admin pagina's met tabellen** geen responsieve aanpassingen hebben. Alleen Orders en Fulfillment zijn eerder gefixt. De rest kapt af, loopt over, of is onbruikbaar op kleinere schermen.

## Gevonden Issues per Categorie

### 1. Tabellen zonder scroll-wrapper (24 pagina's)
Alle tabellen behalve Orders en Fulfillment missen `overflow-x-auto` op hun container en een `min-w-[...]` wrapper. Dit zorgt ervoor dat tabelinhoud afgekapt wordt.

**Getroffen pagina's:** Products, Customers, Invoices, Payments, GiftCards, GiftCardDetail, Subscriptions, Shipping, StackingRules, BogoPromotions, Billing, PendingPlatformPayments, SupplierDocuments, CustomerDetail, QuoteDetail, OrderDetail, CampaignDetail, MarketplaceDetail, LoyaltyPrograms, TranslationHub, en meer.

### 2. Filters die overlopen (Products)
De Products pagina heeft 4 `Select` elementen met vaste breedtes (`w-[140px]`, `w-[160px]`) in een `flex gap-2` **zonder wrapping**. Op mobile lopen deze buiten het scherm.

### 3. Bulk action bars die niet wrappen (Products)
De bulk action bar op Products heeft knoppen in een `flex gap-2` zonder `flex-wrap`, waardoor ze op mobile afgekapt worden.

### 4. Headers die niet stacken (Customers, diverse)
De Customers header gebruikt `flex items-center justify-between` zonder responsive stacking (`flex-col sm:flex-row`).

### 5. Tabelkolommen zonder responsive hiding
Tabellen tonen alle kolommen op elk schermformaat. Minder kritische kolommen (Contact, Type, Sinds bij Customers; SKU, Categorie, Zichtbaarheid bij Products) worden niet verborgen op kleinere schermen.

---

## Aanpak

### Stap 1: Products.tsx (hoogste prioriteit)

- **Filters**: Voeg `flex-wrap` toe aan de filter-rij, maak selects `w-full sm:w-[140px]`
- **Tabel**: Wrap in `overflow-x-auto` met `min-w-[700px]`
- **Responsive column hiding**:
  - SKU: `hidden md:table-cell`
  - Categorie: `hidden lg:table-cell`
  - Zichtbaarheid: `hidden sm:table-cell`
- **Bulk actions**: Voeg `flex-wrap` toe

### Stap 2: Customers.tsx

- **Header**: Wijzig naar `flex flex-col sm:flex-row sm:items-center justify-between gap-2`
- **Zoekbalk**: Verwijder `max-w-sm` op mobile
- **Tabel**: Wrap in `overflow-x-auto` met `min-w-[650px]`
- **Responsive column hiding**:
  - Contact: `hidden lg:table-cell`
  - Type: `hidden sm:table-cell`
  - Sinds: `hidden md:table-cell`

### Stap 3: Invoices.tsx

- **Tabel**: Wrap in `overflow-x-auto` met `min-w-[650px]`
- **Responsive column hiding** voor minder kritische kolommen
- **Filters**: `flex-wrap` en responsive breedtes

### Stap 4: Overige veelgebruikte pagina's

Dezelfde patronen toepassen op:
- **Payments.tsx** - scroll wrapper + column hiding
- **GiftCards.tsx** - scroll wrapper + column hiding
- **Subscriptions.tsx** - scroll wrapper + column hiding
- **Shipping.tsx** - scroll wrapper + column hiding
- **CustomerDetail.tsx** - scroll wrapper
- **OrderDetail.tsx** - scroll wrapper voor items tabel
- **Billing.tsx** - scroll wrapper

### Stap 5: Resterende pagina's

Batch-fix voor de overige pagina's met hetzelfde patroon:
- SupplierDocuments, QuoteDetail, CampaignDetail, MarketplaceDetail, LoyaltyPrograms, TranslationHub, StackingRules, BogoPromotions, PendingPlatformPayments, GiftCardDetail

---

## Technisch Patroon (consistent voor alle pagina's)

Elke tabel-container wordt als volgt aangepast:

```text
Huidige structuur:
  <CardContent>
    <Table>...</Table>
  </CardContent>

Nieuwe structuur:
  <CardContent className="overflow-x-auto px-0 sm:px-6">
    <div className="min-w-[XXXpx]">
      <Table>...</Table>
    </div>
  </CardContent>
```

Elke niet-essientiele kolom krijgt responsive hiding:
```text
<TableHead className="hidden md:table-cell">Kolom</TableHead>
<TableCell className="hidden md:table-cell">Data</TableCell>
```

---

## Bestanden (totaal ~20 bestanden)

| Bestand | Wijzigingen |
|---------|-------------|
| `Products.tsx` | Filters wrappen, tabel scroll, column hiding, bulk wrap |
| `Customers.tsx` | Header stacken, tabel scroll, column hiding |
| `Invoices.tsx` | Tabel scroll, column hiding, filters |
| `Payments.tsx` | Tabel scroll, column hiding |
| `GiftCards.tsx` | Tabel scroll, column hiding |
| `Subscriptions.tsx` | Tabel scroll |
| `Shipping.tsx` | Tabel scroll |
| `CustomerDetail.tsx` | Tabel scroll |
| `OrderDetail.tsx` | Items tabel scroll |
| `Billing.tsx` | Tabel scroll |
| `SupplierDocuments.tsx` | Tabel scroll |
| `QuoteDetail.tsx` | Tabel scroll |
| `CampaignDetail.tsx` | Tabel scroll |
| `MarketplaceDetail.tsx` | Tabel scroll |
| `LoyaltyPrograms.tsx` | Tabel scroll |
| `TranslationHub.tsx` | Tabel scroll |
| `StackingRules.tsx` | Tabel scroll |
| `BogoPromotions.tsx` | Tabel scroll |
| `PendingPlatformPaymentsPage.tsx` | Tabel scroll |
| `GiftCardDetail.tsx` | Tabel scroll |



# Verkoopkanaal Tonen op Orders & Facturen

## Doel
De boekhouder moet in één oogopslag kunnen zien via welk kanaal (SellQo Webshop, Bol.com, Amazon, etc.) een bestelling of factuur is binnengekomen.

---

## Wat Er Al Is

- `OrderMarketplaceBadge.tsx` component bestaat al met iconen voor Bol.com, Amazon, en fallback
- `marketplace_source` veld is aanwezig in de orders tabel
- Filter op bron werkt al in de bestellijst

## Wat Ontbreekt

1. Badge wordt nergens weergegeven in de UI
2. Facturen tonen geen kanaalinformatie
3. SellQo Webshop orders tonen ook geen badge

---

## Implementatieplan

### Fase 1: Orders - Kanaal Zichtbaar Maken

**1.1 Bestellijst (`Orders.tsx`)**
- Voeg nieuwe kolom "Bron" toe aan tabel
- Toon `OrderMarketplaceBadge` in elke rij
- Ook SellQo Webshop tonen (niet verbergen)

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Order      │ Klant         │ Bron            │ Status    │ Bedrag │ Datum │
├────────────────────────────────────────────────────────────────────────────┤
│ #0042      │ Jan Jansen    │ 🛒 Bol.com      │ Verzonden │ €89.99 │ 25 jan│
│ #0041      │ Piet Pieterse │ 🏪 SellQo       │ Betaald   │ €45.00 │ 25 jan│
│ #0040      │ Marie de Vries│ 📦 Amazon       │ Pending   │ €129.00│ 24 jan│
└────────────────────────────────────────────────────────────────────────────┘
```

**1.2 Order Detail (`OrderDetail.tsx`)**
- Badge toevoegen naast ordernummer in header
- Marketplace order ID tonen indien beschikbaar (voor referentie)

```text
┌─────────────────────────────────────────────────────────┐
│ ← #0042  [🛒 Bol.com]  [Verzonden]  [Betaald]          │
│ 25 januari 2026 om 14:32                                │
│ Marketplace ID: 1234567890                              │
└─────────────────────────────────────────────────────────┘
```

**1.3 OrderMarketplaceBadge Uitbreiden**
- Voeg SellQo Webshop badge toe (nu wordt deze verborgen)
- Voeg WooCommerce, Shopify toe voor toekomstige integraties

---

### Fase 2: Facturen - Kanaal Overnemen van Order

**2.1 Query Uitbreiden (`useInvoices.ts`)**
- Haal `marketplace_source` op via de orders relatie
- Voeg toe aan select: `orders (order_number, customer_name, marketplace_source)`

**2.2 Facturenlijst (`Invoices.tsx`)**
- Nieuwe kolom "Bron" toevoegen
- Hergebruik `OrderMarketplaceBadge` component (werkt ook voor facturen)
- Filter optie toevoegen voor kanaal

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Factuur    │ Klant         │ Order   │ Bron        │ Bedrag  │ Status      │
├─────────────────────────────────────────────────────────────────────────────┤
│ INV-2026-42│ Jan Jansen    │ #0042   │ 🛒 Bol.com  │ €89.99  │ ✓ Betaald   │
│ INV-2026-41│ Piet Pieterse │ #0041   │ 🏪 SellQo   │ €45.00  │ ✓ Betaald   │
│ INV-2026-40│ Marie de Vries│ -       │ 📝 Handmatig│ €500.00 │ → Verstuurd │
└─────────────────────────────────────────────────────────────────────────────┘
```

**2.3 Handmatige Facturen**
- Voor facturen zonder order: toon "Handmatig" badge
- Duidelijk onderscheid met marketplace orders

---

### Fase 3: PDF Factuur Aanpassen (Optioneel)

Als de boekhouder dit ook op de PDF wil:
- Voeg bronvermelding toe aan factuurgenerator
- Subtiele tekst onderaan: "Via: Bol.com" of "Via: SellQo Webshop"

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `OrderMarketplaceBadge.tsx` | Wijzigen | SellQo badge toevoegen, nieuwe kanalen |
| `Orders.tsx` | Wijzigen | Bron kolom + badge in rijen |
| `OrderDetail.tsx` | Wijzigen | Badge in header + marketplace ID |
| `Invoices.tsx` | Wijzigen | Bron kolom + badge + filter |
| `useInvoices.ts` | Wijzigen | `marketplace_source` ophalen via order |

---

## Verwacht Resultaat

```text
Boekhouder opent factuuroverzicht:

1. Ziet direct welke facturen van Bol.com, Amazon of webshop komen
2. Kan filteren op "Alle bronnen" → "Bol.com" → alleen die facturen
3. Opent orderdetail → ziet badge + externe order ID voor matching
4. Export naar boekhoudsoftware → broninfo beschikbaar voor verwerking
```

---

## Technische Details

### OrderMarketplaceBadge Uitbreiding

```typescript
const config: Record<string, { icon: typeof ShoppingBag; label: string; className: string }> = {
  sellqo_webshop: {
    icon: Store,
    label: 'SellQo',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  bol_com: {
    icon: ShoppingBag,
    label: 'Bol.com',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  amazon: {
    icon: Package,
    label: 'Amazon',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  woocommerce: {
    icon: ShoppingCart,
    label: 'WooCommerce',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  shopify: {
    icon: ShoppingBag,
    label: 'Shopify',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  manual: {
    icon: FileEdit,
    label: 'Handmatig',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
};
```

### Factuur Query Aanpassing

```typescript
// useInvoices.ts - Uitgebreide select
.select(`
  *,
  orders (
    order_number,
    customer_name,
    marketplace_source
  ),
  customers (...)
`)
```

---

## Tijdsinschatting

| Fase | Geschatte tijd |
|------|----------------|
| Fase 1: Orders UI | ~10 minuten |
| Fase 2: Facturen UI + Query | ~10 minuten |
| Fase 3: PDF (optioneel) | ~15 minuten |

---

## Voordelen voor de Boekhouder

1. **Directe herkenning** - Kleurcodes per kanaal
2. **Filterbaar** - Snel alleen Bol.com of Amazon facturen bekijken
3. **Traceerbaar** - Marketplace order ID voor externe matching
4. **Compleet** - Zowel op bestellingen als facturen zichtbaar


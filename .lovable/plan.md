

# Fase 3: Verkoopkanaal op PDF Factuur

## Doel
Subtiele tekst toevoegen aan de gegenereerde PDF-factuur zodat de boekhouder ook op de afgedrukte/gearchiveerde factuur kan zien via welk kanaal de bestelling is binnengekomen.

---

## Huidige Situatie

De PDF-generator in `supabase/functions/generate-invoice/index.ts`:
- Haalt de complete order op inclusief `marketplace_source` (regel 1054-1058: `select("*")`)
- **Toont de bron echter NIET** op de PDF

---

## Implementatie

### Aanpassing 1: Helper functie voor bronlabel

Voeg een helper functie toe om het marketplace_source om te zetten naar een leesbaar label:

```typescript
function getMarketplaceLabel(source: string | null): string | null {
  const labels: Record<string, string> = {
    sellqo_webshop: 'SellQo Webshop',
    bol_com: 'Bol.com',
    amazon: 'Amazon',
    woocommerce: 'WooCommerce',
    shopify: 'Shopify',
  };
  return source ? labels[source] || source : null;
}
```

### Aanpassing 2: Meta-sectie uitbreiden (regels 856-868)

Voeg een extra regel toe onder de OGM-referentie om de bron te tonen:

```text
Factuurdatum: 26-01-2026          Ordernummer: #0042
Vervaldatum:  09-02-2026          OGM: +++123/4567/89012+++
                                  Bron: Bol.com
```

### Aanpassing 3: Optioneel - Footer tekst

Of als subtielere optie, voeg toe in de footer:

```text
Via: Bol.com | Deze factuur bevat embedded Factur-X XML...
```

---

## Codewijzigingen

### Bestand: `supabase/functions/generate-invoice/index.ts`

**1. Helper functie toevoegen (rond regel 228)**

```typescript
function getMarketplaceLabel(source: string | null): string | null {
  const labels: Record<string, string> = {
    sellqo_webshop: 'SellQo Webshop',
    bol_com: 'Bol.com',
    amazon: 'Amazon',
    woocommerce: 'WooCommerce',
    shopify: 'Shopify',
  };
  return source ? labels[source] || source : null;
}
```

**2. Meta-sectie uitbreiden (rond regel 868)**

Na de OGM-regel, extra regel toevoegen:

```typescript
// Marketplace source badge
const marketplaceLabel = getMarketplaceLabel(order.marketplace_source);
if (marketplaceLabel) {
  yPos -= 16;
  page.drawText('Via:', { x: margin, y: yPos, size: 10, font: helveticaFont, color: grayColor });
  page.drawText(marketplaceLabel, { x: margin + 30, y: yPos, size: 10, font: helveticaFont, color: primaryColor });
}
```

---

## Visueel Resultaat

```text
┌─────────────────────────────────────────────────────────┐
│ BEDRIJFSNAAM                             FACTUUR        │
│                                          INV-2026-042   │
│                                          [FACTUR-X]     │
│ ...                                                     │
├─────────────────────────────────────────────────────────┤
│ Factuurdatum: 26-01-2026    Ordernummer: #0042          │
│ Vervaldatum:  09-02-2026    OGM: +++123/4567/89012+++   │
│ Via: Bol.com                                            │  ← NIEUW
├─────────────────────────────────────────────────────────┤
│ Omschrijving      Aantal   BTW%    Prijs    Totaal      │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Extra Overwegingen

### Optie A: Alleen bij externe marketplaces
- Verberg "Via: SellQo Webshop" voor eigen webshop orders
- Toon alleen voor Bol.com, Amazon, etc.

### Optie B: Altijd tonen
- Ook SellQo Webshop tonen voor complete administratie

**Aanbeveling**: Optie A - alleen externe bronnen vermelden, want dat is waar de boekhouder het meest baat bij heeft.

---

## Tijdsinschatting

| Onderdeel | Tijd |
|-----------|------|
| Helper functie + meta-sectie | ~5 minuten |
| Testen | ~2 minuten |
| **Totaal** | **~7 minuten** |

---

## Samenvatting

Na deze aanpassing:
1. ✅ **UI Bestellijst** - Badge zichtbaar
2. ✅ **UI Order Detail** - Badge + Marketplace ID
3. ✅ **UI Facturen** - Badge + filter
4. ✅ **PDF Factuur** - Subtiele "Via: [kanaal]" tekst

De boekhouder heeft dan volledige traceerbaarheid van elk verkoopkanaal door de hele applicatie heen.


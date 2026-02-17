
# Offerte omzetten naar bestelling (en daarna factuur)

## Huidige situatie

De offerte detailpagina heeft momenteel geen knop om een offerte om te zetten naar een bestelling. Het veld `converted_order_id` bestaat al in de `quotes` tabel, maar de conversielogica ontbreekt volledig.

## Wat wordt gebouwd

Een "Omzetten naar bestelling" knop op de offerte detailpagina die:
1. Een nieuwe bestelling aanmaakt op basis van de offerte-items
2. De offerte koppelt aan de bestelling via `converted_order_id`
3. De offerte-status verandert naar `converted`
4. De gebruiker doorstuurt naar de nieuwe bestelling (waar al een "Factuur genereren" knop beschikbaar is)

De knop is alleen zichtbaar als de offerte status `accepted` of `sent` heeft, en nog niet eerder is omgezet.

## Technische wijzigingen

### 1. useQuotes.ts - Nieuwe `convertToOrder` mutatie

Toevoegen van een `convertToOrder` mutation die:
- Een ordernummer genereert via `generate_order_number` RPC
- Een nieuwe order aanmaakt in de `orders` tabel met alle relevante data van de offerte (klant, bedragen, notities)
- Order items aanmaakt in `order_items` op basis van de `quote_items`
- De offerte updatet: `status = 'converted'`, `converted_order_id = order.id`
- De aangemaakte order retourneert

### 2. QuoteDetail.tsx - UI wijzigingen

- Nieuwe "Omzetten naar bestelling" knop in de **Acties** kaart (sidebar)
- Alleen zichtbaar bij status `accepted` of `sent` (en als `converted_order_id` nog null is)
- Bevestigingsdialoog voordat de conversie plaatsvindt
- Na succesvolle conversie: navigatie naar de bestelling detailpagina
- Als de offerte al is omgezet: toon een link naar de gekoppelde bestelling

### Flow na conversie

```text
Offerte (accepted) 
  -> Klik "Omzetten naar bestelling"
  -> Bevestig
  -> Bestelling wordt aangemaakt (status: pending, payment_status: unpaid)
  -> Navigatie naar bestelling
  -> Daar kan de factuur gegenereerd worden via bestaande functionaliteit
```

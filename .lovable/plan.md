

## Fix: Health categorie-kaarten linken naar verkeerde pagina's

### Probleem
De 6 health-kaarten op het dashboard linken naar **generieke pagina's** terwijl ze specifieke problemen tonen. Bijvoorbeeld:
- Kaart toont "3 producten niet op voorraad" → linkt naar `/admin/products` (alle producten) in plaats van gefilterd op stock
- Kaart toont "€250 openstaand" → linkt naar `/admin/orders/invoices` terwijl "Financieel" meer suggereert
- De kaart toont het **meest urgente probleem**, maar de link gaat naar de **generieke categorie-pagina**, niet naar de plek waar je dat probleem kunt oplossen

### Oplossing
De `HealthCategoryCardCompact` component aanpassen zodat de kaart-link verwijst naar de **actie-URL van het meest urgente item** in plaats van de generieke `category.actionUrl`. Dit zorgt ervoor dat je direct op de juiste plek belandt.

### Technische aanpak

**`src/components/shop-health/HealthCategoryCard.tsx`** — `HealthCategoryCardCompact`:
- Huidige logica: `mainItem = category.items.find(i => i.status !== 'ok') || category.items[0]`
- Link: `<Link to={category.actionUrl || '#'}>`
- **Fix**: Als `mainItem` een `action.url` heeft, gebruik die. Anders fallback naar `category.actionUrl`.

```typescript
// Nieuw:
const targetUrl = mainItem?.action?.url || category.actionUrl || '#';
<Link to={targetUrl}>
```

Dit zorgt ervoor dat:
- "3 niet op voorraad" → `/admin/products?stock=out` (gefilterde view)
- "2 overdue orders" → `/admin/orders?status=pending` (gefilterde view)
- "€250 openstaand" → `/admin/orders/invoices` (facturen)
- "Stripe niet gekoppeld" → `/admin/settings?tab=payments`
- Als alles OK is → generieke categorie-pagina

### Bestanden
- `src/components/shop-health/HealthCategoryCard.tsx` — 1 regel aanpassen in `HealthCategoryCardCompact`


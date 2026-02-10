

# Geneste kaarten verwijderen - Flat rendering voor sub-componenten

## Probleem

4 sub-componenten renderen hun eigen `<Card>` wrapper, wat dubbele randen/schaduwen oplevert wanneer ze ingebed zijn in de geconsolideerde kaarten op de Order Detail pagina:

- `TrackingInfoCard` - eigen Card wrapper
- `ServicePointCard` - eigen Card wrapper
- `BolActionsCard` - eigen Card wrapper
- `MessageHistoryPanel` - eigen Card wrapper

## Oplossing

Elk component krijgt een `embedded` prop. Wanneer `embedded={true}`, wordt de `<Card>/<CardHeader>/<CardContent>` wrapper overgeslagen en wordt alleen de inhoud gerenderd.

## Technische Wijzigingen

### 1. `TrackingInfoCard.tsx`

- Voeg `embedded?: boolean` prop toe
- Wanneer `embedded=true`: render alleen de inhoud (form fields, buttons) zonder Card/CardHeader/CardContent wrapper en zonder de eigen titel (die staat al op de parent)
- Beide render paths (display mode en edit mode) aanpassen

### 2. `ServicePointCard.tsx`

- Voeg `embedded?: boolean` prop toe
- Wanneer `embedded=true`: render alleen de inhoud (adres, openingstijden, kaartlink) zonder Card wrapper

### 3. `BolActionsCard.tsx`

- Voeg `embedded?: boolean` prop toe
- Wanneer `embedded=true`: render alleen de inhoud (status badge, VVB label sectie, actieknoppen) zonder Card wrapper

### 4. `MessageHistoryPanel.tsx`

- Voeg `embedded?: boolean` prop toe
- Wanneer `embedded=true`: render alleen de timeline lijst zonder Card wrapper
- Loading en empty states ook zonder Card wrapper renderen

### 5. `OrderDetail.tsx`

- Geef `embedded` prop door aan alle 4 componenten:

```typescript
<TrackingInfoCard order={order} embedded />
<ServicePointCard servicePoint={...} embedded />
<BolActionsCard order={order} embedded />
<MessageHistoryPanel entityType="order" entityId={order.id} compact embedded maxItems={3} />
```

## Resultaat

- Geen dubbele randen/schaduwen meer
- Visueel schone, platte layout binnen elke geconsolideerde kaart
- Componenten blijven standalone bruikbaar (zonder `embedded` prop) op andere pagina's

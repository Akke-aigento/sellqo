

# Plan: Marketplace Routing 404 Fixen

## Probleem Geïdentificeerd

De "Instellingen" knop navigeert naar een route die niet bestaat:

| Huidige Navigatie | Werkelijke Route |
|-------------------|------------------|
| `/admin/settings/marketplaces/:id` | `/admin/connect/:connectionId` |
| `/admin/settings/marketplaces` (terug) | `/admin/connect` |

## Benodigde Fixes

### 1. Marketplaces.tsx - handleSettings Fix

**Locatie**: Regel 56

Wijzigen:
```typescript
// Van:
navigate(`/admin/settings/marketplaces/${connection.id}`);

// Naar:
navigate(`/admin/connect/${connection.id}`);
```

### 2. MarketplaceDetail.tsx - Alle Terug-Navigatie Fixes

**Locatie**: Regels 186, 201, 217

Alle verwijzingen naar `/admin/settings/marketplaces` wijzigen naar `/admin/connect`:

| Regel | Functie | Wijziging |
|-------|---------|-----------|
| 186 | `handleDisconnect()` | `navigate('/admin/connect')` |
| 201 | Connectie niet gevonden | `navigate('/admin/connect')` |
| 217 | Terug knop | `navigate('/admin/connect')` |

## Technische Details

### Bestanden te Wijzigen

| Bestand | Wijzigingen |
|---------|-------------|
| `src/pages/admin/Marketplaces.tsx` | 1 regel - navigatie pad corrigeren |
| `src/pages/admin/MarketplaceDetail.tsx` | 3 regels - alle terug-navigatie corrigeren |

### Code Wijzigingen

**Marketplaces.tsx** (regel 56):
```typescript
const handleSettings = (type: MarketplaceType) => {
  const connection = getConnectionByType(type);
  if (connection) {
    navigate(`/admin/connect/${connection.id}`);  // GEFIXT
  }
};
```

**MarketplaceDetail.tsx** (3 locaties):
```typescript
// Regel 186 - na disconnect
navigate('/admin/connect');

// Regel 201 - connectie niet gevonden button
<Button variant="link" onClick={() => navigate('/admin/connect')}>

// Regel 217 - terug knop
<Button variant="ghost" onClick={() => navigate('/admin/connect')}>
```

## Resultaat Na Fix

1. Klikken op "Instellingen" bij Bol.com → Opent `/admin/connect/{uuid}` → **MarketplaceDetailPage wordt geladen**
2. "Sync Nu" knop wordt beschikbaar voor manueel hersynchroniseren
3. Alle terug-navigatie werkt correct naar `/admin/connect`

## Route Overzicht (Bestaand in App.tsx)

```
/admin/connect                    → MarketplacesPage (overzicht)
/admin/connect/:connectionId      → MarketplaceDetailPage (instellingen + sync)
/admin/connect/conflicts          → SyncConflictsPage
```

De routes bestaan al correct - alleen de navigatie-paden in de code waren verkeerd.



# Plan: Fix Ads Platform Connection Validatie

## Samenvatting

De Ads platform koppeling heeft geen echte validatie - als je op "Koppelen" klikt, wordt er direct een record opgeslagen als "gekoppeld" zonder te controleren of er daadwerkelijk een werkende connectie is. Dit plan implementeert correcte validatie voor alle ad platforms.

---

## Probleem Analyse

### Huidige Flow (Gebroken)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  HUIDIGE SITUATIE                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Bol.com Ads - Klik "Activeren"]                                          │
│       ↓                                                                     │
│  connectPlatform.mutateAsync({                                             │
│    platform: 'bol_ads',                                                    │
│    account_name: 'Bol.com Advertenties',                                   │
│    config: { uses_retailer_api: true }                                     │
│  })                                                                         │
│       ↓                                                                     │
│  ❌ Direct opgeslagen als is_active: true                                  │
│  ❌ GEEN check of marketplace_connections een Bol.com koppeling heeft     │
│                                                                             │
│  [Meta/Google/Amazon - Klik "Koppelen"]                                    │
│       ↓                                                                     │
│  Toast: "OAuth wordt binnenkort ondersteund"                               │
│       ↓                                                                     │
│  ❌ Geen actie, maar button suggereert dat het werkt                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gewenste Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CORRECTE FLOW                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Bol.com Ads - Klik "Activeren"]                                          │
│       ↓                                                                     │
│  1. Check: Heeft tenant een actieve Bol.com retailer koppeling?            │
│       ↓                                                                     │
│  ❌ NEE → Toon melding: "Je moet eerst Bol.com koppelen in SellQo Connect" │
│       │   + Link naar /admin/connect?tab=marketplace                        │
│       ↓                                                                     │
│  ✅ JA → Activeer Bol.com Ads met referentie naar retailer connection      │
│                                                                             │
│  [Meta Ads - Klik "Koppelen"]                                              │
│       ↓                                                                     │
│  1. Check: Is Meta OAuth geconfigureerd? (secrets aanwezig)                │
│       ↓                                                                     │
│  ❌ NEE → Toon melding: "Meta Ads koppeling is nog niet beschikbaar"       │
│       │   + Badge "Binnenkort"                                              │
│       ↓                                                                     │
│  ✅ JA → Start OAuth flow via social-oauth-init                            │
│                                                                             │
│  [Google/Amazon - Klik "Koppelen"]                                         │
│       ↓                                                                     │
│  Toon melding: "Google/Amazon Ads koppeling komt binnenkort"               │
│  + Disable button + Badge "Binnenkort"                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### 1. Uitbreiden useAdPlatforms Hook

De hook moet toegang krijgen tot `marketplace_connections` om te valideren of Bol.com retailer koppeling bestaat:

```typescript
// src/hooks/useAdPlatforms.ts

// Toevoegen: query voor marketplace connections
const { data: marketplaceConnections = [] } = useQuery({
  queryKey: ['marketplace-connections', currentTenant?.id],
  queryFn: async () => {
    if (!currentTenant?.id) return [];
    const { data, error } = await supabase
      .from('marketplace_connections')
      .select('id, marketplace_type, is_active')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },
  enabled: !!currentTenant?.id,
});

// Helper: check of benodigde koppeling bestaat
const hasBolRetailerConnection = () => {
  return marketplaceConnections.some(c => 
    c.marketplace_type === 'bol_com' && c.is_active
  );
};

// Helper: platform availability status
const getPlatformStatus = (platform: AdPlatform) => {
  if (platform === 'bol_ads') {
    return hasBolRetailerConnection() 
      ? 'ready' 
      : 'requires_connection';
  }
  // Meta OAuth nog niet geconfigureerd (toekomstig)
  if (platform === 'meta_ads') {
    return 'coming_soon'; // of 'ready' als OAuth is geconfigureerd
  }
  // Google en Amazon nog niet geïmplementeerd
  return 'coming_soon';
};
```

### 2. Update PlatformConnections Component

UI aanpassingen per platform status:

| Platform | Status | Button | Actie |
|----------|--------|--------|-------|
| Bol.com | `ready` | "Activeren" (enabled) | Activeer koppeling |
| Bol.com | `requires_connection` | "Eerst Bol.com koppelen" (link) | Navigeer naar Connect |
| Meta | `ready` | "Koppelen via Facebook" | Start OAuth |
| Meta | `coming_soon` | "Binnenkort" (disabled) | - |
| Google | `coming_soon` | "Binnenkort" (disabled) | - |
| Amazon | `coming_soon` | "Binnenkort" (disabled) | - |

```typescript
// src/components/admin/ads/PlatformConnections.tsx

const handleConnect = async (platform: AdPlatform) => {
  const status = getPlatformStatus(platform);
  
  if (status === 'requires_connection') {
    toast({
      title: 'Retailer koppeling vereist',
      description: 'Koppel eerst je Bol.com account in SellQo Connect.',
      action: (
        <Button asChild size="sm">
          <Link to="/admin/connect?tab=marketplace">Ga naar Connect</Link>
        </Button>
      ),
    });
    return;
  }
  
  if (status === 'coming_soon') {
    toast({
      title: 'Binnenkort beschikbaar',
      description: `${AD_PLATFORMS[platform].name} koppeling komt binnenkort.`,
    });
    return;
  }
  
  // Alleen voor 'ready' status
  if (platform === 'bol_ads') {
    // Vind de bestaande Bol.com retailer connection
    const bolConnection = marketplaceConnections.find(
      c => c.marketplace_type === 'bol_com' && c.is_active
    );
    
    await connectPlatform.mutateAsync({
      platform,
      account_name: 'Bol.com Advertenties',
      account_id: bolConnection?.id, // Referentie naar retailer connection
      config: { 
        uses_retailer_api: true,
        retailer_connection_id: bolConnection?.id 
      }
    });
  } else if (platform === 'meta_ads') {
    // Start OAuth flow
    // ... (toekomstige implementatie)
  }
};
```

### 3. UI Verbeteringen

Visuele indicaties voor status per platform:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOL.COM (zonder retailer koppeling)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  🛒 Bol.com                                                                 │
│  Sponsored Products op Bol.com                                              │
│                                                                             │
│  ⚠️ Om Bol.com Ads te gebruiken moet je eerst je Bol.com                   │
│  Retailer account koppelen in SellQo Connect.                               │
│                                                                             │
│  [Ga naar SellQo Connect →]                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  BOL.COM (met retailer koppeling)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  🛒 Bol.com                                           ✅ Retailer gekoppeld │
│  Sponsored Products op Bol.com                                              │
│                                                                             │
│  Gebruik je bestaande Bol.com Retailer API koppeling                       │
│  voor advertenties.                                                         │
│                                                                             │
│  [Activeren]                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  META (coming soon)                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  📱 Meta (FB/IG)                                            🏷️ Binnenkort  │
│  Facebook & Instagram Ads                                                   │
│                                                                             │
│  Koppel je Facebook Business Manager account om te                          │
│  adverteren op Facebook en Instagram.                                       │
│                                                                             │
│  [Koppelen] (disabled, grayed out)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/hooks/useAdPlatforms.ts` | Update | Voeg marketplace connection check toe, platform status helper |
| `src/components/admin/ads/PlatformConnections.tsx` | Update | Validatie voor connect, visuele status per platform |

---

## Implementatie Details

### useAdPlatforms.ts - Wijzigingen

1. **Nieuwe query** voor `marketplace_connections` (alleen `id`, `marketplace_type`, `is_active`)
2. **Helper functie** `hasBolRetailerConnection()` 
3. **Helper functie** `getPlatformStatus(platform)` returns `'ready' | 'requires_connection' | 'coming_soon'`
4. **Export** nieuwe helpers

### PlatformConnections.tsx - Wijzigingen

1. **Import** nieuwe helpers uit hook
2. **Conditional rendering** per platform status:
   - `requires_connection`: Alert met link naar Connect
   - `coming_soon`: Badge + disabled button
   - `ready`: Normale connect flow
3. **Button tekst** aangepast per status:
   - "Activeren" voor Bol.com ready
   - "Ga naar Connect" voor requires_connection  
   - "Binnenkort" voor coming_soon
4. **handleConnect** validatie voordat upsert wordt uitgevoerd

---

## Resultaat

Na deze wijzigingen:
- ✅ Bol.com Ads kan alleen geactiveerd worden als er een werkende Bol.com retailer koppeling is
- ✅ Duidelijke feedback als koppeling ontbreekt met directe link naar oplossing
- ✅ Coming soon platforms tonen correct als "binnenkort" met disabled buttons
- ✅ Geen valse "gekoppeld" statussen meer

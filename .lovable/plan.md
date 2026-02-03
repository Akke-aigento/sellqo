

# Plan: Bol.com Advertising API Credentials Toevoegen

## Huidige Situatie

De Bol.com koppeling vraagt nu alleen om:
- **Client ID** (Retailer API)
- **Client Secret** (Retailer API)

Maar op de Bol.com API credentials pagina staan twee secties:
1. **Client credentials voor de Retailer API** → orders, producten, voorraad
2. **Client credentials voor de Advertising API** → advertenties, sponsored products

## Wat Dit Oplevert

Met beide API's gekoppeld heb je:

| API | Functionaliteit |
|-----|-----------------|
| Retailer API | Orders importeren, voorraad sync, product listing, VVB labels |
| Advertising API | Sponsored Products campagnes, advertentie budget, performance data |

## Wijzigingen

### 1. MarketplaceCredentials Type Uitbreiden

**Bestand**: `src/types/marketplace.ts`

Nieuwe velden toevoegen voor Advertising API:

```typescript
export interface MarketplaceCredentials {
  // Bestaande velden...
  clientId?: string;
  clientSecret?: string;
  
  // NIEUW: Bol.com Advertising API (optioneel)
  advertisingClientId?: string;
  advertisingClientSecret?: string;
}
```

### 2. ConnectMarketplaceDialog.tsx - State Toevoegen

Nieuwe state variabelen voor Advertising credentials:

```typescript
// Bol.com Advertising API (optioneel)
const [advertisingClientId, setAdvertisingClientId] = useState('');
const [advertisingClientSecret, setAdvertisingClientSecret] = useState('');
const [showAdvertisingSection, setShowAdvertisingSection] = useState(false);
```

### 3. ConnectMarketplaceDialog.tsx - Instructies Uitbreiden

Huidige stappen uitbreiden met Advertising API optie:

```typescript
case 'bol_com':
  return {
    title: 'Bol.com Verkopersportaal',
    url: 'https://partner.bol.com/sdd/preferences/services/api',
    steps: [
      'Log in op je Bol.com verkopersaccount',
      'Je komt direct op de API credentials pagina',
      'Bij "Client credentials voor de Retailer API", klik op "+ Aanmaken"',
      'Geef de credentials een naam (bijv. "SellQo Retailer")',
      'Kopieer de Client ID en Client Secret',
      '(Optioneel) Maak ook credentials aan voor de "Advertising API"',
      'Plak alle credentials hieronder en klik op "Verbind"',
    ],
  };
```

### 4. ConnectMarketplaceDialog.tsx - UI voor Advertising Credentials

In de credentials step, speciale sectie voor Bol.com met twee API's:

```text
┌─────────────────────────────────────────────────────────────┐
│  Retailer API (verplicht)                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Client ID *          [                              ] │  │
│  │ Client Secret *      [••••••••••••] 👁                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │ ☐ Ook Advertising API koppelen (voor Bol.com Ads)    │  │
│  │                                                        │  │
│  │   Client ID          [                              ] │  │
│  │   Client Secret      [••••••••••••] 👁                │  │
│  │                                                        │  │
│  │   ℹ️ Hiermee kun je advertenties beheren vanuit SellQo │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                              │
│  [Test Verbinding]                                          │
└─────────────────────────────────────────────────────────────┘
```

### 5. Credentials Opslaan

Bij `handleConnect` beide API credentials meesturen:

```typescript
const credentials = {
  clientId,
  clientSecret,
  // Alleen meesturen als ingevuld
  ...(advertisingClientId && advertisingClientSecret && {
    advertisingClientId,
    advertisingClientSecret,
  }),
};
```

### 6. Ads Manager - Automatische Detectie

In `useAdPlatforms.ts` de advertising credentials detecteren:

```typescript
// Check if Bol.com has advertising credentials
const hasBolAdvertisingCredentials = () => {
  const bolConnection = marketplaceConnections.find(c => 
    c.marketplace_type === 'bol_com' && c.is_active
  );
  return !!(bolConnection?.credentials?.advertisingClientId);
};
```

### 7. PlatformConnections.tsx - Status Aanpassen

Bol.com Ads status baseren op advertising credentials:

```typescript
const getPlatformStatus = (platform: AdPlatform): PlatformStatus => {
  if (platform === 'bol_ads') {
    const bolConnection = getBolRetailerConnection();
    if (!bolConnection) return 'requires_connection';
    // Check of Advertising API credentials aanwezig zijn
    if (!bolConnection.credentials?.advertisingClientId) {
      return 'requires_advertising_credentials';
    }
    return 'ready';
  }
  return 'coming_soon';
};
```

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/types/marketplace.ts` | Nieuwe velden voor advertising credentials |
| `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx` | State, UI sectie, instructies, opslaan |
| `src/hooks/useAdPlatforms.ts` | Detectie van advertising credentials |
| `src/components/admin/ads/PlatformConnections.tsx` | Status logic aanpassen |

## Flow Overzicht

```text
Gebruiker gaat naar SellQo Connect → Bol.com koppelen

STAP 1: Instructies
- Uitleg over beide API's (Retailer + Advertising)
- Directe link naar Bol.com credentials pagina

STAP 2: Credentials invoeren
- Retailer API (verplicht): Client ID + Secret
- Advertising API (optioneel): Client ID + Secret
- Test verbinding knop test beide

STAP 3: Instellingen
- Order sync settings
- Voorraad settings
- etc.

STAP 4: Klaar!
- Retailer functies direct beschikbaar
- Als Advertising ingevuld → Ads Manager ook klaar
```

## Voordelen

1. **Één keer instellen** - Beide API's in dezelfde flow
2. **Optioneel** - Advertising is niet verplicht
3. **Duidelijke UI** - Scheiding tussen Retailer en Advertising
4. **Automatische integratie** - Ads Manager detecteert automatisch

## Technische Details

### Nieuwe Type Definities (marketplace.ts)

```typescript
export interface MarketplaceCredentials {
  // Bestaande velden...
  clientId?: string;
  clientSecret?: string;
  
  // Bol.com Advertising API (optioneel)
  advertisingClientId?: string;
  advertisingClientSecret?: string;
}
```

### Credentials Opbouw (ConnectMarketplaceDialog.tsx)

```typescript
// In handleFinalConnect
const credentials: MarketplaceCredentials = {
  clientId,
  clientSecret,
};

// Voeg advertising toe als ingevuld
if (advertisingClientId && advertisingClientSecret) {
  credentials.advertisingClientId = advertisingClientId;
  credentials.advertisingClientSecret = advertisingClientSecret;
}
```

### Status Check (useAdPlatforms.ts)

```typescript
export type PlatformStatus = 
  | 'ready' 
  | 'requires_connection' 
  | 'requires_advertising_credentials'  // NIEUW
  | 'coming_soon';

const getPlatformStatus = (platform: AdPlatform): PlatformStatus => {
  if (platform === 'bol_ads') {
    const bolConnection = marketplaceConnections.find(c => 
      c.marketplace_type === 'bol_com' && c.is_active
    );
    
    if (!bolConnection) return 'requires_connection';
    
    // Check voor advertising credentials
    const creds = bolConnection.credentials as MarketplaceCredentials;
    if (!creds.advertisingClientId) {
      return 'requires_advertising_credentials';
    }
    
    return 'ready';
  }
  return 'coming_soon';
};
```


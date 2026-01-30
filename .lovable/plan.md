

# Plan: Shopify Connect UI Verbeteren - OAuth als Standaard

## Analyse van het Probleem

Shopify heeft het Custom App proces veranderd:
- Gebruikers worden vanuit de winkel admin doorgestuurd naar het **Dev Dashboard** (dev.shopify.com)
- Het Dev Dashboard geeft **Client ID + Client Secret**, geen `shpat_` Admin API token
- De huidige "Direct Verbinden" flow vraagt om een `shpat_` token die niet meer beschikbaar is voor nieuwe apps

## Bestaande Infrastructuur

De OAuth infrastructuur bestaat al volledig:
- `ShopifyOAuthConnect.tsx` - UI component
- `shopify-oauth-init` edge function - start OAuth flow
- `shopify-oauth-callback` edge function - verwerkt callback en slaat credentials op
- `ShopifyCallback.tsx` - callback pagina
- Secrets: `SHOPIFY_CLIENT_ID` en `SHOPIFY_CLIENT_SECRET` zijn geconfigureerd

## Oplossing

### 1. ShopifyConnectDialog.tsx - Nieuwe Tab Structuur

Huidige tabs: **Direct | Aanvraag | Import**

Nieuwe tabs: **OAuth | Token | Aanvraag | Import**

| Tab | Badge | Beschrijving |
|-----|-------|--------------|
| OAuth | "Aanbevolen" | Eenvoudige koppeling via Shopify login (standaard geselecteerd) |
| Token | "Advanced" | Voor bestaande Custom Apps met shpat_ token |
| Aanvraag | "1-2 dagen" | Handmatige koppeling via support |
| Import | "Eenmalig" | CSV import |

### 2. ShopifyOAuthConnect.tsx - Styling Verbeteren

Huidige component werkt al, maar kan visueel beter:
- Toevoegen van stappen-indicator
- Duidelijkere feedback na redirect
- Consistente styling met andere tabs

### 3. ShopifyInstantConnect.tsx - Hernoemd naar Token Flow

- Verduidelijken dat dit voor **bestaande** Custom Apps is
- Warning toevoegen dat nieuwe apps via Dev Dashboard geen shpat_ token geven
- Verwijzing naar OAuth tab als alternatief

## Wijzigingen per Bestand

### src/components/admin/marketplace/ShopifyConnectDialog.tsx

**Wijziging**: Tab structuur aanpassen

```text
Huidige tabs:
[Zap] Direct    [Clock] Aanvraag    [Upload] Import
      "Nu"           "1-2 dagen"         "Eenmalig"

Nieuwe tabs:
[Store] OAuth     [Key] Token       [Clock] Aanvraag    [Upload] Import
   "Aanbevolen"      "Advanced"        "1-2 dagen"         "Eenmalig"
```

- Default tab wijzigen van 'instant' naar 'oauth'
- Nieuwe TabsContent voor OAuth met ShopifyOAuthConnect
- Hernoemen 'instant' tab naar 'token' in de UI

### src/components/admin/marketplace/shopify/ShopifyInstantConnect.tsx

**Wijziging**: Waarschuwing toevoegen over nieuwe Shopify flow

- Alert toevoegen dat nieuwe Custom Apps via Dev Dashboard geen shpat_ token meer geven
- Uitleggen dat deze methode alleen werkt voor **bestaande** apps
- Link naar OAuth tab als aanbevolen alternatief

### src/components/admin/marketplace/ShopifyOAuthConnect.tsx

**Wijziging**: Kleine UI verbeteringen

- Consistente styling met ShopifyInstantConnect (badges, stappen)
- Duidelijkere call-to-action

## Flow Vergelijking

```text
OAuth Flow (nieuw standaard):
1. Gebruiker vult shop URL in
2. Klik "Verbind met Shopify"
3. Redirect naar Shopify login
4. Gebruiker geeft toestemming
5. Redirect terug naar SellQo
6. Token wordt automatisch opgeslagen
[DONE - geen handmatige stappen]

Token Flow (bestaande apps):
1. Gebruiker gaat naar Dev Dashboard
2. Maakt app aan
3. Krijgt Client ID + Secret (NIET shpat_!)
4. Moet OAuth flow handmatig doen...
[BROKEN - shpat_ niet meer beschikbaar]
```

## Technische Details

### Tab Configuratie (ShopifyConnectDialog.tsx)

```tsx
const [activeTab, setActiveTab] = useState<ConnectionMethod>('oauth');

type ConnectionMethod = 'oauth' | 'token' | 'request' | 'import';
```

### Nieuwe OAuth Tab

```tsx
<TabsTrigger 
  value="oauth" 
  className="flex flex-col items-center gap-1 py-3"
>
  <Store className="w-5 h-5" />
  <span className="text-xs font-medium">OAuth</span>
  <Badge variant="secondary" className="bg-green-100 text-green-700">
    Aanbevolen
  </Badge>
</TabsTrigger>
```

### Waarschuwing in Token Tab

```tsx
<Alert className="bg-amber-50 border-amber-200">
  <AlertTriangle className="w-4 h-4 text-amber-600" />
  <AlertTitle>Alleen voor bestaande Custom Apps</AlertTitle>
  <AlertDescription>
    Nieuwe Custom Apps via het Dev Dashboard geven geen Admin API token.
    Gebruik de <strong>OAuth</strong> tab voor nieuwe koppelingen.
  </AlertDescription>
</Alert>
```

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/marketplace/ShopifyConnectDialog.tsx` | Nieuwe OAuth tab toevoegen, default wijzigen |
| `src/components/admin/marketplace/shopify/ShopifyInstantConnect.tsx` | Waarschuwing + hernoeming |
| `src/components/admin/marketplace/ShopifyOAuthConnect.tsx` | Styling verbeteringen |

## Resultaat

- OAuth is de standaard en aanbevolen methode
- Token flow blijft beschikbaar voor bestaande apps
- Duidelijke communicatie over wat wel/niet werkt
- Geen verwarring meer over waar de shpat_ token te vinden is



# Plan: Verbeterde Shopify Koppeling met 3 Connectie Opties

## Overzicht
Transformeer de huidige Shopify koppeling van een enkele OAuth flow naar een flexibel systeem met drie opties die verschillende gebruikers tegemoet komen: managed service, tech-savvy DIY, en eenmalige CSV import.

## Architectuur

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ShopifyConnectDialog                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │ Request       │ │ Instant       │ │ Manual Import         │  │
│  │ Connection    │ │ Connect       │ │ (CSV)                 │  │
│  │ (1-2 dagen)   │ │ (Direct)      │ │ (Eenmalig)            │  │
│  └───────┬───────┘ └───────┬───────┘ └───────────┬───────────┘  │
│          │                 │                     │              │
│          ▼                 ▼                     ▼              │
│  shopify_connection    Custom App           CSV Parsers         │
│  _requests table      Token Input          (Products, Orders)   │
│          │                 │                     │              │
│          ▼                 ▼                     ▼              │
│  Admin Dashboard     marketplace           Direct import to     │
│  (Status tracking)   _connections         SellQo tables        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Database Aanpassingen

### 1.1 Nieuwe tabel: `shopify_connection_requests`
Opslaan van verzoeken voor managed connections:

```sql
CREATE TABLE shopify_connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,
  store_url TEXT GENERATED ALWAYS AS (store_name || '.myshopify.com') STORED,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_review', 'approved', 'completed', 'rejected')),
  notes TEXT,
  admin_notes TEXT,
  install_link TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.2 Toevoegen kolom aan `marketplace_connections`
Track hoe de connectie tot stand is gekomen:

```sql
ALTER TABLE marketplace_connections 
ADD COLUMN connection_type TEXT DEFAULT 'oauth' 
  CHECK (connection_type IN ('oauth', 'custom_app', 'manual_import', 'request'));
```

### 1.3 RLS Policies
- Tenants kunnen alleen hun eigen requests zien
- Platform admins kunnen alle requests beheren

---

## Fase 2: UI Componenten

### 2.1 Hoofdcomponent: `ShopifyConnectDialog`
Vervangt de huidige `ShopifyOAuthConnect` component met een tabbed interface.

**Locatie:** `src/components/admin/marketplace/ShopifyConnectDialog.tsx`

**Structuur:**
```text
Dialog
├── Tabs
│   ├── Tab 1: Request Connection
│   │   ├── Store naam input (suffix .myshopify.com)
│   │   ├── Notities textarea (optioneel)
│   │   ├── Info alert: "1-2 werkdagen, wij doen het werk"
│   │   └── Submit button → toast + status view
│   │
│   ├── Tab 2: Instant Connect
│   │   ├── Info card met uitleg
│   │   ├── Link naar instructie pagina
│   │   └── CTA: "Start Self-Service Setup"
│   │
│   └── Tab 3: Manual Import
│       ├── Waarschuwing: "Eenmalig, geen sync"
│       ├── CSV type selector (Products/Orders/Customers/Discounts)
│       └── Upload zone per type
```

### 2.2 Request Connection Tab Component
**Component:** `ShopifyRequestConnection.tsx`

**Features:**
- Store naam validatie (alleen alfanumeriek + hyphens)
- Submit naar database
- Success state met "In behandeling" status
- Link naar status dashboard

### 2.3 Instant Connect Instructie Pagina
**Component:** `ShopifyInstantConnectInstructions.tsx`  
**Route:** `/admin/connect/shopify/instructions`

**Content:**
1. Stap-voor-stap uitleg met screenshots
2. Vereiste scopes (copyable):
   - `read_products, write_products`
   - `read_orders, write_orders`
   - `read_inventory, write_inventory`
   - `read_customers`
   - `read_fulfillments, write_fulfillments`
3. Token input form
4. Test connection button
5. Save bij success

### 2.4 Manual Import Tab Component
**Component:** `ShopifyManualImport.tsx`

**CSV Types:**
| Type | Shopify Export Path | Target Table |
|------|-------------------|--------------|
| Producten | Products → Export | products |
| Bestellingen | Orders → Export | orders |
| Klanten | Customers → Export | customers |
| Kortingen | Discounts → Export | discounts |

**Features:**
- Dropzone per bestand type
- Preview van eerste 5 rijen
- Column mapping (auto-detect Shopify format)
- Import progress indicator
- Resultaat samenvatting

### 2.5 Status Dashboard Component
**Component:** `ShopifyRequestStatus.tsx`

**Geïntegreerd in Marketplaces pagina:**
- Toon pending requests voor tenant
- Status badges (Pending/In Review/Approved)
- "Activeer Nu" button wanneer install_link beschikbaar is
- Notificaties bij status updates

---

## Fase 3: Backend Logica

### 3.1 Edge Function: `test-shopify-connection`
Test Custom App credentials voordat ze worden opgeslagen.

```typescript
// Endpoint: POST /test-shopify-connection
// Body: { storeUrl, accessToken }
// Returns: { success: boolean, shopName?: string, error?: string }
```

### 3.2 CSV Import Processing
Hergebruik bestaande `parseCSV` pattern uit `trackingProcessor.ts`:

**Nieuwe parsers:**
- `src/lib/shopifyProductParser.ts`
- `src/lib/shopifyOrderParser.ts`  
- `src/lib/shopifyCustomerParser.ts`
- `src/lib/shopifyDiscountParser.ts`

### 3.3 Request Notification System
Trigger notificatie naar platform admins bij nieuwe request:

```typescript
// Reuse existing send_notification() function
PERFORM public.send_notification(
  tenant_id,
  'integrations',
  'shopify_request_new',
  'Nieuwe Shopify koppelverzoek',
  'Store: ' || store_name,
  'high',
  '/admin/tenants?tab=shopify-requests',
  jsonb_build_object('request_id', id, 'store_name', store_name)
);
```

---

## Fase 4: Platform Admin Interface

### 4.1 Shopify Requests Tab (Platform Admin)
**Locatie:** Toevoegen aan bestaande tenant management of aparte sectie

**Features:**
- Lijst van alle pending requests
- Filter op status
- Approve actie → genereert install_link
- Reject actie → stuurt email naar tenant
- Mark as Completed na succesvolle koppeling

---

## Technische Details

### Bestandswijzigingen

**Nieuwe bestanden:**
1. `src/components/admin/marketplace/ShopifyConnectDialog.tsx` - Hoofd dialog met tabs
2. `src/components/admin/marketplace/shopify/ShopifyRequestConnection.tsx` - Request form
3. `src/components/admin/marketplace/shopify/ShopifyInstantConnectPage.tsx` - Instructie pagina
4. `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` - CSV import
5. `src/components/admin/marketplace/shopify/ShopifyRequestStatus.tsx` - Status widget
6. `src/lib/shopifyImportParsers.ts` - CSV parsers voor Shopify exports
7. `src/hooks/useShopifyRequests.ts` - CRUD hook voor requests

**Aan te passen bestanden:**
1. `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx` - Gebruik nieuwe ShopifyConnectDialog
2. `src/pages/admin/Marketplaces.tsx` - Toon pending requests status
3. `src/App.tsx` - Nieuwe route voor instructie pagina
4. `src/types/marketplace.ts` - connection_type toevoegen aan interfaces

**Database migratie:**
1. `shopify_connection_requests` tabel
2. `connection_type` kolom op `marketplace_connections`
3. RLS policies

### Externe Links
Alle Shopify documentatie links worden clickable:
- `https://admin.shopify.com/store/{store}/settings/apps/development`
- `https://help.shopify.com/nl/manual/apps/custom-apps`

### Copy Functionaliteit
Alle technische waarden krijgen een copy button:
- Scopes lijst
- API access tokens
- Store URL formaat

---

## UI/UX Overwegingen

### Tab Badges
- Request: "1-2 dagen"
- Instant: "Direct"  
- Import: "Eenmalig"

### Kleurcodering
- Request tab: Blauw (managed service)
- Instant tab: Groen (success-oriented)
- Import tab: Oranje (waarschuwing)

### Error Handling
- Store naam validatie met realtime feedback
- Token test met duidelijke foutmeldingen
- CSV parsing errors per rij weergeven

---

## Implementatie Volgorde

1. **Database migratie** - Tabel en kolommen aanmaken
2. **Request Connection tab** - Basis form en database save
3. **Status dashboard** - Weergave van pending requests
4. **Instant Connect pagina** - Instructies en token form
5. **Manual Import** - CSV upload en parsing
6. **Platform Admin tools** - Request management
7. **Integratie** - Alles samenvoegen in één dialog

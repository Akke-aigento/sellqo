
# Implementatieplan: Externe Fulfillment & Dropshipping Ondersteuning

## Overzicht

Dit plan implementeert volledige ondersteuning voor **externe fulfillment partners** (3PL) en **dropshipping scenario's**, inclusief:
1. **Warehouse rol met beperkte toegang** - alleen fulfillment-gerelateerde data
2. **Internationale carriers** - China Post, Yanwen, 17TRACK, etc.
3. **Externe partner API** - 3PL systemen kunnen orders ophalen en tracking updaten
4. **Dedicated Fulfillment Dashboard** - geoptimaliseerd voor magazijnmedewerkers

---

## Huidige Situatie

| Component | Status | Opmerking |
|-----------|--------|-----------|
| `warehouse` rol | ✅ Bestaat | In `app_role` enum |
| Rol-toewijzing | ✅ Werkt | Via `user_roles` tabel |
| Carriers | ⚠️ Beperkt | Alleen EU carriers (PostNL, DHL, etc.) |
| RLS voor warehouse | ❌ Ontbreekt | Ziet alle data inclusief financieel |
| Navigatie filtering | ❌ Ontbreekt | Ziet volledige admin menu |
| 3PL API | ❌ Ontbreekt | Geen externe integratie mogelijkheid |
| Fulfillment Dashboard | ❌ Ontbreekt | Geen dedicated view |

---

## Deel 1: Internationale Carriers voor Dropshipping

### Nieuwe Carriers Toevoegen

Uitbreiding van `src/lib/carrierPatterns.ts` met internationale/dropship carriers:

| Carrier | Tracking URL | Regio |
|---------|-------------|-------|
| China Post | 17track.net/nl/track?nums={tracking} | China |
| Yanwen | track.yanwen.com.cn/en/web/tracking?numbers={tracking} | China |
| Cainiao | global.cainiao.com/detail.htm?mailNoList={tracking} | AliExpress |
| 4PX | track.4px.com/query/{tracking} | China/Global |
| ePacket | 17track.net/nl/track?nums={tracking} | China |
| 17TRACK (universeel) | 17track.net/nl/track?nums={tracking} | Multi-carrier |
| YunExpress | yuntrack.com/Track/Detail/{tracking} | China |
| SF Express | sf-express.com/cn/en/dynamic_function/waybill/{tracking} | China |
| DHL eCommerce | webtrack.dhlecs.com/?trackingnumber={tracking} | Global |
| Royal Mail | royalmail.com/track-your-item#{tracking} | UK |
| USPS | tools.usps.com/go/TrackConfirmAction?tLabels={tracking} | USA |
| Parcel Force | parcelforce.com/track-trace?trackNumber={tracking} | UK |

### Custom Carrier Ondersteuning

Voor carriers die niet in de lijst staan:
- "Andere" optie met vrije URL invoer
- Tracking URL wordt 1-op-1 opgeslagen zonder template

---

## Deel 2: Warehouse Rol - Beperkte Toegang

### Database: Security Definer Functies

Nieuwe functies voor rol-gebaseerde toegangscontrole:

```sql
-- Check of gebruiker warehouse rol heeft
CREATE OR REPLACE FUNCTION public.is_warehouse_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'warehouse'
  )
$$;

-- Get user's highest role (voor UI filtering)
CREATE OR REPLACE FUNCTION public.get_user_highest_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'platform_admin' THEN 1 
      WHEN 'tenant_admin' THEN 2 
      WHEN 'accountant' THEN 3
      WHEN 'staff' THEN 4 
      WHEN 'warehouse' THEN 5
      WHEN 'viewer' THEN 6
    END
  LIMIT 1
$$;
```

### Database: Orders View voor Warehouse

Een speciale view die financiële data verbergt:

```sql
CREATE VIEW public.orders_warehouse
WITH (security_invoker=on) AS
SELECT 
  id,
  tenant_id,
  order_number,
  status,
  fulfillment_status,
  customer_name,
  shipping_address,
  carrier,
  tracking_number,
  tracking_url,
  shipped_at,
  delivered_at,
  delivery_type,
  service_point_id,
  service_point_data,
  marketplace_source,
  marketplace_order_id,
  created_at,
  updated_at
  -- EXCLUSIEF: subtotal, total, tax_amount, discount_amount, shipping_cost, 
  -- customer_email, customer_phone, billing_address, notes, internal_notes
FROM public.orders;

-- RLS: Warehouse users kunnen alleen via deze view
CREATE POLICY "Warehouse users access via view"
  ON public.orders FOR SELECT
  USING (
    -- Reguliere toegang voor niet-warehouse users
    NOT public.is_warehouse_user(auth.uid())
    AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );
```

### Items View (zonder prijzen)

```sql
CREATE VIEW public.order_items_warehouse
WITH (security_invoker=on) AS
SELECT 
  id,
  order_id,
  product_id,
  product_name,
  product_sku,
  product_image,
  quantity
  -- EXCLUSIEF: unit_price, total_price
FROM public.order_items;
```

---

## Deel 3: Frontend Rol-Filtering

### useAuth Hook Uitbreiding

Update `src/hooks/useAuth.tsx`:

```typescript
interface AuthContextType {
  // ... bestaand ...
  userRole: AppRole | null;  // Hoogste rol
  isWarehouse: boolean;
  isAccountant: boolean;
  hasFinancialAccess: boolean;
}

// In provider:
const userRole = roles.length > 0 
  ? roles.reduce((highest, r) => {
      const priority = { platform_admin: 1, tenant_admin: 2, accountant: 3, staff: 4, warehouse: 5, viewer: 6 };
      return priority[r.role] < priority[highest] ? r.role : highest;
    }, roles[0].role as AppRole)
  : null;

const isWarehouse = userRole === 'warehouse';
const isAccountant = userRole === 'accountant';
const hasFinancialAccess = ['platform_admin', 'tenant_admin', 'accountant'].includes(userRole || '');
```

### Sidebar Filtering

Update `src/components/admin/AdminSidebar.tsx`:

```typescript
// Menu items per rol definiëren
const WAREHOUSE_ALLOWED_ITEMS = [
  'dashboard', 'orders', 'orders-all', 'products', 'shipping'
];

const WAREHOUSE_HIDDEN_ITEMS = [
  'orders-invoices', 'orders-creditnotes', 'orders-subscriptions', 'orders-quotes',
  'promotions', 'marketplaces', 'campaigns', 'ai-tools', 'seo', 'translations',
  'reports', 'analytics', 'billing', 'settings', 'customers', 'pos'
];

// In renderNavItem:
if (isWarehouse && !WAREHOUSE_ALLOWED_ITEMS.includes(item.id)) {
  return null;
}
```

### NavItem Type Uitbreiding

Update `src/components/admin/sidebar/sidebarConfig.ts`:

```typescript
export interface NavItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  children?: NavItem[];
  featureKey?: string;
  allowedRoles?: AppRole[];  // NIEUW: welke rollen dit item mogen zien
  excludeRoles?: AppRole[];  // NIEUW: welke rollen dit NIET mogen zien
}
```

---

## Deel 4: Fulfillment Dashboard

### Nieuwe Pagina: `/admin/fulfillment`

Dedicated dashboard voor warehouse medewerkers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📦 Fulfillment Queue                                          [Refresh]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filters: [Te verzenden ▼] [Alle carriers ▼] [Vandaag ▼]    🔍 Zoek order  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  □ Order      │ Klant         │ Items │ Carrier │ Actie                    │
│────────────────────────────────────────────────────────────────────────────│
│  □ #0089      │ J. de Vries   │ 3     │ -       │ [Label maken] [Markeer]  │
│  □ #0088      │ M. Jansen     │ 1     │ PostNL  │ [Print] [Track]          │
│  □ #0087      │ A. Bakker     │ 2     │ -       │ [Label maken] [Markeer]  │
│────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Geselecteerd: 2 orders     [Batch: Label] [Batch: Print] [Batch: Verzend] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Componenten

| Component | Functie |
|-----------|---------|
| `FulfillmentQueue.tsx` | Hoofdtabel met te verzenden orders |
| `FulfillmentOrderRow.tsx` | Order regel met snelle acties |
| `BatchActionsBar.tsx` | Bulk acties voor geselecteerde orders |
| `QuickTrackingInput.tsx` | Modal voor snel tracking invoeren |
| `FulfillmentFilters.tsx` | Filter op status, carrier, datum |

### Order Detail voor Warehouse

Beperkte versie van `OrderDetail.tsx`:
- ✅ Zichtbaar: Klant naam, verzendadres, producten (naam/SKU/foto/aantal)
- ✅ Zichtbaar: Tracking input, pakbon printen
- ❌ Verborgen: Prijzen, marges, facturen, betalingsstatus

---

## Deel 5: 3PL API Endpoint

### Edge Function: `fulfillment-api`

RESTful API voor externe fulfillment partners:

```typescript
// GET /functions/v1/fulfillment-api/orders
// Headers: Authorization: Bearer <3pl_api_key>
// Response: Array van orders klaar voor verzending

// POST /functions/v1/fulfillment-api/orders/{id}/tracking
// Body: { carrier: "china_post", tracking_number: "LP123456789CN" }
// Effect: Update order, trigger klant notificatie

// POST /functions/v1/fulfillment-api/orders/{id}/shipped
// Body: { carrier: "yanwen", tracking_number: "YW123", tracking_url?: "..." }
// Effect: Markeert als verzonden, synct naar marketplace indien nodig
```

### API Key Beheer

Nieuwe tabel `fulfillment_api_keys`:

```sql
CREATE TABLE public.fulfillment_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,  -- "CJ Dropshipping", "Warehouse China"
  api_key TEXT NOT NULL UNIQUE,
  api_secret TEXT,  -- Voor webhook signing
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"read_orders": true, "update_tracking": true}',
  ip_whitelist TEXT[],  -- Optioneel
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### UI voor API Key Beheer

In Settings > Integraties > Fulfillment API:

```text
┌─────────────────────────────────────────────────────────────────┐
│  🔑 Fulfillment API Keys                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CJ Dropshipping                                    [Actief]   │
│  Key: fk_live_abc...xyz                   [Kopieer] [Verwijder]│
│  Laatst gebruikt: 2 uur geleden                                │
│                                                                 │
│  China Warehouse #2                               [Inactief]   │
│  Key: fk_live_def...uvw                   [Kopieer] [Verwijder]│
│  Laatst gebruikt: Nooit                                        │
│                                                                 │
│                              [+ Nieuwe API Key]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deel 6: Tracking Sync naar Marketplaces

### Automatische Terugkoppeling

Wanneer tracking wordt ingevoerd (via UI of API):

1. Check of order `marketplace_source` heeft
2. Indien ja, roep relevante sync functie aan:
   - `confirm-bol-shipment` voor Bol.com
   - `confirm-amazon-shipment` voor Amazon
   - Shopify/WooCommerce webhooks

### Edge Function Update

In `useOrderShipping.ts` of nieuwe Edge Function:

```typescript
// Na tracking update:
if (order.marketplace_source === 'bol_com') {
  await supabase.functions.invoke('confirm-bol-shipment', {
    body: { order_id, tracking_number, carrier, tracking_url }
  });
}
```

---

## Implementatie Overzicht

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Database** | | |
| Migratie | SQL | `is_warehouse_user()`, `get_user_highest_role()` functies |
| Migratie | SQL | `orders_warehouse` en `order_items_warehouse` views |
| Migratie | SQL | `fulfillment_api_keys` tabel |
| Migratie | SQL | RLS policies voor warehouse rol |
| **Carriers** | | |
| `carrierPatterns.ts` | Update | 12+ internationale carriers toevoegen |
| **Auth & UI** | | |
| `useAuth.tsx` | Update | `userRole`, `isWarehouse`, `hasFinancialAccess` |
| `AdminSidebar.tsx` | Update | Rol-gebaseerde menu filtering |
| `sidebarConfig.ts` | Update | `allowedRoles`/`excludeRoles` per item |
| **Fulfillment** | | |
| `FulfillmentQueue.tsx` | Nieuw | Hoofdpagina fulfillment dashboard |
| `FulfillmentOrderRow.tsx` | Nieuw | Order rij component |
| `QuickTrackingInput.tsx` | Nieuw | Snelle tracking invoer modal |
| `FulfillmentAPISettings.tsx` | Nieuw | API key beheer UI |
| **Edge Functions** | | |
| `fulfillment-api/index.ts` | Nieuw | 3PL REST API |
| **Routes** | | |
| `App.tsx` | Update | Route `/admin/fulfillment` toevoegen |

---

## Technische Details

### Rol Hiërarchie

```text
platform_admin (1) - Volledige toegang + platform beheer
     │
tenant_admin (2) - Volledige tenant toegang
     │
accountant (3) - Financieel + rapporten, geen producten wijzigen
     │
staff (4) - Orders, producten, klanten (geen instellingen)
     │
warehouse (5) - Alleen fulfillment: orders picken, tracking invoeren
     │
viewer (6) - Alleen-lezen (geen acties)
```

### Warehouse Gebruiker Flow

```text
Login                Sidebar                 Fulfillment Queue
  │                     │                          │
  │  warehouse role     │  Alleen:                 │  Ziet orders
  │  detected           │  - Dashboard             │  - Klant naam
  │──────────────────▶  │  - Fulfillment           │  - Verzendadres
                        │  - Orders (beperkt)      │  - Items (geen prijs)
                        │                          │
                        │  Verborgen:              │  Kan:
                        │  - Facturen              │  - Label maken
                        │  - Klanten               │  - Tracking invoeren
                        │  - Instellingen          │  - Pakbon printen
                        │  - Rapporten             │
```

### 3PL API Flow

```text
3PL Systeem              Sellqo API                   Database
    │                        │                           │
    │  GET /orders           │                           │
    │  (pending_shipment)    │                           │
    │───────────────────────▶│                           │
    │                        │  SELECT orders            │
    │                        │  WHERE fulfillment=       │
    │                        │  'unfulfilled'            │
    │                        │──────────────────────────▶│
    │                        │                           │
    │  [order list]          │                           │
    │◀───────────────────────│                           │
    │                        │                           │
    │  POST /orders/x/       │                           │
    │       tracking         │                           │
    │  {carrier, number}     │                           │
    │───────────────────────▶│                           │
    │                        │  UPDATE orders            │
    │                        │  SET carrier=...,         │
    │                        │  tracking_number=...      │
    │                        │──────────────────────────▶│
    │                        │                           │
    │                        │  → confirm-bol-shipment   │
    │                        │  → send-tracking-email    │
    │                        │                           │
    │  {success: true}       │                           │
    │◀───────────────────────│                           │
```

---

## Resultaat

Na implementatie:

| Scenario | Ondersteuning |
|----------|---------------|
| **Lokale fulfillment (EU)** | ✅ Bestaande carriers + nieuwe |
| **Dropshipping China** | ✅ China Post, Yanwen, Cainiao, 4PX, etc. |
| **Externe 3PL partner** | ✅ Via Fulfillment API |
| **CJ Dropshipping integratie** | ✅ Via API + tracking sync |
| **Warehouse medewerker (intern)** | ✅ Beperkte rol, geen financiële data |
| **Warehouse partner (extern)** | ✅ API key per partner |
| **Multi-warehouse** | ✅ Meerdere API keys per tenant |
| **Marketplace tracking sync** | ✅ Automatische terugkoppeling |

**Dropshippers kunnen nu:**
1. Orders automatisch importeren (via bestaande marketplace sync)
2. Externe leverancier laten fulfilllen via API
3. Tracking automatisch laten terugstromen naar Bol.com/Amazon/etc.
4. Klant krijgt automatisch tracking email

**Warehouse partners kunnen nu:**
1. Inloggen met beperkte `warehouse` rol
2. Alleen fulfillment-relevante data zien
3. Orders picken, labelen, verzenden
4. Geen toegang tot prijzen, marges, klantgegevens (behalve verzendadres)

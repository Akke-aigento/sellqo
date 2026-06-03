# Fase 2 Foundation — Recon

Datum: 2026-06-03  
Status: read-only rapport, geen code-wijzigingen.

---

## 1. `authenticateRequest` signature + `AuthResult` type

Bron: `supabase/functions/_shared/auth.ts` (regels 1–50).

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface AuthResult {
  user_id: string;
  email: string;
  tenant_ids: string[];
  is_platform_admin: boolean;
}

export async function authenticateRequest(
  req: Request,
  requiredTenantId?: string
): Promise<AuthResult>
```

Service-role bearer-token bypass retourneert een `AuthResult` met
`user_id="service_role"`, lege `tenant_ids`, en `is_platform_admin=true`.
Voor user-JWT's wordt `auth.users` + `user_roles` opgevraagd, vervolgens
optionele tenant-ACL gecheckt tegen `requiredTenantId`.

---

## 2. Edge functions die `authenticateRequest` importeren

Totaal: **81 functies** (`rg -l "from .*_shared/auth" supabase/functions`,
exclusief `_shared/auth.ts` zelf).

Categorisatie op basis van primaire werking (read = alleen GET/SELECT,
write = mutatie op DB of externe API, mixed = beide):

### Read-only (8)
- `check-amazon-listing-status`
- `check-bol-process-status`
- `check-ebay-listing-status`
- `lookup-bol-offer-id`
- `search-ebay-categories`
- `fetch-meta-catalogs`
- `resolve-vat-regime`
- `regression-test-vat`

### Write (53)
- AI write: `ai-build-knowledge-index`, `ai-generate-seo-content`,
  `ai-learn-from-feedback`, `ai-optimize-marketplace-content`,
  `ai-product-promo-kit`, `ai-translate-content`, `ai-suggest-reply`,
  `ai-chatbot-respond`, `ai-help-assistant`, `ai-proactive-monitor`,
  `ai-business-coach`
- Orders/invoicing: `accept-bol-order`, `confirm-bol-shipment`,
  `create-manual-invoice`, `create-quote-payment-link`, `generate-invoice`,
  `generate-peppol-ubl`, `process-refund`, `send-invoice-email`,
  `send-order-confirmation`, `send-quote-email`, `send-return-email`,
  `send-gift-card-email`, `send-customer-message`, `send-test-email`,
  `send-campaign-batch`, `send-team-invitation`, `remove-team-member`,
  `create-notification`
- Marketplaces / sync write: `create-amazon-offer`, `update-amazon-offer`,
  `create-bol-offer`, `update-bol-offer`, `create-bol-vvb-label`,
  `create-ebay-listing`, `create-shopify-product`, `update-shopify-product`,
  `create-woocommerce-product`, `update-woocommerce-product`,
  `create-odoo-product`, `update-odoo-product`,
  `create-amazon-buy-shipping-label`, `create-shipping-label`,
  `fetch-external-label`, `import-bol-csv`, `import-bol-shipments`,
  `run-csv-import`, `trigger-manual-sync`, `sync-meta-catalog`,
  `sync-platform-reviews`, `push-bol-campaign`, `social-oauth-init`,
  `social-post-publish`, `send-meta-message`
- Backfills / VAT: `backfill-ubl-archive`, `backfill-vat-regimes`,
  `warmup-vat-cache`

### Mixed read+write (20)
- `ads-bolcom-scheduler`, `ads-campaign-analyze`, `ads-inventory-watch`,
  `ai-seo-analyzer`, `vat-report-engine`,
  `export-ic-listing-xml`, `export-odoo-csv`, `export-q-bundle`,
  `export-vat-pdf`, `export-vat-xlsx`, `export-vat-xml`,
  `test-marketplace-connection`, `test-odoo-connection`,
  `test-shipping-connection`, `test-shopify-connection`,
  `test-sync-rules`

(Exporters tellen als mixed: lezen brondata, schrijven export-rows /
audit-trail / `vat_returns_archive`.)

---

## 3. Destructuring-risico

`rg "const \{[^}]*\} = await authenticateRequest"` en
`rg "const \{[^}]*\} = auth\b"` over `supabase/functions/**` leveren
**0 matches** buiten `_shared/`. Alle call-sites bewaren het volledige
`AuthResult`-object (variabelenaam meestal `auth`) en dereferencen per veld
(`auth.user_id`, `auth.tenant_ids`, `auth.is_platform_admin`).

→ Toevoegen van nieuwe velden aan `AuthResult` is **backward compatible**.
Geen enkele functie destructureert exhaustief.

---

## 4. Huidige `has_role` definitie

Bron: `supabase/migrations/20260113175808_…sql` (regels 76–90).

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```

- **Return type:** `boolean`
- **Volatility:** `STABLE`
- **Security:** `SECURITY DEFINER`
- **search_path:** `public` (huidig — Fase 2 wil naar `''` voor nieuwe
  variant)
- **Geen** tenant-scoping: een gebruiker met rol X in tenant A passeert ook
  voor tenant B. Dit is precies het gat dat `has_tenant_role` dicht.

Naast `has_role` bestaan `is_platform_admin(uuid)` en
`get_user_tenant_ids(uuid)` in dezelfde migration — beide ook
`STABLE SECURITY DEFINER SET search_path = public`.

---

## 5. Voorgesteld ontwerp `has_tenant_role`

```sql
CREATE OR REPLACE FUNCTION public.has_tenant_role(
  _tenant_id uuid,
  _allowed_roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- Platform admin bypass (geldt ongeacht _allowed_roles)
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'platform_admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND tenant_id = _tenant_id
        AND role = ANY(_allowed_roles)
    )
$$;
```

Ontwerpkeuzes:
- **`auth.uid()` ipv expliciete `_user_id`** — voorkomt spoofing in RLS
  policies; consistent met latere `has_tenant_role(uuid, app_role[])`-stijl.
- **`SET search_path = ''`** — strikter dan bestaande `has_role`; vereist
  schema-qualified types (`public.app_role`) en tabellen (`public.user_roles`).
- **Platform-admin bypass** vóór de tenant-check: één enkele OR, zodat
  RLS-policies geen aparte `is_platform_admin()`-clausule meer hoeven.
- **`STABLE`** — RLS-optimizer kan resultaat per statement cachen.
- **Geen impact** op bestaand `has_role` — beide functies kunnen co-existeren
  tijdens migratie van policies.

---

## 6. Frontend bouwstenen — inventaris

`src/hooks/useAuth.tsx`:
- ✅ Exporteert `AppRole = 'platform_admin' | 'tenant_admin' | 'accountant' | 'staff' | 'warehouse' | 'viewer'`
- ✅ Levert `roles`, `userRole` (hoogste prio via `ROLE_PRIORITY`),
  `isPlatformAdmin`, `isAccountant`, `isWarehouse`, `hasFinancialAccess`
  (= `['platform_admin','tenant_admin','accountant'].includes(userRole)`)

`src/components/ProtectedRoute.tsx`:
- ✅ Enkel `requirePlatformAdmin?: boolean` prop
- ❌ Geen support voor `requireRoles: AppRole[]` of tenant-scoped checks

`rg "useCan|useUserRole|PermissionGate" src` → **0 matches**.
- ❌ Geen `useCan` hook
- ❌ Geen `useUserRole` hook (bestaat alleen impliciet als `userRole` op
  `useAuth`)
- ❌ Geen `PermissionGate` component

→ Voor Fase 2 moet dit alles nieuw gebouwd worden bovenop de bestaande
`useAuth`-velden, geen retrofit van bestaande hooks nodig.

---

## 7. Risico-analyse: AuthResult veld-aanwezigheid

`rg "auth\.(user_id|email|tenant_ids|is_platform_admin)"` over alle edge
functions levert ~10 hits in 8 functies, allemaal **lees-toegang** op
bestaande velden (geen `in`-checks, geen `Object.keys(auth)`, geen
`JSON.stringify(auth)` als payload):

| Functie | Velden gelezen |
|---|---|
| `remove-team-member` | `user_id` |
| `send-team-invitation` | `user_id` |
| `create-manual-invoice` | `user_id` |
| `generate-invoice` | `user_id` |
| `warmup-vat-cache` | `is_platform_admin`, `tenant_ids` |
| `backfill-vat-regimes` | `is_platform_admin`, `tenant_ids` |
| `backfill-ubl-archive` | `is_platform_admin` |

**Conclusie risico-analyse:**
- Geen enkele functie controleert *aanwezigheid* van velden
  (`'foo' in auth`, `auth.foo === undefined`).
- Geen enkele functie serialiseert `auth` integraal naar een externe API.
- Geen destructuring met rest (`const { user_id, ...rest } = auth`).
- Uitbreiding van `AuthResult` met bv. `roles: Array<{tenant_id, role}>` of
  een `effective_role_for(tenant_id)`-helper is **veilig** en breekt geen
  bestaande edge function.

---

## Samenvatting voor Fase 2 go/no-go

| Vereiste | Status |
|---|---|
| Auth-laag uitbreidbaar zonder breaking changes | ✅ |
| `has_role` aanwezig als baseline | ✅ |
| `has_tenant_role` nog niet aanwezig | ❌ — te bouwen |
| Frontend `AppRole` + role-flags | ✅ |
| Frontend `useCan` / `PermissionGate` | ❌ — te bouwen |
| `ProtectedRoute` met rol-array support | ❌ — te bouwen |

Geen blockers gevonden. Fase 2A (RBAC-fundering) kan starten zodra
migration + frontend bouwstenen worden geleverd.
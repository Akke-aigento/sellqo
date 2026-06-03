# SellQo Role Audit — Index

Living document tracking the role-aware RLS / hardening work across phases.
Phase-specific deep-dives live in their own files; this file holds the
chronological summary and completion log.

Related documents:
- `docs/role-audit-phase1-classification.md` — Phase 1 table classification
- `docs/role-audit-phase1d-triage.md` — Phase 1D triage + Fase 2A DROP batch
- `docs/sellqo-fase2-masterplan.md` — Fase 2 masterplan (role-aware RLS)
- `docs/sql/fase2-pre-schema-sync.sql` — Pre-Fase 2 schema dump (40 tables)

---

## Schema-sync 2026-06-03 completed

**Goal.** Eliminate drift between production DB and GitHub repo before
starting Fase 2, so that any rebuild / second environment / rollback has
a complete migration history to replay.

**Scope.**
- **Dropped (3 one-off ops tables, no longer needed):**
  - `shopify_dates_staging`
  - `stock_snapshot_pre_reconcile_20260430`
  - `stock_snapshot_pre_reconcile_final`
  - Migration: timestamped DROP migration (Pre-Fase 2 cleanup).
- **Captured (40 tables with no committed DDL):**
  `admin_actions_log`, `ai_coach_settings`, `ai_credit_purchases`,
  `automatic_discounts`, `automation_runs`, `automation_step_runs`,
  `automation_steps`, `bogo_promotions`, `bundle_products`,
  `customer_group_members`, `customer_group_product_prices`,
  `customer_groups`, `customer_loyalty`, `discount_stacking_rules`,
  `email_preferences`, `email_signatures`, `email_template_blocks`,
  `feature_usage_events`, `gift_promotions`, `import_category_mappings`,
  `import_jobs`, `import_mappings`, `inbox_folders`, `loyalty_programs`,
  `loyalty_tiers`, `loyalty_transactions`, `marketplace_listing_queue`,
  `message_templates`, `pos_cashiers`, `product_bundles`,
  `product_categories`, `returns`, `storefront_api_keys`,
  `storefront_webhooks`, `sync_conflicts`, `tenant_feature_overrides`,
  `tenant_transaction_usage`, `volume_discount_tiers`,
  `volume_discounts`, `webhook_deliveries`.

**Deliverable.** `docs/sql/fase2-pre-schema-sync.sql` — a single
idempotent SQL file containing for every captured table:
- `CREATE TABLE IF NOT EXISTS` with exact columns, types, defaults,
  nullability as in production on 2026-06-03;
- Primary key, unique, check and foreign-key constraints wrapped in
  `DO $$ ... IF NOT EXISTS ... END $$` guards;
- `CREATE INDEX IF NOT EXISTS` for all non-constraint indices;
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` where production has it on;
- `GRANT` statements for `anon` / `authenticated` / `service_role`
  matching live privileges;
- `CREATE POLICY` blocks (guarded) for every RLS policy in production.

**Idempotency.** Every statement is guarded so the file is a no-op
against the current production database and a faithful rebuild against
a fresh environment.

**Verification.** Generated directly from `pg_catalog` /
`information_schema` on 2026-06-03 against project ref
`gczmfcabnoofnmfpzeop`. Re-running the introspection after the drops
confirms 40 captured tables and 0 remaining missing tables in the
target set.

**Status.** Pre-Fase 2 schema-sync ✅ completed. Ready for Fase 2A.

---

## Fase 2 beslispunten vastgeklikt

**Datum.** 2026-06-03
**Status.** Vastgeklikt voor Fase 2-uitrol — niet meer heropenen tijdens
implementatie zonder expliciete herbeoordeling.

1. **Staff mag orders annuleren: JA**, mits elke annulering een entry
   schrijft in `admin_actions_log`
   (`action_type = 'order_cancelled'`, met `target_tenant_id`,
   `actor user_id`, en order-context in `action_details`). Geen extra
   approval-flow; de audit-log is de control.
2. **Staff mag ad-budgetten wijzigen (ads_meta / ads_google /
   ads_amazon / ads_bolcom): NEE.** Alleen `tenant_admin` (en
   `platform_admin` via bypass) mag budget-velden muteren. Staff houdt
   read-only zicht voor operationele monitoring; UI moet de
   budget-controls disablen voor non-admins.
3. **Customer-data voor accountant: OPTIE A — aparte view
   `customers_invoice_view`** die alleen factuur-relevante kolommen
   exposeert: `id`, `tenant_id`, `email`, `first_name`, `last_name`,
   `default_billing_address`, `btw_number`, `total_spent`. Accountant
   krijgt GEEN directe SELECT op `customers`; alle accountant-facing
   queries (rapporten, exports, facturen) routeren via deze view.

---

## Fase 2 Foundation completed

**Datum.** 2026-06-03
**Status.** ✅ Foundation gelegd — backwards-compatible, geen bestaande
code aangeraakt buiten de uitbreidingen hieronder.

### 1. Database — `has_tenant_role` helper

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
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (ur.tenant_id = _tenant_id OR ur.role = 'platform_admin'::public.app_role)
      AND ur.role = ANY(_allowed_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'::public.app_role
  );
$$;
```

- `SECURITY DEFINER`, `STABLE`, `SET search_path = ''` — geen
  schema-resolutie-spoofing mogelijk.
- `EXECUTE` toegekend aan `authenticated` en `service_role`; ingetrokken
  van `PUBLIC`.
- Platform-admin bypass zit ingebakken in de tweede `EXISTS`-tak, zodat
  RLS-policies geen aparte `is_platform_admin()`-clausule meer hoeven.

Daarnaast `public.test_has_tenant_role()` (SECURITY DEFINER, alleen
`service_role` mag `EXECUTE`) — voert de 5 Foundation-scenario's uit en
retourneert een tabel `(scenario, expected, actual, passed)`:

1. user zonder rol → `false`
2. user met juiste rol → `true`
3. user met andere rol → `false`
4. platform_admin ongeacht `_allowed_roles` → `true`
5. verkeerd `tenant_id` voor user → `false`

### 2. Edge-function-laag — `supabase/functions/_shared/auth.ts`

- `AuthResult` uitgebreid met optioneel
  `roles_by_tenant?: Record<string, AppRole[]>` (backwards-compatible —
  bestaande functies dereferencen alleen `user_id`/`email`/`tenant_ids`/`is_platform_admin`).
- `authenticateRequest` bouwt deze map uit dezelfde `user_roles`-query
  die al gedaan werd; nul extra round-trips. Service-role bypass
  returnt een lege map.
- Nieuwe export `requireRole(auth, tenantId, allowed: AppRole[])`:
  - Bypass voor `auth.user_id === "service_role"` (server-to-server).
  - Bypass voor `auth.is_platform_admin === true`.
  - Gooit `AuthError(403, "Insufficient role for this action")` bij
    mismatch.
- Nieuwe export `type AppRole` zodat batch-implementatieprompts
  consistent kunnen typen.

### 3. Frontend bouwstenen

- `src/hooks/useCan.ts` — `useCan(action, resource)` plus de exporteerbare
  `PERMISSION_MATRIX` (gespiegeld aan Hoofdstuk 2 van het masterplan) en
  pure helper `canWithRoles(roles, action, resource)` voor tests.
  `platform_admin` voldoet altijd via bypass.
- `src/components/PermissionGate.tsx` — declaratieve wrapper voor inline
  UI-gating (`<PermissionGate action="write" resource="orders">…`).
- `src/components/ProtectedRoute.tsx` — uitgebreid met optionele
  `requires?: AppRole[]`; bestaande `requirePlatformAdmin` blijft werken.
  Mismatch redirect naar `/no-access`.
- `src/pages/NoAccess.tsx` + route `/no-access` in `src/App.tsx`.
- `src/hooks/useCan.test.ts` — 8 vitest-scenario's (alle 6 rollen +
  empty-roles + combined-roles), allemaal groen.

### 4. Bewust niet aangeraakt

- `useAuth.tsx` ad-hoc booleans `isAccountant`, `isWarehouse`,
  `hasFinancialAccess` blijven bestaan. Migratie naar `useCan` is tech
  debt voor Fase 3 cleanup (zie masterplan §5.2).
- Bestaande edge functions: geen `requireRole`-call toegevoegd; dat
  gebeurt batch-per-batch (2A1 → 2F).
- Bestaande RLS-policies: ongewijzigd. `has_tenant_role` wordt ingezet
  vanaf Batch 2A1.

## Batch 2A0 — Warehouse status edge function completed (2026-06-03)

Pre-step voor 2A1 RLS-aanscherping op `public.orders`. Doel: alle
client-side mutaties op `orders.status` lopen via een gevalideerde edge
function zodat warehouse-UI niet breekt zodra RLS de directe `UPDATE`
op de `status`-kolom dichttrekt.

### 1. Edge function — `supabase/functions/update-order-fulfillment-status/index.ts`

- Auth: `authenticateRequest(req, tenant_id)` (JWT + tenant-binding).
- RBAC: `requireRole(auth, tenant_id, ['tenant_admin', 'staff', 'warehouse'])`.
- Whitelist body: `{ order_id, new_status, tracking_number?, tracking_url?, shipped_at?, delivered_at? }`.
- Server-side transitiematrix:
  - `pending → processing | cancelled`
  - `processing → shipped | cancelled`
  - `shipped → delivered`
  - `delivered`, `cancelled`, `returned`, `partially_returned` → terminaal
    (returned-flow leeft in returns-module, niet hier).
- `cancelled` als doel-status vereist extra `requireRole(['tenant_admin','staff'])` —
  **warehouse mag dus géén orders annuleren**.
- Whitelist UPDATE-kolommen: `status`, `tracking_number`, `tracking_url`,
  `shipped_at`, `delivered_at`, `cancelled_at` (auto), `updated_at`.
  Alles wat niet in deze lijst staat (carrier, fulfillment_status, totalen,
  customer-data, …) is niet aanpasbaar via deze functie.
- Auto-stempel `shipped_at` / `delivered_at` / `cancelled_at` als de
  caller ze niet meegeeft.
- Idempotent: dezelfde `from_status === new_status` is een no-op (handig
  voor bulk-acties).
- Audit-log: insert in `admin_actions_log` met
  `action_type='order_fulfillment_status_update'` en
  `action_details: { order_id, from_status, to_status, fields_updated }`.
- Service-role bypass (cron/webhook) blijft werken via
  `requireRole`-bypass in `_shared/auth.ts`.

### 2. Frontend-migratie-impact

Alle directe `supabase.from('orders').update({ status: … })`-calls in
admin/warehouse UI vervangen door
`supabase.functions.invoke('update-order-fulfillment-status', …)`:

- `src/hooks/useOrders.ts` — `updateOrderStatus` mutation.
- `src/components/admin/OrderBulkActions.tsx` — `handleBulkStatusUpdate`
  (loop per order, want edge fn is single-order).
- `src/components/admin/FulfillmentBulkActions.tsx` —
  `handleMarkAsShipped` + `handleMarkAsDelivered` (loop). `fulfillment_status`
  blijft direct geüpdatet als secundair veld (niet in whitelist).
- `src/hooks/useOrderShipping.ts` — `updateTracking` doet eerst edge fn
  (status + tracking-velden), daarna directe update voor `carrier` +
  `fulfillment_status`.
- `src/components/admin/fulfillment/TrackingImportDialog.tsx` — alleen
  edge fn aanroepen als huidige status `pending`/`processing` is (dezelfde
  pre-check als voorheen); rest van velden (`carrier`, `tracking_status`,
  `last_tracking_check`) blijft directe update.
- `src/hooks/usePaymentConfirmation.ts` — splitst nu in twee stappen:
  (a) `payment_status='paid'` directe update met `.select()` om te zien of
  de order daadwerkelijk nog pending was; (b) als ja én oude `status='pending'`
  → edge fn voor transitie naar `processing`.
- `src/components/admin/BankReconciliationUpload.tsx` — idem
  payment-confirmation patroon; 422 "invalid status transition" wordt
  in reconciliation-context bewust genegeerd (order kan al `processing` zijn).

Niet gemigreerd (terecht):
- `src/pages/admin/Fulfillment.tsx` `updateTracking` schrijft alleen
  `fulfillment_status` + tracking-velden, **niet** `status`.
- Cron/sync/webhook edge functions die service-role gebruiken
  (marketplace-sync, bol-com-webhook, …) — bypass blijft.

### 3. Status-transitie-regels (samenvatting voor reviewers)

| Van \ Naar    | processing | shipped | delivered | cancelled |
|---------------|------------|---------|-----------|-----------|
| pending       | ✅ alle    | ❌      | ❌        | ✅ admin/staff |
| processing    | —          | ✅ alle | ❌        | ✅ admin/staff |
| shipped       | ❌         | —       | ✅ alle   | ❌        |
| delivered     | ❌         | ❌      | —         | ❌        |
| cancelled / returned / partially_returned | terminaal — geen transitie |

"alle" = `tenant_admin`, `staff`, `warehouse` (plus `platform_admin`
bypass). `cancelled` blokkeert `warehouse` expliciet.

`viewer` en `accountant` zitten niet in de allowed-set en krijgen 403
op elke status-mutatie.

### 4. Geen RLS-wijzigingen in deze batch

`public.orders` RLS staat nog op de oude `has_role`-policies. Aanscherping
(drie-policy met `has_tenant_role` + warehouse beperkt tot status/tracking
kolommen via aparte UPDATE-policy) volgt in Batch 2A1, nu deze edge function
live en backwards-compatible draait.

---

## Batch 2A1 — Orders RLS-aanscherping completed

Datum: 2026-06-03

Doel: tenant-blind / legacy `has_role`-policies vervangen door rol-aware
`has_tenant_role(tenant_id, ARRAY[...]::app_role[])`-policies op alle orders /
shipping / returns / packing / digital-delivery / audit-log-tabellen. Service-
role en platform-admin bypass-policies blijven ongewijzigd.

### Nieuwe RLS-policies per tabel

**orders** — dropped: `Users can insert orders for their tenant`,
`Users can update their tenant's orders`, `Tenant admins can delete their tenant's orders`.
```sql
CREATE POLICY "Auth users can view tenant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admin/staff can insert tenant orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

CREATE POLICY "Admin/staff can update tenant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

CREATE POLICY "Tenant admins can delete tenant orders"
  ON public.orders FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```
Warehouse muteert orders uitsluitend via de 2A0-edge-function
`update-order-fulfillment-status` (service-role pad).

**order_items** — idem orders, FK-scope via `order_id → orders.tenant_id`.
Geen warehouse-write (lijnen worden nooit door warehouse aangepast).

**returns** — dropped: `Tenants can view/insert/update own returns`.
SELECT tenant-scope, INSERT/UPDATE `has_tenant_role(['tenant_admin','staff','warehouse'])`,
DELETE `has_tenant_role(['tenant_admin'])`. Geen anon-policy (klant-tracking
blijft via edge function — buiten 2A1 scope).

**shipping_labels** — dropped alle 5 overlappende policies (`ALL` + losse
SELECT/INSERT/UPDATE × 2). Drie-policy met
`has_tenant_role(['tenant_admin','staff','warehouse'])` op INSERT/UPDATE,
admin-only DELETE.

**shipping_status_updates** — dropped: `Users can manage their tenant shipping status updates`
(`ALL`-policy). SELECT tenant-scope blijft; INSERT/UPDATE alleen via
service-role (webhook-pad).

**shipping_methods** — gemigreerd van `has_role` → `has_tenant_role` voor
consistentie (semantisch identiek, tenant-scoped helper).

**packing_slips & packing_slip_lines** — dropped afwijkende
`EXISTS(user_roles…)`-policy. Drie-policy `has_tenant_role(['tenant_admin','staff','warehouse'])`
op WRITE, admin-only DELETE. `packing_slip_lines` heeft géén `tenant_id`-kolom
→ FK-scope via `packing_slip_id`.

**digital_deliveries** — drie-policy `has_tenant_role(['tenant_admin','staff'])`
op INSERT/UPDATE (licentiesleutels), admin-only DELETE.

**tracking_import_log** — dropped: `System can insert import logs`. SELECT
tenant-scope blijft (audit visible); INSERT alleen via service-role.

**inventory_sync_log** — dropped: `Users can insert inventory sync logs for their tenant`.
SELECT tenant-scope blijft (audit visible); INSERT alleen via service-role.

### Edge function role-checks (requireRole toegevoegd)

| Functie | requireRole-call |
|---|---|
| create-shipping-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| confirm-bol-shipment | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| create-bol-vvb-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| create-amazon-buy-shipping-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| fetch-external-label | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','warehouse'])` |
| import-bol-shipments | `requireRole(auth, connection.tenant_id, ['tenant_admin','staff','warehouse'])` |
| send-return-email | `requireRole(auth, tenantId, ['tenant_admin','staff','warehouse'])` |
| process-refund | `requireRole(auth, refundTenantId, ['tenant_admin','staff'])` *(geen warehouse)* |
| generate-invoice | `requireRole(auth, order.tenant_id, ['tenant_admin','staff','accountant'])` |
| run-csv-import | `requireRole(auth, tenant_id, ['tenant_admin'])` |

Webhook / cron / sync / storefront / fulfillment-api-functies blijven ongewijzigd
(service-role, geen user-context).

Drie functies (`create-amazon-buy-shipping-label`, `fetch-external-label`,
`import-bol-shipments`) hadden een dangling `tenant_id`-referentie vóór de
order/connection-fetch; deze is verplaatst naar nà de fetch zodat
`authenticateRequest(req, tenantId)` + `requireRole(...)` een echte tenant
meekrijgen.

### Test-resultaten per rol

Aanvullen na productie-validatie:

- [ ] tenant_admin: status-update via `update-order-fulfillment-status` ✅
- [ ] tenant_admin: nieuwe order via `storefront-api` (service-role) ✅
- [ ] staff: refund via `process-refund` ✅
- [ ] viewer: order bewerken → 403 ❌
- [ ] warehouse: order annuleren → 403 ❌ (al gevalideerd in 2A0)
- [ ] Bol-sync blijft draaien (service-role) ✅
- [ ] Stripe-webhook blijft draaien (service-role) ✅

### Rollback-pad

Bij issues: restore via Cloud → Database → Backups (snapshot van 2026-06-03
02:54 UTC bevat pre-2A1 policies), of revert via chat-history op deze loop
gevolgd door redeploy van de oude edge functions.
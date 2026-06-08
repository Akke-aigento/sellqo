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
---

## Batch 2A0/2A1 — UX-fixes (2026-06-03)

Twee follow-ups op de fulfillment-flow.

### 1. Cancelled orders uit fulfillment-lijst gefilterd
`src/pages/admin/Fulfillment.tsx` query op `orders` krijgt extra filter:

```ts
.not('status', 'in', '(cancelled,returned,partially_returned)')
```

Reden: deze orders verschenen onder het label "Te verzenden" omdat de UI
alleen op `fulfillment_status` filterde. Ze horen thuis in `/admin/orders`,
niet in de fulfillment-queue. Bulk-selectie kan ze daardoor ook niet meer
per ongeluk raken.

### 2. Correctie-pad voor tenant_admin
Edge function `update-order-fulfillment-status` accepteert nu:

- `is_correction?: boolean` (default `false`)
- `reason?: string` (verplicht zodra `is_correction === true`, min 3 chars)

Gedrag bij `is_correction === true`:

- `requireRole(auth, tenant_id, ['tenant_admin'])` — geen staff/warehouse
- TRANSITIONS-matrix wordt **gebypassed**, elke status → elke status mag
- Audit-log entry: `action_type = 'order_status_correction'` met
  `action_details.is_correction = true` en `action_details.reason = <trimmed>`

Normale (niet-correctie) flow ongewijzigd: matrix + rol-check zoals 2A0.

### 3. UI
- `src/components/admin/OrderStatusCorrectionDialog.tsx` — nieuwe dialog met
  read-only huidige status, dropdown alle statussen, verplichte textarea voor
  reden, bevestig-knop. Roept `supabase.functions.invoke('update-order-fulfillment-status', { body: { …, is_correction: true, reason } })` aan.
- `src/pages/admin/OrderDetail.tsx` — ActionsMenu naast de "Retour aanmaken"
  knop, alleen gerenderd als `useCan('correct', 'order_status')` true is.

### 4. useCan-matrix uitbreiding
`src/hooks/useCan.ts`:

- `PermissionAction` uitgebreid met `'correct'`
- `Resource` uitgebreid met `'order_status'`
- `Matrix` is nu `Record<Resource, Partial<Record<PermissionAction, AppRole[]>>>`
- Entry:
  ```ts
  order_status: {
    correct: ['platform_admin', 'tenant_admin'],
  }
  ```
- `platform_admin` voldoet sowieso via bestaande bypass in `canWithRoles`.

### Test-checklist
- [ ] tenant_admin opent order-detail → ActionsMenu zichtbaar, dialog werkt,
      audit-log bevat `order_status_correction` + reason.
- [ ] staff/warehouse/accountant/viewer openen order-detail → geen
      ActionsMenu (knop is niet gerenderd).
- [ ] staff probeert `is_correction: true` via curl → 403 (rol-check edge fn).
- [ ] Correctie `cancelled → processing` werkt zonder 422 transition-error.
- [ ] `/admin/fulfillment` toont geen cancelled / returned orders meer.
- [ ] Normale bulk-action "Markeer als verzonden" blijft werken
      (niet-correctie pad ongewijzigd).

---

## Batch 2A2a — Refund / Invoice / Quote RLS-aanscherping completed

Datum: 2026-06-08
Scope: één migration die legacy `has_role`-policies en rolloze ALL-policies
vervangt door drie-policy templates met `has_tenant_role`. Platform-admin en
service-role bypasses ongewijzigd.

### Bevestigde beslispunten
- ✅ Refund-write (`credit_notes` + `credit_note_lines`) strikt `tenant_admin` — staff/accountant uitgesloten tot cap-feature bestaat.
- ✅ Accountant heeft **read + write** op `invoices`, `invoice_lines`, `invoice_archive` (append-only), `invoice_discounts`, `invoice_duplicates`, `payment_reminders` voor BTW-correcties.
- ✅ Staff mag quotes en proforma's aanmaken/bewerken; delete blijft `tenant_admin`.
- ✅ `payment_confirmations` writes nu service-role-only (Stripe/bank-webhook pad). UI behoudt SELECT.
- ✅ `invoice_archive` blijft append-only (geen UPDATE/DELETE policies aangemaakt).

### Gedropte policies per tabel
- `credit_notes`: "Users can view/insert/update/delete credit notes in their tenants"
- `credit_note_lines`: "Users can view/insert/update/delete credit note lines in their tenants"
- `invoices`: "Users can view/insert/update their tenant's invoices", "Tenant admins can delete their tenant's invoices"
- `invoice_lines`: "Users can view/insert/update/delete their tenant's invoice lines"
- `invoice_archive`: "Users can view/insert archive for their tenant"
- `invoice_discounts`: "Users can view/manage invoice discounts for their tenant"
- `invoice_duplicates`: "Tenant users can manage invoice duplicates"
- `proforma_invoices`: "Users can view/manage proforma invoices for their tenant"
- `proforma_invoice_lines`: "Users can view/manage proforma lines for their tenant"
- `quotes`: "Users can view/insert/update their tenant's quotes", "Tenant admins can delete their tenant's quotes"
- `quote_items`: "Users can view/insert/update their tenant's quote items", "Tenant admins can delete their tenant's quote items"
- `payment_confirmations`: "Users can view own tenant confirmations", "Staff+ can insert confirmations"
- `payment_reminders`: "Users can view/manage payment reminders for their tenant"

Platform-admin policies en service-role ALL-policies bleven onaangetast.

### Nieuwe policies (samenvatting per tabel)

Volledige SQL leeft in de migration `Batch 2A2a — Refund/Invoice/Quote RLS hardening`. Patroon per tabel:

**credit_notes** (refund write strikt admin)
- SELECT `authenticated`: `tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))`
- INSERT/UPDATE/DELETE `authenticated`: `public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])`

**credit_note_lines** (parent-FK scope)
- SELECT: parent `credit_note.tenant_id` in user tenants
- INSERT/UPDATE/DELETE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin'])`

**invoices, invoice_duplicates**
- SELECT: tenant-scope
- INSERT/UPDATE/DELETE: `has_tenant_role(tenant_id, ['tenant_admin','staff','accountant'])`

**invoice_lines, invoice_discounts** (parent-FK via invoices)
- SELECT: parent invoice tenant-scope
- INSERT/UPDATE/DELETE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin','staff','accountant'])`

**invoice_archive** (append-only)
- SELECT: tenant-scope
- INSERT: `has_tenant_role(tenant_id, ['tenant_admin','staff','accountant'])`
- Geen UPDATE / DELETE policies → effectief immutable voor authenticated.

**proforma_invoices, quotes** (sales workflow)
- SELECT: tenant-scope
- INSERT/UPDATE: `has_tenant_role(tenant_id, ['tenant_admin','staff'])`
- DELETE: `has_tenant_role(tenant_id, ['tenant_admin'])`

**proforma_invoice_lines, quote_items** (parent-FK scope)
- SELECT: parent tenant-scope
- INSERT/UPDATE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin','staff'])`
- DELETE: parent + `has_tenant_role(parent.tenant_id, ['tenant_admin'])`

**payment_confirmations** (service_role-only writes)
- SELECT: tenant-scope
- INSERT/UPDATE/DELETE: **geen** authenticated policy → alleen service_role (Stripe / bank-webhook pad) kan schrijven.

**payment_reminders** (parent-FK via invoices)
- SELECT: parent invoice tenant-scope
- INSERT/UPDATE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin','staff','accountant'])`
- DELETE: parent + `has_tenant_role(invoice.tenant_id, ['tenant_admin'])`

### Test-checklist (productie, platform_admin bypass)
- [ ] `/admin/credit-notes` lijst laadt; "Creditnota aanmaken" werkt voor tenant_admin.
- [ ] `/admin/invoices` lijst laadt; nieuwe factuur via `create-manual-invoice` of `generate-invoice` slaagt voor admin/staff/accountant.
- [ ] `/admin/proforma` en `/admin/quotes`: aanmaken/bewerken voor admin/staff; delete alleen admin.
- [ ] `/admin/invoices/:id` betaalherinnering toevoegen werkt voor admin/staff/accountant.
- [ ] Stripe refund-webhook → `process-refund` → updates op `returns` + Stripe blijven slagen (service-role pad).
- [ ] Stripe payment-webhook schrijft `payment_confirmations` (service_role) — geen RLS-block.
- [ ] Warehouse-user kan facturen/credit notes alleen lezen, geen schrijfacties.

### Wat NIET in deze sub-batch zit (volgt in 2A2b/Hoofdstuk 4)
- Edge-function `requireRole`-calls op `pos-refund-payment`, `create-manual-invoice`, `send-invoice-email`, `send-quote-email`, `create-quote-payment-link`, plus aanscherping `process-refund` naar `['tenant_admin']`.
- Frontend gating in `useCan` voor `credit_note` / `invoice` / `quote` / `payment_reminder` resources.



---

## Batch 2A2b — Edge-function role-checks completed (2026-06-08)

Aanvulling op tabellen-RLS uit 2A2a: write-paden voor refunds, invoicing en quotes
worden nu ook in de edge-laag gegated met `requireRole`. Platform_admin en
service_role behouden automatische bypass via de shared `requireRole`-helper.

### Functie-wijzigingen

**process-refund**
- Aanscherping t.o.v. Batch 2A1: `['tenant_admin','staff']` → `['tenant_admin']`.
- Reden: cap-feature voor staff-refunds bestaat nog niet; refund-write blijft strikt
  admin tot Fase 3 (Hoofdstuk 4 / capabilities).
- Audit-log: bij elke refund wordt nu een `admin_actions_log`-record geschreven met
  `action_type='refund_processed'` + `{return_id, refund_method, refund_amount}`.

**pos-refund-payment**
- Vervangen: `supabase.auth.getUser()`-flow → `authenticateRequest(req, tenant_id)`.
- Toegevoegd: `requireRole(auth, tenant_id, ['tenant_admin'])`.
- Service-role DB-client gebruikt voor data-access; client-JWT puur voor identity.
- Audit-log: `action_type='pos_refund_processed'` + `{transaction_id, stripe_refund_id, amount, reason}`.
- POS-frontend (`usePOS.ts`) stuurt al automatisch het user-JWT via `supabase.functions.invoke`,
  consistent met `pos-process-payment`.

**create-manual-invoice**
- Toegevoegd: `requireRole(auth, tenant_id, ['tenant_admin','staff','accountant'])`.
- Accountant moet handmatig kunnen factureren tijdens BTW-correcties.

**send-invoice-email**
- Toegevoegd: `requireRole(auth, invoice.tenant_id, ['tenant_admin','staff','accountant'])`
  na invoice-fetch.

**send-quote-email**
- Toegevoegd: `requireRole(auth, quote.tenant_id, ['tenant_admin','staff'])`.
- Accountant niet nodig — sales workflow.

**create-quote-payment-link**
- Toegevoegd: `requireRole(auth, quote.tenant_id, ['tenant_admin','staff'])`.

### config.toml

- `[functions.process-refund] verify_jwt = false` toegevoegd (auth gebeurt in-code
  via `authenticateRequest`, consistent met andere admin-write-functies).
- `pos-refund-payment`, `create-manual-invoice`, `send-invoice-email`,
  `send-quote-email`, `create-quote-payment-link` hadden reeds `verify_jwt = false`.

### Niet aangeraakt (service-role / cron / webhooks)

- `auto-invoice-cron`, `repair-cid-references`, `repair-attachments`, `sync-odoo-invoices`
- Alle Stripe-webhooks (`stripe-webhook`, `stripe-connect-webhook`, `pos-process-payment`, …)
- Platform-billing functies (out-of-scope 2A2)

### Test-checklist (productie)

- [ ] `tenant_admin`: `process-refund` op een return → success + audit-log entry.
- [ ] `staff`: `process-refund` → 403 (cap-feature pending).
- [ ] `tenant_admin`: POS-refund via `/admin/pos` → success + audit-log entry.
- [ ] `staff`: POS-refund → 403.
- [ ] `tenant_admin` / `staff` / `accountant`: `create-manual-invoice` werkt.
- [ ] `staff`: `send-quote-email` + `create-quote-payment-link` werkt.
- [ ] `accountant`: `send-quote-email` → 403, `send-invoice-email` → 200.
- [ ] `warehouse`: alle bovenstaande functies → 403.
- [ ] Stripe refund-webhook (service_role pad) blijft draaien.
- [ ] Bol/Amazon sync (service_role pad) blijft draaien.
- [ ] `platform_admin`: bypass werkt op alle functies.

---

## Feature — Credit Note PDF generation (2026-06-08)

### Edge function
- **`generate-credit-note`** (new, `verify_jwt = false` in `config.toml`).
  - `authenticateRequest(req, tenant_id)` resolves tenant from the credit_note record.
  - `requireRole(auth, tenant_id, ['tenant_admin','staff','accountant'])`.
  - Input: `{ credit_note_id, language? ('nl'|'en'|'fr'|'de') }`.
  - Default language: explicit param ▸ `customer.preferred_language` ▸ `tenant.default_invoice_language` ▸ `'nl'`.
  - Renders a 4-language fiscal PDF via `pdf-lib` (header "CREDITNOTA / CREDIT NOTE / NOTE DE CRÉDIT / GUTSCHRIFT", reference to original invoice with date + original amount, positive line amounts under "Te crediteren" label, totals as "Totaal te crediteren", VAT-regime notice reused from the original invoice's `vat_regime`, refund status line).
  - Uploads to private bucket `credit-notes` at `<tenant_id>/<credit_note_number>.pdf`, returns 24h signed URL.
  - Updates `credit_notes.pdf_url` and `credit_notes.language`.
  - Returns `{ success, pdf_url, credit_note: <full record with original_invoice, customer, lines> }`.
  - Logs `admin_actions_log` entry with `action_type = 'credit_note_pdf_generated'`.

### Bucket & schema
- New private storage bucket `credit-notes` (workspace blocks public buckets, so signed URLs are used).
- Storage RLS on `storage.objects`:
  ```sql
  CREATE POLICY "credit-notes tenant read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'credit-notes'
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_tenant_role(
        ((string_to_array(name,'/'))[1])::uuid,
        ARRAY['tenant_admin','staff','accountant']::app_role[]
      )
    )
  );
  ```
  Writes are service_role only (no policy needed).
- `public.credit_notes`: added `language TEXT NOT NULL DEFAULT 'nl'` + `CHECK language IN ('nl','en','fr','de')`. `pdf_url` and `reason` already existed.

### Frontend
- `src/pages/admin/CreditNotes.tsx`: action menu entry "PDF genereren / Download PDF" per row. If `pdf_url` is null it invokes `generate-credit-note` first, then opens the returned signed URL. Spinner via `generatingId` state.
- `src/hooks/useCreditNotes.ts`: after a successful `createCreditNote` insert, auto-invokes `generate-credit-note` (best-effort, never blocks creation).
- `useCan` matrix: no new permission — `requireRole` in the edge function is the source of truth; `tenant_admin`, `staff` and `accountant` keep read access to the PDF.

### Production test checklist
- [ ] `platform_admin`: download PDF for an existing credit note works.
- [ ] `tenant_admin` / `staff` / `accountant`: download/generate PDF works for their tenant.
- [ ] `warehouse` / `viewer`: edge function returns 403; signed URL would also be rejected by storage RLS.
- [ ] Cross-tenant: user from tenant A cannot generate PDF for credit_note of tenant B (`authenticateRequest` returns 403).
- [ ] Generated PDF shows header "CREDITNOTA", reference to original invoice with original amount, positive amounts, correct VAT-regime text reused from the original invoice.

---

## Batch 2B1a — Integrations RLS-aanscherping

Datum: 2026-06-08
Scope: 8 integratie-tabellen (marketplace, ads, reviews, shipping, fulfillment-keys, Shopify-requests, OAuth-creds, custom domains).
Migration: zie `supabase/migrations/` — laatste 2026-06-08 entry.

### Open beslispunten bevestigd (recon §9, 2026-06-08)
1. `test-*-connection` → tenant_admin only ✅
2. `check-connect-status` → tenant_admin + staff ✅ (uitwerking in 2B1b)
3. `tenant_oauth_credentials.SELECT` → tenant_admin only (secrets-tabel) ✅
4. `disconnect-stripe-account` → migreren naar `requireRole(['tenant_admin'])` ✅ (in 2B1b)
5. `shopify_connection_requests.INSERT` → beperken tot tenant_admin ✅

### Patroon
Per tabel: `is_platform_admin() OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])` voor write,
`is_platform_admin() OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))` voor read (behalve `tenant_oauth_credentials` en `fulfillment_api_keys` — daar SELECT óók admin-only).
Service-role bypassen RLS by default → webhook/sync-paden ongewijzigd.
`tenant_domains`: anon-SELECT op `is_active=true AND dns_verified=true` behouden voor storefront multi-domain routing.

### Per tabel — gedropte + nieuwe policies

#### marketplace_connections
- DROP: `Users can view their tenant's marketplace connections` (SELECT), `Users can insert marketplace connections for their tenant` (INSERT — gunde staff write), `Users can update their tenant's marketplace connections` (UPDATE — idem), `Tenant admins can delete their tenant's marketplace connections` (DELETE).
- CREATE: `mc_select_tenant_members` (SELECT), `mc_insert_tenant_admin`, `mc_update_tenant_admin`, `mc_delete_tenant_admin`.

#### shopify_connection_requests
- DROP: `Tenants can view their own requests` (SELECT), `Tenants can insert their own requests` (INSERT — gunde alle rollen).
- KEEP: `Platform admins can manage all requests` (ALL, is_platform_admin).
- CREATE: `scr_select_tenant_members`, `scr_insert_tenant_admin`, `scr_update_tenant_admin`, `scr_delete_tenant_admin`.

#### ad_platform_connections
- DROP: `Tenant users can view their ad connections` (SELECT), `Tenant admins can manage ad connections` (ALL — gebruikte user_roles direct).
- CREATE: `apc_select_tenant_members`, `apc_insert_tenant_admin`, `apc_update_tenant_admin`, `apc_delete_tenant_admin`.

#### tenant_oauth_credentials (stricter — SELECT óók admin-only)
- DROP: `Tenant members can view own credentials` (SELECT — lekte token-metadata aan alle rollen), `Tenant admins can manage credentials` (ALL).
- CREATE: `toc_select_tenant_admin`, `toc_insert_tenant_admin`, `toc_update_tenant_admin`, `toc_delete_tenant_admin`.

#### tenant_domains
- DROP: `Users can view own tenant domains` (SELECT), `Tenant admins can insert domains` (INSERT), `Tenant admins can update domains` (UPDATE), `Tenant admins can delete domains` (DELETE).
- KEEP: `Public can read active domains` (anon SELECT, `is_active=true AND dns_verified=true`) — storefront routing.
- CREATE: `td_select_tenant_members`, `td_insert_tenant_admin`, `td_update_tenant_admin`, `td_delete_tenant_admin`.

#### review_platform_connections (dormant — security-bug gefixt)
- DROP: `Public can view enabled platform connections` (anon SELECT — lekte OAuth-tokens zodra is_enabled=true), `Users can view their tenant's review connections`, `Users can insert their tenant's review connections` (rol-blind), `Users can update their tenant's review connections` (rol-blind), `Users can delete their tenant's review connections` (rol-blind).
- CREATE: `rpc_select_tenant_members`, `rpc_insert_tenant_admin`, `rpc_update_tenant_admin`, `rpc_delete_tenant_admin`.

#### shipping_integrations (dormant)
- DROP: `Tenant admins can manage shipping integrations` (ALL — naam misleidend, was rol-blind), `Users can view their tenant shipping integrations` (SELECT).
- CREATE: `si_select_tenant_members`, `si_insert_tenant_admin`, `si_update_tenant_admin`, `si_delete_tenant_admin`.

#### fulfillment_api_keys (was al rol-aware, genormaliseerd)
- DROP: `Tenant admins can manage their API keys` (ALL — voortaan SELECT óók admin-only voor consistency met secrets-tabellen).
- CREATE: `fak_select_tenant_admin`, `fak_insert_tenant_admin`, `fak_update_tenant_admin`, `fak_delete_tenant_admin`.

### Niet in scope (komt in 2B1b)
- Edge-function `requireRole`-checks (`*-oauth-init`, `connect-*`, `disconnect-*`, `test-*-connection`, `verify-domain`, `check-domain-ssl`, `cloudflare-api-connect`, `create-connect-account`, `disconnect-stripe-account`, `check-connect-status`).
- Frontend gating op connect/disconnect-knoppen (komt in H4).

### Productie-test checklist (platform_admin via bypass)
- [ ] `/admin/settings/integrations` → marketplace & ad connections laden
- [ ] `/admin/settings/domains` → domains laden
- [ ] Marketplace-tab → bestaande Bol/Shopify connections leesbaar
- [ ] Storefront op custom domain → multi-domain routing werkt (anon SELECT op `tenant_domains`)
- [ ] Stripe Connect / Bol / Meta webhooks blijven draaien (service-role bypass)

## Feature — Odoo B2C dummy aggregation (Pieter-requirement #6) — 2026-06-08

### Nieuwe tabel `public.tenant_odoo_settings`
- Kolommen: `tenant_id` (PK → tenants), `aggregate_b2c_customers` (bool, default false), `b2c_dummy_partner_name` (text, default `Diverse particulieren`), `b2c_dummy_partner_odoo_id` (int, cache), `aggregate_per_channel` (bool, default false, future-use), timestamps + updated_at trigger.
- GRANT `SELECT,INSERT,UPDATE,DELETE` aan `authenticated`; `ALL` aan `service_role`.
- RLS:
  - `tos_select_tenant_members` — SELECT: alle tenant-leden (+ platform_admin bypass).
  - `tos_insert_admin_accountant` — INSERT: `has_tenant_role(['tenant_admin','accountant'])` (+ platform_admin).
  - `tos_update_admin_accountant` — UPDATE: idem.
  - `tos_delete_admin_accountant` — DELETE: idem.

### Edge-function wijzigingen
- `sync-odoo-customers`: leest `tenant_odoo_settings.aggregate_b2c_customers`. Wanneer `true` én `customer.customer_type !== 'b2b'` → klant wordt overgeslagen (status `skipped` + reason `B2C customer aggregated (anonymized)`). B2B en aggregation-uit blijven onveranderd individueel pushen.
- `sync-odoo-invoices`: bij `aggregate=true` + B2C-klant wordt de Odoo `res.partner` voor "Diverse particulieren" eenmalig opgezocht/aangemaakt (`ensureDummyPartner`), de ID gecached in `tenant_odoo_settings.b2c_dummy_partner_odoo_id`, en hergebruikt voor alle vervolgsyncs. De originele klantnaam/e-mail + ordernummer worden in `account.move.narration` opgenomen als audit-trail. B2B / aggregation-uit pad ongewijzigd.
- Customer-type bepaling: primair via gekoppelde `customers.customer_type`, fallback op `orders.customer_vat_number`/`customer_company_name`.

### Admin UI
- Nieuwe sectie `OdooB2CAggregationSettings` op de Odoo-marketplace-detail (`/admin/marketplaces/:id`, tab Instellingen), alleen zichtbaar wanneer Odoo-connectie + `odooModuleAccounting=true`.
- Toggle + naam-veld + read-only info over de gecachte Odoo partner ID.
- Gating via `useCan('write','integrations')` → tenant_admin (en platform_admin via bypass) mag wijzigen, andere rollen alleen lezen.

### Effect
- SellQo-customers tabel onaangetast (marketing/CRM blijft individueel).
- Odoo-boekhouding krijgt één verzamelklant voor consumer-omzet wanneer ingeschakeld; B2B blijft altijd individueel.
- Pieter-requirement #6 vervuld.

---

## Feature — Credit-notes volledige flow (2026-06-08)

### Doel
Creditnota's voortaan volledig bruikbaar maken in admin UI, met email-pad
(incl. CC naar boekhouder), auto-send-bij-creatie en correcte verwerking
in alle boekhoudings-exports.

### Wijzigingen

**Sidebar & permissies**
- `src/components/admin/sidebar/sidebarConfig.ts`: nieuwe entry "Creditnota's"
  onder Bestellingen → na "Facturen", path `/admin/orders/creditnotes`,
  icon `FileMinus`, `excludeRoles: ['warehouse']`.
- `src/hooks/useCan.ts`: nieuwe resource `credit_notes`.
  - read = alle rollen behalve warehouse (accountant/viewer mogen inkijken).
  - write = platform_admin / tenant_admin / staff / accountant.

**Order-detail integratie**
- Nieuwe component `src/components/admin/OrderCreditNotesSection.tsx`.
- `src/pages/admin/OrderDetail.tsx`: renderen onder Documenten-card wanneer
  een factuur bestaat. Toont per credit-note nummer, datum, bedrag, status
  (Concept / Verzonden), download- en resend-knoppen. "Nieuwe creditnota"
  via `<PermissionGate action="write" resource="credit_notes">`.

**Nieuwe edge function `send-credit-note-email`**
- `supabase/functions/send-credit-note-email/index.ts`
- `authenticateRequest` + `requireRole(['tenant_admin','staff','accountant'])`.
- Body: `{ credit_note_id, language? }`.
- Taalvolgorde: body → `customer.preferred_language` → `tenant.default_invoice_language`
  → `'nl'`.
- Onderwerp per taal: nl/en/fr/de variant van "Creditnota {nr} - {tenant}".
- Genereert PDF on-the-fly indien `pdf_url` ontbreekt door
  `generate-credit-note` opnieuw aan te roepen.
- Verstuurt naar `customer.email`, hergebruikt `tenant.invoice_cc_email`
  + `tenant.invoice_bcc_email` voor Pieter/boekhouder-kopie (zelfde adressen
  als factuur-flow).
- Update na succes: `credit_notes.sent_at = now()`, `status = 'sent'`.
- Audit: `admin_actions_log.action_type = 'credit_note_email_sent'`
  met `{credit_note_id, recipient, cc, bcc, language}`.
- `supabase/config.toml`: `[functions.send-credit-note-email] verify_jwt = false`.

**Auto-send parameter**
- `supabase/functions/generate-credit-note/index.ts`: accepteert nu
  `{ credit_note_id, language?, auto_send_email? }`. Bij `auto_send_email=true`
  roept de functie na PDF-persist `send-credit-note-email` aan; failures
  worden gelogd maar laten de PDF-generatie zelf niet falen (zelfde
  best-effort patroon als `generate-invoice`).
- Response bevat extra `email_sent: boolean` flag.

**Dialog UX**
- `src/components/admin/CreditNoteDialog.tsx`: nieuwe checkbox
  "Direct verzenden naar klant per e-mail" (default `aan`).
- `src/hooks/useCreditNotes.ts`: nieuw `auto_send_email` veld in payload,
  toast-tekst varieert ("Creditnota aangemaakt en verzonden" vs
  "Creditnota aangemaakt").

**Lijst-pagina actions**
- `src/pages/admin/CreditNotes.tsx`: ActionsMenu krijgt extra item
  "E-mail (opnieuw) versturen" achter `useCan('write','credit_notes')`.
  Statusbadge per row was reeds aanwezig (`getStatusBadge`).

**Schema-aanvulling**
- Migration `20260608161220_*` (tenant-ref `gczmfcabnoofnmfpzeop`):
  ```sql
  ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_credit_notes_sent_at ON public.credit_notes(sent_at);
  ```
- `credit_notes.status` bestond al (`draft`/`sent`/`processed`); de UI
  blijft die enum gebruiken — geen CHECK-rewrite om historisch
  data-conflict te vermijden.
- `src/types/creditNote.ts`: `sent_at: string | null` toegevoegd.

**Boekhouding-rapportages**
| Export | Credit-notes meegenomen? | Status |
|---|---|---|
| `vat-report-engine` | Ja — `aggregator.ts` walks `credit_notes + credit_note_lines`, markeert rijen met `is_credit_note: true` en negatieve base/vat in `audit_trail`. | Reeds aanwezig — geverifieerd. |
| `export-vat-xlsx` | Ja — filtert `audit_trail.is_credit_note` voor aparte detail (regel 436-438) + meta-teller "Aantal creditnota's verwerkt". | Reeds aanwezig. |
| `export-vat-pdf`  | Ja — sectie "Creditnota's" gebouwd uit `audit_trail` met `meta.credit_note_count`. | Reeds aanwezig. |
| `export-ic-listing-xml` | Engine zelf bouwt IC-listing uit invoices + credit-note correcties; credit-notes met IC-leveringen worden via `audit_trail` netto verrekend in de engine-output (geen aparte XML-tag nodig). | Reeds aanwezig via engine. |
| `export-q-bundle` | **Nieuw toegevoegd** — extra `fetchCreditNotePdfs()` haalt credit-note PDFs en stopt ze in `06_Factuur_PDFs/creditnotas/` van de ZIP wanneer `include_invoice_pdfs=true`. | Nieuw deze release. |
| `generate-peppol-ubl` | Credit-notes nog niet als UBL CreditNote (BIS 3.0) — open follow-up, niet in deze batch. | Open. |

### Permissie-matrix recap
| Actie | tenant_admin | staff | accountant | warehouse | viewer |
|---|---|---|---|---|---|
| Creditnota inzien | ✅ | ✅ | ✅ | ❌ | ✅ |
| Creditnota aanmaken | ✅ | ✅ | ✅ | ❌ | ❌ |
| PDF genereren / downloaden | ✅ | ✅ | ✅ | ❌ | ✅ (download) |
| E-mail (opnieuw) versturen | ✅ | ✅ | ✅ | ❌ | ❌ |

### Open follow-ups
- Peppol UBL CreditNote-generatie voor B2B-uitsturing.
- Bulk-export van credit-notes in eigen ZIP (los van Q-bundle).

---

## Feature — Credit-note volledige flow (UX + auto-trigger + PDF parity + Peppol UBL) — 2026-06-08

### Fix A — Gecombineerde view facturen + creditnota's
- `/admin/orders/invoices` heeft nu tabs **Alle | Facturen | Creditnota's** (default Alle).
- "Alle" toont gecombineerde lijst met type-badge, klant, datum, bedrag (negatief voor CN) en status.
- Bestaande zoek + statusfilter + Peppol-toggle blijven op de **Facturen**-tab werken.
- Nieuwe component `CreateCreditNoteFromInvoiceButton` — laadt `invoice_lines` on-demand en opent `CreditNoteDialog` met preselectie (volledige creditering). Beschikbaar in zowel de combined-view rij-actie als de Facturen-tab acties.
- Nieuwe component `NewCreditNoteDialog` — invoice-selector op `/admin/orders/creditnotes`. Knop "Nieuwe creditnota" is werkend.
- `CreditNoteDialog` ondersteunt nu een controlled `open`/`onOpenChange` + `hideTrigger` voor hergebruik vanuit andere triggers.
- Permission-gate: `useCan('write', 'credit_notes')` → `tenant_admin`, `staff`, `accountant`.

### Fix B — Auto-trigger retour → creditnota
- DB-functie `public.create_credit_note_from_return(_return_id uuid)` (SECURITY DEFINER):
  - Zoekt invoice via `returns.order_id`.
  - Maakt CN met status `'draft'`, reden `Automatisch gegenereerd voor retour {rma_number}`.
  - Insert samengevatte `credit_note_lines`-regel ter waarde van `refund_amount`, met behoud van BTW-ratio van originele factuur.
  - **Idempotent**: skipt als CN met "Automatisch ...{rma_number}" al bestaat.
- Trigger `trg_returns_auto_credit_note` (AFTER UPDATE OF status): vuurt wanneer `status='completed'` AND `status` veranderd AND `refund_amount > 0`.
- PDF + email afhandeling: bestaande `generate-credit-note(auto_send_email=true)` kan handmatig of via toekomstige scheduler op concept-CN's worden gedraaid.
- Backfill: niet uitgevoerd (CN-2026-0001 was handmatig opgelost).

### Fix C — PDF + UBL parity met invoices
- **`generate-credit-note` PDF rewrite**:
  - Logo embed (PNG/JPG van `tenants.logo_url`) of fallback tenant-naam in header.
  - Tenant info-blok (links): naam, adres, postcode/stad, land, BTW-nummer, **IBAN**, e-mail, telefoon.
  - Klant info-blok (rechts): naam (first+last) → `company_name` → "Particuliere klant" (per taal); GEEN dubbele e-mail meer.
  - Referentie-blok naar originele factuur + reden.
  - Line-table met positieve bedragen ("Te crediteren"), BTW-rij **per tarief** uit `credit_note_lines.vat_rate`.
  - VAT-regime artikel-tekst (Art. 138 / 196 / 146 / OSS) — hergebruikt van factuur, mapping inclusief aliassen `ic_supply_*`, `oss_b2c_eu`, `export_outside_eu`.
  - Refund-status onder totals: "Terugbetaald" of "in behandeling".
  - Footer: `tenant.invoice_footer_text` + Peppol-label indien `peppol_status` in `accepted`/`archive_only`.
  - GEEN QR-code (refund context).
- **`generate-peppol-ubl` extensie**:
  - Accepteert nu `{ document_type: "invoice" | "credit_note", document_id }` (back-compat: `invoice_id` blijft werken).
  - Bij `credit_note`: laadt `credit_notes` + `credit_note_lines`, ophaalt `vat_regime` van originele factuur, schrijft naar `credit_notes.ubl_url` + `peppol_status='archive_only'`.
  - Storage key onderscheidt CN's: `{tenant_id}/credit-notes/{cn_id}.xml`.
  - `invoice_archive` rij geschreven met `document_type='credit_note'`.
- **`generate-credit-note`** roept na PDF-persist `generate-peppol-ubl` aan (best-effort). UBL altijd gegenereerd indien regime Peppol-relevant + B2B VAT, ook zonder `peppol_required`.
- **UI**:
  - CreditNotes-lijst: Peppol-badge (✓ verzonden / ⏱ pending / ⚠ mislukt) naast status.
  - UBL-download blijft beschikbaar via ActionsMenu zodra `ubl_url` is ingevuld.

---

## Credit-notes: async worker + UI consolidation
**Datum:** 2026-06-08

### FIX 1 — status='draft' (no-op, scheme bevestigd)
- Verifieerd: huidige `credit_notes_status_check` = `('draft','sent','processed')`.
- Trigger insert `'draft'` is reeds geldig; geen migratie nodig. Pieter-keuze: huidige scheme behouden (zie prompt-respons "A").
- TypeScript types, i18n keys (NL/EN/FR/DE), Select-opties consistent met DB.

### FIX 2 — pg_net async worker in `create_credit_note_from_return`
- `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;` (idempotent).
- Na `INSERT INTO credit_notes`: niet-blokkerende `PERFORM net.http_post(...)` naar `/functions/v1/generate-credit-note` met body `{credit_note_id, language, auto_send_email:true}`.
- URL + auth gehaald uit bestaande `public.internal_config` (`supabase_url` + `supabase_anon_key`), zelfde pattern als notification-trigger.
- Wrapped in `BEGIN ... EXCEPTION WHEN OTHERS` zodat dispatch-fouten de retour-flow niet breken; status blijft `draft`, admin kan handmatig "Email opnieuw versturen" via Actions-menu.
- `language` valt terug op `'nl'` als `invoices.language` NULL/empty.
- `generate-credit-note` heeft `verify_jwt=false` (config.toml), dus anon-key dispatch werkt zonder service-role exposure.

### FIX 3 — UI eenbron-van-waarheid: tabs inline in Invoices, aparte pagina redirect
- **Nieuwe component** `src/components/admin/CreditNotesTable.tsx`: hergebruikbare filters + ResponsiveDataTable + ActionsMenu (download/UBL/email opnieuw/originele factuur). Prop `hideNewButton` om dubbele CTA te onderdrukken.
- **`src/pages/admin/Invoices.tsx`**:
  - Tab "Creditnota's" rendert nu `<CreditNotesTable />` inline (geen redirect-card meer).
  - `useSearchParams` synchroniseert actieve tab met `?tab=invoices|creditnotes` (replace, geen history-spam). Default tab = "all" → geen query-param.
  - Tab "Alle" combineert invoices + credit_notes ongewijzigd (badge "Factuur"/"Creditnota", negatieve bedragen in `text-destructive`).
  - `Minus` icon verwijderd (niet langer gebruikt).
- **`src/App.tsx`**: `/admin/orders/creditnotes` route is nu `<Navigate to="/admin/orders/invoices?tab=creditnotes" replace />`. `CreditNotesPage` import verwijderd. Bestaande deeplinks blijven werken via redirect.
- **`src/components/admin/sidebar/sidebarConfig.ts`**: entry `orders-creditnotes` verwijderd; entry `orders-invoices` hernoemd naar `"Facturen & creditnota's"` (page-titel toonde dit al).
- **`src/pages/admin/CreditNotes.tsx`**: deprecation-comment bovenaan toegevoegd. Bestand blijft staan als safety-net voor stale imports; cleanup-batch volgt.

### Verificatie
- ✅ `/admin/orders/invoices` opent direct op tab "Alle"; klik op "Creditnota's" → inline tabel zichtbaar zonder redirect.
- ✅ URL `/admin/orders/invoices?tab=creditnotes` opent direct op CN-tab.
- ✅ Oude URL `/admin/orders/creditnotes` → 302 client-side redirect naar `/admin/orders/invoices?tab=creditnotes`.
- ✅ Sidebar: "Creditnota's" entry weg; "Facturen & creditnota's" zichtbaar onder Bestellingen.
- ✅ Migratie pg_net dispatch test: na nieuwe retour `status=completed` met `refund_amount>0` verschijnt credit_note rij; HTTP-call zichtbaar in `net._http_response`.

---

## Role expansion — `marketing` (2026-06-08)

**Goal.** Specialist marketing-rol voor grotere teams die campagnes, promoties,
ads-configs, SEO en CMS-content beheren zonder toegang tot fiscale data,
integrations of platform-settings.

**Enum.** Nieuwe migration voegt `marketing` toe aan `public.app_role`
(`ALTER TYPE ... ADD VALUE IF NOT EXISTS 'marketing'`). Geen verdere
DB-policy-wijzigingen in deze stap: bestaande RLS draait op `app_role[]`
arrays — marketing valt automatisch buiten alle write-arrays
(`tenant_admin/staff/accountant/warehouse`) en krijgt via `tenant_id IN
get_user_tenant_ids()` automatisch tenant-scoped read op alles wat al
publiek-leesbaar is binnen de tenant.

**useCan matrix (`src/hooks/useCan.ts`).**
- RW: `marketing`, `cms`, `seo`, `discount_codes`, `ads`, `volume_discounts`,
  `social_channels`, `inbox`.
- R: `orders` (campaign analytics), `customers` (segmentatie, geen schrijfrechten),
  `products`, `reports`, `global_lookups`, `sellqo_legal`.
- Geen toegang: `invoices`, `credit_notes`, `refunds`, `payments`, `vat`,
  `returns`, `pos`, `themes`, `integrations`, `webhooks_api`, `team`,
  `settings_general`, `settings_financial`, `platform_billing`,
  `customer_notes`, `product_costs`, `suppliers`, `ops_helpers`,
  `automations`, `ai_assistant`, `ai_coach`.
- Nieuwe resource `ad_budgets` (gescheiden van `ads`): write blijft expliciet
  bij `tenant_admin`; marketing kan campagnes configureren maar geen budget
  vrijgeven.
- `order_status.correct` (correction-pad) blijft `tenant_admin` only.

**Sidebar (`src/components/admin/sidebar/sidebarConfig.ts`).**
- Toegevoegd: `MARKETING_ALLOWED_ITEMS` als referentielijst.
- Hidden voor marketing via `excludeRoles: ['marketing']`: fulfillment,
  retouren, facturen, offertes, POS, webshop builder, betalingen,
  categorieën, inkoop, verzending, notificaties, SellQo Connect, billing,
  instellingen.
- Zichtbaar: Dashboard, Inbox, Bestellingen (alleen lijst), Producten (R),
  Klanten (R), Campagnes + AI Tools + SEO, Promoties (full group), Ads
  (full group, budget-vrijgave UI-side te gaten via `useCan('write','ad_budgets')`),
  Vertalingen, Rapporten/Analytics, Help.

**Note voor Batch 2C2 (Marketing & CMS).** Bij het schrijven van expliciete
RLS policies voor marketing-tabellen (campaigns, email_*, discount_codes,
ads_*, automatic_discounts, automation_*, bogo_promotions, gift_promotions,
volume_discounts, content_translations, storefront_pages, legal_pages,
homepage_sections, seo_*, ab_test_configs, ad_creatives, ad_campaigns,
ad_audience_syncs, ad_platform_connections (read-only), social_*) MOET de
marketing-rol meegenomen worden in de policy-arrays — voorgeschreven
pattern: `array['tenant_admin','staff','marketing']` voor write,
`array['tenant_admin','staff','accountant','viewer','marketing']` voor read.
Uitzondering: `ad_platform_connections` blijft `['tenant_admin']` write
(geen credentials-management voor marketing).

**Tests.** `src/hooks/useCan.test.ts` uitgebreid met `marketing role` suite:
RW op campaigns/discount_codes/ads/seo/cms, R-only op orders, geen toegang
tot invoices/credit_notes/payments/vat, geen `order_status.correct`, geen
`ad_budgets` write, platform_admin bypass-check.

**Seed.** Geen migration-seed; toewijzing via team-management UI.

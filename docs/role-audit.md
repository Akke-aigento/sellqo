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

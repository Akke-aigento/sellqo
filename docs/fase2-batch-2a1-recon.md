# Fase 2 — Batch 2A1 Orders Recon

Datum: 2026-06-03 · status: read-only rapport, geen code-wijzigingen.
Scope: orders, order_items, returns, shipping_labels, shipping_status_updates,
shipping_methods, packing_slips, packing_slip_lines, digital_deliveries,
tracking_import_log, inventory_sync_log.

Legenda classificatie:
- ✅ rol-aware: tenant-scope + `has_role` / `has_tenant_role` check op WRITE
- ⚠️ tenant-blind: tenant_id wordt gecheckt, maar elke user_role mag schrijven (warehouse/viewer kunnen muteren waar dat niet hoort)
- ❌ unbounded: geen tenant-scope of `USING (true)` zonder rol-check

## 1. Huidige RLS per tabel (uit `pg_policies`)

### orders — ⚠️ tenant-blind (read) / ✅ rol-aware (write)
- SELECT: `tenant_id IN get_user_tenant_ids(auth.uid())` + platform_admin bypass — tenant-scope OK, geen rol-filter (viewer kan alles lezen, inclusief financials).
- INSERT/UPDATE: tenant-scope + `has_role(tenant_admin) OR has_role(staff)` — ✅ rol-aware (maar `has_role` is **niet** tenant-scoped, zie risico hieronder).
- DELETE: tenant-scope + `has_role(tenant_admin)` — ✅.
- Platform admin krijgt aparte all-access policies.

### order_items — ⚠️ tenant-blind (read) / ✅ rol-aware (write)
- Idem orders, met join via `order_id`.
- Warehouse heeft géén INSERT/UPDATE/DELETE — moet via service-role of API-key.

### returns — ⚠️ tenant-blind
- SELECT/INSERT/UPDATE: tenant-scope, geen rol-check. Elke user (incl. viewer, warehouse) kan retours muteren.
- DELETE ontbreekt voor authenticated; service_role ALL.
- Géén anon-policy → custom retour-tracking voor klanten loopt vandaag via edge function (service-role).

### shipping_labels — ⚠️ tenant-blind (zelfs dubbel)
- Drie overlappende policies: `ALL` + losse SELECT/INSERT/UPDATE, allemaal puur `tenant_id IN ...`.
- Geen rol-check → viewer kan labels aanmaken/wijzigen.
- Dubbele policies = housekeeping nodig (DROP overlap in 2A1).

### shipping_status_updates — ⚠️ tenant-blind
- `ALL` + SELECT, alleen tenant-scope. Webhook gebruikt service-role, dus rol-check is veilig toe te voegen.

### shipping_methods — ✅ rol-aware
- SELECT tenant-scope, INSERT/UPDATE/DELETE met `has_role(tenant_admin|staff)` (DELETE alleen tenant_admin). Platform admin override.

### packing_slips / packing_slip_lines — ❌ rol-blind & policy-vorm afwijkend
- `ALL` policy via `EXISTS (SELECT 1 FROM user_roles ur WHERE ur.tenant_id = ... AND ur.user_id = auth.uid())`. Iedere rol kwalificeert.
- Inconsistente policy-vorm tov rest (`get_user_tenant_ids`). Aan te scherpen tot drie-policy met `has_tenant_role`.

### digital_deliveries — ⚠️ tenant-blind
- SELECT/INSERT/UPDATE/DELETE puur tenant-scope. Bevat licentiesleutels — rol-filter (`tenant_admin|staff`) op WRITE is wenselijk.

### tracking_import_log — ⚠️ tenant-blind
- INSERT tenant-scope (geen rol). Bedoeld als audit-log → moet service-role only worden voor WRITE.
- SELECT tenant-scope (audit visible) — OK.

### inventory_sync_log — ⚠️ tenant-blind
- INSERT tenant-scope, geen rol. Idem: WRITE → service-role; SELECT blijft tenant-wide audit.

**Risico op bestaande `has_role`**: niet tenant-scoped. Een staff-user van tenant A die ook user_role.tenant_id=B zou hebben, kan via RLS van tenant B schrijven zolang `tenant_id` matched. In productie is een user vandaag zelden multi-tenant met verschillende rollen, maar 2A1 moet migreren naar `has_tenant_role(tenant_id, ARRAY[...])`.

## 2. Edge functions die naar deze tabellen schrijven

| Functie | authenticateRequest | requireRole | service_role | Geraakte tabellen | Type |
|---|---|---|---|---|---|
| create-shipping-label | ✅ | ❌ | ✅ | orders, shipping_labels | admin write |
| confirm-bol-shipment | ✅ | ❌ | ✅ | orders, shipping_labels | admin write |
| create-bol-vvb-label | ✅ | ❌ | ✅ | orders, shipping_labels | admin write |
| create-amazon-buy-shipping-label | ✅ | ❌ | ✅ | orders, shipping_labels | admin write |
| fetch-external-label | ✅ | ❌ | ✅ | orders, shipping_labels | admin write |
| import-bol-shipments | ✅ | ❌ | ✅ | orders, order_items | admin write |
| process-refund | ✅ | ❌ | ✅ | returns | admin write |
| send-return-email | ✅ | ❌ | ✅ | returns | admin write |
| generate-invoice | ✅ | ❌ | ✅ | orders, order_items | admin read+log |
| run-csv-import | ✅ | ❌ | ✅ | orders, order_items | admin bulk write |
| tracking-webhook | ❌ (webhook) | ❌ | ✅ | orders, tracking_import_log | systeem write |
| shipping-webhook | ❌ (webhook) | ❌ | ✅ | orders, shipping_labels, shipping_status_updates | systeem write |
| expire-orders | ❌ (cron) | ❌ | ✅ | orders (via RPC) | systeem write |
| auto-invoice-cron | ❌ (cron) | ❌ | ✅ | orders | systeem write |
| sync-bol-orders / sync-shopify-orders / sync-amazon-orders / sync-woocommerce-orders / sync-ebay-orders / sync-odoo-orders | ❌ (cron/connector) | ❌ | ✅ | orders, order_items, shipping_labels | sync write |
| storefront-api | ❌ (public) | ❌ | ✅ | orders, order_items, shipping_methods | publieke checkout |
| storefront-customer-api | ❌ (public+token) | ❌ | ✅ | orders | klant-self-service |
| create-checkout-session | ❌ (public) | ❌ | ✅ | orders, order_items | checkout |
| create-bank-transfer-order | ❌ (public) | ❌ | ✅ | orders, order_items | checkout |
| stripe-connect-webhook | ❌ (webhook) | ❌ | ✅ | orders, order_items | systeem write |
| fulfillment-api | API-key auth (eigen) | ❌ | ✅ | orders | 3PL extern |

Geen enkele write-functie roept vandaag `requireRole` aan. Auth wordt enkel gebruikt voor tenant-binding, niet voor rol-validatie.

## 3. Dedicated warehouse-status-update functie?

**Nee.** Status-overgangen lopen vandaag op twee manieren:
- UI direct via PostgREST (`useOrders.updateOrderStatus` → `supabase.from('orders').update({ status })`).
- Webhooks via service-role (shipping-webhook, tracking-webhook, marketplace syncs).

→ Consequentie: warehouse rol kan **niet** zinvol via RLS gefilterd worden zonder eerst een dedicated edge function `update-order-fulfillment-status` te bouwen die:
- alleen `status`, `fulfillment_status`, `tracking_*`, `shipped_at`, `delivered_at` mag muteren,
- `requireRole(auth, tenant_id, ['tenant_admin','staff','warehouse'])`,
- audit-entry schrijft naar `admin_actions_log`.

Anders moet de RLS-UPDATE policy óf de hele rij openzetten voor warehouse (te breed) óf warehouse blijft uitgesloten (UI breekt).

## 4. Custom frontends (vanxcel + mancini)

Repos zijn niet in deze sandbox beschikbaar. Op basis van bestaande architectuur-memos (`mem://architecture/headless/comprehensive-integration-suite`, `mem://architecture/canonical-checkout-and-fee-engine`):
- Custom frontends gebruiken **storefront-api** + **storefront-customer-api** als enige write-pad voor orders.
- Er is **geen** documented pattern waarbij external frontends rechtstreeks PostgREST aanroepen met user-JWT op orders.
- API-keys voor 3PL lopen via fulfillment-api.

→ Risico voor RLS-aanscherping: **laag**, mits storefront/fulfillment edge functions service-role blijven gebruiken (wat ze doen). Te bevestigen door één gerichte audit op vanxcel/mancini code voor letterlijke `from('orders').insert/update` calls vóór de RLS-aanscherping live gaat.

## 5. Voorgesteld policy-patroon per tabel

Alle policies gebruiken `has_tenant_role(tenant_id, ARRAY[...]::app_role[])`. Service_role behoudt eigen ALL-policy.

### orders
- SELECT (auth): `tenant_id IN get_user_tenant_ids()`  *(rol-filter komt in 2A frontend gating, niet in RLS — anders breekt dashboards voor accountant/warehouse)*
- INSERT (auth): tenant-scope + `has_tenant_role(tenant_id, ['tenant_admin','staff'])`
- UPDATE (auth, full row): tenant-scope + `has_tenant_role(tenant_id, ['tenant_admin','staff'])`
- UPDATE (auth, warehouse-status): **geen aparte RLS-policy**; loopt via dedicated edge function (zie §3). Indien toch via RLS gewenst → kolom-policy is niet mogelijk in Postgres, dus alternatief is trigger die niet-toegestane kolomwijzigingen afwijst.
- DELETE (auth): tenant-scope + `has_tenant_role(tenant_id, ['tenant_admin'])`

### order_items
- Idem orders, geen warehouse-write (warehouse muteert nooit lijnen).

### returns — drie-policy + anon tracking
- SELECT anon: bounded — alleen rijen waar `return_token = current_setting('request.headers')::json->>'x-return-token'` óf via security definer RPC. *(Concreet RLS-recept volgt in implementatiebatch; vandaag loopt klant-tracking via edge function, dus anon-policy is **niet** strikt nodig voor 2A1.)*
- SELECT auth: tenant-scope
- INSERT auth: tenant-scope + `has_tenant_role(['tenant_admin','staff','warehouse'])`
- UPDATE auth: tenant-scope + `has_tenant_role(['tenant_admin','staff','warehouse'])`
- DELETE auth: `has_tenant_role(['tenant_admin'])`

### shipping_labels
- SELECT auth: tenant-scope (alle rollen incl. viewer)
- INSERT/UPDATE auth: `has_tenant_role(['tenant_admin','staff','warehouse'])`
- DELETE auth: `has_tenant_role(['tenant_admin'])`
- DROP de overlappende `ALL`-policy + duplicate SELECT/INSERT.

### shipping_status_updates
- SELECT auth: tenant-scope (audit)
- INSERT/UPDATE: service_role only (webhook-pad). UI heeft hier geen schrijfreden.

### shipping_methods
- Behoud huidige pattern (al ✅ rol-aware), migreer alleen `has_role` → `has_tenant_role` voor consistentie.

### packing_slips / packing_slip_lines
- Drop EXISTS-policy. Vervang door drie-policy met `has_tenant_role(['tenant_admin','staff','warehouse'])` op WRITE, tenant-scope op SELECT.

### digital_deliveries
- SELECT tenant-scope
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','staff'])`
- DELETE: `has_tenant_role(['tenant_admin'])`

### tracking_import_log
- SELECT tenant-scope (audit)
- INSERT: service_role only (drop authenticated INSERT)

### inventory_sync_log
- SELECT tenant-scope (audit)
- INSERT: service_role only

## 6. Edge-function-changes: requireRole toevoegingen

Voor elke write-functie met `authenticateRequest` (= admin-path), `requireRole(auth, tenant_id, [...])` toevoegen vóór de mutatie:

| Functie | requireRole(allowed) |
|---|---|
| create-shipping-label | `['tenant_admin','staff','warehouse']` |
| confirm-bol-shipment | `['tenant_admin','staff','warehouse']` |
| create-bol-vvb-label | `['tenant_admin','staff','warehouse']` |
| create-amazon-buy-shipping-label | `['tenant_admin','staff','warehouse']` |
| fetch-external-label | `['tenant_admin','staff','warehouse']` |
| import-bol-shipments | `['tenant_admin','staff','warehouse']` |
| process-refund | `['tenant_admin','staff']` (geen warehouse) |
| send-return-email | `['tenant_admin','staff','warehouse']` |
| generate-invoice | `['tenant_admin','staff','accountant']` |
| run-csv-import | `['tenant_admin']` |
| **NIEUW** update-order-fulfillment-status | `['tenant_admin','staff','warehouse']` + audit log |

Webhook/cron/sync/storefront-functies blijven service-role en raken geen `requireRole` aan (ze hebben geen user-context).

## 7. Voorgestelde sub-volgorde 2A1

a. **RLS-aanscherping (migration)**
   - Drop overlappende policies (`shipping_labels`, `packing_slips*`).
   - Vervang `has_role` door `has_tenant_role` op `orders`, `order_items`, `shipping_methods`.
   - Voeg drie-policy + rol-filter toe op `returns`, `shipping_labels`, `shipping_status_updates`, `packing_slips`, `packing_slip_lines`, `digital_deliveries`.
   - Verander `tracking_import_log` + `inventory_sync_log` INSERT naar service_role only.
   - **Vóór deploy**: bouw dedicated `update-order-fulfillment-status` edge function, anders verliest warehouse alle UI-mutaties op orders.

b. **Edge function role-checks**
   - Voeg `requireRole` toe in alle 10 admin write-functies (tabel §6).
   - Geen wijziging aan service-role / webhook / sync-functies.

c. **Frontend gating (Hoofdstuk 4)**
   - `useCan` + `PermissionGate` rond status-mutaties, refund-knoppen, label-acties.
   - Order-detail status-dropdown via nieuwe `update-order-fulfillment-status` invoke i.p.v. directe `supabase.from('orders').update`.

## Open vragen / blockers

1. **Warehouse status-pad**: bevestig of dedicated edge function `update-order-fulfillment-status` deel van 2A1 wordt of als 2A0 ervoor schuift.
2. **vanxcel/mancini audit**: zonder repo-access kan niet 100% bevestigd worden dat geen externe frontend rechtstreeks `orders` muteert. Korte handmatige grep nodig voor RLS aanscherping live gaat.
3. **Returns anon-tracking**: vandaag via edge function — bevestig dat we anon-RLS policy uitstellen tot Fase 2B (geen 2A1 scope).
4. **`has_role` legacy**: blijft bestaan voor backwards compat; 2A1 introduceert `has_tenant_role` parallel. Cleanup van oude `has_role`-calls in policies komt in latere batch.
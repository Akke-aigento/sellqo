# SellQo Fase 2 — Role-Aware RLS Masterplan (v2)

> **Fase 2 — VOLLEDIG AFGESLOTEN (2026-06-09)**
>
> Alle hoofdstukken (0 t/m 5) zijn uitgerold. Zie
> `docs/fase2-eindrapport.md` voor scope, statistiek en backlog.

> **Bedoeling.** Een feilloos af te draaien plan voor de uitrol van rol-gediscrimineerde RLS-policies en edge-function-checks over de hele SellQo-codebase. Koud op te pakken na de pentest. Toekomst-klaar: ook dormant features krijgen passende defaults zodat ze veilig zijn op het moment dat ze ooit activeren.
>
> **Wanneer uitvoeren.** Niet vóór de pentest. Eerst pentest doorlopen, debrief, Fase 2A DROP-batch (zie `docs/role-audit-phase1d-triage.md`), schema-sync (zie Pre-Fase 2 hieronder), dán dit traject.
>
> **Discipline.** Geen big-bang migrations. Per batch: recon → review → implementatie → test → approval → merge → testperiode → volgende batch. Tussen elke batch 1-3 dagen rust in productie.
>
> **Verificatie-status van dit document.** Gebaseerd op (a) volledige scan van de live productie-DB (239 tabellen, projectref `gczmfcabnoofnmfpzeop`, row counts geverifieerd via pg_stat_user_tables op 2026-06-03), (b) volledige scan van de repo op datum 2026-06-03 (242 migrations + frontend code), (c) bestaande infrastructuur in `useAuth.tsx`, `ProtectedRoute.tsx`, `_shared/auth.ts`. Patronen komen rechtstreeks uit Fase 1A-1D werk.
>
> Wat per batch alsnog door Lovable's recon-fase moet: huidige RLS-state per tabel (kan tussen nu en uitvoering wijzigen), en eventueel nieuwe tabellen die na de pentest worden toegevoegd.

---

## Inhoudsopgave

- [Pre-Fase 2 — Schema-sync (drift wegwerken)](#pre-fase-2--schema-sync-drift-wegwerken)
- [Hoofdstuk 0 — Pre-flight checklist](#hoofdstuk-0--pre-flight-checklist)
- [Hoofdstuk 1 — Foundation](#hoofdstuk-1--foundation)
- [Hoofdstuk 2 — Permissie-matrix](#hoofdstuk-2--permissie-matrix)
- [Hoofdstuk 3 — Uitrol-batches (2A1 t/m 2F)](#hoofdstuk-3--uitrol-batches)
- [Hoofdstuk 4 — Frontend gating](#hoofdstuk-4--frontend-gating)
- [Hoofdstuk 5 — Cleanup](#hoofdstuk-5--cleanup)
- [Bijlage A — Patronen-cheatsheet](#bijlage-a--patronen-cheatsheet)
- [Bijlage B — Rollback procedures](#bijlage-b--rollback-procedures)
- [Bijlage C — Lessons learned uit Fase 1](#bijlage-c--lessons-learned-uit-fase-1)
- [Bijlage D — Volledig tabel-classificatie-appendix](#bijlage-d--volledig-tabel-classificatie-appendix)

---

## Pre-Fase 2 — Schema-sync (drift wegwerken)

**Probleem.** Tijdens de repo-verificatie zijn 43 tabellen ontdekt die in productie bestaan maar niet in de migration-files van GitHub staan. Voor een toekomst-klaar systeem moet dat opgelost worden: zonder gemigreerde definitie kun je geen tweede SellQo-omgeving opzetten, geen rollback uitvoeren, en geen audit-trail bijhouden van schema-wijzigingen.

**Drift-tabellen (43 stuks).** Alle SellQo-native, geen cross-project pollution. Detail per tabel in Bijlage D, kolom "Drift".

**Plus 3 tijdelijke ops-tabellen die kunnen worden opgeruimd:**
- `shopify_dates_staging` (105 rijen — Bol.com date migration, eenmalig uitgevoerd)
- `stock_snapshot_pre_reconcile_20260430` (47 rijen — stock-snapshot voor reconciliatie)
- `stock_snapshot_pre_reconcile_final` (47 rijen — idem)

### Prompt voor Lovable

```
Pre-Fase 2 — Schema-sync. We gaan de drift tussen productie-DB en GitHub repo wegwerken vóór Fase 2 begint.

OPDRACHT (in deze volgorde)

1. Drop drie tijdelijke ops-tabellen via aparte migration:
   - DROP TABLE IF EXISTS public.shopify_dates_staging;
   - DROP TABLE IF EXISTS public.stock_snapshot_pre_reconcile_20260430;
   - DROP TABLE IF EXISTS public.stock_snapshot_pre_reconcile_final;
   Bevestig in commit message dat dit one-off ops-tabellen waren met data die niet meer nodig is.

2. Genereer een schema-dump van de huidige public-schema-state:
   - Per ontbrekende tabel een CREATE TABLE-statement met exacte huidige kolommen, types, defaults, constraints, indices, en RLS-policies
   - Commit als één migration: docs/sql/fase2-pre-schema-sync.sql (of als reguliere migration met timestamp)
   - Belangrijk: gebruik IF NOT EXISTS guards zodat de migration idempotent is

3. Lijst van tabellen die in deze sync-migration moeten staan (40 stuks, na de 3 cleanup-drops):
   admin_actions_log, ai_coach_settings, ai_credit_purchases, automatic_discounts,
   automation_runs, automation_step_runs, automation_steps, bogo_promotions,
   bundle_products, customer_group_members, customer_group_product_prices,
   customer_groups, customer_loyalty, discount_stacking_rules, email_preferences,
   email_signatures, email_template_blocks, feature_usage_events, gift_promotions,
   import_category_mappings, import_jobs, import_mappings, inbox_folders,
   loyalty_programs, loyalty_tiers, loyalty_transactions, marketplace_listing_queue,
   message_templates, pos_cashiers, product_bundles, product_categories, returns,
   storefront_api_keys, storefront_webhooks, sync_conflicts, tenant_feature_overrides,
   tenant_transaction_usage, volume_discount_tiers, volume_discounts, webhook_deliveries

4. Verifieer na merge: schema-comparison tussen production en repo levert 0 verschillen op.
   Documenteer de schema-sync in docs/role-audit.md onder een nieuwe sectie "Schema-sync 2026-XX-XX completed".
```

### Test na merge

- [ ] Schema-comparison tooling (Supabase CLI: `supabase db diff`) toont 0 verschillen
- [ ] Een fresh database setup vanuit de repo-migrations kan reproduceren wat in productie staat
- [ ] Alle 239 tabellen zijn nu via migrations in de repo gedefinieerd

---

## Hoofdstuk 0 — Pre-flight checklist

Vóór je de eerste echte batch start (Foundation). Duurt samen ~20 minuten.

### 0.1 Verifieer dat Fase 1-werk + schema-sync intact zijn

- [ ] `docs/role-audit-phase1-classification.md` en `docs/role-audit-phase1d-triage.md` bestaan en zijn gemerged
- [ ] `docs/architecture-patterns.md` bestaat met AI-tables read-only sectie
- [ ] Fase 2A DROP-batch (7 statements uit het 1D-rapport) is na de pentest gesubmit
- [ ] Pre-Fase 2 schema-sync (hierboven) is uitgevoerd, drift = 0
- [ ] Geen nieuwe linter-warnings sinds Fase 1

### 0.2 Verifieer building blocks

Run in Supabase SQL editor van `gczmfcabnoofnmfpzeop`:

```sql
-- has_role bestaat?
SELECT proname, pg_get_function_result(oid) AS return_type
FROM pg_proc WHERE proname IN ('has_role', 'get_user_tenant_ids')
ORDER BY proname;
-- Expected: has_role(uuid, app_role) → boolean, get_user_tenant_ids → SETOF uuid

-- App_role enum bevat alle 6 rollen?
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumsortorder;
-- Expected: platform_admin, tenant_admin, staff, accountant, viewer, warehouse
```

### 0.3 Klik de matrix vast

De matrix in Hoofdstuk 2 staat definitief. Aanpassen aan deze matrix moet bewust en gedocumenteerd — niet ad-hoc tijdens een batch.

### 0.4 Bevestig uitrol-volgorde

Risico eerst. Financiële impact → integriteit/GDPR → configuratie → dormant.

```
Foundation → bouwstenen (1 migration + auth.ts uitbreiding)
2A1 Orders                  → schrijf-restricted naar tenant_admin/staff/warehouse
2A2 Refunds via credit_notes → schrijf tenant_admin only (cap-feature is tech debt)
2B1 Integrations             → connect/disconnect = tenant_admin only
2B2 Customers (CRM)          → accountant via view, viewer SELECT-only
2C1 Catalog                  → products = staff manage; product_suppliers = tenant_admin only (cost data)
2C2 Marketing & CMS          → staff manage; discount_codes split; ads-budget conservatief
2D  Reports & Settings       → VAT = accountant + tenant_admin; platform-billing = platform_admin only
2E  POS                      → SellQo native POS feature; staff op terminals
2F  Dormant lockdown         → 73 dormant tabellen, rol-aware defaults per cluster
Frontend gating              → na alle backend-batches
```

Tussen batches: 1-3 dagen testperiode. Geen marathonsessies.

---

## Hoofdstuk 1 — Foundation

Eénmalige infrastructuur. Backwards-compatible. Breekt niets.

### 1.1 Bestaande infrastructuur (geverifieerd in repo)

**Frontend (`src/`):**
- `useAuth.tsx` heeft volledige rol-awareness: type `AppRole` met alle 6 rollen, `roles: UserRole[]`, `userRole` (highest priority), booleans `isPlatformAdmin`, `isAccountant`, `isWarehouse`, `hasFinancialAccess`
- `ProtectedRoute.tsx` bestaat met enkel `requirePlatformAdmin` boolean
- `useTenant.tsx` gebruikt al `roles` uit useAuth

**Backend (`supabase/functions/_shared/`):**
- `authenticateRequest` returnt `{user_id, email, tenant_ids, is_platform_admin}` — geen `roles_by_tenant`
- `has_role(user_id, role)` SQL helper bestaat (single-role check)
- `get_user_tenant_ids` returnt `SETOF uuid` (twee overloads — beide werken)

### 1.2 Te bouwen

1. `authenticateRequest` uitbreiden met `roles_by_tenant: Record<string, AppRole[]>` (backwards-compatible)
2. Nieuwe SQL-helper `public.has_tenant_role(_tenant_id uuid, _allowed_roles app_role[])`
3. TypeScript helper `requireRole(authResult, tenantId, allowedRoles)` in `_shared/auth.ts`
4. Frontend: nieuwe hook `useCan(action, resource)`
5. `ProtectedRoute` uitbreiden met `requires: AppRole[]` (backwards-compatible)
6. Nieuwe pagina `/no-access` als fallback voor rol-mismatch
7. Nieuw component `<PermissionGate>` voor inline gating

### 1.3 Recon-prompt

```
Recon Fase 2 Foundation. GEEN code-wijzigingen — alleen rapport in docs/fase2-foundation-recon.md.

OPDRACHT
1. Toon huidige authenticateRequest signature + AuthResult type (eerste 50 regels van _shared/auth.ts).

2. Tel alle edge functions die authenticateRequest importeren. Lijst per functie: read/write/mixed.

3. Bevestig dat geen enkele functie AuthResult exhaustively destructured (zou breken bij uitbreiding).

4. Toon huidige has_role definitie, return type, search_path setting.

5. Voorgesteld has_tenant_role ontwerp:
   - Signature: public.has_tenant_role(_tenant_id uuid, _allowed_roles app_role[]) RETURNS boolean
   - SECURITY DEFINER, SET search_path = ''
   - Body: check user_roles WHERE user_id = auth.uid() AND tenant_id = _tenant_id AND role = ANY(_allowed_roles)
   - Bypass-pad: platform_admin returnt true ongeacht _allowed_roles

6. Inventaris bestaande frontend bouwstenen — bevestig:
   - useAuth.tsx exporteert AppRole, roles, userRole, isPlatformAdmin/isAccountant/isWarehouse/hasFinancialAccess
   - ProtectedRoute.tsx heeft enkel requirePlatformAdmin (geen rol-array support)
   - GEEN useCan, useUserRole, of PermissionGate hooks/components bestaan

7. Risico-analyse op uitbreiding: lijst eventuele functies die specifieke veld-aanwezigheid van AuthResult checken.
```

### 1.4 Implementatie-prompt

```
Implementeer Fase 2 Foundation volgens docs/fase2-foundation-recon.md.

ORDE
1. Migration: 
   - CREATE FUNCTION public.has_tenant_role(_tenant_id uuid, _allowed_roles app_role[]) 
     RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND (ur.tenant_id = _tenant_id OR ur.role = 'platform_admin')
         AND ur.role = ANY(_allowed_roles)
     ) OR EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
     );
     $$;
   - Test 5 scenarios in test-functie:
     (a) user zonder rol → false
     (b) user met juiste rol → true
     (c) user met andere rol → false
     (d) platform_admin ongeacht _allowed_roles → true
     (e) ongeldig tenant_id voor user → false

2. Update _shared/auth.ts:
   - Breid AuthResult uit met optioneel: roles_by_tenant?: Record<string, AppRole[]>
   - authenticateRequest vult dit veld op basis van user_roles-query
   - Voeg requireRole(auth, tenant_id, allowed) helper toe (gooit AuthError 403)
   - Service_role bypass: requireRole returnt zonder check als auth.user_id === 'service_role'

3. Frontend bouwstenen:
   - Maak src/hooks/useCan.ts met matrix-constante (zie Hoofdstuk 2 voor structuur)
   - Maak src/components/PermissionGate.tsx
   - Breid src/components/ProtectedRoute.tsx uit met requires?: AppRole[]
   - Maak src/pages/NoAccess.tsx (route /no-access)
   - Schrijf unit-tests voor useCan (6+ scenarios)

4. Bestaande ad-hoc booleans (isAccountant, isWarehouse, hasFinancialAccess) NIET aanraken. 
   Die coëxisteren met useCan en worden in een latere cleanup-batch gemigreerd.

5. Paper trail in docs/role-audit.md onder "Fase 2 Foundation completed":
   - has_tenant_role SQL definitie
   - Wijzigingen in auth.ts
   - Nieuwe frontend bouwstenen
   - Datum
```

### 1.5 Test-checklist na Foundation

```sql
-- Test SQL helper
SELECT public.has_tenant_role('<tenant_id>'::uuid, ARRAY['tenant_admin', 'staff']::app_role[]);
```

In productie:
- [ ] Bestaande edge functions blijven werken (geen 500-errors in logs)
- [ ] Webhooks (Stripe, Bol) blijven werken — service_role pad onaangetast
- [ ] Frontend laadt zonder errors (geen breaking change op useAuth)
- [ ] /no-access route is bereikbaar

### 1.6 Rollback

Laagrisico. `DROP FUNCTION has_tenant_role`, `git revert` op auth.ts en frontend. Geen edge functions zijn nog afhankelijk.

---

## Hoofdstuk 2 — Permissie-matrix

Dit is de waarheid. Code in `useCan.ts` spiegelt deze tabel. Wijzigen aan deze matrix moet bewust en in beide plekken tegelijk.

> **Legende.** R = read · W = write · — = geen toegang · ⚙ = specifieke gerestricteerde actie

| Resource | platform_admin | tenant_admin | staff | accountant | warehouse | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Orders** | RW | RW | RW (⚙ annuleren?) | R (factuurvelden) | R + ⚙ status (picked/packed/shipped/returned) | R |
| **Order items / packing slips** | RW | RW | RW | R | R | R |
| **Returns** (nieuw) | RW | RW | RW | R | R + ⚙ ontvangen | R |
| **Refunds / credit_notes** | RW | RW | — (⚙ tot cap, niet geïmpl.) | R | — | R |
| **Invoices / proforma / quotes** | RW | RW | RW | R | — | R |
| **Payments confirmations** | RW | RW | R | R | — | R |
| **Customers** | RW | RW | RW | R (alleen factuur) | R (naam/adres) | R |
| **Customer notes / segmentation** | RW | RW | RW | — | — | R |
| **Customer inbox + folders** | RW | RW | RW | — | — | R |
| **Storefront customers (eigen auth)** | — | — | — | — | — | — (eigen RLS) |
| **Products / variants / bundles** | RW | RW | RW | R | R | R |
| **Product cost / supplier / purchase orders** | RW | RW | — | R | R | — |
| **Discount codes** | RW | RW | R + ⚙ apply | R | — | R |
| **Ads — Bolcom (actief)** | RW | RW | R | — | — | R |
| **Ads — Meta/Google/Amazon (dormant)** | RW | RW | R | — | — | R |
| **Marketing campaigns / email** | RW | RW | RW | — | — | R |
| **CMS pages / homepage / blog** | RW | RW | RW | — | — | R |
| **SEO tools** | RW | RW | RW | — | — | R |
| **Themes / branding** | RW | RW | RW | — | — | R |
| **Reports (sales/finance)** | R | R | R | R (vol.) | — | R (bep.) |
| **VAT / BTW** | RW | RW | — | RW | — | R |
| **Integrations (Bol/Shopify/Stripe Connect/Odoo)** | RW | RW | — | — | — | R |
| **Webhooks / API keys / domains** | RW | RW | — | — | — | — |
| **Team-management** | RW | RW | — | — | — | — |
| **Tenant-settings (algemeen)** | RW | RW | — | — | — | R |
| **Tenant-settings (financieel)** | RW | RW | — | R | — | — |
| **Tenant-platform-data (subscription/addons/billing)** | RW | R (eigen) | — | R (eigen) | — | — |
| **AI assistant config + content** | RW | RW (config) | RW (use) | — | — | R |
| **AI Business Coach** | RW | RW | RW | — | — | R |
| **POS (terminals/transactions/sessions)** | RW | RW (config) | RW (operate) | R | RW (operate) | R |
| **Loyalty / Gift cards / Customer groups** | RW | RW | RW | R | — | R |
| **Automations (engine)** | RW | RW (config) | R + ⚙ execute | — | — | R |
| **Volume / BOGO discounts** | RW | RW | R + ⚙ apply | — | — | R |
| **WhatsApp / Social (channels + posts)** | RW | RW (connect) | RW (use) | — | — | R |
| **Suppliers / Purchase orders (dormant)** | RW | RW | — | R | R | — |
| **Operationele helpers (sync/queues/logs)** | RW | R (eigen) | R (eigen) | R (financial subset) | — | — |
| **Global lookups (vat_regimes, themes, doc_articles)** | RW | R | R | R | R | R |
| **SellQo legal / changelogs** | RW | R | R | R | R | R |

### Open beslispunten

- **Staff & order-annulering**: default in matrix = ja met audit. Beslissing vóór 2A1.
- **Staff & refund-cap**: cap-feature bestaat nog niet → refunds = tenant_admin only. Cap = tech debt voor Fase 3.
- **Staff & ad-budget**: conservatieve default = staff alleen R. Beslissing vóór 2C2/2F-Ads.

---

## Hoofdstuk 3 — Uitrol-batches

Elke batch volgt het patroon: **Scope → Recon-prompt → Reviewmoment → Implementatie-prompt → Test-checklist → Rollback**.

---

### 3.1 Batch 2A1 — Orders

**Scope (geverifieerd).**

Tabellen met tenant_id direct:
- `orders` (126 rijen) — enum-status: pending/processing/shipped/delivered/cancelled; enum-payment_status: pending/paid/refunded/failed
- `returns` (3 rijen — nieuwe canonical retours-tabel)
- `shipping_labels` (319 rijen), `shipping_status_updates` (60), `shipping_methods` (3)
- `packing_slips`, `digital_deliveries`
- `tracking_import_log`, `inventory_sync_log` (100k+ rijen — sync log)

Tabellen via FK (parent-scope):
- `order_items` (130 rijen — via `orders.tenant_id`)
- `packing_slip_lines` (via `packing_slips`)

**Edge functions (geverifieerd):**
- `confirm-bol-shipment`, `create-bol-vvb-label` (warehouse-flow)
- `expire-orders` (system cron, service_role)
- `fulfillment-api` (externe partner-API via `fulfillment_api_keys`)
- `storefront-api` checkout actions (service_role)
- `process-refund`, `pos-refund-payment` → vallen onder 2A2
- `send-return-email`, `process-refund` (raken `returns`)

#### Recon-prompt

```
Recon Batch 2A1 Orders. Rapport in docs/fase2-batch-2a1-recon.md, geen code-wijzigingen.

OPDRACHT
1. Per tabel (orders, order_items, returns, shipping_labels, shipping_status_updates, 
   shipping_methods, packing_slips, packing_slip_lines, digital_deliveries, 
   tracking_import_log, inventory_sync_log): huidige RLS-policies uit pg_policies.
   Classificeer: ✅ rol-aware / ⚠️ tenant-blind / ❌ unbounded.

2. Lijst edge functions die naar deze tabellen schrijven. Per functie: 
   authenticateRequest gebruik, role-check status, service-role usage.

3. Bestaat er een dedicated warehouse-status-update-functie, of doen UI/edge-functies 
   direct write voor status-overgangen? Antwoord bepaalt of warehouse rol via RLS 
   gefilterd kan worden of of er eerst een dedicated edge function moet komen.

4. Custom frontends checken (vanxcel + mancini repos beschikbaar maken indien mogelijk):
   doen die direct PostgREST writes op orders? Zo ja: moet via edge function vóór RLS aanscherpen.

5. Voorgesteld policy-patroon per tabel:
   - returns: drie-policy (anon SELECT bounded voor klant-retour-tracking; auth tenant-scope SELECT; 
     auth WRITE via has_tenant_role(['tenant_admin','staff','warehouse']))
   - orders: drie-policy (idem); warehouse via aparte UPDATE-policy beperkt tot status-kolom
   - shipping_labels: tenant_admin/staff/warehouse RW; viewer R
   - inventory_sync_log: service_role write, tenant R (audit zichtbaar)

6. Edge-function-changes: per write-functie de toe te voegen requireRole-call.

7. Voorgestelde sub-volgorde 2A1:
   a. Eerst tabellen-RLS aanscherpen
   b. Daarna edge-function role-checks
   c. Frontend gating in Hoofdstuk 4
```

#### Implementatie-prompt

```
Implementeer Batch 2A1 volgens docs/fase2-batch-2a1-recon.md.

ORDE
1. Pre: maak Supabase DB-snapshot via dashboard (gratis, 2 klikken).

2. Eén migration voor alle tabellen — drie-policy-template per tabel volgens matrix:
   - DROP bestaande tenant-blind policies
   - CREATE nieuwe (anon SELECT waar passend, auth SELECT, auth WRITE via has_tenant_role)
   - Voor orders: aparte UPDATE-policy voor warehouse beperkt tot kolommen (status, shipped_at, delivered_at)

3. Edge functions — voeg requireRole(auth, tenant_id, [...]) toe per recon-bevinding.
   Voor warehouse-status-functies: requireRole(auth, tenant_id, ['tenant_admin', 'staff', 'warehouse']).

4. Als recon liet zien dat geen dedicated warehouse-status-functie bestaat: bouw 
   warehouse-update-order-status met server-side validatie van toegestane statusovergangen 
   (picked → packed → shipped → returned). Geen andere order-velden mogen via deze functie.

5. Verifieer: bestaande edge-function-test-suite blijft slagen.

6. Paper trail: docs/role-audit.md sectie "Fase 2A1 — Orders implemented" met 
   gewijzigde tabellen, nieuwe policies (volledige SQL), gewijzigde edge functions, datum.
```

#### Test-checklist

In incognito (anon):
- [ ] Order-tracking-pagina werkt voor recente orders
- [ ] Return-status-pagina werkt voor klanten

Per rol op test-tenant:
- [ ] **tenant_admin**: lijst zien, aanmaken, bewerken, annuleren
- [ ] **staff**: lijst zien, bewerken; annuleren conform matrix-beslissing
- [ ] **accountant**: lijst zien (read-only), factuurvelden zichtbaar
- [ ] **warehouse**: lijst zien, status-overgangen via dedicated function; geen andere velden
- [ ] **viewer**: lijst zien (read-only)

Productie-tenants (VanXcel, Mancini):
- [ ] Storefront-checkout-flow werkt (service_role pad)
- [ ] Bol.com-order-sync werkt
- [ ] Stripe-webhook-flow (payment confirmations) functioneert
- [ ] VanXcel POS-flow werkt (raakt orders + payments)

#### Rollback

Snapshot terugzetten, of: rollback-migration genereren op basis van paper trail (DROP nieuwe, CREATE oude policies), git revert op edge functions.

---

### 3.2 Batch 2A2 — Refunds via credit_notes

**Belangrijke verificatie.** SellQo heeft GÉÉN dedicated `payments`, `refunds`, `payouts`-tabel:
- `orders.payment_status` (enum) = payment-state
- `invoices` + `invoice_lines` = uitgaande facturen
- `credit_notes` + `credit_note_lines` = refunds (type IN ('full','partial','correction'))
- `payment_confirmations`, `payment_reminders` = statussen/herinneringen
- Stripe handelt feitelijke payments extern af

**Scope (geverifieerd).**

Tabellen:
- `credit_notes` + `credit_note_lines` (echte refunds)
- `invoices` (140), `invoice_lines` (153), `invoice_archive` (164), `invoice_discounts`, `invoice_duplicates`
- `proforma_invoices` + `proforma_invoice_lines`
- `quotes` + `quote_items`
- `payment_confirmations`, `payment_reminders`

Edge functions:
- `process-refund` (haupt), `pos-refund-payment`
- `create-manual-invoice`, `generate-invoice`, `send-invoice-email`, `auto-invoice-cron`
- `repair-cid-references`, `repair-attachments`
- `confirm-platform-bank-payment` (SellQo billing — service_role) → niet 2A2
- `stripe-connect-webhook` (service_role) → niet 2A2

**Specifieke aandacht.**
- Refunds = tenant_admin only (cap-feature voor staff bestaat nog niet → tech debt voor Fase 3)
- Accountant moet credit_notes SELECT kunnen (factuur-historie)
- Webhook-paden niet aanraken (service_role bypassed RLS)

#### Recon-prompt + implementatie-prompt + test-checklist

Volgt structuur van 2A1 — Lovable schrijft beide o.b.v. dezelfde template. Belangrijkste afwijking: refunds-write strikt tenant_admin only, géén staff (tot cap-feature).

---

### 3.3 Batch 2B1 — Integrations

**Scope (geverifieerd).**

Tabellen:
- `marketplace_connections` (1 rij — actief)
- `shopify_connection_requests` (1 rij)
- `ad_platform_connections` (2 rijen)
- `review_platform_connections` (0 rijen — dormant, valt naar 2F)
- `tenant_oauth_credentials` (1 rij)
- `shipping_integrations` (0 rijen — dormant)
- `fulfillment_api_keys` (0 rijen — dormant)
- `tenant_domains` (3 rijen)

Edge functions:
- OAuth flows: `*-oauth-init` en `*-oauth-callback` (meestal `verify_jwt = false`)
- Connect/disconnect: `connect-*`, `disconnect-*`
- Test: `test-*-connection`
- Domain: `verify-domain`, `check-domain-ssl`, `detect-domain-provider`, `cloudflare-api-connect`
- Stripe Connect: `create-connect-account`, `disconnect-stripe-account`, `check-connect-status`

**Specifieke aandacht.** Integraties verbinden = tenant_admin only. Staff mag wel status-zichtbaarheid hebben (read), niet de connectie zelf wijzigen.

---

### 3.4 Batch 2B2 — Customers (CRM)

**Belangrijke verificatie.** Address-data zit als JSONB-kolommen op `customers` (`default_shipping_address`, `default_billing_address`) — géén `customer_addresses` tabel. Column-level scheiding voor accountant via view nodig.

**Scope (geverifieerd).**

Tabellen:
- `customers` (108 rijen) — hoofdtabel
- `customer_messages` (42 rijen) — actief gebruikt
- `customer_communication_settings` (41)
- `customer_segments`, `segment_members` (via FK)
- `newsletter_subscribers` (4)
- `external_reviews`
- `inbox_folders` (26 rijen — folders voor customer_messages-inbox, **niet** Nomadix Inbox)
- `customer_events` — al gedaan in Fase 1B
- `customer_message_attachments` — al gedaan in Fase 1B

Apart (storefront-customer-auth, eigen RLS):
- `storefront_customers` (4 rijen)
- `storefront_carts` (72)
- `storefront_cart_items` (57)
- `storefront_favorites` — al gedaan in Fase 1B

**Architecturele beslissing — accountant-view.**

Twee opties:
- **Optie A** (aanbevolen): aparte view `customers_invoice_view` met alleen factuur-relevante kolommen (id, tenant_id, email, first_name, last_name, default_billing_address, btw_number, total_spent). Accountant krijgt SELECT op view, niet op basistabel. Frontend doet rol-conditional query.
- **Optie B**: tabel-niveau accountant ziet alles. Minder strikt maar minder werk.

Aanbeveling: **Optie A** voor GDPR-data-minimalisatie.

**Specifieke aandacht — `storefront_customers` is een aparte wereld.** Storefront-customer-auth (klanten van VanXcel die inloggen om orders te zien) — RLS scoped op `id = auth.uid()`, geen tenant-rol. Apart van de matrix.

---

### 3.5 Batch 2C1 — Catalog

**Verificatie — bundle-tabellen.** Drie tabellen, twee implementaties:
- `product_bundle_items` (92 rijen, in 1C afgehandeld) = oude bundle-implementatie (product_id = bundle, child_product_id = inhoud)
- `product_bundles` (1 rij — drift) = nieuwe bundle-definitie
- `bundle_products` (4 rijen — drift) = nieuwe bundle-line-items

Live-migratie in progress. Voor 2C1: drie-policy op de twee nieuwe (via schema-sync in repo), oude blijft zoals 1C achterliet. Data-migratie van oud → nieuw is aparte tech-debt-taak, niet voor Fase 2.

**Verificatie — categories.** `categories` (76 rijen) = category-tree, `product_categories` (159 rijen — drift) = M:N-junction products↔categories. Beide actief, verschillende doelen.

**Verificatie — cost data.** `product_suppliers` (0 rijen — dormant) bevat `purchase_price`. Lock met restrictieve defaults: tenant_admin RW, accountant R, staff GEEN. Valt naar 2F-Procurement, NIET 2C1. In 2C1 alleen: products, variants, categories, bundles, specs, files, media_assets, license_keys.

**Scope (geverifieerd) — alleen actieve catalog-tabellen:**
- `products` (121), `product_variants` (288), `product_specifications` (41), `product_custom_specs` (261)
- `product_variant_options` — Fase 1C afgehandeld
- `product_bundle_items` — Fase 1C afgehandeld
- `product_bundles`, `bundle_products` (drift — eerst sync, dan drie-policy)
- `categories` (76), `product_categories` (159 — drift)
- `product_files`, `product_channel_warnings`
- `media_assets`, `license_keys`

Procurement (suppliers/purchase_orders/product_suppliers): valt naar 2F-Procurement.

---

### 3.6 Batch 2C2 — Marketing & CMS

**Scope (geverifieerd).** Grootste batch in tabel-aantal omdat SellQo veel marketing-features heeft.

Discount:
- `discount_codes` (7 rijen — actief), `discount_code_usage`

Email (actieve — overige in 2F-Marketing):
- (email_campaigns, email_automations, email_templates etc. zijn dormant → 2F)

Paid ads — actief:
- `ad_campaigns` (1 rij), `ad_creatives`, `ad_audience_syncs`
- `ads_ai_recommendations`, `ads_ai_rules`
- `ads_bolcom_campaigns` (4 rijen — actief), `ads_bolcom_adgroups`, `ads_bolcom_keywords`, `ads_bolcom_performance`, `ads_bolcom_search_terms`, `ads_bolcom_targeting_products`
- `ads_product_channel_map`

Paid ads — dormant (Meta/Google/Amazon → 2F-Ads).

CMS:
- `homepage_sections` (3), `storefront_pages` (1), `legal_pages` (21)
- `tenant_theme_settings` (4), `tenant_theme_presets` (1)
- `ab_test_configs`
- `content_translations`

SEO:
- `seo_scores` (54), `seo_analysis_history` (8), `seo_keywords`, `seo_competitors`, `seo_competitor_keywords`, `seo_audit_results`, `seo_scheduled_audits`, `seo_search_console_data`, `seo_web_vitals` (1)

**Specifieke aandacht — discount_codes.**
- Staff mag bestaande codes *applying* (UPDATE op `orders.discount_code_id` of INSERT op `discount_code_usage`)
- Staff mag de `discount_codes`-tabel zelf NIET schrijven (alleen SELECT)
- Tenant_admin = volledig manage

Twee aparte policies op discount_codes nodig: SELECT voor alle authenticated, INSERT/UPDATE/DELETE alleen tenant_admin.

**Specifieke aandacht — ads_bolcom_*.** Actief gebruikt door VanXcel. Per matrix: tenant_admin RW, staff R (conservatief). Open beslispunt vóór deze batch: mag staff campagne-budgetten wijzigen?

---

### 3.7 Batch 2D — Reports & Settings

**Scope (geverifieerd).** Veel tabellen, meeste tenant-admin only.

Tenant-config:
- `tenants` (8 rijen — hoofdtabel; aparte view nodig voor admin-only kolommen zoals `subscription_status`, `is_internal_tenant`, `is_demo`)
- `tenant_subscriptions` (7), `tenant_ai_credits` (8), `tenant_newsletter_config`, `tenant_notification_settings` (155), `tenant_return_settings` (8), `tenant_tracking_settings` (5), `tenant_feature_overrides` (2 — drift), `tenant_transaction_usage` (5 — drift), `tenant_badges` (11 — actief), `tenant_milestones` (11 — actief)

Team:
- `user_roles` (5), `team_invitations` (4), `profiles` (6)

AI:
- `ai_coach_settings` (6 — drift, actieve feature!), `ai_usage_log` (89), `ai_generated_content`, `ai_generated_images` (2), `ai_action_suggestions`, `ai_learning_patterns`
- Anderen al in 1D afgehandeld of dormant → 2F

VAT:
- `vat_report_cache` (8 — actief), `vat_rates` (16 — global), `vat_regimes` (12 — global)
- vat_returns, vat_validations → 0 rijen, valt naar 2F-Ops

Platform-level (platform_admin):
- `platform_quick_actions` (6), `platform_health_metrics` (0 — dormant), `platform_incidents` (0)
- `platform_coupons` (1), `platform_coupon_redemptions` (0), `platform_invoices` (0 — dormant)
- `admin_actions_log` (3 — drift), `admin_billing_actions` (4)
- `internal_config` (2)
- `pending_platform_payments` (0)

Notifications & UI prefs:
- `notifications` (344 — actief), `dashboard_preferences` (0), `sidebar_preferences` (2), `user_label_preferences` (1)

Storefront API (tenant-owned):
- `storefront_api_keys` (2 — drift)

Feedback:
- `app_feedback`, `ai_feedback`

**Specifieke aandacht — `tenants`-tabel.**
- Tenant_admin mag eigen tenant updaten — maar bepaalde kolommen zijn platform_admin only
- Implementatie: view `tenants_self_editable_view` voor tenant_admin (zonder gevoelige kolommen), plus aparte edge function `platform-update-tenant` voor platform_admin

**Specifieke aandacht — ai_coach_settings.**
- 6 actieve tenants gebruiken dit. SellQo's AI Business Coach.
- Tenant_admin RW eigen config, staff R, anderen geen
- Edge function `ai-business-coach` zal hier reads/writes doen — moet rol-checks krijgen

---

### 3.8 Batch 2E — POS (SellQo native)

**Belangrijke context.** Dit gaat over SellQo's eigen POS-feature (Stripe Terminal integration). VanXcel test 'm actief (10 sessies, 1 transactie). **Niet** te verwarren met Toog (De Fiere Margriet's aparte POS-project, ander Supabase, eigen codebase).

**Scope (geverifieerd).**

Tabellen:
- `pos_sessions` (10 — actief), `pos_terminals` (1), `pos_transactions` (1)
- `pos_quick_buttons` (1)
- `pos_cash_movements` (0), `pos_parked_carts` (0), `pos_offline_queue` (0)
- `pos_cashiers` (0 — drift)

Edge functions (alle echte implementaties, 92-163 regels):
- `pos-create-payment-intent` (Stripe-flow voor card payment via terminal)
- `pos-manage-reader` (terminal-management)
- `pos-process-payment` (afronden POS-payment)
- `pos-refund-payment` (refund via POS — koppelt met credit_notes)

**Rol-mapping voor POS (matrix-extension):**

| Resource | platform_admin | tenant_admin | staff | accountant | warehouse | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| pos_terminals (configureren) | RW | RW | R | — | R | R |
| pos_sessions (open/close shift) | RW | RW | RW | R | RW | R |
| pos_transactions (transactie afsluiten) | RW | RW | RW | R | RW | R |
| pos_cash_movements (kassa-telling) | RW | RW | RW | R | RW | R |
| pos_parked_carts | RW | RW | RW | — | RW | R |
| pos_quick_buttons (configuratie) | RW | RW | R | — | R | R |
| pos_offline_queue | RW | RW | RW | — | RW | — (service_role) |
| pos_cashiers | RW | RW | R | — | R | — |

POS-refunds: zelfde regel als admin-refunds (tenant_admin only tot cap-feature).

Terminal-config (nieuwe terminal koppelen, terminal-naam wijzigen) = tenant_admin only.

#### Test-checklist (na 2E)

- [ ] VanXcel POS-flow blijft werken (terminal koppelen, payment intent, process payment, refund)
- [ ] Een staff-rol kan POS-transacties doen
- [ ] Een viewer-rol kan POS-data zien maar geen transacties triggeren
- [ ] Offline-queue sync blijft functioneren (service_role write)

---

### 3.9 Batch 2F — Dormant lockdown (rol-aware defaults)

**Doel.** 73 dormant tabellen (0 rijen, scaffolding voor nog-niet-geactiveerde features) krijgen rol-aware defaults volgens hun feature-cluster. Toekomst-klaar: als een tenant ooit zo'n feature activeert, is RLS al passend geconfigureerd.

**Aanpak per cluster.** Niet één generieke "tenant_admin only" regel, maar een logische rol-mapping per feature-categorie, gebaseerd op hoe het normaal gebruikt zou worden in productie.

#### 12 clusters

##### Cluster 1: Loyalty (5 tabellen)
`loyalty_programs`, `loyalty_tiers`, `loyalty_transactions`, `customer_loyalty`, `tenant_loyalty_rewards`

Rol-mapping (zoals customers-pattern):
- tenant_admin: RW (configuratie programma + tiers)
- staff: RW (klant-loyalty inzien/aanpassen voor klantenservice)
- accountant: R (financiële impact van loyalty-uitgaven)
- warehouse, viewer: R

##### Cluster 2: Gift cards (4 tabellen)
`gift_cards`, `gift_card_designs`, `gift_card_transactions`, `gift_promotions`

Rol-mapping (financieel product):
- tenant_admin: RW (design, batch-generate, refund)
- staff: RW (uitgeven, scanning bij retail-use-cases)
- accountant: R (financiële tracking)
- warehouse, viewer: R

##### Cluster 3: Customer groups B2B (3 tabellen)
`customer_groups`, `customer_group_members`, `customer_group_product_prices`

Rol-mapping (sales-tool):
- tenant_admin: RW (groepen, prijzen instellen)
- staff: RW (klant aan groep toevoegen)
- accountant: R
- warehouse, viewer: R

##### Cluster 4: Email marketing engine (10 tabellen)
`email_campaigns`, `email_automations`, `email_unsubscribes`, `email_signatures`, `email_template_blocks`, `email_preferences`, `email_templates`, `message_templates`, `campaign_link_clicks`, `campaign_sends`

Rol-mapping (marketing):
- tenant_admin + staff: RW (manage campaigns en templates)
- email_unsubscribes: service_role write (unsubscribe-link), tenant R
- campaign_link_clicks + campaign_sends: service_role write (tracking pixels), tenant R
- viewer: R

##### Cluster 5: Automation engine (4 tabellen)
`automation_runs`, `automation_step_runs`, `automation_steps`, `automatic_discounts`

Rol-mapping (operations):
- tenant_admin: RW (configureren automations)
- staff: R + execute (eens automation bestaat, mag staff em manueel triggeren)
- automation_step_runs/runs: service_role write (execution logs)
- viewer: R

##### Cluster 6: Volume/BOGO discounts (4 tabellen)
`volume_discounts`, `volume_discount_tiers`, `bogo_promotions`, `discount_stacking_rules`

Rol-mapping (zoals discount_codes-pattern):
- tenant_admin: RW (codes/regels aanmaken)
- staff: R + apply (toepassen op orders, niet bewerken)
- viewer: R

##### Cluster 7: SellQo SaaS billing (4 tabellen)
`subscriptions`, `subscription_invoices`, `subscription_lines`, `subscription_notifications`

Rol-mapping (SellQo factureert tenants):
- platform_admin: RW (alles)
- tenant_admin: R eigen subscription only
- anderen: GEEN
- Bron-of-truth blijft Stripe via webhook → service_role write

##### Cluster 8: Suppliers / Purchase orders (5 tabellen — cost data!)
`suppliers`, `supplier_documents`, `product_suppliers`, `purchase_orders`, `purchase_order_items`

Rol-mapping (procurement met cost-data):
- tenant_admin: RW
- staff: GEEN (cost-data, matrix-regel)
- accountant: R (voor inkoop-rapportering)
- warehouse: R (om te weten wat van wie komt voor receiving — alleen suppliers + purchase_orders, niet supplier_documents of product_suppliers want die bevatten cost)
- viewer: GEEN

##### Cluster 9: WhatsApp / Social channels (6 tabellen)
`whatsapp_connections`, `whatsapp_templates`, `social_connections`, `social_channel_connections`, `meta_messaging_connections`, `social_posts`

Rol-mapping (communicatie + marketing):
- tenant_admin: connect/disconnect, RW templates
- staff: R connections, RW posts + send template (gebruik)
- viewer: R

##### Cluster 10: Multi-platform ads (10 tabellen — Meta/Google/Amazon)
`ads_meta_campaigns`, `ads_meta_adsets`, `ads_meta_performance`, `ads_google_campaigns`, `ads_google_performance`, `ads_amazon_campaigns`, `ads_amazon_adgroups`, `ads_amazon_keywords`, `ads_amazon_performance`, `ads_amazon_search_terms`

Rol-mapping (conservatief — open beslispunt of staff mag budgetten wijzigen):
- tenant_admin: RW (campaigns + budget)
- staff: R (zien wat draait, geen budgetwijzigingen — kan losser na beslissing)
- viewer: R

##### Cluster 11: Returns legacy (2 tabellen)
`return_items`, `return_status_history`

Status: gedeprecieerd, vervangen door nieuwe `returns`-tabel (2A1).
Rol-mapping (lock-and-leave):
- service_role only — geen frontend write, geen edge-function write meer
- platform_admin: R (audit / debug)
- DROP-migration plannen voor Fase 3

##### Cluster 12: Operationele helpers (16 tabellen)
`sync_queue`, `sync_conflicts`, `sync_activity_log`, `marketplace_listing_queue`, `webhook_deliveries`, `storefront_webhooks`, `feature_usage_events`, `ai_credit_purchases`, `import_jobs`, `import_mappings`, `import_category_mappings`, `odoo_customer_sync_log`, `odoo_invoice_sync_log`, `odoo_journal_mappings`, `odoo_tax_mappings`, `translation_jobs`, `translation_settings`, `vat_returns`, `vat_validations`, `support_tickets`, `support_messages`, `ai_help_conversations`, `ai_help_unanswered`

Rol-mapping (variëert per tabel):
- Background jobs (sync_queue, sync_conflicts, marketplace_listing_queue, webhook_deliveries): service_role only, platform_admin R
- Sync logs (sync_activity_log, odoo_*_sync_log): service_role write, tenant_admin/accountant R
- Storefront webhooks (storefront_webhooks): tenant_admin RW, service_role execute
- Feature usage (feature_usage_events): service_role write, platform_admin R
- AI credit purchases (ai_credit_purchases): service_role write (Stripe), tenant R eigen
- Imports (import_jobs, import_mappings, import_category_mappings): tenant_admin/staff RW
- Odoo mappings (odoo_journal_mappings, odoo_tax_mappings): tenant_admin/accountant RW
- Translations (translation_jobs, translation_settings): tenant_admin RW
- VAT outputs (vat_returns, vat_validations): tenant_admin/accountant RW
- Support tickets (support_tickets, support_messages): tenant_admin/staff RW eigen tenant
- AI help dormant (ai_help_conversations, ai_help_unanswered): service_role only (geen activiteit)

#### Recon-prompt voor 2F

```
Recon Batch 2F Dormant lockdown. Rapport in docs/fase2-batch-2f-recon.md.

OPDRACHT
1. Bevestig per cluster (12 stuks, zie masterplan) dat alle genoemde tabellen 
   inderdaad 0 rijen hebben in productie. Lijst per tabel: tenant_id-kolom Y/N, 
   huidige RLS-policies, bestaande edge-function-referenties.

2. Voor elke tabel met BESTAANDE edge functions:
   - Lijst de functies
   - Classificeer: heeft de functie role-checks? Werkt 'ie met service_role?
   - Identificeer mogelijk dode code-paden (functies die niet meer worden aangeroepen)

3. Voorgestelde drie-policy-templates per cluster volgens masterplan-rol-mapping.

4. Risico-inschatting: welke clusters hebben CASCADE-relaties naar actieve tabellen?
   Bijv. customer_loyalty FK naar customers — als RLS strikt is, beïnvloedt dat customer-flows?

5. Test-strategie: omdat tabellen 0 rijen hebben, kan integratie-test niet via 
   normale UI. Voorgestelde aanpak: per cluster één tenant_admin testdata inserten, 
   testen dat verschillende rollen passende rechten hebben, daarna data weer verwijderen.
```

#### Implementatie-prompt 2F

Eén grote migration per cluster (12 migrations totaal, of gegroepeerd in 3-4 megamigrations). Aanrader: gegroepeerd in 3 (financieel, marketing/comms, ops) om review-overhead te beperken.

#### Test-checklist

- [ ] Per cluster: insert testdata als platform_admin/tenant_admin, verifieer rol-rechten via verschillende test-accounts
- [ ] Geen functies/UI breken op productie (clusters zijn dormant dus geen impact, maar wel verifieren)
- [ ] Service_role-paden blijven werken (webhooks, sync jobs)
- [ ] Cleanup testdata na verificatie

---

## Hoofdstuk 4 — Frontend gating

**Wanneer.** Na ALLE backend-batches (2A1 t/m 2F). Niet eerder. Backend dichtklikken eerst → daarna UI-knoppen verbergen die toch al 403 zouden geven.

### 4.1 Wat er al is + wat ontbreekt

Al gebouwd in Foundation: `useCan`, `PermissionGate`, `ProtectedRoute` met `requires`, `/no-access` pagina, `AppRole` type in `useAuth`.

### 4.2 Uitrol per resource-categorie

Per categorie één Lovable-prompt die alle bestaande componenten wrappet met `<PermissionGate>` of conditioneert met `useCan`. Volgorde matcht batches:

1. Orders-UI (admin/orders/*, return-detail-pagina's)
2. Refunds-UI (refund-button, credit-notes-overzicht)
3. Integrations-UI (settings/integrations/*)
4. Customers-UI (admin/customers/*, customer-detail, inbox)
5. Catalog-UI (admin/products/*, bundle-editor)
6. Marketing-UI (campaigns, discount-codes, ads, SEO-tools)
7. Reports-UI + Settings-UI (admin/settings/*)
8. POS-UI (admin/pos/*, terminal-pages)
9. Dormant clusters — meeste hebben nog geen UI; alleen waar UI bestaat (Loyalty, Gift cards, Customer groups) gating toevoegen

### 4.3 Test per rol

Per rol een test-account aanmaken op staging-tenant, alle hoofdpagina's afklikken:
- [ ] viewer: alles read-only, geen bewerk/verwijder/aanmaak-knoppen
- [ ] staff: catalog/orders/customers write, geen settings/integrations/finance
- [ ] accountant: finance/invoices, beperkt customer data, geen catalog write
- [ ] warehouse: orders-fulfillment, POS-operate, geen marketing
- [ ] tenant_admin: alles van eigen tenant
- [ ] platform_admin: alles van alle tenants

---

## Hoofdstuk 5 — Cleanup (post-merge)

### 5.1 Documentation finalize

- [ ] `docs/role-audit.md` finaliseren met alle 10 batches + datums
- [ ] `docs/architecture-patterns.md` aanvullen met: drie-policy-template, frontend-gating-patroon (useCan + PermissionGate), role-aware edge-function-pattern (requireRole), AI-tables read-only-UI-pattern (al bestaand)
- [ ] Losse `docs/fase2-batch-*-recon.md` consolideren in `docs/fase2-summary.md`

### 5.2 Tech debt voor Fase 3

- Refund-cap-feature (matrix wijst erop, niet geïmpl. in 2A2)
- Data-migratie oud → nieuw bundle-model (product_bundle_items → product_bundles + bundle_products)
- Customer-data view-laag finaliseren als 2B2 Optie A werd gekozen
- DROP-migration voor returns legacy (`return_items`, `return_status_history`)
- Migratie van ad-hoc useAuth booleans (`isAccountant`, `isWarehouse`, `hasFinancialAccess`) naar useCan-pattern
- Security-definer + function search_path warnings uit Fase 1 (geparkeerd voor aparte Security Masterplan)

### 5.3 Activatie-checklist voor dormant features

Voor elk van de 12 dormant clusters: als/wanneer de feature live gaat voor een tenant, deze stappen:

1. Verifieer dat de tabel-RLS uit 2F nog matched met de matrix
2. Update Hoofdstuk 2-matrix indien rol-mapping moet verfijnen
3. Update `useCan.ts` met de matrix-wijziging
4. Bouw eventueel benodigde edge functions met requireRole-checks
5. Bouw eventueel benodigde frontend met PermissionGate
6. Documenteer activatie in `docs/role-audit.md`

### 5.4 Pentest 2.0

Overweeg een herhaal-pentest na Fase 2 — gericht op cross-rol-privilege-escalatie binnen één tenant, frontend-gating-bypass, en edge-function-authorization-checks.

## Hoofdstuk 3 — Uitrol-status (afgesloten 2026-06-09)

### Voltooid

| Batch | Inhoud | Status |
|---|---|---|
| Pre-Fase 2 | Schema-sync | ✅ |
| Foundation | has_tenant_role, AuthResult, requireRole, useCan, PermissionGate | ✅ |
| 2A DROP-batch | Cross-tenant has_role sweep van fiscale tabellen | ✅ |
| 2A0 | update-order-fulfillment-status edge | ✅ |
| 2A1 | Orders + 10 sub-tabellen RLS (32 policies) | ✅ |
| 2A2a | Credit_notes/invoices/quotes/proforma RLS (13 tabellen, 39 calls) | ✅ |
| 2A2b | Refund/invoice/quote edge-functions requireRole | ✅ |
| 2B1a | Integrations RLS (8 tabellen, 32 policies) | ✅ |
| 2B1b | Integration edge-functions requireRole + Stripe-disconnect tenant_admin | ✅ |
| 2B2a | Customer-cluster RLS + cross-tenant sweep (576 regels, 20+ tabellen) | ✅ |
| 2B2b | Customer-cluster edge-functions requireRole | ✅ |
| 2C1a-i/ii/iii | Catalog RLS in 3 splits (core/suppliers-PO/UGC) | ✅ |
| 2C1b | Catalog edge-functions (10 functies) | ✅ |
| 2C2a-i | Email marketing RLS (10 tabellen, 54 calls) | ✅ |
| 2C2a-ii | Discount/loyalty/gift RLS (11 tabellen, 53 calls) | ✅ |
| 2C2a-iii | Ads RLS (7 tabellen, 34 calls) | ✅ |
| 2C2a-iv | CMS/SEO/Theme/Social/A-B/Notif RLS (21 tabellen, 82 calls) | ✅ |
| 2C2b | Marketing/Ads edge-function role-checks (16 functies) | ✅ |
| 2C2c | Social-tabellen consolidatie | ✅ (no-op — verschillende domeinen) |
| 2D | Reports/Settings/Billing RLS + 5 viewer-write-lekken + platform-gift-month fix | ✅ |
| 2E | POS RLS (8 tabellen, 40 policies, 3 edges) | ✅ |
| 2F-i | Marketing-extras + Loyalty-restant + SEO dormant lockdown | ✅ |
| 2F-ii | Procurement/Payment/Integrations dormant lockdown | ✅ |
| 2F-iii | Ads-restant + Analytics/Tracking dormant lockdown | ✅ |
| 2F-iv | Customer/Product/AI/Uncategorized dormant lockdown | ✅ |
| H4 | Frontend gating (useCan/PermissionGate/RouteGuard/RoleSimulator) | ✅ |
| H5 | Cleanup post-merge (legacy helpers gedropt, eindrapport) | ✅ |

### Marketing-rol uitgerold

- app_role enum uitgebreid met 'marketing'
- useCan matrix met marketing-kolom
- Sidebar gating
- Backward-compatible

### Geparkeerd in backlog (docs/fase2-backlog.md)

- 2C1c: Anon-INSERT pad voor external_reviews via edge function met rate-limit
- 2C1d: Column-masking cost_price (views products_safe + product_variants_safe)
- 2C2d: Column-masking ads-budget + tracking_events tenant-binding audit

### Aanvullend werk vandaag (buiten masterplan scope)

- Credit-note feature volledig: PDF, Peppol UBL, email, auto-trigger retour→CN
- Odoo B2C dummy aggregator (UI klaar, untested geen Odoo-conn)
- Storefront-api cart_create idempotency (unique index, race-fix)
- Storefront-api cartAddItem variant-aware stock check
- VanXcel checkout naam-fix (first_name/last_name in JSONB)
- Storefront-api customer find-or-create smartere update flow
- admin_actions_log kolom-mismatch fix in CN-functies
- Customer-data backfill voor orphan-orders zonder customer_id
- Stripe-disconnect type-to-confirm hardening (StripeDisconnectDialog)
- 5 config.toml verify_jwt entries (CORS-preflight fix)
- Marketing-rol toegevoegd zonder RLS-rework

### Statistiek-overzicht

- Migraties: ~14 in totaal vandaag
- Edge functions met requireRole: ~70
- RLS-policies herzien: ~250+
- 0 legacy has_role(auth.uid()) overgebleven na sweep

---

## Bijlage A — Patronen-cheatsheet

### A.1 Drie-policy-template

```sql
-- 1. Anon SELECT (indien storefront-zichtbaar)
CREATE POLICY "Public can view active <resource>"
ON public.<table> FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM <parent> p
    WHERE p.id = <table>.<parent_id>
      AND p.is_active = true
      AND p.hide_from_storefront = false
  )
);

-- 2. Authenticated SELECT (alle rollen binnen tenant)
CREATE POLICY "Tenant users can view <resource>"
ON public.<table> FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 3. Authenticated WRITE (specifieke rollen via has_tenant_role)
CREATE POLICY "Tenant <roles> can manage <resource>"
ON public.<table> FOR ALL TO authenticated
USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
```

### A.2 Parent-FK-scope (zoals 1C op product_bundle_items)

Voor tabellen zonder eigen tenant_id maar met FK naar tenant-table:

```sql
CREATE POLICY "Tenant users can view bundle items"
ON public.product_bundle_items FOR SELECT TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products
    WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);
```

### A.3 Edge-function role-check (TypeScript)

```typescript
import { authenticateRequest, requireRole } from "../_shared/auth.ts";

serve(async (req) => {
  const { tenant_id } = await req.json();
  const auth = await authenticateRequest(req, tenant_id);
  requireRole(auth, tenant_id, ['tenant_admin', 'staff']); // throws 403 on mismatch
  // ... handler logic
});
```

### A.4 Frontend gating (React)

```tsx
import { PermissionGate } from '@/components/PermissionGate';

<PermissionGate action="write" resource="orders" fallback={null}>
  <Button onClick={editOrder}>Bewerken</Button>
</PermissionGate>

// Of programmatisch:
const canEdit = useCan('write', 'orders');
{canEdit && <Button>...</Button>}
```

### A.5 JWT-gating qual-pattern (uit Fase 1D, voor service_role-only tabellen)

```sql
CREATE POLICY "Service role only"
ON public.<table> FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);
```

---

## Bijlage B — Rollback procedures

### B.1 Voor RLS-migrations

Per batch:
1. Vóór submit: Supabase DB-snapshot via dashboard (gratis, 2 klikken)
2. Migration submit
3. Bij issue: rollback-migration submitten die DROP nieuwe + CREATE oude policies doet. Lovable genereert deze op basis van paper trail in `docs/role-audit.md`.

### B.2 Voor edge-function-changes

`git revert <commit>` van de batch-commit. Lovable houdt per batch één single-commit aan.

### B.3 Voor frontend-changes

Idem `git revert`. Frontend-rollback heeft zelden cascade.

### B.4 Voor schema-sync (Pre-Fase 2)

Schema-sync drops 3 ops-tabellen + voegt 40 CREATE-statements toe. Rollback: snapshot terug + git revert. Risico laag omdat de drift-tabellen al in productie staan; de migration documenteert hun bestaan, drops zijn one-off ops.

---

## Bijlage C — Lessons learned uit Fase 1

8 lessen die de hele Fase 1-sprint schoon hebben afgerond — volg ze in Fase 2:

1. **Naam ≠ inhoud.** product_variant_options had policy genaamd "Service role full access" die feitelijk `TO public` gaf. Kijk altijd naar `pg_policies.roles` en `pg_policies.qual`, niet naar policy-namen.

2. **Grep op de juiste repo.** Custom frontends (VanXcel, Mancini) leven in aparte repo's en doen mogelijk direct PostgREST writes. Vóór je een tabel afsluit: grep ook in alle custom frontend-repos.

3. **Live DB-inspectie > migration-files.** Migrations zeggen wat de bedoeling was, `pg_policies` zegt wat er nu staat. Voor elke batch: query live state, vergelijk met matrix, fix verschil. (Bonus: en met 43-tabel-drift in mind — vraag een schema-sync-check vóór elke batch.)

4. **Paper trail nu, niet later.** Elke beslissing (vooral ⁉️-twijfelgevallen) documenteren in `docs/role-audit.md` op het moment dat je 'm maakt.

5. **JWT-gating qual-patronen verifiëren op airtight zijn.** Voor elke nieuwe policy met JWT-claims: bevestig server-side-verified, niet user-influenced.

6. **Geen big-bang migrations.** Per batch: recon → review → implementatie → test → approval → testperiode → volgende.

7. **Backups voor je begint.** Supabase DB-snapshot per batch. 2 klikken. Geen excuus.

8. **Test in incognito en als verschillende rollen.** Niet alleen als tenant_admin. Het hele point van Fase 2 is rol-discriminatie — test als verschillende rollen.

### Aanvullende lessen voor Fase 2 (uit deze masterplan-voorbereiding):

9. **Aanwezigheid van een tabel ≠ actieve feature.** SellQo heeft 142 tabellen met 0 rijen die scaffolding zijn voor toekomstige features. Verifieer met row counts vóór je iets onder de matrix legt. (De eerdere POS-fout: pos_* tabellen bestonden in de repo, maar zonder die check zouden ze ten onrechte als "Toog" zijn geclassificeerd.)

10. **Drift tussen repo en productie is een audit-risico.** Lovable kan migrations toepassen in de DB zonder ze terug te committen. Bij elke security-audit: voer eerst een schema-sync uit, anders mis je tabellen.


---

## Bijlage D — Volledig tabel-classificatie-appendix

**Doel.** Definitieve scope-classificatie voor alle 239 tabellen in productie. Per tabel: batch, row count (snapshot 2026-06-03), drift-status, en korte reden.

**Legende:**
- `📌` = drift (tabel bestaat in productie, niet in repo-migrations vóór schema-sync)
- `✅ Fase 1X` = al afgehandeld in Fase 1
- `🌐 Global` = globale lookup/reference, geen tenant-rol-discriminatie nodig
- `🗑️ Cleanup` = tijdelijke ops-tabel, te droppen in schema-sync
- `2A1-2F` = Fase 2-batch waarin deze tabel wordt aangepakt


### ✅ Fase 1A+1B — Cross-batch lockdown

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ai_chatbot_conversations` | 0 |  | RLS + anon bounded |

### ✅ Fase 1B — Anon-bounding & gateway writes (afgehandeld)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `channel_field_mappings` | 33 |  | Globale lookup confirmed |
| `customer_events` | 0 |  | Anon INSERT dropped |
| `customer_message_attachments` | 1 |  | Service-role gateway |
| `platform_settings` | 1 |  | Platform_admin only |
| `storefront_favorites` | 0 |  | Service-role lockdown |

### ✅ Fase 1C — Catalog (afgehandeld)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `product_bundle_items` | 92 |  | Drie-policy-template (oude impl) |
| `product_variant_options` | 67 |  | Drie-policy + cross-tenant fix |

### ✅ Fase 1D — JWT-gated airtight (geverifieerd)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ai_assistant_config` | 8 |  | JWT-gated airtight |
| `ai_knowledge_index` | 0 |  | JWT-gated airtight |
| `ai_reply_suggestions` | 2 |  | JWT-gated airtight |
| `ai_user_behavior_log` | 0 |  | JWT-gated airtight |
| `ai_user_learning_patterns` | 0 |  | JWT-gated airtight |
| `oauth_states` | 21 |  | Service_role only confirmed |
| `tenant_addons` | 0 |  | Service_role only confirmed |

### 🌐 Global / Public reference (geen rol-discriminatie)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `doc_articles` | 26 |  | Helpdocs publiek |
| `doc_categories` | 13 |  | Helpdocs publiek |
| `platform_changelogs` | 0 |  | Public read |
| `pricing_plans` | 4 |  | Publiek voor signup-flow |
| `sellqo_legal_pages` | 6 |  | SellQo TOS/privacy |
| `themes` | 3 |  | Globale theme-library |
| `vat_rates` | 16 |  | Publieke BTW-tarieven |
| `vat_regimes` | 12 |  | Publieke EU-BTW-reference |

### 🗑️ Cleanup — Te droppen tijdens schema-sync

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `shopify_dates_staging` | 105 | 📌 | One-off ops-tabel, mag DROP |
| `stock_snapshot_pre_reconcile_20260430` | 47 | 📌 | Snapshot, mag DROP |
| `stock_snapshot_pre_reconcile_final` | 47 | 📌 | Snapshot, mag DROP |

### Batch 2A1 — Orders

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `digital_deliveries` | 0 |  | Digital products |
| `inventory_sync_log` | 100217 |  | Voorraad sync log |
| `order_items` | 130 |  | Via FK orders.tenant_id |
| `orders` | 126 |  | Hoofdtabel |
| `packing_slip_lines` | 0 |  | Via FK packing_slips |
| `packing_slips` | 0 |  | Pakbonnen |
| `returns` | 3 | 📌 | Nieuwe canonical retours |
| `shipping_labels` | 319 |  | Verzending |
| `shipping_methods` | 3 |  | Verzendmethodes |
| `shipping_status_updates` | 60 |  | Tracking-updates |
| `tracking_import_log` | 0 |  | Tracking sync log |

### Batch 2A2 — Refunds via credit_notes

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `credit_note_lines` | 0 |  | Via FK credit_notes |
| `credit_notes` | 0 |  | Refunds via credit_notes |
| `invoice_archive` | 164 |  | Factuur-archief |
| `invoice_discounts` | 0 |  | Via FK invoices |
| `invoice_duplicates` | 0 |  | Via FK invoices |
| `invoice_lines` | 153 |  | Via FK invoices |
| `invoices` | 140 |  | Facturen |
| `payment_confirmations` | 2 |  | Betalingsbevestigingen |
| `payment_reminders` | 0 |  | Herinneringen |
| `proforma_invoice_lines` | 0 |  | Via FK proforma |
| `proforma_invoices` | 0 |  | Proforma |
| `quote_items` | 2 |  | Via FK quotes |
| `quotes` | 2 |  | Offertes |

### Batch 2B1 — Integrations

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ad_platform_connections` | 2 |  | Ad-platform-OAuth |
| `fulfillment_api_keys` | 0 |  | Externe API-keys |
| `marketplace_connections` | 1 |  | Marketplace-OAuth |
| `review_platform_connections` | 0 |  | Reviews-OAuth |
| `shipping_integrations` | 0 |  | Verzendkoppelingen |
| `shopify_connection_requests` | 1 |  | Shopify-koppeling |
| `tenant_domains` | 3 |  | Custom domains |
| `tenant_oauth_credentials` | 1 |  | OAuth tokens |

### Batch 2B2 — Customers (CRM)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `customer_communication_settings` | 41 |  | Comms-settings |
| `customer_messages` | 42 |  | Inbox-berichten |
| `customer_segments` | 0 |  | Segmenten |
| `customers` | 108 |  | Klanten (JSONB addresses) |
| `external_reviews` | 0 |  | Klant-reviews |
| `inbox_folders` | 26 | 📌 | Folders voor klant-inbox |
| `newsletter_subscribers` | 4 |  | Newsletter-lijst |
| `segment_members` | 0 |  | Via FK customer_segments |

### Batch 2B2 (apart) — Storefront-customer-auth (eigen RLS-systeem)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `storefront_cart_items` | 57 |  | Via FK storefront_carts |
| `storefront_carts` | 72 |  | Storefront-customer carts |
| `storefront_customers` | 4 |  | Storefront-side auth, eigen RLS |

### Batch 2C1 — Catalog

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `bundle_products` | 4 | 📌 | Via FK product_bundles (drift) |
| `categories` | 76 |  | Category-tree |
| `license_keys` | 0 |  | Digital product license keys |
| `media_assets` | 0 |  | Media-library |
| `product_bundles` | 1 | 📌 | Nieuwe bundle-impl (drift) |
| `product_categories` | 159 | 📌 | M:N products↔categories |
| `product_channel_warnings` | 0 |  | Channel-warnings |
| `product_custom_specs` | 261 |  | Custom specs |
| `product_files` | 0 |  | Bestanden bij producten |
| `product_specifications` | 41 |  | Specs |
| `product_variants` | 288 |  | Varianten |
| `products` | 121 |  | Producten |

### Batch 2C2 — Marketing & CMS

> **Update 2026-06-08.** App-rol `marketing` is toegevoegd aan de `app_role`
> enum (zie `docs/role-audit.md` → "Role expansion — marketing"). Bij het
> schrijven van expliciete RLS policies voor de tabellen in deze batch
> MOET marketing meegenomen worden in de policy-arrays:
> write `array['tenant_admin','staff','marketing']`,
> read `array['tenant_admin','staff','accountant','viewer','marketing']`.
> Uitzondering: `ad_platform_connections` (en credential-tabellen) blijven
> `['tenant_admin']` write — marketing krijgt geen integration-config-rechten.
> Budget-gevoelige velden (campaign-budget vrijgeven) blijven UI-gated via
> `useCan('write','ad_budgets')` → tenant_admin only.

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ab_test_configs` | 0 |  | A/B-tests |
| `ad_audience_syncs` | 0 |  | Audience-syncs |
| `ad_campaigns` | 1 |  | Generieke campaign-table |
| `ad_creatives` | 0 |  | Creatives |
| `ads_ai_recommendations` | 0 |  | AI-tips voor ads |
| `ads_ai_rules` | 2 |  | AI-regels voor ads |
| `ads_bolcom_adgroups` | 0 |  | Bol.com adgroups |
| `ads_bolcom_campaigns` | 4 |  | Bol.com ads (actief) |
| `ads_bolcom_keywords` | 0 |  | Bol.com keywords |
| `ads_bolcom_performance` | 0 |  | Bol.com performance |
| `ads_bolcom_search_terms` | 0 |  | Bol.com search terms |
| `ads_bolcom_targeting_products` | 0 |  | Bol.com targeting |
| `ads_product_channel_map` | 0 |  | Product↔channel-mapping |
| `content_translations` | 0 |  | Vertalingen |
| `discount_code_usage` | 0 |  | Code-gebruik tracking |
| `discount_codes` | 7 |  | Kortingscodes (staff apply / admin manage) |
| `homepage_sections` | 3 |  | Homepage CMS |
| `legal_pages` | 21 |  | Tenant legal pages |
| `seo_analysis_history` | 8 |  | SEO-history |
| `seo_audit_results` | 0 |  | SEO-audit-resultaten |
| `seo_competitor_keywords` | 0 |  | Via FK seo_competitors |
| `seo_competitors` | 0 |  | SEO-concurrenten |
| `seo_keywords` | 0 |  | SEO-keywords |
| `seo_scheduled_audits` | 0 |  | Geplande SEO-audits |
| `seo_scores` | 54 |  | SEO-scores |
| `seo_search_console_data` | 0 |  | Search Console-data |
| `seo_web_vitals` | 1 |  | Web Vitals |
| `storefront_pages` | 1 |  | CMS-pagina's |
| `tenant_theme_presets` | 1 |  | Theme-presets |
| `tenant_theme_settings` | 4 |  | Theme-settings |

### Batch 2D — Reports & Settings

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `admin_actions_log` | 3 | 📌 | Audit log voor platform-admin |
| `admin_billing_actions` | 4 |  | Platform billing acties |
| `ai_action_suggestions` | 0 |  | AI action suggestions |
| `ai_coach_settings` | 6 | 📌 | AI Business Coach per tenant |
| `ai_content_edits` | 0 |  | AI edits history |
| `ai_feedback` | 0 |  | Feedback op AI-features |
| `ai_generated_content` | 0 |  | AI gegenereerde content (incl edits) |
| `ai_generated_images` | 2 |  | AI-gegenereerde afbeeldingen |
| `ai_learning_patterns` | 0 |  | AI learning |
| `ai_prompt_favorites` | 0 |  | User favorites |
| `ai_usage_log` | 89 |  | AI-gebruik logs |
| `app_feedback` | 0 |  | Feedback van users |
| `dashboard_preferences` | 0 |  | User UI prefs |
| `internal_config` | 2 |  | Platform-internal config |
| `notifications` | 344 |  | In-app notificaties |
| `pending_platform_payments` | 0 |  | Pending SellQo payments |
| `platform_coupon_redemptions` | 0 |  | Via FK platform_coupons |
| `platform_coupons` | 1 |  | Platform coupons (SellQo billing) |
| `platform_health_metrics` | 0 |  | Platform metrics |
| `platform_incidents` | 0 |  | Platform incidents |
| `platform_invoices` | 0 |  | SellQo→tenant invoices |
| `platform_quick_actions` | 6 |  | Platform-admin actions |
| `profiles` | 6 |  | User-profielen |
| `sidebar_preferences` | 2 |  | User UI prefs |
| `storefront_api_keys` | 2 | 📌 | Storefront API keys per tenant |
| `team_invitations` | 4 |  | Team-uitnodigingen |
| `tenant_ai_credits` | 8 |  | AI-credits per tenant |
| `tenant_badges` | 11 |  | Achievements (actief) |
| `tenant_feature_overrides` | 2 | 📌 | Feature-flags per tenant |
| `tenant_milestones` | 11 |  | Mijlpalen (actief) |
| `tenant_newsletter_config` | 1 |  | Newsletter-config |
| `tenant_notification_settings` | 155 |  | Notification-settings |
| `tenant_return_settings` | 8 |  | Retour-settings |
| `tenant_subscriptions` | 7 |  | Tenant subscription-status |
| `tenant_tracking_settings` | 5 |  | Tracking-settings |
| `tenant_transaction_usage` | 5 | 📌 | Usage-tellingen (Fase 1A locked) |
| `tenants` | 8 |  | Tenant-tabel (split view voor admin-kolommen) |
| `user_label_preferences` | 1 |  | User UI prefs |
| `user_roles` | 5 |  | Rol-toewijzingen |
| `vat_report_cache` | 8 |  | BTW-rapport cache |

### Batch 2E — POS (SellQo native)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `pos_cash_movements` | 0 |  | Kassa-tellingen |
| `pos_cashiers` | 0 | 📌 | POS-medewerkers (drift) |
| `pos_offline_queue` | 0 |  | Offline sync queue |
| `pos_parked_carts` | 0 |  | Geparkeerde tickets |
| `pos_quick_buttons` | 1 |  | Snelle knoppen |
| `pos_sessions` | 10 |  | POS sessies (10 rows) |
| `pos_terminals` | 1 |  | Fysieke kassa's |
| `pos_transactions` | 1 |  | POS transacties |

### Batch 2F (Cluster 1) — Loyalty

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `customer_loyalty` | 0 | 📌 | tenant_admin/staff RW, accountant R |
| `loyalty_programs` | 0 | 📌 | tenant_admin/staff RW, accountant R |
| `loyalty_tiers` | 0 | 📌 | tenant_admin/staff RW, accountant R |
| `loyalty_transactions` | 0 | 📌 | tenant_admin/staff RW, accountant R |
| `tenant_loyalty_rewards` | 0 |  | tenant_admin RW, staff R, accountant R |

### Batch 2F (Cluster 2) — Gift cards

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `gift_card_designs` | 0 |  | tenant_admin RW, staff R |
| `gift_card_transactions` | 0 |  | tenant_admin/staff RW, accountant R |
| `gift_cards` | 0 |  | tenant_admin/staff RW, accountant R |
| `gift_promotions` | 0 | 📌 | tenant_admin RW, staff R |

### Batch 2F (Cluster 3) — Customer groups B2B

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `customer_group_members` | 0 | 📌 | tenant_admin RW, staff RW, accountant R |
| `customer_group_product_prices` | 0 | 📌 | tenant_admin RW, staff R, accountant R |
| `customer_groups` | 0 | 📌 | tenant_admin RW, staff RW, accountant R |

### Batch 2F (Cluster 4) — Email marketing engine

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `campaign_link_clicks` | 0 |  | service_role write, tenant read |
| `campaign_sends` | 0 |  | service_role write, tenant read |
| `email_automations` | 0 |  | tenant_admin RW, staff R+execute, viewer R |
| `email_campaigns` | 0 |  | tenant_admin/staff RW, viewer R |
| `email_preferences` | 0 | 📌 | tenant_admin/staff RW per klant |
| `email_signatures` | 0 | 📌 | tenant_admin RW, staff RW eigen |
| `email_template_blocks` | 0 | 📌 | tenant_admin/staff RW |
| `email_templates` | 0 |  | tenant_admin/staff RW, viewer R |
| `email_unsubscribes` | 0 |  | tenant_admin/staff R, service_role write |
| `message_templates` | 0 | 📌 | tenant_admin/staff RW |

### Batch 2F (Cluster 5) — Automation engine

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `automatic_discounts` | 0 | 📌 | tenant_admin RW, staff R+apply |
| `automation_runs` | 0 | 📌 | tenant_admin RW, staff R, service_role write |
| `automation_step_runs` | 0 | 📌 | tenant_admin RW, staff R, service_role write |
| `automation_steps` | 0 | 📌 | tenant_admin RW config, staff R |

### Batch 2F (Cluster 6) — Volume/BOGO discounts

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `bogo_promotions` | 0 | 📌 | tenant_admin RW, staff R+apply |
| `discount_stacking_rules` | 0 | 📌 | tenant_admin RW, staff R |
| `volume_discount_tiers` | 0 | 📌 | tenant_admin RW, staff R |
| `volume_discounts` | 0 | 📌 | tenant_admin RW, staff R+apply |

### Batch 2F (Cluster 7) — SellQo SaaS billing

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `subscription_invoices` | 0 |  | platform_admin RW, tenant_admin R eigen |
| `subscription_lines` | 0 |  | platform_admin RW, tenant_admin R eigen |
| `subscription_notifications` | 0 |  | platform_admin RW, tenant_admin R eigen |
| `subscriptions` | 0 |  | platform_admin RW, tenant_admin R eigen |

### Batch 2F (Cluster 8) — Suppliers / Purchase orders

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `product_suppliers` | 0 |  | tenant_admin RW, accountant R, anderen GEEN (cost!) |
| `purchase_order_items` | 0 |  | tenant_admin RW, warehouse R, accountant R |
| `purchase_orders` | 0 |  | tenant_admin RW, warehouse R, accountant R |
| `supplier_documents` | 0 |  | tenant_admin RW, accountant R, anderen GEEN |
| `suppliers` | 0 |  | tenant_admin RW, warehouse R, accountant R, staff GEEN |

### Batch 2F (Cluster 9) — WhatsApp / Social channels

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `meta_messaging_connections` | 0 |  | tenant_admin connect, staff use |
| `social_channel_connections` | 0 |  | tenant_admin connect, staff use |
| `social_connections` | 0 |  | tenant_admin connect, staff use |
| `social_posts` | 0 |  | tenant_admin/staff RW |
| `whatsapp_connections` | 0 |  | tenant_admin connect/disconnect, staff use |
| `whatsapp_templates` | 0 |  | tenant_admin/staff RW |

### Batch 2F (Cluster 10) — Multi-platform ads (Meta/Google/Amazon)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ads_amazon_adgroups` | 0 |  | tenant_admin RW, staff R |
| `ads_amazon_campaigns` | 0 |  | tenant_admin RW, staff R |
| `ads_amazon_keywords` | 0 |  | tenant_admin RW, staff R |
| `ads_amazon_performance` | 0 |  | tenant_admin/staff R |
| `ads_amazon_search_terms` | 0 |  | tenant_admin/staff R |
| `ads_google_campaigns` | 0 |  | tenant_admin RW, staff R |
| `ads_google_performance` | 0 |  | tenant_admin/staff R |
| `ads_meta_adsets` | 0 |  | tenant_admin RW, staff R |
| `ads_meta_campaigns` | 0 |  | tenant_admin RW, staff R (conservatief) |
| `ads_meta_performance` | 0 |  | tenant_admin/staff R |

### Batch 2F (Cluster 11) — Returns legacy (gedeprecieerd)

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `return_items` | 0 |  | Service_role only (deprecated) |
| `return_status_history` | 0 |  | Service_role only (deprecated) |

### Batch 2F (Cluster 12) — Operationele helpers

| Tabel | Rijen | Drift | Reden / Rol-mapping |
|---|---:|:---:|---|
| `ai_credit_purchases` | 0 | 📌 | Service_role write (Stripe), tenant R |
| `ai_help_conversations` | 0 |  | Dormant AI-help-feature scaffolding |
| `ai_help_unanswered` | 0 |  | Dormant AI-help-feature scaffolding |
| `feature_usage_events` | 0 | 📌 | Service_role write, platform_admin R |
| `import_category_mappings` | 0 | 📌 | tenant_admin/staff RW |
| `import_jobs` | 26 | 📌 | tenant_admin/staff RW, service_role execute |
| `import_mappings` | 0 | 📌 | tenant_admin/staff RW |
| `marketplace_listing_queue` | 0 | 📌 | Service_role only |
| `odoo_customer_sync_log` | 0 |  | Service_role write, tenant_admin/accountant R |
| `odoo_invoice_sync_log` | 0 |  | Service_role write, tenant_admin/accountant R |
| `odoo_journal_mappings` | 0 |  | tenant_admin/accountant RW |
| `odoo_tax_mappings` | 0 |  | tenant_admin/accountant RW |
| `storefront_webhooks` | 0 | 📌 | tenant_admin RW, service_role execute |
| `support_messages` | 0 |  | Via FK support_tickets |
| `support_tickets` | 0 |  | tenant_admin/staff RW eigen tenant, platform_admin all |
| `sync_activity_log` | 4 |  | Tenant R, service_role write |
| `sync_conflicts` | 0 | 📌 | Service_role only |
| `sync_queue` | 0 |  | Service_role only (background jobs) |
| `translation_jobs` | 0 |  | Service_role write, tenant_admin R |
| `translation_settings` | 0 |  | tenant_admin RW |
| `vat_returns` | 0 |  | tenant_admin/accountant RW |
| `vat_validations` | 0 |  | tenant_admin/accountant R, service_role write |
| `webhook_deliveries` | 0 | 📌 | Service_role only |

---

### Statistieken

- **Totaal tabellen in scope:** 239
- **Al afgehandeld in Fase 1:** 15
- **Globale lookups (geen rol-discriminatie):** 8
- **Cleanup (te droppen):** 3
- **Fase 2 — actieve batches (2A1-2E):** 133
- **Fase 2 — dormant lockdown (2F, 12 clusters):** 80
- **Drift (te syncen in Pre-Fase 2):** 43
- **Tabellen met 0 rijen (dormant):** 142
- **Totaal rijen in productie:** 103,994

# Batch 2B2 — Customers Recon

Datum: 2026-06-08
Scope: alle `customer*` tabellen + `segment_members` + bijbehorende edge functions.
**Geen code-wijzigingen.** Dit document is bron voor de eerstvolgende implementation-batches (2B2a tabellen-RLS → 2B2b edge-function role-checks → Hoofdstuk 4 frontend gating).

---

## 1. Tabel-inventaris & huidige RLS

Werkelijk aanwezige tabellen in `public` (vanuit `information_schema`):

| Tabel | Rijen-status | Aanwezig? |
|---|---|---|
| `customers` | actief | ✅ |
| `customer_communication_settings` | actief | ✅ |
| `customer_events` | actief | ✅ |
| `customer_groups` | actief | ✅ |
| `customer_group_members` | actief | ✅ |
| `customer_group_product_prices` | actief | ✅ |
| `customer_loyalty` | actief | ✅ |
| `customer_messages` | actief | ✅ |
| `customer_message_attachments` | actief | ✅ |
| `customer_segments` | actief | ✅ |
| `segment_members` | actief | ✅ (geen `customer_segment_members`) |
| `customer_addresses` | **NIET aanwezig** — adressen leven inline op `customers` (`billing_*`, `shipping_*`) en op `orders` |
| `customer_notes` | **NIET aanwezig** — notities zitten in `customers.notes` + `customer_messages` (internal_note flag) |
| `customer_tags` / `customer_tag_assignments` | **NIET aanwezig** — tags in `customers.tags` array |
| `customer_preferences` | **NIET aanwezig** — opt-ins in `customer_communication_settings` + `customers.accepts_marketing` |
| `customer_gdpr_requests` | **NIET aanwezig** |
| `customer_consent_log` | **NIET aanwezig** |
| `customer_loyalty_transactions` | **NIET aanwezig** — staat in `loyalty_transactions` |

> Aanname uit briefing dat we losse address/notes/tags/preferences/gdpr-tabellen hadden klopt niet. Scope 2B2 = **alleen bovenstaande 11 tabellen**. GDPR-flows draaien tegen `customers` zelf (open beslispunt §9).

### 1.1 Huidige policies (uit `pg_policies`)

#### `customers`
| Policy | Cmd | Qual / With-check | Classificatie |
|---|---|---|---|
| Users can view their tenant's customers | SELECT | `tenant_id IN get_user_tenant_ids(auth.uid())` | ⚠️ tenant-aware, **niet rol-aware** (warehouse mag PII zien) |
| Users can insert customers for their tenant | INSERT | tenant + `has_role(tenant_admin OR staff)` | ✅ rol-aware |
| Users can update their tenant's customers | UPDATE | tenant + `has_role(tenant_admin OR staff)` | ✅ rol-aware |
| Tenant admins can delete their tenant's customers | DELETE | tenant + `has_role(tenant_admin)` | ✅ rol-aware |
| Platform admins can view/insert/update/delete any customer | ALL | `is_platform_admin(auth.uid())` | ✅ |

**Gat:** `has_role()` calls zijn niet tenant-scoped — een staff/admin in tenant A geeft schrijfrechten in tenant B zolang `tenant_id IN get_user_tenant_ids` matcht (multi-tenant user). Migreren naar `has_tenant_role()` in 2B2a.

#### `customer_communication_settings`
SELECT/INSERT/UPDATE/DELETE — `tenant_id IN (SELECT user_roles.tenant_id …)` **zonder rol-filter**. ⚠️ tenant-aware, rol-blind. Inline subquery i.p.v. `get_user_tenant_ids` (consistency-issue).

#### `customer_events`
SELECT only, `tenant_id IN get_user_tenant_ids`. ⚠️ tenant-aware. Geen INSERT/UPDATE/DELETE policy — write via service-role (storefront-api). Bevestigd patroon.

#### `customer_groups` / `customer_group_members` / `customer_group_product_prices`
CRUD tenant-scoped via `get_user_tenant_ids` (junction via FK-scope). ⚠️ rol-blind — elke rol kan groepen/prijzen muteren.

#### `customer_loyalty`
CRUD via `loyalty_program_id → loyalty_programs.tenant_id`. ⚠️ rol-blind.

#### `customer_messages`
CRUD `tenant_id IN get_user_tenant_ids`. ⚠️ rol-blind (inbox heeft enkel app-side gating).

#### `customer_message_attachments`
SELECT only, inline `tenant_id IN user_roles`. ⚠️ rol-blind. Write via service-role (handle-inbound-email).

#### `customer_segments` + `segment_members`
CRUD tenant-scoped (junction via segments). ⚠️ rol-blind.

---

## 2. PII-kolommen per tabel

| Tabel | PII | Metadata / niet-PII |
|---|---|---|
| `customers` | `email`, `first_name`, `last_name`, `phone`, `company_name`, `vat_number`, `billing_*`, `shipping_*`, `notes` | `customer_type`, `tags`, `total_orders`, `total_spent`, `accepts_marketing`, sync-IDs |
| `customer_communication_settings` | — | opt-in flags, channels |
| `customer_events` | event-payload kan PII/IP bevatten | event_type, occurred_at |
| `customer_groups` | — | naam, regels |
| `customer_group_members` | FK naar customer (indirect) | — |
| `customer_group_product_prices` | — | prijs-override |
| `customer_loyalty` | FK naar customer | points, tier |
| `customer_messages` | `body`, `subject`, `from_email`, `to_email` | thread_id, direction, internal_note flag |
| `customer_message_attachments` | filename | mime, size |
| `customer_segments` | filter-definition kan email-patronen bevatten | naam |
| `segment_members` | FK naar customer | — |

---

## 3. Edge-functions die customer-tabellen raken

| Functie | Tabellen | Auth-pad | Voorgestelde requireRole |
|---|---|---|---|
| `storefront-api` | customers (W), customer_events (W), customer_communication_settings (R) | service-role | **GEEN** — eigen pad |
| `storefront-customer-api` | customers (R/W self), customer_events (W) | cart-session JWT | **GEEN** — eigen pad |
| `platform-customer-portal` | customers (R) | portal JWT | **GEEN** — eigen pad (bevestigen) |
| `sync-odoo-customers` | customers (W) | service-role / cron | **GEEN** — systemic |
| `sync-shopify-customers` | customers (W) | service-role / admin-triggered | conditional: admin → `['tenant_admin','staff']`; cron → bypass |
| `run-csv-import` (customers branch) | customers (W) | admin JWT | `['tenant_admin','staff']` |
| `import-bol-csv` (klant-rijen) | customers (W) | admin JWT | `['tenant_admin','staff']` |
| `send-customer-message` | customer_messages (W) | admin JWT | `['tenant_admin','staff']` (verify reeds gezet?) |
| `handle-inbound-email` | customer_messages, attachments (W) | webhook | **GEEN** — provider |
| `process-email-webhook` | customer_messages (U) | webhook | **GEEN** — provider |
| `send-credit-note-email` / `send-invoice-email` / `send-quote-email` / `send-return-email` / `send-gift-card-email` | customers (R) | admin JWT | conform Batch 2A matrix (al gedekt) |
| `send-meta-message` / `send-whatsapp-message` | customer_messages (W) | admin JWT | `['tenant_admin','staff','marketing']` |
| `ai-generate-email` | customers (R) | admin JWT | `['tenant_admin','staff','marketing']` |
| `email-preferences` | customers (U opt-in) | tokenized link | **GEEN** — public unsubscribe |
| `ai-marketing-context` | customers (R aggregate) | admin JWT | `['tenant_admin','staff','marketing']` |

> **Niet aanwezig**: `import-customers`, `merge-customers`, `dedupe-customers`, `gdpr-export-customer`, `gdpr-delete-customer`, `send-marketing-email`. Marketing-mail loopt via `email-campaigns` / `send-test-email` (Batch 2C2).

---

## 4. Voorgesteld policy-patroon (2B2a migration)

Gebruik `has_tenant_role(auth.uid(), tenant_id, ARRAY[...]::app_role[])` consequent. Vervang `has_role()` voor cross-tenant-veilige variant.

### customers
- SELECT (auth): `tenant_id IN get_user_tenant_ids(auth.uid())` — alle rollen. Rationale: marketing (segmentatie), accountant (factuur-koppeling), warehouse (verzendlabel), viewer (rapportage). Bulk-PII-export rol-gate'd op edge-function-niveau (§6).
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','staff'])`. Marketing **niet**.
- DELETE: `has_tenant_role(['tenant_admin'])`.
- Platform-admin policies behouden.

### customer_communication_settings
- SELECT: tenant-scope alle rollen.
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff','marketing'])`.
- Vervang inline subquery door `get_user_tenant_ids`.

### customer_events
- SELECT: tenant-scope alle rollen.
- Geen auth INSERT/UPDATE/DELETE — service-role only. Bevestigt huidig patroon.

### customer_groups + customer_group_members + customer_group_product_prices
- SELECT: tenant-scope alle rollen.
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff','marketing'])`.

### customer_loyalty
- SELECT: tenant-scope.
- INSERT/UPDATE: `has_tenant_role(['tenant_admin','staff'])`.
- DELETE: `has_tenant_role(['tenant_admin'])`.
- Service-role ALL voor automated point-awarding.

### customer_messages
- SELECT: `has_tenant_role(['tenant_admin','staff','marketing','viewer'])`. Warehouse/accountant niet — past bij `inbox` matrix.
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff','marketing'])`.
- Service-role ALL voor inbound webhooks.

### customer_message_attachments
- SELECT: zelfde rollen als customer_messages.
- Write enkel service-role.

### customer_segments + segment_members
- SELECT: tenant-scope alle rollen.
- INSERT/UPDATE/DELETE: `has_tenant_role(['tenant_admin','staff','marketing'])`.

---

## 5. Edge-function changes (2B2b)

Te patchen:
1. `send-customer-message` — `requireRole(['tenant_admin','staff'])`.
2. `send-meta-message` / `send-whatsapp-message` — `requireRole(['tenant_admin','staff','marketing'])`.
3. `ai-generate-email` / `ai-marketing-context` — `requireRole(['tenant_admin','staff','marketing'])`.
4. `run-csv-import` (customers branch) + `import-bol-csv` — `requireRole(['tenant_admin','staff'])`.
5. `sync-shopify-customers` — `requireRole(['tenant_admin','staff'])` voor admin-trigger; cron-pad bevestigen.

**GEEN wijziging**: `storefront-api`, `storefront-customer-api`, `platform-customer-portal`, `sync-odoo-customers`, `handle-inbound-email`, `process-email-webhook`, `email-preferences`.

CORS-check: elke functie met nieuwe `requireRole` MOET `verify_jwt = false` in `supabase/config.toml` (analoog Batch 2A0 / 2B1b). Audit-lijst in 2B2b PR.

---

## 6. PII / GDPR-overwegingen

- **Bulk-PII-export**: DB-SELECT open voor alle rollen, maar bulk-CSV-download via rol-gate'd edge-functions (`['tenant_admin','staff']`). Marketing krijgt segmentatie-counts/IDs, geen email-bulk-export — server-side via `email-campaigns`.
- **Bulk-delete**: alleen `tenant_admin`.
- **Audit-log**: nieuw tabelpatroon buiten 2B2-scope (voorstel Batch 2D). Voor nu: log alleen bij PII-export en customer-delete. SELECT niet loggen (logs-noise).
- **GDPR-export/delete**: geen aparte `customer_gdpr_requests`-tabel. Voorstel spec + tabel in Fase 3. Ad-hoc via `tenant_admin` op `customers` DELETE.

---

## 7. Risico-analyse

- **UI-breaks**: marketing zonder `customer_messages` (oud rol-blind) — geen impact, past bij design (inbox marketing-toegang blijft).
- **Custom frontends (VanXcel, Mancini)**: writes via `storefront-api` service-role. Geen directe PostgREST writes. Geen breaking change.
- **Marketing segmentatie**: kan via `customer_segments` + `customer_group_members` (write) effectief segmenteren. Bulk-mail via `email-campaigns` server-pad.
- **Cross-tenant staff/admin**: huidige `has_role()` is niet tenant-scoped → migratie naar `has_tenant_role()` lost dit op. Multi-tenant user testen vereist.
- **Inline `user_roles` subqueries** in `customer_communication_settings` + `customer_message_attachments` — vervangen door helper-functie.

---

## 8. Voorgestelde sub-volgorde 2B2

a. **2B2a** — één migration met alle bovenstaande RLS-aanpassingen. Drop/recreate policies waar nodig. Geen data-mutaties.
b. **2B2b** — edge-function `requireRole` toevoegen (5 functies), `verify_jwt = false` audit in config.toml.
c. **Hoofdstuk 4 frontend gating** — `useCan('write','customers')`, `useCan('read','inbox')`, gating op import-knoppen, marketing-rol toegang tot Segments/Groups.

---

## 9. Open beslispunten

1. **Marketing leest customer emails** voor campagne-preview? Voorstel: ja READ op `customers`, bulk-export en mail-send via server-pad. → bevestigen.
2. **Accountant leest `customer_messages`** (inbox)? Voorstel: nee — past bij `inbox` matrix. Klacht-context via factuur-notities. → bevestigen.
3. **Viewer mag customer-PII lezen** voor rapportage? Voorstel: ja READ. → bevestigen.
4. **Aparte `customer_gdpr_requests`-tabel** invoeren? Voorstel: niet in 2B2 — Fase 3 GDPR-spec. → bevestigen.
5. **`customer_notes`-tabel** loskoppelen van `customers.notes`? Voorstel: niet in 2B2 (inline-veld werkt + valt onder customers RLS). → bevestigen.
6. **`customer_tags`-tabel** loskoppelen van `customers.tags`-array? Voorstel: niet in 2B2. → bevestigen.
7. **Cross-tenant staff hard cap**: migreren naar `has_tenant_role()` overal — akkoord? (geadviseerd: ja, security-fix).
8. **`sync-shopify-customers` flow**: cron of admin-trigger of beide? Bepaalt of `requireRole` toegevoegd wordt.

---

_Vervolg: na akkoord op §9 → 2B2a migration draft._

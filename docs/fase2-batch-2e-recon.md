# Fase 2 — Batch 2E recon: POS (SellQo native)

_Datum: 2026-06-09 — recon-only, geen code-wijzigingen._

Multi-tenant POS-cluster (Toog-merk, productie bij De Fiere Margriet).
Staff bedient, tenant_admin configureert, accountant heeft fiscaal-zicht.

---

## 1. Bestaande POS-tabellen + huidige RLS

Uit `pg_policies` (publiek schema, `tablename LIKE 'pos\_%'`):

| Tabel | SEL | INS | UPD | DEL | ALL | helper | rol-aware | plat-bypass | Classificatie |
|---|---|---|---|---|---|---|---|---|---|
| `pos_cash_movements` | 1 | 1 | – | – | – | ❌ raw `user_roles` | ❌ | ❌ | ⚠️ tenant-blind, geen UPDATE/DELETE policy |
| `pos_cashiers` | 1 | – | – | – | 1 | ✅ helper | ❌ | ❌ | ⚠️ tenant-blind ALL |
| `pos_offline_queue` | 1 | 1 | 1 | 1 | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind |
| `pos_parked_carts` | 1 | 1 | 1 | 1 | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind |
| `pos_quick_buttons` | 1 | 1 | 1 | 1 | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind (config) |
| `pos_sessions` | 1 | 1 | 1 | – | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind, geen DELETE policy |
| `pos_terminals` | 1 | 1 | 1 | 1 | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind (config) |
| `pos_transactions` | 1 | 1 | 1 | – | – | ❌ raw | ❌ | ❌ | ⚠️ tenant-blind, geen DELETE policy |

Algemeen patroon: **alle policies tenant-scoped via raw subquery op
`user_roles`**, geen rol-discriminatie, geen platform_admin-bypass, geen
`has_tenant_role`. Elke user met **eender welke rol** binnen de tenant
kan POS-data lezen, schrijven en (voor de meeste tabellen) verwijderen
— inclusief viewer / warehouse / marketing.

### Niet bestaand (masterplan-stubs)

`pos_transaction_lines`, `pos_payments`, `pos_cash_drawers`,
`pos_receipts`, `pos_receipt_templates`, `pos_discounts_applied`,
`pos_tabs`, `pos_tab_items`, `pos_categories` (categorieën worden via
algemene `categories` + `product_categories` gedeeld — bevestigd),
`pos_collab_menus`, `pos_collab_menu_items`, `pos_shift_reports`,
`pos_z_reports`, `pos_x_reports`, `pos_devices`, `pos_device_pairings`,
`pos_settings`.

→ POS-implementatie is dunner dan masterplan suggereert: transactie-
regels zitten waarschijnlijk in JSONB op `pos_transactions`, betalingen
in dezelfde row (`payment_method`, Stripe PI op transactie-niveau),
geen aparte tabs/menu/z-report tabellen. **2E-ii en 2E-iii hebben dus
nauwelijks scope** zolang die tabellen niet bestaan.

---

## 2. Kolommen-sensitiviteit per bestaande tabel

| Tabel | Klasse | Opmerking |
|---|---|---|
| `pos_sessions` (15 cols) | operationeel | open/close-amounts, cashier_id |
| `pos_transactions` (31 cols) | operationeel + fiscaal | totals, tax, payment_method, Stripe PI |
| `pos_cash_movements` (10 cols) | operationeel | cash in/out per shift |
| `pos_cashiers` (8 cols) | config (PIN/identity) | gevoelig: hashes? te valideren |
| `pos_terminals` (13 cols) | config | Stripe reader id, label, location |
| `pos_offline_queue` (10 cols) | operationeel (pending sync) | |
| `pos_parked_carts` (14 cols) | operationeel (tafels-light) | dit IS de tabs-vervanger |
| `pos_quick_buttons` (11 cols) | content/config | UI shortcut buttons |

→ Geen aparte fiscaal-sluitende z/x-report tabellen aanwezig. Z/X-
rapport wordt vermoedelijk **on-the-fly berekend** uit `pos_transactions`
+ `pos_cash_movements` (geen aparte INSERT-only fiscaal-tabel). Dit
vereenvoudigt 2E-ii: enkel terminals/cashiers/quick_buttons als
config-cluster.

---

## 3. POS edge functions — inventaris + auth-pad

Bestaand in `supabase/functions/`:

| Functie | Auth-pattern nu | Classificatie |
|---|---|---|
| `pos-create-payment-intent` | `getUser(token)` + tenant-lookup; geen rol-check | ⚠️ tenant-user, geen rol-gate |
| `pos-manage-reader` | idem | ⚠️ tenant-user, geen rol-gate (terminal-management!) |
| `pos-process-payment` | idem | ⚠️ tenant-user, geen rol-gate |
| `pos-refund-payment` | ✅ `authenticateRequest` + `requireRole(['tenant_admin'])` | ✅ reeds gehard (Batch 2A2b) |

Niet bestaand (masterplan-stubs): `pos-open-session`, `pos-close-session`,
`pos-add-transaction`, `pos-void-transaction`, `pos-cash-movement`,
`pos-cash-count`, `pos-pair-terminal`/`pos-unpair-terminal` (zit in
`pos-manage-reader`), `pos-generate-receipt`, `pos-generate-z-report`,
`pos-generate-x-report`, `pos-sync-products`, `pos-apply-discount`.
→ Verkoop, sessie-open/close en cash-movements gebeuren waarschijnlijk
via directe PostgREST-inserts uit de Toog-tablet-app (met staff-JWT).
RLS is daar de enige guard — wat de huidige tenant-blind policies
**extra urgent** maakt.

---

## 4. Voorgesteld policy-patroon (bevestigd uit masterplan §3.8)

### POS-operational
_pos_sessions, pos_transactions, pos_cash_movements, pos_parked_carts,
pos_offline_queue_

- **SELECT** (auth): `is_platform_admin OR (tenant_id ∈ get_user_tenant_ids() AND has_tenant_role(tenant_id, ['tenant_admin','staff','accountant']))`
- **INSERT/UPDATE** (auth): `… has_tenant_role(['tenant_admin','staff'])`
- **DELETE** (auth): `… has_tenant_role(['tenant_admin'])`
- **Service-role**: implicit bypass (POS-runner, Stripe Terminal webhook)

### POS-config
_pos_terminals, pos_cashiers, pos_quick_buttons_

- **SELECT** (auth): `… has_tenant_role(['tenant_admin','staff'])`
- **INSERT/UPDATE/DELETE** (auth): `… has_tenant_role(['tenant_admin'])`
- **pos_quick_buttons UPDATE**: ook `marketing` (UI-content)

### POS-content / fiscaal / receipts
Niet van toepassing — bijhorende tabellen bestaan niet. Opnemen
in policy-template-document voor toekomstige toevoegingen.

---

## 5. Edge-function-changes (scope)

| Functie | Voorgestelde `requireRole` |
|---|---|
| `pos-create-payment-intent` | `['tenant_admin','staff']` |
| `pos-process-payment` | `['tenant_admin','staff']` |
| `pos-manage-reader` | `['tenant_admin']` — terminal pairing is admin-only |
| `pos-refund-payment` | reeds `['tenant_admin']` ✅ |

Stripe Terminal webhooks: geen wijziging (service-role / signature pad).

---

## 6. Risico-analyse — productie De Fiere Margriet

- **Staff-rol bevestigen**: queryen of cashiers van DFM een `user_roles`
  row hebben met `role='staff'`. Indien ze enkel een nul-rol of geen
  rol hebben, gaat de nieuwe `has_tenant_role`-policy hen blokkeren →
  **pre-flight check vereist vóór 2E-i**.
- **Toog-tablet auth**: vermoedelijk lange-lifetime JWT per cashier
  (saved login). Werkt blijven na rol-aware policies zolang `user_roles`
  juist gevuld is.
- **Stripe Terminal sessie-pad**: `pos-create-payment-intent` +
  `pos-process-payment` gebruiken nu user-JWT; service-role wordt enkel
  in webhook gebruikt. Na 2E-iv vereist dit een echte staff-JWT — geen
  regressie verwacht (tablet logt in als staff).
- **E-commerce → POS-conversie**: geen edge-function gevonden die
  webshop-orders converteert naar POS-transacties. Geen issue verwacht.
- **Multi-cashier shifts**: schema heeft één `cashier_id` per
  `pos_sessions` row — geen native multi-cashier; shift-overdracht
  gebeurt via close + open. Voorgestelde SELECT-policy (alle staff
  binnen tenant) ondersteunt overdracht-zicht.

---

## 7. Open beslispunten (voorstel = default)

| ID | Punt | Voorstel |
|---|---|---|
| **OB-2E-1** | Accountant SELECT op `pos_transactions`/`pos_sessions`? | **Ja** (BTW-aansluiting + Z-equivalent-berekening) |
| **OB-2E-2** | Marketing UPDATE op `pos_quick_buttons` (UI-content)? | **Ja** (POS-content beheer) |
| **OB-2E-3** | Staff mogen elkaars POS-sessies zien? | **Ja** binnen dezelfde tenant (shift-overdracht) |
| **OB-2E-4** | `pos_transactions` DELETE — wie? | **Alleen `tenant_admin`** (audit/fiscaal) |
| **OB-2E-5** | Cash-movements zonder admin-approval door staff? | **Ja** (operationele realiteit) |
| **OB-2E-6** | `pos-manage-reader` — `tenant_admin` only of ook staff? | **`tenant_admin` only** (terminal-pairing is config) |
| **OB-2E-7** | DFM-cashiers daadwerkelijk `staff`-rol? | **Pre-flight verifiëren** vóór migratie |
| **OB-2E-8** | `pos_cashiers` zelf-management — staff mag eigen PIN wijzigen? | Voor nu: nee, `tenant_admin` only (PIN-management = admin) |

---

## 8. Voorgestelde sub-volgorde 2E

- **2E-i — POS operational RLS**
  `pos_sessions`, `pos_transactions`, `pos_cash_movements`,
  `pos_parked_carts`, `pos_offline_queue`. **Pre-flight**: bevestig dat
  DFM-cashiers `staff`-rol hebben. Geen DELETE-policy bestaat momenteel
  op `pos_sessions` / `pos_transactions` / `pos_cash_movements` — die
  blijven dus dicht voor non-admin (gewenst).
- **2E-ii — POS config RLS**
  `pos_terminals`, `pos_cashiers`, `pos_quick_buttons`. Strikt
  `tenant_admin` voor mutaties; staff alleen SELECT (+ marketing UPDATE
  op `pos_quick_buttons`).
- **2E-iii — POS content/fiscaal** (no-op-batch)
  Geen tabellen aanwezig. Levert een policy-template aan in
  `docs/h4-style-guide.md` voor toekomstige z/x-report + tabs +
  collab-menu tabellen.
- **2E-iv — Edge-function role-checks**
  `pos-create-payment-intent`, `pos-process-payment` →
  `['tenant_admin','staff']`.
  `pos-manage-reader` → `['tenant_admin']`.
  `pos-refund-payment` reeds gehard.

---

## 9. Kritieke lekken vóór 2E-i

Geen blokkerende cross-tenant lekken (alle policies wel tenant-scoped),
maar:

- **Viewer / warehouse / marketing** kunnen vandaag POS-transacties
  lezen + cash-movements toevoegen — past niet bij rol-intentie.
- **pos-manage-reader** kan door eender welke ingelogde user van de
  tenant terminals (un)pairen → operationeel risico (kan productie-
  POS uitschakelen). Aan te bevelen: vroege quickfix vóór 2E-i.

_Einde recon 2E._
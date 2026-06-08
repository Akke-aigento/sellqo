# Fase 2 — Batch 2A2 Recon: Refunds via credit_notes & Invoicing RLS

Datum: 2026-06-08
Scope: refund-, factuur-, proforma-, quote- en betaal-tabellen + bijhorende edge functions.
Geen code-wijzigingen — alleen analyse en voorstel.

Context: SellQo heeft GEEN dedicated `payments`/`refunds`/`payouts`-tabel.
- Refunds = rows in `credit_notes` (type `full|partial|correction`) gekoppeld aan `invoices`.
- `orders.payment_status` is enum (`pending|paid|refunded|failed`) en wordt bijgewerkt door Stripe-webhooks + `process-refund`.
- Stripe handelt feitelijke geldstromen extern af (Direct Charges op connected accounts).
- Cap-feature voor staff-refunds bestaat NIET → in 2A2 is refund-write strikt `tenant_admin`.

---

## 1. Huidige RLS — pg_policies snapshot

Legende: ✅ rol-aware (matrix-conform) · ⚠️ tenant-blind (elke rol mag schrijven binnen tenant) · ❌ unbounded

### `credit_notes`
| cmd    | policy | qual / with_check | klassificatie |
|--------|--------|---|---|
| SELECT | Users can view credit notes from their tenants | `tenant_id IN get_user_tenant_ids(auth.uid())` | ⚠️ tenant-blind (acceptabel voor read) |
| INSERT | Users can insert credit notes in their tenants | `tenant_id IN get_user_tenant_ids(auth.uid())` | ⚠️ tenant-blind — staff/warehouse/viewer kunnen refunds aanmaken |
| UPDATE | Users can update credit notes in their tenants | idem | ⚠️ tenant-blind |
| DELETE | Users can delete credit notes in their tenants | idem | ⚠️ tenant-blind |

### `credit_note_lines`
Parent-FK scope via `credit_notes` (`credit_note_id IN (... tenant_id IN get_user_tenant_ids ...)`). SELECT/INSERT/UPDATE/DELETE → ⚠️ tenant-blind via parent.

### `invoices`
| cmd    | policy | klassificatie |
|--------|--------|---|
| SELECT | Users can view their tenant's invoices (tenant-scope) + Platform admins view all | ✅ |
| INSERT | Users can insert invoices for their tenant — vereist `has_role(uid,tenant_admin)` OR `has_role(uid,staff)` | ⚠️ rol-aware maar via globale `has_role` (niet tenant-scoped) en mist `accountant` |
| UPDATE | idem (tenant_admin OR staff via globale has_role) | ⚠️ idem, accountant ontbreekt |
| DELETE | Tenant admins can delete (`has_role tenant_admin`, globaal) | ⚠️ globale has_role |

### `invoice_lines`
Parent-FK + `has_role(tenant_admin)` of `has_role(staff)` voor I/U/D, SELECT tenant-scope. ⚠️ globale has_role, accountant ontbreekt.

### `invoice_archive`
| cmd | policy | klassificatie |
|-----|--------|---|
| SELECT | tenant-scope | ⚠️ tenant-blind |
| INSERT | tenant-scope | ⚠️ tenant-blind (geen UPDATE/DELETE policy → effectief read+insert-only) |

### `invoice_discounts`
Policy `ALL` met `EXISTS (invoices i JOIN user_roles ur ...)` → elke user met een role op die tenant mag alles. ⚠️ tenant-blind (rolloze EXISTS-check, omvat warehouse/viewer).

### `invoice_duplicates`
Policy `ALL` `tenant_id IN get_user_tenant_ids`. ⚠️ tenant-blind.

### `proforma_invoices`
Policy `ALL` `EXISTS user_roles WHERE ur.tenant_id = pi.tenant_id AND user_id = auth.uid()`. ⚠️ tenant-blind (geen rolfilter).

### `proforma_invoice_lines`
Parent-FK via `proforma_invoices`, ALL + rolloze EXISTS. ⚠️ tenant-blind.

### `quotes`
| cmd | policy | klassificatie |
|-----|--------|---|
| SELECT | tenant-scope (+platform admin) | ✅ |
| INSERT | tenant + `has_role(tenant_admin)` OR `has_role(staff)` | ⚠️ globale has_role |
| UPDATE | idem | ⚠️ globale has_role |
| DELETE | `has_role(tenant_admin)` | ⚠️ globale has_role |

### `quote_items`
Parent-FK + zelfde rol-set. ⚠️ globale has_role.

### `payment_confirmations`
| cmd | policy | klassificatie |
|-----|--------|---|
| SELECT | user_roles tenant scope | ✅ |
| INSERT | user_roles tenant scope WHERE role IN (`tenant_admin`,`staff`,`accountant`) | ✅ rol-aware tenant-scoped (geen UPDATE/DELETE policy → effectief append-only) |

### `payment_reminders`
Policy `ALL` + SELECT met rolloze EXISTS via `invoices` parent. ⚠️ tenant-blind.

---

## 2. Edge functions — auth & write-patroon

| Function | verify_jwt | authenticateRequest | requireRole | Schrijft naar | Pad |
|---|---|---|---|---|---|
| `process-refund` | default (true) | ✅ | ✅ `['tenant_admin','staff']` (uit 2A1) | `returns` (+ Stripe refund) | Admin user |
| `pos-refund-payment` | **false** | ❌ gebruikt `supabase.auth.getUser()` via anon client | ❌ | `pos_transactions` (+ Stripe refund) | POS terminal/admin |
| `create-manual-invoice` | false | ✅ `authenticateRequest(req, tenant_id)` | ❌ | `invoices`, `invoice_lines` | Admin user |
| `generate-invoice` | false | ✅ | ✅ `['tenant_admin','staff','accountant']` (uit 2A1) | `invoices`, `invoice_lines`, `invoice_archive` | Admin user (kan ook door cron) |
| `auto-invoice-cron` | default | ❌ service-role only | n/v | `invoices` (indirect via `generate-invoice` call) | Cron |
| `send-invoice-email` | false | ✅ (geen rol-check) | ❌ | `invoices` (status update) | Admin user |
| `send-quote-email` | false | ✅ (geen rol-check) | ❌ | `quotes` (status update) | Admin user |
| `create-quote-payment-link` | false | ✅ (geen rol-check) | ❌ | `quotes` (metadata) | Admin user |
| `repair-cid-references` | default | ❌ service-role | ❌ | `invoices`/attachments | Maintenance (geen UI-trigger gevonden) |
| `repair-attachments` | default | ❌ service-role | ❌ | invoices/attachments | Maintenance |
| `sync-odoo-invoices` | default | ❌ service-role | ❌ | `invoices` (sync metadata) | Cron/admin |
| Stripe-webhooks (`stripe-webhook`, `pos-process-payment`, etc.) | false | service-role | n/v | `orders.payment_status`, `payment_confirmations`, `invoices` | Webhook |
| Platform-billing functies | n.v.t. | platform_admin only | n.v.t. | `platform_invoices` (buiten scope 2A2) | — |

### Onderscheid webhook-pad vs admin-pad
- **Service-role bypass (geen rol-check nodig)**: `auto-invoice-cron`, `repair-*`, `sync-odoo-invoices`, alle Stripe-webhooks → schrijven met service-role-key, RLS wordt overgeslagen. requireRole hoeft hier NIET toegevoegd te worden.
- **Admin-user pad (requireRole vereist)**: `process-refund` (✅ al), `pos-refund-payment`, `create-manual-invoice`, `generate-invoice` (✅ al), `send-invoice-email`, `send-quote-email`, `create-quote-payment-link`.

---

## 3. Voorgesteld policy-patroon (drie-policy template per tabel)

Alle policies gebruiken de Fase-2 helper `has_tenant_role(tenant_id, ARRAY[...]::app_role[])` i.p.v. de globale `has_role`. Platform admin policies blijven naast elkaar bestaan (geen breaking change voor superuser-flows).

### `credit_notes` (refunds, strikt admin tot cap-feature)
```sql
-- SELECT: alle tenant-users (incl. accountant) voor financial reporting
CREATE POLICY "Tenant users can view credit notes" ON public.credit_notes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- INSERT/UPDATE/DELETE: tenant_admin only (geen staff — cap-feature bestaat niet)
CREATE POLICY "Admins can insert credit notes" ON public.credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "Admins can update credit notes" ON public.credit_notes
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "Admins can delete credit notes" ON public.credit_notes
  FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
```

### `credit_note_lines` (parent-FK scope)
SELECT voor iedereen in tenant; INSERT/UPDATE/DELETE alleen als parent `credit_note` in tenant zit én user is `tenant_admin`.

### `invoices`, `invoice_lines`, `invoice_archive`, `invoice_discounts`, `invoice_duplicates`
- SELECT: tenant-scope (alle rollen).
- INSERT/UPDATE/DELETE: `has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[])`.
- `invoice_lines` en `invoice_discounts`: parent-FK + zelfde rolset.
- `invoice_archive`: append-only houden (geen UPDATE/DELETE policy) — alleen INSERT door admin/staff/accountant.

### `proforma_invoices`, `proforma_invoice_lines`
- SELECT: tenant-scope.
- INSERT/UPDATE: `['tenant_admin','staff']`.
- DELETE: `['tenant_admin']`.

### `quotes`, `quote_items`
- Idem proforma (sales workflow).
- SELECT tenant-scope; INSERT/UPDATE `['tenant_admin','staff']`; DELETE `['tenant_admin']`.

### `payment_confirmations`
- SELECT: tenant-scope (alle rollen).
- INSERT/UPDATE/DELETE: **service_role only** — wordt uitsluitend door Stripe/bank-webhook geschreven. Bestaande staff/accountant-INSERT policy laten vervallen (geen UI-flow gebruikt deze).

### `payment_reminders`
- SELECT: tenant-scope.
- INSERT/UPDATE: `['tenant_admin','staff','accountant']`.
- DELETE: `['tenant_admin']`.

---

## 4. Edge-function changes (requireRole toevoegen)

| Function | Voorgestelde requireRole | Reden |
|---|---|---|
| `process-refund` | **bijstellen** naar `['tenant_admin']` | 2A1 zette `['tenant_admin','staff']`; cap-feature ontbreekt nog → staff-refund tijdelijk dichtzetten tot Hoofdstuk 4 caps levert |
| `pos-refund-payment` | `['tenant_admin']` + migreren van `getUser()` naar `authenticateRequest` | POS-refund is even gevoelig als web-refund |
| `create-manual-invoice` | `['tenant_admin','staff','accountant']` | Nu zonder rol-check; accountant moet handmatig kunnen factureren |
| `generate-invoice` | reeds `['tenant_admin','staff','accountant']` | OK (uit 2A1) |
| `send-invoice-email` | `['tenant_admin','staff','accountant']` | Mist rol-check |
| `send-quote-email` | `['tenant_admin','staff']` | Mist rol-check; accountant niet nodig |
| `create-quote-payment-link` | `['tenant_admin','staff']` | Mist rol-check |
| `auto-invoice-cron` | geen | service-role cron |
| `repair-cid-references` | geen* | service-role maintenance; *als UI-trigger toegevoegd → `['tenant_admin']` |
| `repair-attachments` | idem | idem |
| `sync-odoo-invoices` | geen | service-role cron |
| Stripe-webhooks | geen | service-role |

---

## 5. Risico-analyse

- **UI-flows die kunnen breken bij strenger RLS**
  - `useCreditNotes.createCreditNote` (admin/CreditNotes pagina) → direct PostgREST INSERT op `credit_notes` + `credit_note_lines`. Nu vrij voor elke tenant-user; ná hardening alleen `tenant_admin`. Effect: staff verliest "Creditnota aanmaken"-knop. Mitigatie: gate de knop met `useCan('create','credit_note')` en toon toast bij 403.
  - `useInvoices` / `Invoices.tsx` directe insert/update → blijft werken voor tenant_admin/staff/accountant; warehouse/viewer verliezen schrijfrechten (gewenst).
  - `Quotes.tsx`, `Promotions.tsx` → quote-create blijft werken voor admin/staff.
  - `usePaymentReminders` (handmatig reminder versturen) → admin/staff/accountant blijven; warehouse/viewer verliest schrijfrechten (gewenst).
  - `payment_confirmations` INSERT in UI: geen vinder in client-code → veilig om naar service-role-only te brengen.
- **Custom frontends (vanxcel, mancini)**: deze headless storefronts gebruiken de Storefront API (`/functions/v1/storefront-*`) — geen directe PostgREST writes op `credit_notes`/`invoices`/`quotes`. **Geen blocker.** (Te bevestigen door grep in betreffende repos vóór deploy.)
- **Views/reports voor accountant**: `vat-report-engine`, `useReports`, `useVatReport*` lezen `invoices`, `invoice_lines`, `credit_notes`. Allemaal via SELECT met tenant-scope → accountant houdt leesrechten ✅. Geen breakage verwacht.
- **Restore-only situatie** (huidige user-bug): policies veranderen geen owner-rechten; restore blijft beschikbaar voor platform_admin via bestaande platform-admin policies.

---

## 6. Voorgestelde sub-volgorde Batch 2A2

1. **2A2a — Tabellen-RLS** (één migration):
   - DROP legacy `has_role`-based policies op invoices/quotes/etc.
   - DROP rolloze ALL-policies op proforma/discounts/duplicates/reminders.
   - CREATE drie-policy template per tabel met `has_tenant_role`.
   - Platform-admin policies behouden.
2. **2A2b — Edge-function role-checks**:
   - `process-refund` aanscherpen naar `tenant_admin`.
   - `pos-refund-payment` migreren naar `authenticateRequest` + `requireRole(['tenant_admin'])`.
   - `create-manual-invoice`, `send-invoice-email` → `requireRole(['tenant_admin','staff','accountant'])`.
   - `send-quote-email`, `create-quote-payment-link` → `requireRole(['tenant_admin','staff'])`.
3. **2A2c — Frontend gating** (gepland voor Hoofdstuk 4, niet in 2A2):
   - `useCan` matrix uitbreiden met `credit_note`, `invoice`, `quote`, `payment_reminder` resources.
   - Knoppen en menu-items gaten in CreditNotes/Invoices/Quotes pagina's.

---

## 7. Open beslispunten

- **Mag `accountant` `credit_notes` BEKIJKEN?** → **Ja, read-only.** Consistent met matrix-regel "accountant heeft R op refunds/credit_notes voor factuur-historie". Write blijft `tenant_admin` only.
- **Mag `accountant` `invoices` BEWERKEN?** Voorstel: ja (write incluis), nodig voor correcties tijdens BTW-aangifte. Bevestiging gevraagd.
- **Mag `staff` quotes/proforma versturen?** Voorstel: ja (sales workflow). Bevestiging gevraagd.
- **Cap-feature staff-refunds**: scope voor latere batch (2C?). Tot dan blijft refund-write `tenant_admin` only.
- **`pos-refund-payment` verify_jwt = false** → bewust voor kassapad. Migratie naar `authenticateRequest` (die zelf de JWT valideert) blijft compatible omdat de Authorization-header al wordt meegestuurd; alleen anon-fallback verdwijnt. Bevestigen dat geen ongeauth POS-flow refunds triggert.

---

## 8. Vereiste pre-flight checks vóór 2A2a-migration

- DB-snapshot via Lovable Cloud dashboard.
- Confirm dat `has_tenant_role(uuid, app_role[])` helper bestaat (toegevoegd in 2A0).
- Grep custom frontends (vanxcel, mancini) op directe writes naar `credit_notes`/`invoices`/`quotes`.
- Test-plan: tenant_admin/staff/accountant/warehouse/viewer per tabel × per action; service-role webhook-paden ongewijzigd; Stripe refund-flow end-to-end.

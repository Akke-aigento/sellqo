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
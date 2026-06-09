# Fase 2 — Eindrapport (afgesloten 2026-06-09)

## Scope

- Hoofdstuk 0 t/m 5 conform `docs/sellqo-fase2-masterplan.md`.
- Tijdsbestek: start 2026-06-03 (recon + foundation) → eind 2026-06-09
  (cleanup post-merge).
- Doel: per-rol RLS + per-rol edge-function checks + frontend gating over
  de volledige SellQo-codebase, inclusief dormant tabellen.

## Uitrol-statistiek

| Cluster | Tabellen RLS herzien | Policies (DROP + CREATE, indicatief) | Edge functions gehard |
|---|---|---|---|
| 2A Orders/Fiscaal | 14 | ~120 | 8 |
| 2B Integrations/Customers | 18 | ~140 | 11 |
| 2C Catalog/Marketing/CMS | 27 | ~220 | 14 |
| 2D Reports/Settings/Billing | 16 | ~95 | 9 |
| 2E POS | 8 | ~40 | 3 |
| 2F Dormant lockdown (i+ii+iii+iv) | 19 | ~80 | 0 |
| H4 Frontend gating | n.v.t. | n.v.t. | n.v.t. |
| H5 Cleanup | 0 (2 helpers gedropt) | 0 | 0 |
| **Totaal** | **~102 tabellen** | **~695 policies** | **~45 edge functions** |

Cijfers afgeleid van de paper trail in `docs/role-audit.md` (per-batch
secties). De DB telt 881 RLS-policies in `public` na afsluiting.

## Permissie-matrix dekking

- 6 applicatie-rollen (`platform_admin`, `tenant_admin`, `staff`,
  `accountant`, `warehouse`, `marketing`, `viewer`) + `service_role` bypass.
- Matrix-bron: `src/hooks/useCan.ts` (synced met masterplan Hoofdstuk 2).
- Coverage per resource: zie `docs/h4e-matrix-coverage.md` (38 resources,
  100% met minstens één gating-point, deelcoverage gedocumenteerd).
- Route coverage: zie `docs/h4e-route-coverage.md` (77 admin-routes,
  37 met `RouteGuard`, 40 bewust open met motivatie).

## Sanity-checks eindverificatie (2026-06-09)

- **Tenant-blind policies overgebleven:** 54 hits — allemaal verklaarbaar:
  - `*_service_role_all` (FOR ALL TO service_role USING(true)) — bewust
  - Public read-policies op storefront-tabellen (`products`,
    `product_variants`, `categories`, `homepage_sections`, `storefront_pages`,
    `legal_pages`, `sellqo_legal_pages`, `pricing_plans`, `themes`,
    `vat_regimes`, `external_reviews`, `tenant_domains`, `doc_articles`,
    `doc_categories`, `product_bundle_items`, `product_categories`,
    `product_variant_options`) — bewust open voor anonieme storefront
  - `team_invitations` user-self via `auth.uid()` — bewust
  - `channel_field_mappings` — read voor alle ingelogde users
- **Legacy `has_role(uuid, app_role)` policy-calls:** 0
- **RLS-disabled public-tabellen:** 0
- **`useCan` matrix-onbekende resources:** 0 (alle 38 resources gedefinieerd)
- **Route coverage:** 37/77 geguard, 40 bewust open

## Legacy helpers gedropt (H5)

- `public.has_role(uuid, app_role)` — vervangen door `has_tenant_role`
- `public.get_user_role(uuid)` — niet meer gebruikt
- Behouden: `has_tenant_role`, `get_user_tenant_ids` (zero + uuid arg),
  `is_platform_admin(uuid)` — bron-van-waarheid voor alle RLS-policies.

## Backlog na Fase 2 (zie `docs/fase2-backlog.md`)

- 2C1c — anon-INSERT `external_reviews` via edge function (rate-limited)
- 2C1d — column-masking `cost_price` op `products`/`product_variants`
- 2C2d — column-masking ad-budgets + `tracking_events` tenant-binding
- Marketplace customer-creation (architecturale beslissing)
- `bundle_products` legacy onderzoek
- Security-hardening na pentest: `.env` cleanup (acuut), CI-check edge
  functions zonder `requireRole`, audit-log compleetheidssweep

## Volgende fases

- Geen Fase 3+ binnen deze masterplan-scope.
- Aanbevolen volgorde: (1) `.env` cleanup, (2) pentest, (3) backlog
  opname per item.

## Lessons learned uit deze sprint

- Cross-tenant `has_role`-sweep raakte 20+ tabellen buiten de initiële
  customer-cluster scope — losse `EXISTS` joins via `customers`
  gestandaardiseerd naar `get_user_tenant_ids(auth.uid())`.
- 5 viewer-write-lekken gevonden in 2D-recon (`vat_returns`,
  `subscriptions`, `subscription_*`, `tenant_subscriptions`, en
  `platform_invoices`) — allemaal geherclassificeerd naar tenant_admin/
  accountant-only writes.
- Kritiek lek in `platform-gift-month` edge function (ontbrekende
  `is_platform_admin` check) gevonden in 2D-recon en gefixt.
- `useCan` multi-tenant rol-leak in H4-5: rollen uit tenant A werden
  meegeteld in tenant B-context. Opgelost door `roles` te filteren op
  `currentTenant?.id` voordat de matrix wordt gecheckt.
- Recon-eerst-discipline werkte: per cluster eerst inventaris → review
  → migration, zonder big-bang.
- Dormant tabellen (2F) bleken voor 80% al gehard via eerdere clusters.
  Het 2F-recon document fungeert als single source of truth voor wat
  intentioneel niet aangeraakt is.

---

**Status:** Fase 2 volledig afgesloten. Geen openstaande hoofdstukken.
Backlog items zijn los oppakbaar.

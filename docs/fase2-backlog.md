# Fase 2 backlog — geparkeerd na 2026-06-08

## 2C1c — Anon-INSERT external_reviews via edge function

- Doel: klant kan review insturen zonder login
- Aanpak: aparte edge function met rate-limit + spam-check + tenant-token 
  binding (NIET anon-INSERT policy op tabel)
- Effort: ~1-2u

## 2C1d — Column-masking cost_price

- Tabellen: products + product_variants (cost_price kolom)
- Doel: warehouse + marketing + viewer mogen kostprijs niet zien
- Aanpak: views products_safe + product_variants_safe zonder cost_price; 
  refactor frontend om views te lezen ipv basis-tabel
- Effort: ~3-4u

## 2C2d — Column-masking ad-budgets + tracking_events audit

- ads-campaigns daily_budget/total_budget: alleen tenant_admin muteren
- tracking_events anon-INSERT moet via tenant-token binding
- per-channel WRITE restricties op ad_creatives indien needed
- Effort: ~2-3u

## Marketplace customer-creation (architecturale beslissing)

- sync-bol-orders + sync-shopify-orders maken geen customer-records
- Beslissing: maken we marketplace customers? Of accepteren we inline 
  customer-data in orders?
- Niet urgent — eigen webshop customer-flow werkt correct na vandaag

## Bundle_products legacy onderzoek

- Recon §7 (Fase 2C1) noteerde mogelijk deprecated
- Onderzoeken: bestaan er nog actieve bundles in productie?

## Security-hardening na pentest

- .env cleanup (secrets in repo) — ACUTE
- CI-check op edge functions zonder requireRole
- Audit-log compleetheid sweep — alle admin-acties moeten loggen
- Pentest planning

## Volgende fase

- Hoofdstuk 4 — Frontend gating: useCan/PermissionGate uitrol over admin-UI
- Hoofdstuk 5 — Cleanup (post-merge): drop legacy helpers, archive old 
  policies, verify pg_policies tegen masterplan-matrix

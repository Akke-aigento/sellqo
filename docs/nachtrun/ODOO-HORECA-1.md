# ODOO-HORECA-1 — Odoo-boekhoudkoppeling ook in Horeca Big — 2 november 2026

Batch VERVOLG-1 (onderdeel A), branch `vervolg-1`. Niet gepusht, niet gedeployed, geen DB-writes (enkel read-only natrek).

Plan-scope: spoor horeca; feature-sleutel `odoo_sync` (bestaat); prijzenpagina-label `landing.pricing.feat_odoo`
(bestaat, verschijnt automatisch via `planLines.ts`); grandfathering niet nodig (gaat aan, niet uit; live staat er
vandaag geen enkele winkel op `horeca_big`).

## Root cause
- `pricing_plans.features` (jsonb): `odoo_sync` = `false` voor `horeca` en `horeca_big`, `true` voor `pro`/`enterprise`
  (live nagetrokken). Een horecazaak kon Odoo dus in geen enkel horecaplan krijgen, terwijl KASSA-ODOO-1 (Z-rapporten
  naar Odoo) net voor horeca gebouwd is.
- Gating: enkel client-side, `checkFeature('odoo_sync')` in `src/components/admin/accounting/OdooAccountingCard.tsx:20`
  (`useUsageLimits`: `features[key] === true` of een actieve add-on). Geen databankfunctie leest
  `features->'odoo_sync'` (enkel `watchtower_health_snapshot` gebruikt de naam als health-sleutel).
- De upgradekaart was hardcoded NL "Beschikbaar op Pro of Enterprise", ook voor horecazaken.

## Uitgevoerd
- `supabase/migrations/20261102080000_odoo_horeca_1.sql` — `jsonb_set(features, '{odoo_sync}', 'true')` enkel voor
  `id = 'horeca_big'`, enkel als de waarde nog niet `true` is; vorige features in `ops.odoo_horeca_1_prev_plan`.
- `supabase/migrations/20261102080005_odoo_horeca_1_docs.sql` — helpartikel `boekhoudkoppeling-odoo`: "Vanaf het
  Pro-abonnement" → "Met Pro of Enterprise (webshop) en met Horeca Big" (snapshot + replace, guard op de oude zin).
- `OdooAccountingCard.tsx` — volledig via i18n (`admin.odooCard.*`, 5 talen), datum met `useDateFnsLocale`
  (was hardcoded `nl`), en spoor-bewust via `useTracks().planTrack`: horecaplan → badge + "Beschikbaar op Horeca Big"
  (naam uit `landing.pricing.name_horeca_big`, dus per taal "Hospitality Big", "Horeca Grand", "Gastro Groß",
  "Заклад Великий"); andere plannen → "Pro / Enterprise". Bestaande kaart hergebruikt, geen nieuw component.
- Prijzenpagina/onboarding: geen codewijziging nodig; `planLines.ts` toont `feat_odoo` ("Odoo-boekhouding, met Peppol")
  zodra de vlag aan staat.
- Claim-audit (`sellqo-claim-audit`): twee claims die "enkel Pro" zeiden, bijgewerkt in de 5 `landing.*.json`:
  `landing.faq.items[10].a` ("(vanaf Pro)" → "(vanaf Pro, of Horeca Big)"), `landing.core.invoices_text`
  ("(Pro)" → "(Pro, Enterprise of Horeca Big)"), en `landing.faq.items[3].a` (Horeca Big: "… en de
  Odoo-boekhoudkoppeling"). Bron: `pricing_plans.horeca_big.features.odoo_sync` + gating in `OdooAccountingCard`.
- Harnas: nieuw scenario `scripts/harness/scenarios/odoo-kaart` (vier standen, nl + en, overloopcheck).

## Security-keuzes
Geen RLS, policies of grants geraakt. `pricing_plans` wordt enkel door de migratie geschreven. De ops-snapshot is
`revoke all` voor anon/authenticated.

## Gedeelde-paden-waarschuwing
`pricing_plans` voedt `/pricing`, onboarding, de sporen en `checkFeature` voor elke winkel; enkel de rij `horeca_big`
en enkel de sleutel `odoo_sync` verandert. Geen storefront-api, geen custom frontends.

## Verificatie
- Migraties 2× op lokale PostgreSQL 16 (nagebootste `pricing_plans`/`doc_articles`): exit 0, tweede run raakt niets,
  andere plannen ongemoeid, snapshot met `odoo_sync=false`.
- Live read-only: helpartikelzin precies 1×; geen winkel op `horeca_big`.
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0. `node scripts/i18n-parity.mjs` → exit 0 (11223 keys × 5).
  `check-i18n-used-keys` → 0. `verify-lint-baseline` → 1457 → 1456. `check-dead-buttons` → 0.
- Harnas `odoo-kaart` 390/1280 (+ en) → exit 0, geen overloop; screenshots bekeken.
- Na uitrol: `select features->'odoo_sync' from pricing_plans where id = 'horeca_big';` = `true`.

## Bewust ongemoeid / Vervolg
- `horeca_big.features.peppol` blijft `false`: dat verbergt enkel Instellingen › Peppol (eigen Peppol-ID voor de
  UBL van SellQo-facturen). Peppol-verzending via Odoo (`peppol_send_enabled` in de Odoo-instellingen) is niet aan die
  vlag gebonden, dus de claim "met Peppol" klopt. Wil Akke de Peppol-sectie ook in Horeca Big: aparte beslissing.
- Events-plannen zien nog "Pro / Enterprise" (er bestaat geen eventsplan met Odoo).
- Helpartikel `abonnement-beheren` somt enkel Free/Starter/Pro/Enterprise op (geen horeca-/eventsplannen): verouderd,
  niet in deze batch.
- De link "Bekijk abonnementen" gaat zoals voorheen naar `/pricing`.

## Changelog (NL)
**Odoo-boekhouding nu ook in Horeca Big**
Heb je Horeca Big, dan koppel je voortaan je eigen Odoo-boekhouding: facturen en creditnota's gaan automatisch naar Odoo, en als je dat aanzet ook de Z-rapporten van je kassa. Zit je op Horeca Small, dan zie je bij Boekhouding dat de koppeling in Horeca Big zit.

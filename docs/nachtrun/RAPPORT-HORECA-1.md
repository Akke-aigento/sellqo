## RAPPORT-HORECA-1 — Rapporten › Horeca: Z-archief, CSV voor de boekhouder en analyse — 1 november 2026

Branch `night-rapport` (nachtrun); niets gepusht, gedeployed of live gedraaid.

**Root cause** — Z-rapporten waren enkel in de kassa-app te zien (`src/kassa/app/screens/ReportsScreen.tsx`, `recentReports()` in `reportActions.ts`, laatste 30). In beheer (`/admin/reports`, `src/pages/admin/Reports.tsx`) bestond niets voor horeca: geen archief, geen export, geen analyse (productmix, uren, medewerkers, gemiddelde besteding).

**Uitgevoerd**
- Migratie `supabase/migrations/20261101230620_rapport_horeca_1.sql`: één RPC `horeca_analysis(p_tenant_id, p_from_day date, p_to_day date)` (security definer, `has_tenant_role` tenant_admin/accountant, enkel lezen). Periode = bedrijfsdagen via `kassa_day_start` (afkapuur zoals de Z). Levert totalen (omzet, tickets, rekeningen, couverts, fooien), productmix (verstuurde lijnen van afgerekende rekeningen via `horeca_line_total` + artikels van de klassieke kassa), per uur (Brusselse klok), per dag, per medewerker.
- Migratie `20261101230630_rapport_horeca_1_docs.sql`: nieuw helpartikel `horeca-rapporten` (context `/admin/reports`).
- `src/pages/admin/Reports.tsx`: tabs nu deeplinkbaar (`?tab=aangiftes|boekhouding|horeca`), tab **Horeca** enkel met horecaspoor. Bestaande tabs ongewijzigd (hun hardcoded NL-teksten bewust niet aangeraakt).
- `src/components/admin/reports/HorecaReportsTab.tsx`: Z-archief (lijst in de pagina-periode, som, openen in iframe + afdrukken/PDF), CSV voor de boekhouder (één regel per Z: totaal, maatstaf en btw per tarief, per betaalwijze, afronding, fooien, kas in/uit, kortingen, annuleringen), analyse (4 tegels, toppers top 10 + productmix-CSV, omzet per uur, tabel per medewerker).
- `src/hooks/useHorecaReports.ts` (Z via RLS op `kassa_reports`, analyse via RPC), `src/lib/horecaReports.ts` (+ test).
- **Hergebruik reportHtml**: `src/kassa/app/reportHtml.ts` wordt rechtstreeks geïmporteerd (puur, geen kopie); `src/kassa/` niet gewijzigd. Enkel de labelopbouw (±20 regels `t('kassa.reports.*')`) staat nu twee keer: in `ReportsScreen.tsx` en in `HorecaReportsTab.tsx` (ReportsScreen mocht niet aangeraakt worden). Vervolg: een `reportLabels(t, …)`-helper naast `reportHtml.ts` en beide laten aanroepen (kassa-release).
- i18n nl/en/fr/de/uk (`admin.horecaReports.*`; hergebruik van `kassa.reports.*`).
- Harnas: scenario `rapport-horeca`.

**Eén bron per getal**
- Omzet = `pos_transactions` `status='completed'` en `order_id is null`, som `total` — exact de regel van de cockpit (`src/lib/cockpitRevenue.ts` `toSales`). Horeca-betalingen (`horeca_pay`) krijgen nooit een `order_id`, dus het periodetotaal = de som van de Z-rapporten van die bedrijfsdagen (Z neemt alle completed tickets; enkel klassieke-kassatickets aan een order verschillen, en die zitten al in de orderomzet).
- Fooien = `check_payments.tip_cents` van afgerekende tickets (zoals het Z-rapport). Online fooi (`check_online_payments`) staat in de Z en in de fooienpot van PERSONEEL-2, maar niet in "per medewerker" (geen medewerker gekend).
- Z-cijfers in archief en CSV komen ongewijzigd uit `kassa_reports.data`.

**Security-keuzes** — `horeca_analysis`: security definer met `has_tenant_role(tenant_admin, accountant)`; staff en andere zaken geweigerd (getest). Z-archief leest `kassa_reports` via de bestaande RLS (leden van de zaak). Geen schrijfacties.

**Gedeelde-paden-waarschuwing** — Geen storefront-contract, gedeelde tabel of edge function geraakt. `fiscal_events` wordt niet gelezen door de analyse (niet nodig; Z-cijfers zitten in `kassa_reports`).

**Verificatie**
- Lokale PG16 (`scripts/gks/sql/run.sh`): `test_personeel2.sql` dekt de analyse (omzet 32,00 = tafel 26 + klassiek 6, ticket met order_id en voided ticket tellen niet, couverts 2, fooi 1,50, productmix samengevoegd over tafel + klassieke kassa per product, geannuleerde lijn niet, som per uur = omzet, 2 medewerkers; staff/vreemde zaak geweigerd; boekhouder ziet de analyse maar niet de uren).
- `npx vitest run src/lib/horecaReports.test.ts`: 3/3 (nieuw testbestand → toevoegen aan de Vitest-stap in CI).
- i18n-parity, check-i18n-used-keys, check-dead-buttons: exit 0. eslint gewijzigde bestanden: 0 fouten.
- Harnas `rapport-horeca` 390/1280: geen horizontale overloop (eerst 158 px op 390 — gefixt met `min-w-0`), Z-dialoog bekeken.
- `tsc --noEmit -p tsconfig.app.json`: exit 2 met 27 fouten, alle in bestanden die deze batch niet raakt (useOrders, useInvoices, PlatformBlog, … — `RejectExcessProperties`, wijst op een afwijkende supabase-js in de gedeelde node_modules van de sandbox); 0 fouten in de gewijzigde of nieuwe bestanden. Hoofdsessie: opnieuw draaien op de samengevoegde branch. `npm run build` niet gedraaid (geheugen: tsc werd 2× door de OOM-killer gestopt).

**Bewust ongemoeid / Vervolg**
- Geen ondertekend (fiscaal) rapport in de beheer-weergave: dat vraagt de vestigingsgegevens van de kassa; de dialoog vermeldt dat in een GKS-zaak het ondertekende kassarapport officieel is.
- Analyse per dag zit al in de RPC (`days`) maar wordt nog niet getoond.
- Uitrol: migratie 230620 → frontend publish → docs 230630.

### Changelog (NL)
**Je horecarapporten in SellQo-beheer** — Onder Rapporten › Horeca vind je al je Z-rapporten terug om af te drukken of als CSV aan je boekhouder te geven. Je ziet er ook je toppers, je omzet per uur en per medewerker, en wat een rekening en een couvert gemiddeld opbrengen.

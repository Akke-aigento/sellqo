# SellQo — Volledige pagina-audit · Runbook v2 (autonome motor)

**Locatie in repo:** `docs/audit/RUNBOOK.md` — dit bestand is de bron van waarheid voor de audit. CC leest dit vóór elke audit-sessie.

**Doel:** elke pagina van SellQo doorlichten — elke knop, weergave, query, letter, viewport, mail en edge function — en per pagina een geverifieerde defectenlijst opleveren. Geen steekproef, geen aannames.

**Architectuur — 3 lagen:**
- **Laag 1 (CC, statisch):** code-audit per pagina op de 7 assen (§2). Volledig autonoom, 0 Lovable-credits.
- **Laag 2 (CC, visueel):** Playwright headless tegen een lokale preview-build; 3 viewports, console-errors, failed requests, mail-template-renders. Volledig autonoom.
- **Laag 3 (chat-Claude, live):** natrek van alle 🟡-items via de Lovable-connector (`query_database`, gedragsvingerafdrukken). Buiten CC's bereik.

**Rolverdeling:** CC audit → chat-Claude verifieert 🟡 → Akke krijgt één fixplan per batch → expliciete go → fixbatch. Fixes NOOIT tijdens de audit-run zelf.

---

## 1 · SHA-pinning (eerst, altijd)

Bij kickoff van de audit (en bij elke hervatting na een fixbatch):

```bash
git ls-remote https://github.com/Akke-aigento/sellqo.git main
```

Noteer de SHA in `docs/audit/AUDIT_STATE.md` als `pinned_sha`. De **hele audit draait tegen die SHA** (checkout op die commit). Fixes komen later op een aparte branch; na elke gemergde fixbatch wordt de betrokken pagina éénmalig hergeverifieerd tegen de nieuwe main en de pin bijgewerkt. Zo verschuift het doel nooit onder de audit.

`AUDIT_STATE.md` houdt ook bij: welke batches/pagina's klaar zijn, welke 🟡's open staan, laatste run-datum. Dit is het geheugen tussen sessies — CC leest dit als eerste, altijd.

---

## 2 · De audit-checklist (vast, per pagina) — 7 assen

### A. Knoppen & acties
- Elke knop: roept de `onClick`/handler écht iets aan, of is 'ie dood?
- Roept 'ie een edge function aan → bestaat die functie in de repo, matchen de body-params exact (functie verwacht X, frontend stuurt X)? Live-gedeployed = 🟡 voor laag 3.
- Roept 'ie een mutatie/RPC aan → bestaat de RPC (repo-grep; live = 🟡), raakt de mutatie plausibele kolommen (live-schema = 🟡)?
- Doet de knop iets zinvols, of is 'ie een no-op (bv. navigeren naar de tab waar je al bent)?
- Klopt het label met wat 'ie doet?

### B. Weergaven & waarden
- Elke getoonde waarde: mapt 'ie naar een DB-kolom? Kolom-bestaan + waarde-klopt = 🟡 (laag 3).
- Statuslabels: dekt de label-logica alle statuswaarden die de code elders schrijft?
- Lege staten: is "0 / geen" écht leeg, of een verborgen laadfout (error-pad dat stil naar empty-state valt)?

### C. Queries & data-laag
- Elke `.select()` met embed (`table(*)`): meerdere FK's mogelijk tussen die tabellen? Statisch verdacht op basis van repo-migraties = 🟡 met exacte `pg_constraint`-query erbij.
- `.maybeSingle()` op iets dat >1 rij kan geven → throwt stil.
- RLS: draait de query onder de juiste rol? Policy-check = 🟡 met `pg_policies`-query.
- Ontbrekende `.limit()` op event/log-tabellen; client-side aggregatie van ongelimiteerde rijen.

### D. Edge functions achter de pagina
- Bestaat elke aangeroepen functie in de repo? Live-gedeployed = 🟡 (gedragsvingerafdruk-opdracht uitschrijven).
- Verkeerde-kolom-klasse: leest de functie kolommen die de migraties niet kennen? Twijfel = 🟡 met `information_schema.columns`-query.
- Auth: klopt de rol-check (platform_admin-bypass waar bedoeld)?

### E. i18n & tekst
- Missende keys → i18next toont rauw pad. `fallbackLng: 'nl'` toont stil NL bij missende niet-NL-key.
- 5 app-talen (NL/EN/FR/DE/UK) — draai `scripts/i18n-parity.mjs` éénmalig per run, map failures naar pagina's.
- E-mail-i18n is apart: `_shared/tenantEmailI18n.ts`, 4 talen (nl/en/fr/de, GÉÉN uk), buiten tsc en parity — handmatig greppen op key-gebruik vs. key-definitie.
- Platform-adminschermen zijn hardcoded NL — noteren, niet fixen.
- Typo's, verkeerde termen, inconsistente labels.

### F. Dode / nutteloze elementen
- Knoppen/kaarten/velden die niks doen of dubbel zijn.
- Geïmporteerde-maar-ongebruikte acties: check vóór je 'm als cruft noteert of het een verborgen bedoelde actie is (Stripe-ontkoppel-dialog-les).

### G. Prestatie & gedrag
- Onnodige refetch/remount (Radix tab-remount zonder `forceMount` + `visited`).
- N+1 (per-rij losse queries); blokkerende laad-waterfalls.

---

## 3 · Laag 2 — Visuele audit (Playwright)

**Setup (eenmalig per sessie):**
```bash
npm ci && npm run build
npx playwright install chromium --with-deps
# serveer de build lokaal (vite preview of serve op dist/)
```

**Per route, per viewport (375×812 / 768×1024 / 1440×900):**
1. Navigeer, wacht op network-idle.
2. Vang: console-errors, console-warnings, failed requests (4xx/5xx/CORS), pageerrors.
3. Detecteer horizontale overflow: `document.documentElement.scrollWidth > clientWidth`.
4. Detecteer rauwe i18n-paden in de DOM (regex op `\b[a-z]+\.[a-z_]+\.[a-z_.]+\b` in zichtbare tekst, gefilterd op bekende namespaces).
5. Detecteer lege verdachte containers (kaarten/tabellen met 0 children waar de code data verwacht).
6. Screenshot → `docs/audit/screenshots/<route-slug>/<viewport>.png`.

**Beperkingen (eerlijk noteren, niet omheen hacken):**
- Geen live-DB in de sandbox → veel pagina's renderen met lege/error-states. Dat is óók informatie (crasht de pagina op lege data?), maar data-afhankelijke weergaven blijven 🟡.
- Auth-gated routes: render wat kan; wat een echte sessie vraagt → 🟡 "handmatige spotcheck" op de lijst voor Akke (korte lijst, geen marathon).
- Mail-templates: render alle templates uit `_shared/` per taal (nl/en/fr/de) naar HTML-bestanden in `docs/audit/mail-renders/`, valideer op missende keys en kapotte interpolaties. NOOIT echt versturen.

---

## 4 · Rapportformaat (vast, per pagina)

Eén bestand per pagina: `docs/audit/reports/<batch>-<route-slug>.md`

```markdown
# Audit: /admin/orders — Orders-overzicht
Pinned SHA: <sha> · Datum: <datum> · Assen: A–G · Viewports: ✅/–

## Verdict-samenvatting
🔴 3 · 🟡 2 · 🟢 12

## Bevindingen
### 🔴 A1 — "Exporteer"-knop dood
- **Wat:** onClick roept `handleExport` aan die niet bestaat / leeg is.
- **Waar:** `src/pages/admin/Orders.tsx:142`
- **Root cause:** handler verwijderd in commit X, knop bleef staan.
- **Fixrichting:** <één zin>. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 C2 — Embed orders→customers mogelijk ambigu
- **Vermoeden:** twee FK's (customer_id + guest_customer_id?)
- **Natrek voor laag 3:** `SELECT ... FROM pg_constraint WHERE ...` (exacte query)

### 🟢 (compact lijstje van wat geverifieerd correct is)
```

Regels:
- Elke 🔴 heeft bestand+regel + root cause. Geen root cause = geen 🔴, dan 🟡.
- Elke 🟡 heeft de **exacte natrek-opdracht** (SQL of vingerafdruk) uitgeschreven — laag 3 mag copy-pasten.
- Fixrichting is één zin, géén implementatie. Fixes komen pas na Akke's go.

---

## 5 · Werkvolgorde

**Run 0 — Visuele quick-scan (eerst):** laag 2 over ALLE routes in één run. Output: `docs/audit/reports/00-visual-quickscan.md` met de zichtbaarste rommel (overflow, console-errors, rauwe i18n-paden, crashes op lege data) gegroepeerd per batch-gebied.

**Daarna batch 1 t/m 10** (laag 1 + gerichte laag-2-verdieping per pagina), volgorde uit §6.

---

## 6 · Pagina-inventaris (batchvolgorde)

1. **Storefront** (klant-facing, hoogste impact): `/shop/:tenantSlug`, `/product/:productSlug`, `/products`, `/cart`, `/checkout`, `/checkout/qr-betaling`, `/wishlist`, `/order/:orderId`, `/page/:pageSlug`, `/legal/:pageType`. Raakt storefront-api-contract van de 5 custom frontends — strikt additief denken.
2. **Betaal- & onboarding-flows:** `/betaling/machtiging/:token`, `/actie/:token` (+ `/gelukt`), `/pay/success`, `/pay/cancelled`, `/invite/:token`. *(`/actie` net gefixt — herverifieer na deploy.)*
3. **Admin: Orders & facturatie:** orders, order-detail, discounts, invoices, quotes (+detail/edit).
4. **Admin: Producten & voorraad:** products, product-new/-edit, categories, suppliers, purchase-orders, supplier-documents, returns (+detail), fulfillment, shipping, import, reports (+stock).
5. **Admin: Klanten & POS:** customers (+detail), pos (+terminals), checkin, badges, events (+detail).
6. **Admin: Marketing, ads & promoties:** marketing (+ai/ai-center/seo/translations/campaigns), ads (+ai/bolcom/products/keywords/search-terms/campaigns), promotions (alle subpagina's).
7. **Admin: Overig & instellingen:** dashboard, analytics, inbox/messages, notifications, connect (+conflicts/detail), storefront-editor, settings, billing, help, field-mappings.
8. **Platform-admin:** dashboard, tenants/:tenantId *(al geaudit — zie §7)*, billing, payments, coupons, blog, changelog, docs, feedback, support, health, legal.
9. **Publieke marketingsite:** landing, pricing, about, contact, blog (+slug), careers, partners, integrations, help, security (+slug), changelog, status, api-docs, alle legal-pagina's.
10. **Auth:** auth, reset-password, no-access.

---

## 7 · Al gedaan — niet opnieuw doen

**`platform/tenants/:tenantId`** volledig geaudit (1 sep 2026). Open fixes: onboarding-link cross-origin-302, ambigue plan-embed (`plan_id`+`pending_plan_id`), "Activeer abonnement"-no-op. Herverifieer éénmalig ná de fix-deploy, dan afvinken in `AUDIT_STATE.md`.

**Recent gefixt & live (context):** billing-datum/geld-hardening, storefront-api reviews-500 (`author_name`), help-i18n-key, tenant-tabs keep-alive.

---

## 8 · Bekende bug-patronen (actief naar zoeken, elke pagina)

1. **Ambigue PostgREST-embed** — dubbele FK → `table(*)` faalt stil → lege weergave. Fix-patroon: `table!fk_naam(*)`.
2. **Cross-origin 302 via fetch** — CORS blokkeert redirect. Fix-patroon: JSON terug + `window.location.href`.
3. **Verkeerde-kolom-param** — code leest niet-bestaande kolom (`reviewer_name`→`author_name`-klasse).
4. **Service-role-blindheid** — sandbox ziet wat RLS de gebruiker onthoudt, of andersom.
5. **No-op knop** — label ↔ gedrag laten kloppen.
6. **Onbounded ophaal + client-side aggregatie** op event/usage-tabellen.
7. **Tab-remount zonder keep-alive** (`forceMount` + `visited`-patroon).

---

## 9 · Verificatie-discipline (niet-onderhandelbaar)

- **Nooit agent-self-report vertrouwen.** Migratie → `query_database` op de echte tabel. Edge-functie → neveneffectvrije gedragsvingerafdruk. Code → GitHub raw.
- **Lovable synct edge functions NIET automatisch van main** — expliciete deploy + vingerafdruk.
- **CC ziet verse Lovable-commits niet automatisch** — `git fetch`/verse clone vóór recon; `git ls-remote` + raw is de bron.
- **Geen destructieve tests op productie.** Mutaties die mails/Stripe/data raken: structureel verifiëren, of enkel op SellQo Speeltuin (`bc18b2e3`) / Demo Bakkerij (`is_demo=true`).
- **De 5 custom frontends** (VanXcel, Mancini Milano, Loveke, Astra Sleep, Zona Dorata) mogen NOOIT breken — strikt additief, blob-hash-check op frozen paths bij elke fixbatch.
- **Fixes alleen ná expliciete go van Akke.** De audit-run zelf wijzigt géén productcode — enkel `docs/audit/**`.

---

## 10 · Handige constanten

- SellQo-core: `9932a7fe-43a1-42de-9c64-168968599600` · Supabase ref `gczmfcabnoofnmfpzeop` · GitHub `Akke-aigento/sellqo` · workspace `8fa9AQcZxxoglV7BaRsZ`
- Testtenants: SellQo Speeltuin `bc18b2e3`, Demo Bakkerij (`is_demo=true`)
- Akke platform_admin: `be6f2a43-0002-47d1-b066-061c5181c70a` (info@sellqo.app)
- Split: CC = statisch + visueel + rapporten (0 credits) · connector = live-natrek, deploys · GitHub→Lovable-sync gratis, alleen agent-acties kosten credits

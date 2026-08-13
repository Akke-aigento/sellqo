# Fase 2 backlog — geparkeerd na afsluiting 2026-06-09

> Fase 2 is volledig afgesloten — zie `docs/fase2-eindrapport.md`.
> De items hieronder zijn bewust geparkeerd voor losse opname.

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

## Kapotte ?tab= deep-links in edge-functies (geparkeerd 2026-08-12)

Gevonden tijdens WEBSHOP-4. `Settings.tsx:162` leest uitsluitend de
`section`-parameter; `tab` wordt nergens uitgelezen, dus deze links landen
allemaal op "Mijn profiel". De zes frontend-links zijn in commit `7c4442fa`
gerepareerd; deze drie zitten in edge-functies en zijn bewust blijven staan.

| Locatie | Huidig | Zou moeten zijn |
|---|---|---|
| `check-scheduled-notifications/index.ts:226` | `action_url: "/admin/settings?tab=billing"` | `/admin/billing` |
| `create-addon-checkout/index.ts:142` | `success_url: .../admin/settings?tab=billing&addon_success=${addon_type}` | `/admin/billing?addon_success=...` |
| `create-addon-checkout/index.ts:143` | `cancel_url: .../admin/settings?tab=peppol&addon_cancelled=true` | zie hieronder |

**Waarom geparkeerd:** er zijn op dit moment nul actieve add-ons. De eerstvolgende
is SellQo Connect (kanaal-uitbreiding) en die bestaat nog niet. Deze links raken
uitsluitend add-on-flows, dus repareren heeft pas waarde zodra add-ons live gaan.

**Drie punten die bij die reparatie horen:**

1. `cancel_url` hardcodeert `peppol`, terwijl `create-addon-checkout` vijf types
   kent: `peppol`, `pos`, `webshop`, `bol_com`, `whatsapp`. Voor vier van de vijf
   stuurt annuleren de klant naar de verkeerde pagina. Een `return_url` in de
   request-body meesturen is waarschijnlijk de juiste oplossing, maar dat is een
   gedragswijziging en geen linkfix.
2. `addon_success` en `addon_cancelled` worden nergens uitgelezen — er is dus geen
   bevestiging na aankoop. Eigen verbetering.
3. `/admin/billing` zit achter `RouteGuard requireRead="platform_billing"`. Een
   koper zonder dat recht wordt daar geweigerd. Nagaan of dat in de praktijk kan
   voorkomen voordat de success-URL daarheen wijst.

**Ook geparkeerd:** `check-scheduled-notifications` schrijft de URL als `action_url`
in bestaande notificaties. Een fix werkt alleen vooruit; reeds verstuurde
notificaties houden de oude link.

## Custom head scripts vuren nooit op de SellQo-winkel (gevonden 2026-08-13)

`ShopLayout.tsx:133` leest `themeSettings.custom_head_scripts` om tracking- en
meta-tags in de `<head>` te injecteren. Maar `usePublicStorefront` haalt de
theme-instellingen uit de view `tenant_theme_public`, en die view laat precies
twee kolommen weg: `custom_head_scripts` en `storefront_password`.

Gevolg: het veld is in te vullen bij Instellingen → Webshop, maar de scripts
komen nooit in de pagina. Stilzwijgend — er is geen foutmelding.

**Los van WEBSHOP-5A.** De preview-fallback in `usePublicStorefront` selecteert
dezelfde kolomlijst als de view en laat beide kolommen dus ook weg; dat is daar
bewust, omdat de preview anders scripts zou tonen die de gepubliceerde winkel
niet heeft.

**Te beslissen bij het oppakken:** of `custom_head_scripts` in de view hoort
(dan is het een viewwijziging) of dat de winkel dat veld apart moet ophalen voor
tenants die het gezet hebben. De eerste optie is eenvoudiger maar zet
tenant-scripts in een publiek leesbare view; de tweede is preciezer. Raakt geen
custom frontend: die bouwen hun eigen `<head>`.

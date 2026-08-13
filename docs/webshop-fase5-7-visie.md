# WEBSHOP Fase 5-7 — Visie: van basis naar "beter dan Shopify"

**Status:** visie ter kompas — 2026-08-13
**Eigenaar:** Akke · uitvoering via Claude + Lovable / Claude Code
**Voortbouwend op:** `docs/webshop-masterplan.md` (WEBSHOP-1 t/m 4b zijn live op `origin/main`, commit `ffa03d1c`)

---

## 0. De ambitie

Tenants moeten in een fluitje van een cent hun eigen webshop kunnen maken — zo smooth als Shopify, maar beter. "Beter" zit op twee plekken waar SellQo een structurele voorsprong heeft:

1. **AI-first.** Een tenant hoeft niet uit templates te kiezen en alles zelf in te vullen; hij beschrijft z'n zaak en krijgt een werkende, gevulde shop terug. Dit is het marketing-wapen waarmee we klanten lokken.
2. **EU/BE-compliance ingebakken.** BTW, juridische pagina's in 4 talen, VIES/reverse-charge — al gebouwd. Een tenant gaat niet alleen mooi, maar ook compliant live, zonder gedoe.

De volgorde is strategisch: **de basis moet onberispelijk zijn vóór de AI erbovenop komt.** De AI-build genereert secties, content en kleuren op basis van de bestaande bouwstenen. Rammelt die onderlaag, dan bouwt de AI op drijfzand en valt het resultaat tegen bij de eerste aanraking — precies wanneer we het promoten. Basis eerst maakt de AI-build later beter én veiliger.

---

## 1. De eerste wet blijft gelden

Alles uit §0 van `docs/webshop-masterplan.md` blijft onverkort van kracht:

- De vijf custom-frontend tenants (Loveke, VanXcel, Astra Sleep, Mancini, Zona Dorata) merken NIETS van deze reeks.
- Strikt additief op gedeelde tabellen (`tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`).
- Edge-functies `storefront-resolve`, `storefront-api`, `checkout-engine` worden niet aangeraakt tenzij een batch-recon additieve uitbreiding aantoont én na apart akkoord.
- Testbedden: SellQo Speeltuin + Demo Bakkerij. Elke batch daar gesmoke-test vóór "klaar".
- Per batch: recon → review → go → implementatie → post-flight verificatie → paper trail.
- Er is nog geen enkele echte tenant die de ingebouwde webshop gebruikt. Dat geeft vrij spel binnen de wet: we kunnen de editor-ervaring herbouwen zonder een live winkel te raken.

---

## 2. Drie fases

### Fase A — WEBSHOP-5: de editor-ervaring onberispelijk

De basis waarop al het andere rust. Volgorde binnen de fase, van fundament naar franje:

1. **Live preview (WYSIWYG) — eerst.** Komt eerst omdat alles erna er beter van wordt: templates bouw je met preview, de sectie-editor voelt pas goed mét preview, en de AI-build toont z'n resultaat via diezelfde preview. De tenant ziet z'n winkel veranderen terwijl hij sleutelt — geen "opslaan en bidden".
2. **Sectie-editor smooth.** Slepen om te herordenen, inline bewerken, secties toe/afvoegen zonder gedoe. Hier meteen de bevestigde relatieve-links-bug fixen: `HeroSection` en `TextImageSection` geven `button_link` rauw aan de router door zonder winkelpad, waardoor een knop met `/products` in de admin-app belandt (genoteerd in `webshop-batch-3-verificatie.md` §5).
3. **Templates pixel-perfect.** Nu functionele seeds; ze moeten eruit zien alsof een designer ze maakte. Met preview + goede editor als gereedschap gaat dit sneller.

### Fase B — WEBSHOP-6: 5-6 perfecte templates

Genoeg branches dat elke tenant een passend startpunt vindt en direct online kan. Voorstel: fashion/streetwear · food/ambacht · elektronica/gadgets · diensten/afspraken · interieur/lifestyle · minimal one-pager. Elk met:

- Echte previews (screenshots op Speeltuin-data, geen nagetekende mockups).
- Kloppende demo-content in de juiste tone-of-voice (NL).
- Meteen goede juridische pagina's in de juiste taal — "in een fluitje van een cent live" betekent óók compliant live.

Let op: dit is de plek waar de i18n-slottaak thuishoort (WEBSHOP-6 uit het oorspronkelijke masterplan). De verweesde `theme.wizard`-vertaalsleutels worden hier opgeruimd.

### Fase C — WEBSHOP-7: de AI-build (het marketing-wapen)

Tenant beschrijft z'n zaak ("handgemaakte kaarsen, warme sfeer, jonge gezinnen") → de AI kiest een passend template, schrijft de teksten, stemt de kleuren af, en genereert desgewenst sfeerbeelden via Nano Banana. Omdat A en B dan af zijn, bouwt de AI op een rotsvaste basis.

**Credits zijn een ontwerpvereiste, geen bijzaak.** De AI-build wordt begrensd in credits per tenant/plan — vanaf regel één, niet achteraf.

**Harde voorwaarde vóór fase C:** het AI-credits-systeem moet gezond zijn. Openstaande punten uit de backlog (ontbrekende maandelijkse reset-cron, race-condition in `use_ai_credits`, tenant-blinde RLS op UPDATE, dode Stripe top-up webhook) moeten dicht vóórdat de AI-build erop gaat leunen. Anders bouwen we een duur marketing-feature op een lekkend kredietsysteem. Dit staat als AI-CRED-1/2 in de backlog en wordt een expliciete prerequisite-batch.

---

## 3. Beeldgeneratie-principes (blijven gelden voor fase C)

Uit de bestaande werkwijze:

- Alleen genuine photographs met achtergrondvervanging voor productbeelden — geen generatieve compositie (gas strut-count fouten, verkeerde constructiedetails).
- Voor sfeer-/hero-beelden in de AI-build is generatie wel acceptabel, want daar gaat het om sfeer, niet om een exacte productweergave. Grens bewaken: nooit een AI-gegenereerd beeld dat zich voordoet als een echt product.
- Geen "handgemaakt"-claims of onverifieerbare marketingtaal (Belgische misleidende handelspraktijken).
- AI-beeldgeneratie loopt via de Lovable AI-gateway / `nano-studio` edge-functie; credits via het bestaande systeem met platform_admin-bypass op edge-niveau.

---

## 4. Eerste stap: editor-recon (geen code)

Vóór er iets aan de live preview gebouwd wordt, een grondige read-only recon van de huidige editor:

- Hoe rendert `HomepageBuilder` nu, en welke sectie-types bestaan er (`SECTION_TYPES`)?
- Wat kan de sectie-editor al (herordenen, bewerken, zichtbaarheid)?
- Waar zit de relatieve-links-bug precies, en wat is de kleinste correcte fix?
- Hoe zwaar is een echte WYSIWYG-preview technisch? Hergebruiken we de bestaande storefront-renderers in een iframe/preview-context, of is er een aparte preview-render nodig?
- Welke storefront-componenten zijn gedeeld met de custom frontends (via storefront-api) en mogen dus niet veranderen?

Op basis daarvan schrijven we `docs/webshop-fase5-masterplan.md` met de batch-opdeling — net zoals bij het oorspronkelijke masterplan. Feiten eerst, dan bouwen.

---

## 5. Open beslispunten

| ID | Vraag | Voorlopig |
|---|---|---|
| OB-F5-1 | WYSIWYG: bestaande renderers in iframe, of aparte preview-render? | Recon beslist |
| OB-F5-2 | Sectie-editor: bestaande HomepageBuilder uitbouwen of herbouwen? | Recon beslist |
| OB-F6-1 | Definitieve 6 branches — akkoord met de voorgestelde lijst? | Ter review |
| OB-F7-1 | AI-build: welk creditsbedrag per generatie / per plan? | Fase C |
| OB-F7-2 | AI-CRED-1/2 als aparte prerequisite-batch vóór fase C? | Voorstel: ja |

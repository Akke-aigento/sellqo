---
name: sellqo-nieuwe-storefront
description: Het opzetten van een nieuwe SellQo custom-frontend-klant — een tenant met een eigen storefront in een eigen Lovable-project. Toepassen zodra een nieuwe klant een eigen webshop krijgt in plaats van het SellQo-theme, of wanneer gevraagd wordt "nieuwe klant aanmelden", "eigen storefront opzetten", "nieuw storefront-project". Bepaalt de volgorde, de mappenstructuur, welke registers bijgewerkt moeten worden, en per stap de SQL of grep die bewijst dat hij klaar is.
---

# Nieuwe SellQo custom-frontend-klant

**Scope: enkel SellQo en zijn storefronts. Bij andere ventures in deze
workspace (yeketi, toog, …): negeer deze skill, tenzij expliciet gevraagd.**

**Een custom-frontend-klant is geen tenant maar een venture.** Hij krijgt een
eigen Lovable-project, een eigen repo, een eigen `CLAUDE.md` en een eigen
role-audit — precies de N4-set uit `nomadix-nieuwe-venture`. Een tenant op het
SellQo-theme krijgt dat níet: dat is een databaserij die `create-tenant` en
`useTemplateSeed` al volledig afhandelen.

Deze skill bestaat omdat die opzet tot nu toe met de hand gebeurde, en dat
aantoonbaar misgaat. Benny Rich (aug 2026) werd geremixt van Zona Dorata, nam
daarbij een kapotte normalizer mee, kwam met een derde architectuur die in geen
enkele skill stond, en stond twee weken buiten de eerste wet in `CLAUDE.md` §1.
Geen daarvan meldde zichzelf.

**De rode draad: remixen kopieert ook de fouten.** Elke stap hieronder heeft
daarom een verificatie. Vink niets af op basis van "dat zal wel goed staan".

---

## S0 — Vaststellen dat het echt een custom frontend wordt

Een eigen storefront is een venture met eigen onderhoud, een eigen deploypad en
een eigen plek in de eerste wet. Het SellQo-theme is bijna altijd het juiste
antwoord. Ga alleen verder als de klant een eigen ontwerp krijgt dat de
theme-renderer niet aankan.

---

## S1 — De tenant in SellQo

1. Tenant aanmaken via de normale weg (`create-tenant`; idempotent, lost
   slug-conflicten zelf op).
2. `tenant_theme_settings.use_custom_frontend = true` zetten.

**Verificatie:**

```sql
select t.name, t.slug, ts.use_custom_frontend
from tenants t
join tenant_theme_settings ts on ts.tenant_id = t.id
where t.slug = '<slug>';
```

Noteer de `tenants.id` — die is straks nodig als `SELLQO_TENANT_ID`.

---

## S2 — Het Lovable-project

Gebruik `remix_project` op een bestaand storefront, of `create_project` voor een
schone start. Kies de architectuur bewust; er zijn er drie en ze zijn niet
uitwisselbaar (zie `sellqo-custom-frontend-runbook`, patroon 3):

| Architectuur | Referentie | Wanneer |
|---|---|---|
| Vite + React, `CheckoutContext` | VanXcel, Loveke | standaard, meeste referentiecode |
| Vite + React, `storefrontApi.ts` | Astra Sleep | idem, andere state-opzet |
| TanStack Start, `createServerFn` | Benny Rich | SSR nodig (per-product OG-tags, SEO) |

**Direct na de remix, vóór al het andere:** haal de merknaam en de assets van de
bron eruit. Benny Rich's projectbeschrijving is anderhalf jaar later nog steeds
de Zona Dorata-prompt.

---

## S3 — De normalizer — de stap die het vaakst stil misgaat

`storefront-api` stuurt per cart-regel:

```js
variant: { title, attribute_values, image_url }
```

De normalizer van het bronproject leest mogelijk andere veldnamen. Bij Benny
Rich waren dat `variant_label ?? variant.name ?? variant.option_values` — geen
van drieën bestaat, dus elke cart-regel kwam zonder variantlabel binnen en de
bag toonde niet wélke maat of kleur besteld was. Dat is stil: geen fout, geen
lege pagina, alleen een ontbrekend woord.

**Verificatie — doe dit met een grep, niet op gevoel:**

```
rg -n 'variant_label|variant_title|variant\?\.|option_values|attribute_values' src/
```

Wat je wilt zien is `variant_title` of `variant?.title`. Zie je `variant_label`,
`variant.name` of `option_values`: repareren, niet omzeilen in presentatie.

---

## S4 — De proxy — twee endpoints, nooit meer

De storefront praat met exact twee SellQo-functies:

| Endpoint | Waarvoor |
|---|---|
| `storefront-api` | producten, categorieën, cart, de hele checkout |
| `storefront-customer-api` | klantaccounts, orders, adressen, wishlist |

Alles gaat via `POST { action, tenant_id, params }` met `X-API-Key`. De hele
checkout loopt via acties (`checkout_start`, `checkout_customer`,
`checkout_address`, `checkout_shipping`, `checkout_complete`) — **niet** via
losse functies als `create-checkout-session`.

Drie harde regels:

- **Nooit vanuit de client naar SellQo.** Alles door de proxy; de API-key is
  server-side.
- **Pin de tenant server-side** — via `SELLQO_TENANT_ID` uit de omgeving, of hard
  in de proxy. Een `X-Tenant-ID`-header van de client mag nooit bepalen wiens
  data je krijgt.
- **De klantsessie hoort in een httpOnly-cookie** die de proxy zet, gestript uit
  de payload naar de browser. Een cookie die client-JS schrijft is niet veiliger
  dan localStorage.

**Verificatie:**

```
rg -n 'functions/v1/' src/ supabase/functions/
```

Alleen `storefront-api` en `storefront-customer-api` mogen voorkomen.

---

## S5 — De repo-scaffold (de "eigen map")

Volg N4 uit `nomadix-nieuwe-venture`:

```
<klant>/
├── CLAUDE.md                      uit templates/CLAUDE.md, geen placeholders
├── .claude/skills/
│   └── <klant>-project/SKILL.md   datamodel, merkregels, harde grenzen
├── docs/role-audit.md             leeg maar aanwezig — batch 1 vult hem
└── docs/screens/                  screenshots per batch
```

Wat in `<klant>-project/SKILL.md` hoort: de merkregels (kleuren, typografie,
wat wel en niet gezegd mag worden), de bevroren bestanden, en de vallen die
specifiek voor deze klant gelden. Wat er níet in hoort: de SellQo-patronen —
die staan in `sellqo-custom-frontend-runbook` en moeten niet gekopieerd worden.

**Let op de claim-hygiëne.** Een nieuwe storefront heeft nog geen verzendmethode,
geen Stripe, geen reviews en geen bestelhistorie. Beloftes over levering,
"veilig betalen"-badges, ratings of "nieuw binnen" zijn op dat moment
aantoonbaar onwaar. Benny Rich heeft daar een expliciete regel voor in zijn
eigen `CLAUDE.md`; neem die over.

---

## S6 — De registers bijwerken (hier ging het mis)

Drie plekken kennen de klant nog niet. Alle drie zijn ze een lijst die stil
veroudert.

- [ ] **`CLAUDE.md` §1 — de eerste wet.** De klant hoort bij de opsomming.
      Controleer met de query eronder; die is leidend, niet de opsomming.
- [ ] **`nomadix-lovable-connector`** — project-ID in de tabel.
- [ ] **`sellqo-custom-frontend-runbook`** — referentietabel, met de architectuur.

**Verificatie:**

```sql
select t.name, t.slug from tenant_theme_settings ts
join tenants t on t.id = ts.tenant_id
where ts.use_custom_frontend is true order by t.name;
```

Elke rij hieruit moet in `CLAUDE.md` §1 staan. Ontbreekt er een, dan valt die
tenant buiten de bescherming van de eerste wet zonder dat iets dat meldt.

---

## S7 — De runbook-checklist

Loop `sellqo-custom-frontend-runbook` af — patroon 1 t/m 5, met de checklist
onderaan die skill. Dat is geen formaliteit: elk patroon daar is betaald met een
productiebug bij een eerdere storefront.

---

## S8 — Verkoopgereedheid

Een storefront die er staat, kan nog niet verkopen. Deze twee zijn geen
codeprobleem maar wel een blokkade, en het is beter ze bij oplevering te
benoemen dan er later achter te komen:

```sql
select t.name, t.stripe_charges_enabled, t.payment_methods_enabled,
       (select count(*) from shipping_methods sm
        where sm.tenant_id = t.id and sm.is_active) as verzend_actief
from tenants t where t.slug = '<slug>';
```

- `stripe_charges_enabled = false` → kaartbetaling dicht. Dit is de
  verantwoordelijkheid van de klant zelf; meld het, los het niet op.
- `verzend_actief = 0` → de checkout strandt op de verzendstap, ongeacht
  betaalmethode.

---

## Checklist

- [ ] S0 — bewust gekozen voor een eigen storefront, niet voor het theme
- [ ] S1 — tenant bestaat, `use_custom_frontend = true`, tenant-id genoteerd
- [ ] S2 — Lovable-project aangemaakt, merk van de bron eruit gehaald
- [ ] S3 — normalizer leest `variant.title`, geverifieerd met grep
- [ ] S4 — alleen `storefront-api` + `storefront-customer-api`, tenant server-side gepind
- [ ] S5 — `CLAUDE.md`, `<klant>-project/SKILL.md`, `docs/role-audit.md` aangemaakt
- [ ] S6 — eerste wet, connector-tabel en runbook-referentietabel bijgewerkt
- [ ] S7 — runbook-patronen 1 t/m 5 afgelopen
- [ ] S8 — verkoopgereedheid nagekeken en gerapporteerd

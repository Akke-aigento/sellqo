# AI Credits — Recon Rapport

Datum: 2026-06-11
Scope: read-only deepdive. Geen wijzigingen in code of DB.

---

## 1. Schema & Data

### 1.1 `tenant_ai_credits` (1 rij per tenant, UNIQUE op `tenant_id`)

| Kolom | Type | Betekenis (intended) |
|---|---|---|
| `id` | uuid PK | — |
| `tenant_id` | uuid, UNIQUE, FK tenants | Eigenaar |
| `credits_total` | int | **Maandtegoed** uit `pricing_plans.ai_credits_monthly`. Wordt bij elke reset overschreven. |
| `credits_used` | int | Cumulatief verbruik in de huidige periode. Reset naar 0. |
| `credits_purchased` | int | Bijgekochte credits (top-up). Vervalt NIET bij reset (correct). |
| `credits_reset_at` | timestamptz | Wanneer de volgende maand-reset moet draaien. |
| `last_purchase_at` | timestamptz | Laatste top-up tijd. |
| `stripe_customer_id` | text | Niet gevuld in productie. |
| `created_at` / `updated_at` | timestamptz | — |

Beschikbaar saldo = `credits_total + credits_purchased − credits_used`
(zie `useAICredits.ts` en `use_ai_credits()` RPC). Gevolg: één teller (`credits_used`) trekt af van zowel maand- als top-up-pot — bij reset wordt `credits_used` op 0 gezet en daarmee verdwijnt ook impliciet top-up-consumptie. Bij normaal gebruik geen probleem; bij overschrijding maandtegoed onnauwkeurig.

### 1.2 `ai_credit_purchases` (Stripe top-ups)

`tenant_id, stripe_session_id, stripe_payment_intent_id, credits_amount, price_paid, currency='EUR', status('pending'|...), created_at, completed_at`.

RLS: alleen SELECT voor tenant-leden. Geen INSERT/UPDATE policy → schrijven via service-role — correct.

**Productiedata:** `count(*) = 0`. Niemand heeft ooit succesvol credits gekocht via Stripe Checkout, óf de records worden niet aangemaakt (zie §1.5).

### 1.3 `ai_usage_log`

Per AI-call: `feature, credits_used, model_used, input_tokens, output_tokens, prompt_summary, result_summary, metadata, created_at`.

RLS: tenant-leden SELECT + INSERT, service_role INSERT.
Alleen de 5-arg overload van `use_ai_credits` schrijft een log; de 2-arg variant niet. Bijna alle callers gebruiken 2-arg → telemetrie is incompleet.

Inhoud productie:

| feature | calls | sum credits_used |
|---|---:|---:|
| product_field_assistant | 54 | 61 |
| reply_suggestion | 18 | 18 |
| seo_analysis | 8 | 16 |
| seo_generate_meta_title | 3 | 38 |
| seo_generate_meta_description | 2 | 3 |
| image_generation | 2 | 8 |
| admin_adjustment | 1 | −200 |
| help_assistant | 1 | 1 |

### 1.4 `tenant_ai_credits` rijen (7 rijen voor 8 tenants — 1 tenant heeft geen rij)

| tenant (kort) | total | used | purchased | reset_at | status |
|---|---:|---:|---:|---|---|
| 6086ee0c… | 10 | 0 | 0 | 2026-02-20 | VERLOPEN |
| d03c63fe… | 10 | 10 | 0 | 2026-02-27 | VERLOPEN + leeg |
| 54f6b480… (VanXcel) | 210 | 135 | 200 | 2026-02-28 | VERLOPEN |
| 1671a91c… | 10 | 4 | 0 | 2026-03-23 | VERLOPEN |
| 2606c5b9… (Mancini) | 10 | 8 | 0 | 2026-05-01 | VERLOPEN |
| 75c80e40… | 10 | 0 | 0 | 2026-05-21 | VERLOPEN |
| c11441ef… (internal) | 500 | 0 | 500 | 2027-01-20 | OK (bypass via `is_internal_tenant`) |

**6 van 7 tenants hebben verlopen `credits_reset_at`.** Bevestigt dat er geen werkende cron is — sinds februari 2026 is er nooit een reset uitgevoerd.

### 1.5 Stripe-flow (top-up): GEBROKEN

1. Frontend → `create-ai-credits-checkout` edge function
   - Maakt `ai_credit_purchases` rij met `status='pending'`
   - Stripe Checkout session (`mode: payment`), metadata `{tenant_id, purchase_id, credits, type: 'ai_credits'}`
   - Success URL: `/admin/marketing/ai?purchase=success&credits=…`
2. Stripe redirect → frontend toont toast "X credits toegevoegd" en doet `refetchCredits()`.
3. **Wat ontbreekt:** `platform-stripe-webhook` filtert NIET op `metadata.type === 'ai_credits'`. `grep ai_credits supabase/functions/platform-stripe-webhook/index.ts` → 0 hits. Er wordt nooit `add_ai_credits()` aangeroepen, `ai_credit_purchases.status` blijft `pending`, `credits_purchased` wordt niet verhoogd.

De UI liegt: de toast suggereert succes, maar de credits worden nooit bijgeschreven. Enige reden dat dit niet eerder opviel: 0 productie-aankopen.

De bank-transfer-variant werkt wél: `confirm-platform-bank-payment` roept `add_ai_credits(tenant, credits)` aan voor `payment_type='ai_credits'`.

---

## 2. Consumptie-logica

### 2.1 Consumers en kost per call

Alle callers gebruiken de **2-arg overload** `use_ai_credits(p_tenant_id, p_credits_needed)` behalve `ai-translate-content` (dynamisch). Frontend-tarieven (`useAICredits.getCreditCost`) en server-side kosten zijn niet gesynchroniseerd.

| Edge function | Server-side credits per call | Frontend prijslijst (`useAICredits`) |
|---|---|---|
| `ai-translate-content` | `fields × targetLanguages` | — |
| `ai-generate-email` | hard-coded in functie | 3 (`email_content`) |
| `ai-generate-social` | hard-coded | 2 (`social_post`) |
| `ai-generate-image` | hard-coded | 5 (`image_generation`) |
| `ai-generate-seo-content` | hard-coded | — |
| `ai-seo-analyzer` | hard-coded | — |
| `ai-generate-ab-variant` | hard-coded | — |
| `ai-generate-storefront-copy` | hard-coded | — |
| `ai-chatbot-respond` | hard-coded | — |
| `ai-suggest-reply` | hard-coded | — |
| `ai-campaign-suggestions` | hard-coded | 1 (`campaign_suggestion`) |
| `ai-product-field-assistant` | hard-coded | — |

Risico: FE en BE kunnen uit de pas lopen → "Bevestig kost 3 credits" terwijl er 5 worden afgeschreven.

### 2.2 Atomic? — **Nee**

`use_ai_credits` (2-arg) doet: `SELECT available` → `IF available >= needed` → `UPDATE SET credits_used = credits_used + needed`. Dit is **read-then-write zonder lock** (geen `FOR UPDATE`, geen WHERE-conditie op `credits_used`).

Race condition bij parallelle calls (Bulk Vertalen, bulk SEO, batch image-gen):
- Twee gelijktijdige aanroepen lezen dezelfde `available`
- Beide passeren de check, beide doen `UPDATE`
- Resultaat: meer verbruik dan toegestaan, of negatief saldo (geen DB-constraint die dit voorkomt)

De 5-arg overload heeft hetzelfde patroon.

### 2.3 Foutafhandeling bij `false`-retour

- `ai-translate-content`: returnt **HTTP 402** `{"error":"Onvoldoende AI credits"}` — correct.
- Andere functies: gemengd, soms 200 met `error`-veld, soms 500.

Frontend (`useAIMarketing.registerCreditCallback`) opent `CreditPurchaseDialog` alleen als de error-shape herkend wordt; bij generieke `supabase.functions.invoke()` errors valt het terug op een nietszeggende toast ("Fout bij starten vertaling"). Geen uniforme error-shape (bv. `{code: 'INSUFFICIENT_CREDITS'}`).

---

## 3. Refill & Reset — de kern

### 3.1 Bestaat de cron?

- Edge function `reset-monthly-ai-credits` bestaat en roept `public.reset_monthly_ai_credits()` aan.
- RPC bestaat: zet `credits_used=0`, `credits_total = plan.ai_credits_monthly OR 10`, `credits_reset_at = now() + 1 month`, voor rijen met `credits_reset_at <= now()`. Tweede 2-arg overload bestaat ook.
- **Geen pg_cron schedule** zichtbaar (cron-schema niet leesbaar voor exec-rol), maar:
  - Migraties bevatten 0 verwijzingen naar `cron.schedule(...)` voor deze functie.
  - 6/7 tenants verlopen sinds feb 2026.
  - Conclusie: **er draait geen scheduler.** De edge function is geschreven maar nooit ingepland.

### 3.2 Hoe zou maandtegoed bepaald moeten worden?

`pricing_plans.ai_credits_monthly`:

| plan | ai_credits_monthly |
|---|---:|
| free | 0 |
| starter | 50 |
| pro | 500 |
| enterprise | 5000 |

`reset_monthly_ai_credits()` koppelt al naar `tenant_subscriptions → pricing_plans` met fallback **10**.

Mismatches:
- Free-plan = 0, maar fallback = 10 → Free-tenants krijgen impliciet 10 credits/maand. Bug of bewust?
- Reset wordt getriggerd op `credits_reset_at <= now()`, niet op `tenant_subscriptions.current_period_start`. Plan-upgrade halverwege de maand wordt pas zichtbaar bij volgende reset.

### 3.3 Top-up bij reset

`credits_purchased` wordt niet aangeraakt → top-ups blijven staan. Correct.
`credits_used` → 0 betekent dat eventuele top-up consumptie ook gereset wordt; netto-saldo werkt in voordeel van klant.

---

## 4. Security

`pg_policies` op `tenant_ai_credits`:

```
SELECT  → tenant-leden via get_user_tenant_ids(auth.uid())   ✓ correct
UPDATE  → tenant-leden via get_user_tenant_ids(auth.uid())   ✗ FOUT
```

**Bevestigd:** elke `authenticated` user die lid is van de tenant (incl. viewer/warehouse/kassier) kan via PostgREST direct `update tenant_ai_credits set credits_used=0, credits_purchased=999999`. Privilege escalation op betaalbare quota.

Geen INSERT- of DELETE-policy, dus alleen UPDATE is exposed.

Correcte vorm: alle credit-mutaties via `SECURITY DEFINER` RPC (`use_ai_credits`, `add_ai_credits`, `reset_monthly_ai_credits`); UPDATE-policy schrappen of beperken tot service_role. Past in patroon `mem://architecture/ai-tables-read-only-ui-pattern`.

---

## 5. Bevindingen

1. **Geen cron** — `reset_monthly_ai_credits` is nooit ingepland; 6/7 tenants hebben verlopen `reset_at` sinds feb 2026.
2. **Stripe-aankoop is dead code** — `platform-stripe-webhook` handelt `metadata.type === 'ai_credits'` niet af; `add_ai_credits` wordt nooit getriggerd; `ai_credit_purchases` blijft `pending`. 0 productie-aankopen.
3. **Race condition** in `use_ai_credits` (read-then-write, geen `FOR UPDATE`) → parallelle batches kunnen quota overschrijden.
4. **Tenant-blind UPDATE policy** op `tenant_ai_credits` → elke tenant-member kan eigen credits muteren. Open finding uit 2D-recon bevestigd.
5. **FE ↔ BE prijslijst niet gesynchroniseerd** — `useAICredits.getCreditCost` is een losse hard-coded map; servers gebruiken eigen waarden.
6. **Logging inconsistent** — 2-arg `use_ai_credits` schrijft niet naar `ai_usage_log`; 5-arg wel. Meeste callers gebruiken 2-arg → telemetrie incompleet.
7. **Tenant zonder credit-rij** — 7 rijen voor 8 tenants. Geen auto-creatie bij signup; eerste AI-call faalt stil (`available_credits IS NULL` → `false`).
8. **Fallback van 10 credits** bij geen actieve subscription botst met Free-plan = 0. Onbedoeld trial-tegoed.
9. **Reset gekoppeld aan eigen timeline** i.p.v. Stripe billing period. Plan-upgrades vertraagd zichtbaar.
10. **Geen DB-constraint** die negatief saldo voorkomt (zie `admin_adjustment: -200`).
11. **Geen tenant-creatie-trigger** voor `tenant_ai_credits` — manueel ingevuld in 7 gevallen.
12. **CreditPurchaseDialog gateway-error UX** — generieke "Fout bij starten" toast i.p.v. duidelijke 402-melding met "koop bij"-CTA.

## 6. Gap-analyse

| Onderdeel | Status | Wat ontbreekt |
|---|---|---|
| Maandelijkse reset | gedeeltelijk | pg_cron schedule (of Scheduled Function) op `reset-monthly-ai-credits` |
| Stripe top-up fulfilment | ontbreekt | `platform-stripe-webhook` branch voor `metadata.type === 'ai_credits'` → `add_ai_credits` + `ai_credit_purchases.status='completed'` |
| Atomic afschrijving | onveilig | `use_ai_credits` herschrijven met `UPDATE … WHERE available >= needed RETURNING` of `SELECT … FOR UPDATE` |
| RLS hardening | onveilig | DROP UPDATE policy "Users can update their tenant AI credits"; alleen `SECURITY DEFINER` RPC's |
| Tenant-init | ontbreekt | Trigger op `tenants` insert die `tenant_ai_credits` aanmaakt (`credits_total = plan.ai_credits_monthly`, `credits_reset_at = now() + 1 month`) |
| Plan-upgrade hook | ontbreekt | Bij `tenant_subscriptions` upgrade: direct ophogen of pro-rata bijschrijven (beslispunt) |
| Single source of truth tarieven | inconsistent | Centrale tabel `ai_feature_costs` of constant-map gedeeld FE/BE |
| Usage logging | inconsistent | Verplicht `ai_usage_log` INSERT binnen `use_ai_credits` zelf |
| 402-foutafhandeling | inconsistent | Uniforme error-shape `{code:'INSUFFICIENT_CREDITS', balance, needed}` + globale toast met koop-CTA |
| Audit-trail | beperkt | `admin_adjustment` events via dedicated RPC met `actor_id` in metadata |

## 7. Open beslispunten voor Akke

1. **Maandtegoed Free-plan**: 0 of 10 credits per maand?
2. **Plan-upgrade timing**: bij Free→Pro op dag 15 — direct 500, pro-rata, of pas bij volgende reset?
3. **Top-up vervaldatum**: eeuwig of vervalt na X maanden?
4. **Reset-anchor**: kalendermaand, signup-anniversary, of Stripe billing period?
5. **Negatief saldo toegestaan?** Hard floor op 0 of historisch boekhouden?
6. **Stripe Checkout vs bank-only**: top-up via platform-account werkt niet (webhook mist); bouwen of overstappen naar bank-transfer-only?
7. **Bulk-vertaling pricing**: per veld/taal, per product, of token-based?
8. **AI Coach / proactive monitor / ads-ai-engine** consumeren géén credits — bewust of mee laten tellen?
9. **Internal tenant bypass**: blijft `is_internal_tenant` ongelimiteerd, of platform-budget?
10. **`ai-product-field-assistant`**: vandaag credits per veld (vaak/duur). Pakket-model of token-based?

---

_Einde recon. Geen wijzigingen aan code, schema of data._

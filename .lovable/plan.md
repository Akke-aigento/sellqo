# UPGRADE-PF-1 — Upgrades volledig pay-first

## Wat er nu misgaat (geverifieerd in de code)

`sync-tenant-plan` action=`switch` heeft in de upgrade-tak nog het volledige legacy invoice-first-blok (regels ~465-710): het berekent proratie, maakt zélf een `invoices`-rij + `invoice_lines`, genereert de PDF, incasseert off-session en mailt. Drie concrete fouten:

1. **Proratie 30/30 d** — de periode komt uit `tenant_subscriptions.current_period_start/_end`. Bij pay-first worden die bij activatie op vandaag → vandaag+1 maand gezet en daarna niet per dag bijgewerkt, dus `remainingDays == periodDays`.
2. **Dubbel factureren** — de al betaalde pay-first-cycle van de lopende periode speelt geen rol; bij een interval-swap wordt zelfs de volle nieuwe prijs gefactureerd.
3. **Verkeerd vertrekpunt** — de huidige prijs komt uit `pricing_plans` van `tenant_subscriptions.plan_id`, niet uit de werkelijke `subscription_lines.unit_price`.

Vaststellingen die het ontwerp bepalen:
- De echte lopende periode is af te leiden uit `subscriptions.next_invoice_date` (= periode-einde) en `interval`; `billing_cycles.period_start/period_end` van de laatst gesettelde cycle is een nog directere bron. Er is géén `current_period_*` op `subscriptions`.
- `billing_cycles` heeft geen `cycle_type` en geen doelplan-velden → additieve migratie nodig.
- `tenant_subscriptions` heeft `pending_plan_id / pending_interval / pending_effective_at` (nu enkel voor downgrades) maar geen manier om "upgrade wacht op betaling" te onderscheiden.
- De webhook (`_shared/subscriptionCharge.ts` → `handleCycleCharge`) is de enige factureer-plek en herkent cycles via `intent.metadata.billing_cycle_id`. Dat blijft zo.
- `calculate-plan-switch` en `execute-plan-switch` (+ `src/hooks/usePlanSwitch.ts`) hebben **geen enkele aanroeper** in de app: dode Stripe-Billing-code die het oude pad nabootst.

## Pro-rata-berekening (nieuwe gedeelde helper)

Nieuwe helper `supabase/functions/_shared/planProration.ts`:

```text
periodeEinde  = laatst gesettelde/lopende billing_cycle.period_end
                (fallback: subscriptions.next_invoice_date)
periodeStart  = die cycle.period_start
                (fallback: periodeEinde − 1 interval)
periodeDagen  = periodeEinde − periodeStart      (in dagen, min. 1)
restDagen     = clamp(periodeEinde − vandaag, 0, periodeDagen)

huidigNetto   = Σ over subscription_lines: quantity × unit_price   (WAARHEID)
nieuwNetto    = pricing_plans[doelplan][interval-prijs]
deltaNetto    = (nieuwNetto − huidigNetto) × restDagen / periodeDagen  → 2 dec
btwPct        = btw van lijn 0 (bestaande snapping 0/6/12/21), default 21
btw           = round(deltaNetto × btwPct/100, 2)
totaal        = deltaNetto + btw
```

- `deltaNetto ≤ 0` → geen betaling: het bestaande deferred-downgrade-pad (pending_plan_id op periodegrens).
- Interval-swap monthly→yearly is óók "delta vanaf de huidige lijn", maar tegen een nieuwe periode: `deltaNetto = jaarprijs − (huidige maandlijn × restDagen/periodeDagen als credit)`; de nieuwe periode start vandaag.
- Verrekening met de al betaalde cycle zit impliciet in het delta-vertrekpunt: de klant heeft de oude prijs voor de hele periode al betaald, dus alleen het verschil over de resterende dagen is verschuldigd. Nooit meer een vol maandbedrag.

**Voorbeeld** (lijn €2,00/maand → plan €5,00/maand, periode 01/08–01/09 = 31 d, vandaag 17/08 → 15 d rest):
```text
delta netto = (5,00 − 2,00) × 15/31 = 1,4516 → €1,45
btw 21%     = €0,30
totaal      = €1,75
```
Regelomschrijving: `Upgrade Starter → Pro (pro rata 15/31 d, 17/08/2026 t/m 01/09/2026)`.

## Flow — mandate-modus (`subscriptions.payment_mode = 'mandate'`)

```text
UI: kies hoger plan → sync-tenant-plan action=switch
  ├─ open proration-cycle aanwezig? → 409 "upgrade al in behandeling"
  ├─ delta ≤ 0 → bestaand pending-downgrade-pad (ongewijzigd)
  └─ delta > 0
       1. INSERT billing_cycles: cycle_type='proration', model='pay_first',
          mode='mandate', period = vandaag → periodeEinde,
          target_plan_id / target_interval, status='pending'
       2. PaymentIntent (off_session, confirm) met
          metadata.billing_cycle_id, idempotencyKey cycle:<id>
          ├─ succeeded/processing → cycle 'processing'
          │      → plan gaat DIRECT in (lijnen + tenant_subscriptions + tenants)
          │      → webhook maakt straks de betaalde factuur (CYCLE-3)
          ├─ requires_action / geweigerd → cycle 'awaiting_payment'
          │      → betalingsverzoek via dispatch-payment-request
          │      → planwissel PENDING (zie manual-flow)
          └─ intent-aanmaak faalt (throw) → cycle op 'cancelled',
                 GEEN planwissel, nette fout naar de UI
       3. Webhook payment_failed → cycle 'awaiting_payment'; als het plan al
          direct inging blijft het staan en neemt dunning/reminders het over
          (identiek aan een mislukte gewone pay-first-cycle).
```
**Ontwerpkeuze bevestigd:** bij mandaat volstaat `processing` om het plan direct te laten ingaan. Dat is consistent met `hasUsableMandate` en met de gewone pay-first-cycle (waar de klant ook al toegang heeft terwijl SEPA loopt), en de betalingsplicht blijft geborgd via de cycle + dunning. Wél strikter dan vandaag: bij een *geweigerde* intent wordt het plan niet meer stil doorgezet.

## Flow — manual-modus (`payment_mode = 'manual'`)

```text
UI: kies hoger plan → sync-tenant-plan action=switch
  └─ delta > 0
       1. INSERT billing_cycles: cycle_type='proration', mode='manual',
          status='awaiting_payment', due_date=vandaag, grace_until=+7 d
       2. dispatch-payment-request (link + PR-PDF + mail) — hergebruik
       3. tenant_subscriptions: pending_plan_id / pending_interval /
          pending_effective_at=NULL + pending_billing_cycle_id=<cycle>
          → plan gaat NIET in; UI toont "upgrade wacht op betaling"
       4a. Betaling → webhook: factuur (betaald) + cycle 'settled'
             + EFFECTUEER de planwissel
       4b. grace verstrijkt → process-cycle-reminders zet 'expired'
             → pending upgrade vervalt (pending_* leeggemaakt),
               notificatie "upgrade verlopen — probeer opnieuw"
```

## Webhook: proration-settlement herkennen en afhandelen

`handleCycleCharge` laadt de cycle al op id. Uitbreiding: ook `cycle_type, target_plan_id, target_interval` selecteren. Na de bestaande factuur+settle-stappen, alleen als `cycle_type='proration'` en `target_plan_id` gezet:

1. `subscription_lines` van `cycle.subscription_id`: lijn 0 → `description` = `<plan> (<interval>)`, `unit_price` = nieuwe planprijs, `quantity` 1; overige lijnen ongemoeid.
2. `subscriptions`: `name` bijwerken; bij interval-swap ook `interval`, `start_date`, `next_invoice_date`.
3. `tenant_subscriptions`: `plan_id`, `billing_interval`, `current_period_start/_end`, en `pending_plan_id / pending_interval / pending_effective_at / pending_billing_cycle_id` op NULL.
4. `tenants.subscription_plan` = `targetPlan.slug`.
5. Notificatie "plan actief".

Idempotent: de stap staat achter de bestaande `.is("invoice_id", null)`-race-guard en is no-op als `tenant_subscriptions.plan_id` al het doelplan is (mandate-modus, waar het plan al direct inging).

De factuurregel van een proration-cycle krijgt de pro-rata-omschrijving in plaats van de generieke periodetekst.

## Wat er wijzigt

**Migratie (additief, `IF NOT EXISTS`)**
- `billing_cycles`: `cycle_type text not null default 'recurring'` (`'recurring' | 'proration'`), `target_plan_id uuid null`, `target_interval text null`.
- `tenant_subscriptions`: `pending_billing_cycle_id uuid null`.
- Partiële unieke index: max één niet-afgesloten proration-cycle per subscription.
- Geen wijziging aan grants/RLS (beide tabellen bestaan al met hun policies).

**Nieuw**
- `supabase/functions/_shared/planProration.ts` — periode-afleiding + delta + btw, gedeeld door switch en webhook.

**Gewijzigd**
- `supabase/functions/sync-tenant-plan/index.ts` — upgrade-tak herschreven; het hele legacy invoice/PDF/charge/mail-blok verdwijnt. `activate`, `cancel` en het downgrade-pad blijven ongemoeid.
- `supabase/functions/_shared/subscriptionCharge.ts` — proration-effectuering + pro-rata-regelomschrijving.
- `supabase/functions/process-cycle-reminders/index.ts` — bij expiry van een proration-cycle de pending upgrade opruimen + notificatie.
- `supabase/functions/generate-subscription-invoices/index.ts` — proration-cycles uitsluiten van de stale-`pending`-sweep en van de periodecyclus-logica.
- `src/pages/admin/Billing.tsx` (+ `PlanActivationWizard`) — "upgrade wacht op betaling"-banner met link naar het betalingsverzoek zolang er een open proration-cycle is.
- `src/hooks/usePlatformBillingStatus.ts` — nieuwe responsevelden (`pending_upgrade`, `billing_cycle_id`, `payment_request_url`).
- i18n 4-talig (nl/en/fr/de) voor de nieuwe teksten.

**Verwijderd (dode code, geen aanroepers)**
- `supabase/functions/calculate-plan-switch/`, `supabase/functions/execute-plan-switch/`, hun `config.toml`-blokken en `src/hooks/usePlanSwitch.ts`.

## Randgevallen

| Geval | Gedrag |
|---|---|
| Interval-swap monthly→yearly, zelfde plan | Upgrade-pad: delta = jaarprijs − credit resterende dagen oude maandlijn; nieuwe periode start vandaag |
| Interval-swap yearly→monthly | Rank daalt → bestaand downgrade-pad, periodegrens |
| Al een open proration-cycle | 409 + melding "upgrade al in behandeling, rond eerst de betaling af" |
| Upgrade tijdens `trialing` | Geen billing-sub → `switch` geeft nu al 400; de UI kiest `activate`. Ongewijzigd |
| Meerdere `subscription_lines` | `huidigNetto` = som van alle lijnen; alleen lijn 0 gaat naar het nieuwe plan |
| `restDagen = 0` (upgrade op periodegrens) | delta = 0 → geen cycle, wissel wordt op de grens door de runner toegepast |
| Mandaat ontbreekt in mandate-modus | Val terug op de manual-flow (betalingsverzoek + pending) i.p.v. een fout |

## Risico's & open vragen

1. **Periode-bron** — de laatst gesettelde `billing_cycle` als waarheid, met `subscriptions.next_invoice_date` als fallback. Bij tenants zonder gesettelde cycle (handmatig gemigreerd) is de fallback de enige bron en kan die afwijken van wat de klant feitelijk betaalde.
2. **Btw-bron** — btw komt van de bestaande subscription-lijn (nu altijd 21). Gaat het platform ooit 0% (intracom B2B) toepassen, dan volgt de proratie automatisch mee.
3. **Mandate-modus `processing`** — plan direct actief bij een nog niet definitief afgeronde SEPA-incasso; bij later falen blijft de klant op het hogere plan tot dunning ingrijpt. Alternatief (wachten op `succeeded`) kost dagen bij SEPA; ik raad het niet aan.
4. **Open vraag** — moeten de al gecrediteerde legacy-facturen (SQ-2026-0007/0008) nog iets krijgen? Aanname: nee, afgehandeld, geen dataherstel.
5. **Open vraag** — grace-window voor een proration-cycle: 7 dagen zoals de gewone cycle, of korter (bv. 3 d) omdat het een upgrade is? Ik plan 7 d tenzij je anders wil.

## Slottaken

- Changelog `2026.08u` (improvement) in de 4 landing-locales + registratie in `src/pages/public/PublicChangelog.tsx`.
- DOCS-1: `doc_articles` (`doc_level='tenant'`) over plan-upgrades bijwerken — pro rata, direct bij incasso, wachten op betaling bij overschrijving.
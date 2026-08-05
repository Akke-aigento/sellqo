# 2a·2 — Billing.tsx omhangen naar de native billing-engine

Doel: `/admin/billing` wordt weer self-service. De tenant_admin ziet zijn abonnement, stelt zijn betaalwijze in (SEPA-mandaat of betalingsverzoek per periode) en wijzigt zijn plan via `sync-tenant-plan`. SAFEGUARD-1 gaat eraf.

## 1. Recon-uitkomst: de exacte interface van sync-tenant-plan

`sync-tenant-plan` accepteert **precies drie acties** — er is **geen preview/calculate-actie**:

```text
body: { tenant_id, plan_id, billing_interval: 'monthly'|'yearly', action: 'activate'|'switch'|'cancel' }
auth: Bearer JWT — platform_admin of tenant_admin van dat tenant_id
```

Gedrag en antwoorden (ongewijzigd laten):
- `activate` → maakt/hergebruikt de interne billing-subscription, zet `tenant_subscriptions` actief, triggert direct de eerste factuur. Antwoord: `{ success, action:'activate', billing_subscription_id, billing_customer_id, invoice_generation_invoked }` of `{ noop:true }`.
- `switch` bij upgrade → direct actief + pro-rata one-off factuur.
- `switch` bij downgrade/interval-verlaging → `{ success, action:'switch', downgrade:true, effective_at, pending_plan_id, pending_interval }`.
- `switch` zonder bestaande billing-subscription → **400 met "use action=activate"**. De UI kiest dus zelf: `activate` als er geen `billing_subscription_id` is, anders `switch`.
- Free plan of `cancel` → opzegging per periode-einde.

Omdat er geen preview bestaat, wordt de UI-stap een **bevestigingsdialoog zonder bedragbelofte**: hij legt de twee wetten uit (upgrade = direct, met pro-rata verrekening op de eerstvolgende factuur; downgrade = gaat in op de periodegrens) en noemt het nieuwe periodetarief van het gekozen plan/interval — geen berekend pro-rata-bedrag, want dat kennen we client-side niet.

## 2. Betaalwijze-blok

Schema-bevindingen die het ontwerp bepalen:
- `subscriptions.payment_mode` (`mandate` | `manual`) en `subscriptions.billing_model` (`pay_first`) bestaan al, met defaults `mandate` / `pay_first`. `sync-tenant-plan` zet ze niet expliciet → nieuwe subs staan op `mandate`.
- `customer_payment_mandates` heeft alleen `method_type`, `status`, `stripe_*` — **geen last4/brand-kolommen**. De UI toont dus type (SEPA-incasso / kaart) en status, geen laatste 4 cijfers.
- RLS-blokkade: de mandaatrij en de billing-subscription staan op de **interne SellQo-tenant**. `customer_payment_mandates` en `subscriptions` hebben tenant-gescopeerde SELECT-policies, dus een tenant_admin van bv. VanXcel kan zijn eigen platform-mandaat **niet** direct uit de browser lezen — een client-side query geeft stil nul rijen.

Daarom één kleine nieuwe leesfunctie:

- **`get-platform-billing-status`** (nieuwe edge function, service-role read, auth = `authenticateRequest` + `requireRole(tenant_id, ['tenant_admin'])`, platform_admin mag ook): geeft `{ has_billing_customer, mandate: { status, method_type } | null, payment_mode, billing_model, next_invoice_date, billing_subscription_id }` voor het aanvragende tenant.

Blok-gedrag:
- Geen billing-customer of geen mandaat → "Nog geen automatische incasso ingesteld", met twee keuzes:
  1. **Automatische incasso instellen** → `create-platform-mandate-setup` (2a·1) → URL in een dialoog met kopieer- en openen-knop (patroon van `MandateLinkDialog`), daarna status verversen.
  2. **Betalingsverzoek per periode** (manual) → zet `payment_mode='manual'` op de interne subscription.
- Actief mandaat → type + statusbadge + uitleg dat facturatie automatisch verloopt; knop "Betaalwijze vervangen" mint een nieuwe mandaatlink.
- Manual-modus → uitleg dat er elke periode een betalingsverzoek per e-mail komt (CYCLE-2) + knop om alsnog naar incasso te schakelen.

Manual-modus schrijven kan niet client-side (RLS op `subscriptions` van de interne tenant). Kleinste nette uitbreiding: dezelfde functie krijgt een `set_payment_mode`-actie met identieke rolcheck. Bestaat er nog geen subscription, dan houdt de UI de keuze in state en past die direct na `activate` toe.

`sync-tenant-plan` blijft ongewijzigd: de payment_mode wordt ná `activate`/`switch` gezet via die kleine functie, dus de twee wetten en de pro-rata-logica worden niet aangeraakt.

## 3. Paginastates en wat elk toont

| State | Detectie | Toont |
|---|---|---|
| Trial / free | trialing, geen sub, of plan free | huidig plan + verloopdatum, plankeuze actief, betaalwijze-stap verplicht vóór activeren |
| Actief met mandaat | sub actief + mandaat `active` | plan/interval/volgende factuurdatum, mandaat-blok groen, plankeuze actief |
| Actief manual | sub actief + `payment_mode='manual'` | idem, met "betalingsverzoek per e-mail"-uitleg |
| Downgrade gepland | `pending_plan_id` gevuld | banner: welk plan, per welke datum |
| past_due | `status='past_due'` | waarschuwing + verwijzing naar de open betaling; upgrade blijft toegestaan |
| Enterprise | plan-slug `enterprise` | "Neem contact op" i.p.v. keuzeknop — niet self-service |
| Geannuleerd per periode-einde | `cancel_at_period_end` | bestaande waarschuwing + reactiveren via plankeuze |

Poortwachter: geen actief mandaat **en** geen expliciete manual-keuze → de plankeuze opent eerst het betaalwijze-blok in plaats van te activeren.

## 4. Wat er uit Billing.tsx verdwijnt

- `selectionDisabled` op `PlanComparisonCards` en de `Alert` met `billing.plan_change_via_team` (i18n-keys blijven bestaan).
- De lege `onSelectPlan` no-op → nieuwe flow.
- `useCalculatePlanSwitch` / `useExecutePlanSwitch` + `PlanSwitchPreviewCard` en de bijhorende state — vervangen door de eigen bevestigingsdialoog. `DowngradeWarningDialog` blijft, maar gevoed door plan-vergelijking i.p.v. de preview-respons.
- `createCheckout` en `openCustomerPortal` worden niet meer aangeroepen; de `{false && ...}`-portalkaart met het hardcoded "VISA •••• 4242"-blok gaat definitief weg.
- `window.location.reload()` → gerichte react-query invalidatie.
- De `platform_invoices`-tabel blijft als read-only archief (echte facturen = 2a·4).
- De edge functions `calculate-plan-switch`, `execute-plan-switch` en `platform-customer-portal` blijven bestaan (opruimen = Fase B).

## 5. i18n

`billing` heeft nu 20 keys in nl, 12 in en en **slechts 1 in fr en de**. Alle gebruikte keys — bestaande én nieuwe (`billing.payment_mode.*`, `billing.mandate.*`, `billing.plan_change.*`, statuslabels, dialoogteksten) — worden viertalig aangevuld, en de component gaat volledig op `t()` (de hardcoded NL-strings zoals "Wissel van Plan", "Beheer je abonnement…" en de verbruikslabels gaan mee).

## 6. Technische details

- Nieuwe edge function `get-platform-billing-status` met `action: 'status' | 'set_payment_mode'`, auth via `_shared/auth.ts`, service-role read/write op de interne tenant.
- Nieuwe hook `usePlatformBillingStatus` (query) + mutaties voor mandaatlink, payment_mode en plan-sync; invalidatie van `tenant-subscription` en de nieuwe statusquery.
- Nieuwe componenten `PaymentMethodCard` en `PlanChangeConfirmDialog` onder `src/components/admin/billing/`.
- `Number()` op alle prijsvelden; geen signed URLs in de DB; `.select()` na mutaties waar persistentie bewezen moet worden.
- Geen wijziging aan `MandateActivation.tsx`, de CYCLE-functies, de webhook of `sync-tenant-plan`.

## 7. Risico's en open vragen

Risico's:
- Zonder preview-endpoint kan de UI het exacte pro-rata-bedrag niet tonen; verwachtingsmanagement zit in de dialoogtekst. Het bedrag wordt pas op de factuur zichtbaar.
- `switch` faalt met 400 zonder bestaande billing-subscription; de UI moet correct kiezen, inclusief het geval "tenant_subscriptions bestaat, `billing_subscription_id` leeg".
- Een SEPA-mandaat kan nog `processing` zijn direct na terugkomst. Voorstel: activeren toestaan zodra er een mandaatrij bestaat die niet `failed` is, met status "in verwerking".
- Enterprise-detectie op plan-slug is fragiel als slugs wijzigen.

Open vragen:
1. Payment_mode-setter als `action` in `get-platform-billing-status` (mijn voorkeur) of als aparte functie `set-platform-payment-mode`?
2. Mag manual-modus voor élk plan, of alleen voor handmatig beheerde/enterprise-tenants?
3. Moet een geplande downgrade in deze batch annuleerbaar zijn (vraagt een extra actie in `sync-tenant-plan`), of later?
4. Mag een tenant met `status='past_due'` zelf upgraden, of eerst de openstaande betaling afronden?
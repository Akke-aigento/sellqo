

## Analyse: Abonnementensysteem — Wat Werkt & Wat Ontbreekt

### ✅ Wat WEL werkt

| Onderdeel | Status |
|---|---|
| **Stripe Checkout** | `create-platform-checkout` maakt checkout sessies met juiste priceId, billing adres, BTW collectie, promo codes |
| **Webhook: subscription.created/updated** | `platform-stripe-webhook` vangt dit op, upsert naar `tenant_subscriptions`, update tenant plan |
| **Webhook: subscription.deleted** | Tenant wordt gedowngraded naar `free` plan, status op `canceled` |
| **Webhook: invoice.paid** | Factuur wordt opgeslagen in `platform_invoices` met PDF URL, hosted URL, bedrag, periode |
| **Webhook: invoice.payment_failed** | Status wordt op `past_due` gezet op subscription én tenant |
| **Feature gating** | `checkFeature()` controleert plan features + add-ons, `FeatureGate` component blokkeert UI |
| **Limieten** | `checkLimit()` / `enforceLimit()` voor producten, orders, klanten, users |
| **Trial blocker** | `TrialExpiredBlocker` blokkeert hele admin na trial expiry, toont upgrade opties |
| **Customer Portal** | `platform-customer-portal` functie bestaat voor beheer/annulering |

### ❌ Wat ONTBREEKT

| Probleem | Impact | Ernst |
|---|---|---|
| **Geen e-mail bij betaling mislukt** | Regel 307: `// TODO: Send payment failed email via Resend` — tenant weet niet dat betaling faalde | **Hoog** |
| **Geen e-mail bij trial bijna afgelopen** | Regel 329: `// TODO: Send trial ending email via Resend` — geen herinnering 3 dagen voor expiry | **Hoog** |
| **Geen factuur-e-mail bij platformbetaling** | `invoice.paid` slaat factuur op maar stuurt GEEN e-mail met de factuur naar de tenant | **Hoog** |
| **`past_due` blokkeert NIET** | Bij mislukte betaling: status wordt `past_due` maar `shouldBlockAccess()` checkt alleen `isTrialExpired` — tenant kan gewoon doorwerken | **Kritiek** |
| **Geen grace period logica** | Na `past_due` zou er X dagen grace moeten zijn → dan pas blokkeren of downgraden naar free | **Gemiddeld** |
| **Geen automatische downgrade bij aanhoudend unpaid** | Stripe stuurt uiteindelijk `subscription.deleted` maar tot die tijd is er geen tussenactie | **Gemiddeld** |
| **Webhook is niet geregistreerd in Stripe** | Er is een `platform-stripe-webhook` edge function maar er is **geen bewijs** dat deze daadwerkelijk als endpoint in Stripe is geconfigureerd — zonder dat doen alle webhooks niets | **Kritiek** |

### Plan: Volledige Fix

**Stap 1: `shouldBlockAccess()` uitbreiden** — `useTrialStatus.ts`
- Blokkeer ook bij `past_due`, `unpaid`, en `canceled` (niet alleen trial expired)
- Grace period: bij `past_due` blokkeer na 7 dagen

**Stap 2: E-mail notificaties toevoegen** — 3 nieuwe edge function calls in `platform-stripe-webhook`
- `invoice.payment_failed` → stuur e-mail "Je betaling is mislukt, update je betaalmethode"
- `customer.subscription.trial_will_end` → stuur e-mail "Je trial verloopt over 3 dagen"
- `invoice.paid` → stuur e-mail met factuur PDF link

Alle drie gebruiken de bestaande `send-tenant-email` of `create-notification` flow (met `skip_in_app: true` voor e-mail delivery).

**Stap 3: Blocker UI uitbreiden** — `TrialExpiredBlocker.tsx`
- Ondersteuning voor `past_due` status: toon "Betaling mislukt" bericht + link naar Customer Portal
- Verschil maken tussen trial expired vs. betaling mislukt

**Stap 4: Stripe webhook URL documenteren**
- Duidelijk aangeven welke URL in Stripe Dashboard moet staan:
  `https://{project-ref}.supabase.co/functions/v1/platform-stripe-webhook`
- Welke events aan moeten staan: `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`, `payout.*`

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/hooks/useTrialStatus.ts` | `shouldBlockAccess()` uitbreiden met `past_due`/`unpaid`/`canceled` check |
| `src/components/admin/TrialExpiredBlocker.tsx` | Aparte UI voor `past_due` vs. trial expired |
| `supabase/functions/platform-stripe-webhook/index.ts` | E-mails sturen bij `invoice.payment_failed`, `trial_will_end`, `invoice.paid` |

### Samenvatting

De **basis-infrastructuur staat er** (checkout, webhooks, feature gating, trial blocker). Maar er zitten **3 kritieke gaten**: (1) tenant wordt niet geblokkeerd bij mislukte betaling, (2) er worden geen e-mails gestuurd bij betaal/trial events, en (3) de webhook URL moet daadwerkelijk in Stripe geconfigureerd zijn. Dit plan fixt alle drie.


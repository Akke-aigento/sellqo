# CYCLE-2 — Betalingsverzoek + herinnering/expiry-spoor (plan)

Sluitstuk van de pay-first engine: het betalingsverzoek-document met betaallink, de mail, en het vriendelijke herinnering/expiry-spoor. Geen frontend, geen wijziging aan het invoice_first-pad of de bestaande dunning.

## 1. Architectuur betalingsverzoek

Drie kleine bouwstenen plus een dunne orkestrator, in plaats van één grote functie:

**a) `generate-payment-request-pdf` (nieuw)**
- Input `{ billing_cycle_id }`. Service-role, geen JWT (alleen intern aangeroepen).
- Zelfde patroon als `generate-subscription-invoice-pdf`: pdf-lib, A4, logo-embed, tenant-/klantblok, totalenblok, `Intl.NumberFormat`, alle numerics via `Number()`.
- Eigen template, duidelijk géén factuur:
  - Kop `BETALINGSVERZOEK` + PR-nummer (i.p.v. `FACTUUR`).
  - Disclaimer prominent onder de kop: "Dit is geen factuur. Uw factuur volgt direct na ontvangst van de betaling."
  - Periode (`period_start` t/m `period_end`), vervaldatum (`due_date`), één regel met de abonnementsnaam, subtotaal/btw/totaal exact uit de cycle-kolommen.
  - Afzender = tenant van de cycle (voor platformabonnementen de interne SellQo-tenant), geadresseerde = `customers`-rij van `customer_id`.
  - Geen OGM/IBAN-instructies wanneer er een betaallink is; de betaallink wel als tekst onderaan.
- Opslag: bestaande bucket `invoices`, pad `<tenant_id>/payment-requests/<PR-nummer>.pdf` (`upsert: true`). Alleen het **pad** in de DB (`billing_cycles.pdf_path`), nooit een signed URL. Geen UBL — een betalingsverzoek is geen fiscaal document.

**b) `create-cycle-payment-link` (nieuw)**
- Input `{ billing_cycle_id }`; idempotent volgens `create-invoice-payment-link`: sessie < 24 u hergebruiken, anders nieuwe.
- Stripe Checkout via `getStripeContext(tenant)` (Direct Charge voor connected tenants, platformaccount voor de interne tenant), `mode: 'payment'`, `line_items` met `price_data` (`Betalingsverzoek <PR-nummer>`), `customer_email` van de klant.
- Betaalmethodes: **geen** `payment_method_types` meesturen, zodat Stripe automatisch kaart/Bancontact/iDEAL/wallets aanbiedt (bewuste afwijking van `create-invoice-payment-link`, dat de lijst hardcodeert).
- Metadata: sessie-metadata `{ billing_cycle_id, tenant_id, payment_request_number }` **én** `payment_intent_data.metadata: { billing_cycle_id, tenant_id }`.
- success/cancel: `${PUBLIC_APP_URL}/pay/success?pr=<PR>` en `/pay/cancelled?pr=<PR>` (bestaande publieke routes; geen nieuwe pagina in deze batch).
- Slaat `checkout_session_id` / `_url` / `_created_at` op de cycle op.

**c) `send-payment-request-email` (nieuw)**
- Resend + `EMAIL_SENDERS` + `getTenantBrand`/`renderTenantEmail`/`formatAmount`/`t` — exact de stack van `send-invoice-email`.
- Onderwerp: `Betalingsverzoek <PR-nummer> — <tenantnaam>`.
- Body: vriendelijke toon, periode + bedrag + vervaldatum, prominente betaalknop naar de checkout-URL, plus de disclaimer dat de factuur direct na betaling volgt.
- PDF als bijlage via `storage.from('invoices').download(pdf_path)` (service-role, base64 zoals in `send-invoice-email`) — geen signed URL in de mail nodig.
- Herinneringsvarianten via optionele `reminder_level: 1|2|3` (3 = laatste kennisgeving bij expiry), zelfde patroon als `send-invoice-email`.
- Pay-first mailt altijd; `subscriptions.auto_send` wordt niet gelezen (consistent met CYCLE-3).

**Orkestratie: `dispatch-payment-request` (nieuw, dun)**
- Input `{ billing_cycle_id, reminder_level? }`: cycle laden → guard (`status in ('awaiting_payment','reopened')`, `invoice_id is null`) → PR-nummer garanderen via `generate_payment_request_number` als het leeg is → paylink → PDF → mail → `request_sent_at` / `last_reminder_at` bijwerken.
- Dit is het enige adres dat de runner en de reminder-cron kennen; beide roepen het **best-effort** aan (in een `safe()`-wrapper, faalt nooit de runner).

**Aanroeppunten**
- Runner (`generate-subscription-invoices`): in `handlePendingCycle`, ná `toAwaitingPayment()`, in beide takken die op `awaiting_payment` uitkomen — `mode='manual'` én het vangnet `mode='mandate'` zonder actief mandaat. Best-effort; faalt de dispatch, dan pikt de reminder-cron de cycle de volgende dag op (`request_sent_at is null`).
- Verder niets in de webhook.

## 2. Checkout → payment_intent metadata

`payment_intent_data.metadata` op de sessie wordt door Stripe letterlijk gekopieerd naar het aangemaakte PaymentIntent. Daardoor draagt `payment_intent.succeeded` de `billing_cycle_id` en pikt de bestaande CYCLE-3-tak (`handleCycleCharge`) hem op **zonder enige wijziging**: factuur `paid` aanmaken, cycle `settled`, PDF + mail. Dat geldt ook voor een cycle op `expired`, want CYCLE-3 filtert alleen op `settled`/`invoice_id`.

Conclusie: `checkout.session.completed` hoeft **niets** te doen; we voegen geen handler toe. Twee kanttekeningen die het ontwerp expliciet afdekt:
- Vertraagde methodes (SEPA via Checkout) leveren pas later `payment_intent.succeeded`. De cycle blijft tot dan `awaiting_payment` en zou een herinnering kunnen krijgen terwijl er al betaald wordt. Mitigatie: bestaat er een `checkout_session_id` jonger dan 7 dagen, dan slaan we niveau-verhoging over en loggen dat (geen extra Stripe-call).
- `stripe-connect-webhook` geeft `payment_intent.succeeded` van connected accounts al door aan de shared handler (sinds CYCLE-3); we verifiëren dat en deployen hem mee als er iets aan `_shared` wijzigt.

## 3. Herinnering/expiry-cron

Nieuwe functie `process-cycle-reminders`, opgebouwd volgens `process-invoice-dunning` (service-role client, `safe()`-wrapper i.p.v. `.catch()`, summary in de response, optionele `{ billing_cycle_id }` voor een handmatige run).

Selectie: `billing_cycles` met `status in ('awaiting_payment','reopened')`, `invoice_id is null`, `limit 500`.

Niveaus (vriendelijke toon, geen aanmaning, geen boete, geen rente):

| Situatie | Actie |
|---|---|
| `request_sent_at is null` | eerste verzending (dispatch zonder reminder_level) |
| vandaag ≥ `due_date` en `reminder_level < 1` | niveau 1 |
| vandaag ≥ midpoint(`due_date`, `grace_until`) en `reminder_level < 2` | niveau 2 |
| vandaag > `grace_until` | `status='expired'` + niveau 3 (laatste kennisgeving) |

Elke actie: dispatch best-effort, dan `reminder_level` / `last_reminder_at` bijwerken. Bij expiry ook een `notifications`-rij (categorie `billing`, prioriteit `high`) voor de platformadmin, zoals dunning doet.

Idempotentie/veiligheid:
- Verhoging alleen naar een hoger niveau, plus dag-guard: overslaan als `last_reminder_at::date = today`.
- Update-guards: `.eq('status', <verwachte status>)` + `.is('invoice_id', null)`, zodat een cycle die intussen door de webhook is gesettled nooit wordt teruggezet of geëxpireerd.
- Expiry raakt uitsluitend `billing_cycles.status`; `subscriptions` en `tenant_subscriptions` blijven onaangeraakt (suspensie = LOCK-1).

Cron: nieuwe pg_cron-job `process-cycle-reminders-daily`, `30 7 * * *`, exact het `net.http_post` + `vault.decrypted_secrets` / `cron_service_role_key`-patroon van job 47/61, met `cron.unschedule`-guard vooraf. Wordt via runtime-SQL gezet (geen migratie met projectspecifieke keys).

## 4. Migratie (kolommen die nog missen)

`billing_cycles` (CYCLE-1) heeft geen opslagvelden voor PDF/checkout/verzending. Eén additieve migratie, geen DROP:

```text
ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_url text,
  ADD COLUMN IF NOT EXISTS checkout_session_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS billing_cycles_reminder_scan_idx
  ON public.billing_cycles (status, grace_until) WHERE invoice_id IS NULL;
```

RLS/GRANTs blijven zoals CYCLE-1 (tenant-scoped, `service_role` ALL).

Optioneel: `get-document-url` uitbreiden met `doc_type: 'payment_request'` (tabel `billing_cycles`, bucket `invoices`, pad-kolom `pdf_path`, nummerkolom `payment_request_number`) zodat 2a·4 de PDF veilig kan downloaden. Puur code, geen DDL — meenemen tenzij je het bij de frontend-batch wil.

## 5. Hergebruik

| Bestaand | Gebruikt voor |
|---|---|
| `generate-subscription-invoice-pdf` | template- en storage-patroon van de PDF |
| `create-invoice-payment-link` | idempotente Checkout-sessie + `getStripeContext` |
| `send-invoice-email` | Resend, `EMAIL_SENDERS`, tenant-branding, bijlage-download, reminder_level |
| `process-invoice-dunning` | cron-skelet, `safe()`, summary, notifications |
| `_shared/subscriptionCharge.ts` | ongewijzigd — vangt de Checkout-betaling al af |
| cron-jobs 47/61 | vault-service-role cron-patroon |

## 6. Risico's

1. **Dubbele mail** als dispatch slaagt maar de `request_sent_at`-update faalt; beperkt door de dag-guard, in het slechtste geval één duplicaat.
2. **Verouderde betaallink**: een sessie > 24 u wordt vervangen, maar een oude PDF bij de klant houdt de oude URL. Elke herinnering regenereert daarom PDF én link samen.
3. **Vertraagde betaalmethodes** kunnen een onnodige herinnering triggeren — gemitigeerd met de 7-daagse sessie-guard, niet volledig uitgesloten.
4. **Toon/juridisch**: teksten expliciet als verzoek; nergens "aanmaning", "vordering" of "wettelijke rente".
5. **Interne tenant als afzender**: onvolledige adres-/btw-gegevens maken de PDF karig. De functie faalt daar niet op, maar het is een datacheck vóór de eerste echte verzending.
6. **Bucket-hergebruik**: betalingsverzoeken in de `invoices`-bucket in een submap houdt het overzichtelijk maar mengt documenttypes; alternatief is een aparte bucket.

## 7. Open vragen

1. PDF in de bestaande `invoices`-bucket onder `payment-requests/`, of een nieuwe private bucket `payment-requests`?
2. `get-document-url` nu al uitbreiden met `payment_request`, of pas bij 2a·4?
3. Mailtaal: vaste NL-teksten (zoals de huidige subscription-mails), of meteen via `tenantEmailI18n` op klanttaal?
4. Bij niveau 2/3 ook een `notifications`-rij voor de platformadmin, of alleen bij expiry?
5. Success-URL: bestaande `/pay/success` hergebruiken, of een eigen `/pay/pr-success` met "je factuur volgt per mail"?
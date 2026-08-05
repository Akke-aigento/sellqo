# CYCLE-1 — Billing-cycle-engine: schema + runner-vertakking

Doel: pay-first facturatie mogelijk maken zonder één gram gedragsverandering voor bestaande abonnementen. Nieuwe cycli worden geregistreerd in `billing_cycles`; facturen volgen pas na betaling (CYCLE-3).

## 1. Migratie-ontwerp (DDL-schets)

**1a. Enums** (als types, `IF NOT EXISTS`-safe via `DO $$`):
- `billing_payment_mode`: `mandate`, `manual`
- `billing_model`: `pay_first`, `invoice_first`
- `billing_cycle_status`: `pending`, `awaiting_payment`, `processing`, `settled`, `expired`, `reopened`

**1b. `subscriptions`** — twee kolommen toevoegen:
- `payment_mode billing_payment_mode NOT NULL DEFAULT 'mandate'`
- `billing_model billing_model NOT NULL DEFAULT 'pay_first'`

Backfill in dezelfde migratie, direct na `ADD COLUMN`:
`UPDATE public.subscriptions SET billing_model = 'invoice_first' WHERE created_at <= now();` — alle bestaande rijen (incl. de Astra-sub `dfe77faa`) blijven op het huidige pad; alleen ná deze migratie aangemaakte subs zijn pay-first. `payment_mode` blijft voor bestaande rijen op `mandate` (dat is het bestaande gedrag: mandaat-charge of geen mandaat).

**1c. Tabel `public.billing_cycles`**
```
id uuid pk default gen_random_uuid()
subscription_id uuid not null references public.subscriptions(id) on delete cascade
tenant_id uuid not null
customer_id uuid
period_start date not null
period_end   date not null
subtotal numeric(12,2) not null default 0
vat_amount numeric(12,2) not null default 0
total numeric(12,2) not null default 0
mode billing_payment_mode not null
model billing_model not null default 'pay_first'
status billing_cycle_status not null default 'pending'
payment_request_number text            -- PR-JJJJ-xxxx, alleen bij mode='manual'
due_date date
grace_until date
invoice_id uuid references public.invoices(id) on delete set null
stripe_payment_intent_id text
reminder_level integer not null default 0
last_reminder_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```
Constraints/indexen:
- `UNIQUE (subscription_id, period_start)` — dé idempotentie-sleutel
- `UNIQUE (tenant_id, payment_request_number)` waar `payment_request_number IS NOT NULL` (partieel)
- index op `(status, due_date)` en `(tenant_id, status)` voor CYCLE-2-cron
- `updated_at`-trigger via bestaande `public.update_updated_at_column()`

Grants + RLS (patroon van `invoices`):
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_cycles TO authenticated;
GRANT ALL ON public.billing_cycles TO service_role;
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
-- SELECT/INSERT/UPDATE/DELETE TO authenticated USING tenant_id IN (SELECT public.get_user_tenant_ids())
```
Geen `anon`-grant. Runner werkt met service_role en bypasst RLS.

**1d. RPC `public.generate_payment_request_number(_tenant_id uuid)`**
Exacte kopie van het `generate_invoice_number`-patroon: `SECURITY DEFINER`, `SET search_path = public`, tenant-guard (`auth.uid() IS NOT NULL AND NOT (is_platform_admin OR tenant in get_user_tenant_ids)` → 42501), vast prefix `PR`, jaar uit `now()`, `MAX(SUBSTRING(payment_request_number FROM 'PR-JJJJ-(\d+)'))+1`, `LPAD(...,4,'0')`. Teller leest uit `billing_cycles` gefilterd op tenant + jaar. `REVOKE EXECUTE ... FROM anon` conform de SEC-1-hardening; `GRANT EXECUTE TO authenticated, service_role`.

## 2. Runner-vertakking (`generate-subscription-invoices`)

Hergebruik ongewijzigd: `advanceDate`/`toISODate`, eligible-filter (`generate_days_before`, `end_date`-guard), de pending-plan/downgrade-block, de totalen-berekening uit `subscription_lines`, `getStripeContext`, en de `next_invoice_date`-advance.

Wijzigingen, in volgorde:
1. Select uitbreiden met `payment_mode, billing_model` (verder ongemoeid).
2. Pending-plan-block loopt zoals nu, vóór alles.
3. Nieuwe splitsing direct na `periodEndAdj`:
   - `billing_model !== 'pay_first'` → **exact de bestaande code** (`subscription_invoices`-check, invoice + lines, link, advance, PDF, charge, mail). Geen enkele regel gewijzigd.
   - `billing_model === 'pay_first'` → nieuw pad hieronder.
4. Pay-first pad:
   - Idempotentie: `insert` in `billing_cycles` met `(subscription_id, period_start)`; bij unique-violation (`23505`) → `summary.skipped_existing++`, `continue`. Insert-first i.p.v. select-first sluit de race die de bestaande `maybeSingle()`-check openlaat.
   - Lines leeg → skip zoals nu (`skipped_no_lines`), geen cycle.
   - Totalen uit dezelfde bereken-loop; opgeslagen als `subtotal/vat_amount/total`. Er wordt **geen** invoice en **geen** `invoice_lines` aangemaakt, en geen `generate_invoice_number` aangeroepen.
   - `mode = sub.payment_mode`:
     - `mandate`: mandaat ophalen (zelfde query als nu). Actief mandaat → `paymentIntents.create` met metadata `{ billing_cycle_id, tenant_id, subscription_id }` — **zonder** `invoice_id`. Intent-id wegschrijven, status `processing` (ook bij `succeeded`; de webhook zet `settled` + maakt de factuur in CYCLE-3, zodat er precies één plek is die factureert). Bij `requires_*`/`canceled`/exception → `status='awaiting_payment'`, `due_date = period_start`, `grace_until = due_date + 7 d`, `reminder_level = 0`; teller `charge_failed`. Geen actief mandaat → zelfde `awaiting_payment`-uitkomst, teller `no_mandate`.
     - `manual`: `generate_payment_request_number(tenant_id)` → `payment_request_number`, `status='awaiting_payment'`, `due_date = period_start`, `grace_until = due_date + 7 d`.
   - `next_invoice_date`/`last_invoice_date`-advance daarna, identiek aan nu (advance is bewust gekoppeld aan cycle-aanmaak, niet aan betaling).
   - Geen PDF-call en geen `send-invoice-email` in dit pad — dat is CYCLE-2 (betalingsverzoek) resp. CYCLE-3 (factuur na betaling).
5. Summary uitbreiden met `cycles_created`, `cycles_awaiting_payment`, `cycles_processing` zodat cron-logs de twee paden scheiden.

**Vooruitblik CYCLE-3 (nu niet bouwen):** `_shared/subscriptionCharge.ts` returnt vandaag `false` zonder `metadata.invoice_id`. Daar komt een tweede tak op `metadata.billing_cycle_id`: cycle → `settled`, factuur direct als `paid` aanmaken (`generate_invoice_number`, lines uit de cycle-totalen), `invoice_id` terugschrijven. Daarom is `invoice_id` nullable en houden we de cycle-totalen redundant op de cycle: de factuur is dan reconstrueerbaar zonder de subscription-lines opnieuw te lezen (die kunnen intussen gewijzigd zijn door een downgrade).

## 3. Idempotentie- en race-analyse

- **Dubbele run op dezelfde dag:** `UNIQUE (subscription_id, period_start)` blokkeert de tweede cycle. Bovendien is `next_invoice_date` al doorgezet, dus de sub is niet meer eligible.
- **Twee gelijktijdige runs (cron + handmatige "Genereer nu"):** insert-first + unique constraint maakt dubbele cycli onmogelijk. Wél mogelijk: run A maakt cycle, run B faalt met 23505 en skipt — correct.
- **Timeout ná cycle-insert, vóór de charge:** cycle blijft `pending`. Dat is een echt gat: de volgende dag is de sub niet meer eligible (advance is al gedaan óf niet, afhankelijk van waar de timeout viel). Mitigatie in dit plan: aan het begin van elke run een sweep die cycli met `status='pending'` en `created_at < now() - 1 uur` opnieuw afhandelt (charge of PR-nummer toekennen). Kleine, afgebakende extra lus.
- **Timeout ná charge, vóór de advance:** cycle bestaat mét intent; volgende run is sub nog eligible → insert faalt op 23505 → skip → `next_invoice_date` blijft achter en de sub loopt vast. Mitigatie: bij een 23505-skip de bestaande cycle ophalen en, als `period_start === sub.next_invoice_date`, de advance alsnog uitvoeren (zelf-herstellend, geen dubbele charge).
- **Stripe-idempotentie:** `paymentIntents.create` krijgt een `idempotencyKey` = `cycle:<billing_cycle_id>`, zodat een retry na netwerkfout nooit dubbel incasseert.
- **PR-nummerreeks:** `MAX(...)+1` is niet concurrency-veilig onder parallelle inserts. Voor de cron-cadans (één proces) acceptabel en identiek aan het bestaande factuurnummerpatroon; het partiële unique-index vangt een collision af als error, geen stille duplicaat.

## 4. Risico's

1. **Dubbele facturatie bij een verkeerd gezette `billing_model`.** Als een sub op `pay_first` staat maar er al `subscription_invoices`-rijen bestaan, controleert het pay-first pad die tabel niet. De backfill sluit dit uit voor bestaand bestand; toekomstig omzetten van een lopende sub naar pay-first is riskant en hoort een expliciete guard/handmatige stap te worden (buiten CYCLE-1).
2. **Cycli zonder eindstation.** Zolang CYCLE-3 er niet is, blijft een `processing`-cycle na een succesvolle SEPA-betaling hangen zonder factuur — dus btw-technisch onvolledig. Daarom moeten er tot CYCLE-3 in productie géén pay-first subs live gezet worden. Aanbeveling: CYCLE-1 en CYCLE-3 vlak na elkaar deployen, of pay-first tijdelijk alleen op de interne test-tenant.
3. **`payment_intent.succeeded` zonder `invoice_id` valt vandaag door de webhook heen** (`subscriptionCharge.ts` returnt `false`) — de betaling wordt dan stil genegeerd. Idem risico 2: CYCLE-3 is functioneel blokkerend.
4. **Enum-uitbreiding is lastig terug te draaien.** `status='reopened'` heeft nog geen producer/consumer; die blijft ongebruikt tot CYCLE-2. Bewust meegenomen om latere enum-migraties te vermijden.
5. **Runner-runtime.** Twee paden + sweep-lus verhogen de looptijd. Bij groei is per-tenant batching nodig; nu (1 actieve sub) geen probleem.
6. **`grace_until` +7 dagen is hardcoded.** Zou eigenlijk per tenant/plan configureerbaar moeten zijn; nu constante, met een TODO.

## 5. Open vragen

1. Bij `mode='mandate'` en `intent.status === 'succeeded'`: cycle direct `settled` zetten in de runner, of altijd de webhook laten beslissen? Mijn voorstel is het tweede (één factureer-plek), maar dan hangt een succesvolle kaartbetaling kort op `processing`.
2. Moet een `pay_first`-cycle ook een `subscription_invoices`-rij krijgen zodra de factuur in CYCLE-3 bestaat, of wordt `billing_cycles.invoice_id` de enige koppeling? Twee bronnen van waarheid wil ik vermijden.
3. `expired` — wie zet die? Vermoedelijk de CYCLE-2-cron na `grace_until`. En: schorst dat het abonnement (`status`), of alleen de cycle?
4. Bij `expired` en daarna toch betaling: `reopened` op dezelfde cycle, of nieuwe cycle? Dit bepaalt of de period-unique constraint later in de weg zit.
5. Wordt `payment_mode` per abonnement of per klant gezet? Nu per subscription; een klant met mandaat maar handmatige wens moet dan per sub gezet worden.
6. Moet de sweep voor blijven-hangende `pending`-cycli in CYCLE-1 mee, of liever als aparte mini-batch?

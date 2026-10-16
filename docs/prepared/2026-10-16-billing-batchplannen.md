# Platformfacturatie: drie batchplannen (BILL-2, BILL-3, SUB-UNIFY)

Recon 16-10-2026, alleen lezen. Repo `/home/claude/sellqo` op `4f51953` (gelijk aan `origin/main`). De live-DB is nagekeken via de connector, alleen met SELECT. Er is niets gewijzigd.

Het gaat hier over de facturatie van SellQo aan zijn tenants. Die loopt via de facturatietenant `sellqo` = `d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`. Die tenant heeft geen `stripe_account_id`, dus alles draait op het platform-Stripe-account.

## 0. Vooraf: ID-botsing en efficiëntie-pass

**De namen BILL-2 en BILL-3 zijn al gebruikt** in `docs/role-audit.md`:
- `BILL-2` (25-08, r. 7326): fiscale velden op abonnementsfacturen. Dat was **alleen invoice-first** plus een mismatch-vlag in de pay-first-webhook.
- `BILL-3` (25-08, r. 7088): `process-refund` voor **tenant-retouren**. Dat is iets anders dan refunds op platformbetalingen.

De open punten van 14-10 (r. 614 en 18188) gebruiken "BILL-2" toch weer voor de 21%-bug.

**Voorstel:** nieuwe ID's, zodat de paper trail niet door elkaar loopt:
- **BILL-VAT-PF-1** (= BILL-2 uit deze opdracht)
- **BILL-REFUND-1** (= BILL-3)
- **SUB-UNIFY-2** (= SUB-UNIFY)

Hieronder gebruik ik voor de leesbaarheid de namen uit de opdracht.

**Efficiëntie-pass:**
1. Er is geen nieuwe tool nodig. Connector-SQL plus CC volstaat.
2. De plek klopt: dit is multi-file werk in CC en de deploy loopt via de Lovable-agent.
3. Er is een terugkerend patroon: nieuwe cycle-makers vergeten steeds het btw-regime (vier plekken met een hardcoded `21`). Daarom zit in plan 1 één helper `resolveCycleFiscal`. Die zou ook in skill `sellqo-gedeelde-paden` moeten (voorstel onderaan).
4. Toekomstige-Akke vindt het omslachtig dat elke deploy van een `_shared`-bestand drie functies raakt. De lijsten staan per plan klaar.

---

## 1. BILL-2: het btw-regime op abonnementsfacturen (pay-first)

### 1.1 Wat gaat er precies fout

Er zijn **drie lagen**, en elk ervan maakt verlegging op zich al onmogelijk.

**A. De pay-first-cyclus bepaalt nooit een regime.**

`generate-subscription-invoices/index.ts:580-600` berekent de bedragen van de cyclus uit `subscription_lines.vat_rate`, zonder resolver. Die regel is altijd 21, want hij wordt op vier plekken hardcoded gezet:

| Bestand | Regels | Wat er staat |
|---|---|---|
| `sync-tenant-plan/index.ts` | 42 | `const VAT_RATE = 21` |
| `sync-tenant-plan/index.ts` | 279 en 396 | activate en reuse schrijven die waarde weg |
| `generate-subscription-invoices/index.ts` | 516, 529, 555 | pending downgrade/interval: `vat_rate: 21` |
| `_shared/planProration.ts` | 161-163 | pro-rata neemt de btw van regel 0, met fallback 21 |
| `mail-billing-api/index.ts` | 40 en 221 | `VAT_RATE = 21` voor Akke Mail-cycli |

De BILL-2-resolver van 25-08 draait alleen op het invoice-first-pad (`generate-subscription-invoices:689-760`), waar het regime het bedrag bepaalt.

**B. De webhook dwingt 21% expliciet af.**

`_shared/subscriptionCharge.ts:461-525` resolvet wél, maar bij een tariefverschil geldt:
- `mismatch` → `vat_regime: "domestic_standard"` (r. 499-503);
- er komt `metadata.vat_regime_mismatch` op de factuur.

Dat is bewust zo ("het bedrag bepaalt het regime"). Omdat A altijd 21% int, wordt een geldige EU-B2B-klant dus **gegarandeerd** een binnenlandse 21%-factuur. Dat is de "geforceerd naar 21%" uit de audit van 14-10.

**C. De facturatieklant mist de fiscale data, en het land staat standaard op NL.**
- `ensureBillingCustomer` (`sync-tenant-plan/index.ts:205-243`) maakt de klant aan met alleen e-mail, bedrijfsnaam, `customer_type:'b2b'` en `external_id`. Geen `vat_number`, geen `billing_country`.
- De DB-trigger `register_tenant_as_sellqo_customer` (live functiedefinitie) kopieert evenmin btw-nummer of land.
- `customers.billing_country` heeft **default `'NL'`** (`migrations/20260116104653_…sql:13`).
- Gevolg: elke tenant die via de trigger binnenkomt, krijgt land NL. Live geldt dat al voor The Fonske Crawl en Studio Akke, terwijl het Belgische tenants zijn.

**D. (Latent, maar fiscaal fout) Een SaaS-abonnement wordt als goederenlevering geclassificeerd.**
- `regimeResolver.ts:270-272`: `has_goods = lines.some(l => !l.product_category || …)`.
- Abonnementsregels dragen geen categorie, dus `has_goods = true`. Bij een geldige VIES geeft dat `ic_supply_goods` (r. 153-154): vak **46**, tekst "art. 39bis intracommunautaire levering", grootboek 700300.
- Voor een dienst hoort dat `ic_supply_services` te zijn: vak **44**, "Btw verlegd – art. 21 §2", grootboek 706000.
- Dezelfde fout zit in BILL-2-pad 1 van augustus. De BILL-2-testverwachting "NL-B2B → `ic_supply_goods`" (role-audit r. 7516) was dus zelf fout.

**E. (Latent) Odoo kiest het eerste 0%-tarief.**
- `sync-odoo-invoices/index.ts:184-194`: buiten OSS zoekt `resolveTax` op `amount = rate` met `limit 1`.
- Een 0%-verleggingsfactuur landt dus op een willekeurige 0%-tax ("0%", "0% EU G", "0% EU S" of export).
- De SellQo-tenant **is** aan Odoo gekoppeld: 1 credential, 24 synclogs, geen `odoo_tax_mappings`.
- De Peppol-verzending en de aangifte lopen via Odoo. Die verkeerde tax is dus het eigenlijke geldrisico richting de fiscus.

### 1.2 Live data

Query 1, alle platformfacturen:
```sql
select i.invoice_number, i.status, i.subtotal, i.tax_amount, i.is_b2b, i.vat_regime,
       i.reporting_country, i.peppol_status, c.customer_type, c.vat_number, c.billing_country
from invoices i left join customers c on c.id = i.customer_id
where i.tenant_id = 'd03c63fe-48c6-4ff7-a30b-7506ea3e71ab' order by i.created_at;
```

Uitkomst:
- **15 facturen**, de laatste op **17-08-2026** (SQ-2026-0010).
- Alle 15 hebben `vat_regime = domestic_standard` en `reporting_country = NULL`. **Geen enkele** heeft `is_b2b = true`.
- Er is **geen factuur van na de BILL-2-deploy**. BILL-2 is dus nooit in de praktijk bewezen.
- **Bedragen fout: 0.** Alle klanten met een factuur zijn BE, of NL zonder btw-nummer (Sandbox en Speeltuin, testklanten). Voor hen is 21% juist.
- **Fiscale metadata fout: 6 facturen** met `customer_type = 'b2b'` en `is_b2b = false`:
  - **SQ-2026-0001 (Ozay/Astra, € 60,50, unpaid, `peppol_status = 'sent'`)** is de enige echte;
  - INV-2026-0004, SQ-2026-0005/0006/0007/0008/0009 zijn testklanten.
- `metadata ? 'vat_regime_mismatch'`: 0 rijen. Er is nog nooit een EU-B2B-cyclus betaald.

Query 2, cycli:
```sql
select bc.status, bc.cycle_type, bc.subtotal, bc.vat_amount, c.vat_number, c.billing_country
from billing_cycles bc left join customers c on c.id = bc.customer_id
where bc.tenant_id = 'd03c63fe-…' order by bc.created_at;
```

Uitkomst: 5 cycli, allemaal 21%, alle subscription lines `21.00`. Astra oktober staat `expired` (€ 35,09, BE, terecht 21%).

Query 3, de facturatieklanten op de SellQo-tenant (11 stuks):
- `vat_verified = true`: 1 (Baram);
- `billing_country = NL`: 4. Daarvan zijn er **2 fout**: The Fonske Crawl en Studio Akke, met `tenants.country = BE`. Sandbox en Speeltuin zijn testklanten;
- `vat_number` leeg: 5, onder meer Fonske en Studio Akke, terwijl `tenants.btw_number = BE1017500207`;
- Zona Dorata: `tenants.btw_number = ''`, maar de klant heeft `BE0723862104`. Die divergentie is bestaand.

Query 4, de echte tenants: **alle tenants zijn BE** (`tenants.country`). Vandaag wordt er dus **geen euro te veel geïnd**. De bug is latent en gaat af bij de eerste NL/DE-B2B-tenant, of zodra iemand NL-default-klanten een btw-nummer geeft.

### 1.3 Voorgestelde wijzigingen

**Nieuw `_shared/cycleFiscal.ts`, puur plus één client-call.**
- `resolveCycleFiscal(supabase, {tenant_id, customer_id, lines, order_date})` hergebruikt `resolveInvoiceFiscalFields`.
- Elke regel gaat erin met `product_category: 'digital_service'`.
- Het resultaat is `{ rates: number[] per regel, vat_regime, fiscal_snapshot }`.
- Regel voor het tarief: zelfde clausule als pad 1 (`isDomesticFamilyRegime` → opgeslagen `vat_rate`, anders het resolver-tarief, dus 0). Nooit hoger dan het opgeslagen tarief: een min-guard tegen de "6% → 21%"-val uit BILL-2.

**`generate-subscription-invoices/index.ts:580-620` (pay-first-tak).**
- `resolveCycleFiscal` vóór `computeVatTotals`.
- De totalen worden berekend met de opgeloste tarieven.
- `vat_regime` en `fiscal_snapshot` gaan mee in de cycle-insert.
- Hier bepaalt het regime het bedrag (net als pad 1): er is nog niets geïnd.

**Pad 1 (r. 704-706) en `subscriptionCharge.ts:480`.**
- `product_category: 'digital_service'` toevoegen aan de resolver-input. Dat lost D op.

**`_shared/subscriptionCharge.ts:461-525`.**
- Heeft de cyclus een `vat_regime`, dan wint dat, zonder nieuwe resolver-call en zonder VIES-latency in de webhook.
- De mismatch-check blijft als vangnet: snapshot-tarief tegen geïnd tarief.
- Cycli zonder `vat_regime` (oude rijen) volgen het huidige gedrag.
- **Niet gelijktrekken met pad 1:** het comment in BILL-2 blijft staan.

**`sync-tenant-plan/index.ts`.**
- `ensureBillingCustomer` (r. 205-243): bij aanmaak `vat_number` (uit `billing_vat_number`, anders `btw_number`, gecleaned), `billing_country` (uit `tenants.country`, anders BE) en een eventueel adres meegeven.
- Bij een bestaande klant: lege velden aanvullen, nooit overschrijven.
- De pro-rata-cyclus (r. 695-710) gaat via `resolveCycleFiscal`.

**`_shared/planProration.ts:161-178`.** Een tariefparameter van de aanroeper accepteren, in plaats van regel 0 met fallback 21.

**`generate-subscription-invoices:516/529/555` en `mail-billing-api:221`.** Geen hardcoded 21 meer. De opgeslagen line-rate blijft 21 als "binnenlands tarief"; het regime wordt per cyclus bepaald, zodat de lines niet herschreven hoeven te worden.

**`generate-payment-request-pdf/index.ts:62/215`.**
- `vat_regime` selecteren;
- bij een niet-binnenlands regime de `vat_regimes.invoice_text_nl` tonen, net als `generate-subscription-invoice-pdf:221-232`.

**`sync-odoo-invoices/index.ts:184-194`.**
- Bij `vat_regime ∈ {ic_supply_services, ic_supply_goods, export_outside_eu}` gericht zoeken: `name ilike` op "EU S", "EU G" of "export", of via `odoo_tax_mappings` per regime.
- Wordt er geen match gevonden: **fout loggen en de factuur niet syncen**, nooit terugvallen op de eerste 0%-tax.
- **Dit is een gedeeld pad** (alle tenants met Odoo). De wijziging raakt alleen 0%-regimes. Domestic en OSS blijven byte-identiek.

### 1.4 Migraties (additief en idempotent)

1. `billing_cycles`: twee kolommen toevoegen.
   ```sql
   alter table public.billing_cycles add column if not exists vat_regime text;
   alter table public.billing_cycles add column if not exists fiscal_snapshot jsonb;
   ```
   Allebei nullable, zonder default. Terugdraaien kan met drop; de data is herberekenbaar.

2. Trigger `register_tenant_as_sellqo_customer` uitbreiden met `vat_number` (`coalesce(nullif(billing_vat_number,''), nullif(btw_number,''))`) en `billing_country` (`coalesce(NEW.country,'BE')`).
   - In de `DO UPDATE`: alleen `coalesce(customers.x, EXCLUDED.x)`.
   - `CREATE OR REPLACE`, met het oude functielijf als comment voor de rollback.
   - **De kolomdefault `'NL'` niet wijzigen.** `customers` is een gedeelde tabel voor alle tenant-klanten.

3. Data, apart en pas na go:
   - Fonske en Studio Akke `billing_country` naar BE, plus `vat_number` aanvullen;
   - snapshot in `snapshots.sellqo_<datum>_customers` en een log in `admin_billing_actions`.
   - **Geen** UPDATE op bestaande facturen (zie de beslisvragen).

### 1.5 Risico's (geld)

- **Te weinig innen.** Een fout `ic_supply_services` laat 21% liggen die SellQo zelf aan de fiscus verschuldigd is. Guard: alleen 0% bij een **verse, geldige VIES** én `billing_country ≠ BE`. Die VIES-controle zit al in de resolver.
- **Te veel innen.** Voorkomen door de min-guard: het opgeloste tarief is nooit hoger dan het opgeslagen tarief.
- **VIES-timeout (5 s)** in de cron-loop. Bij een timeout valt de resolver terug op domestic. Dat is veilig (21%), maar wordt gelogd in `fiscal_snapshot.warnings`.
- **Lopende cycli.** Een cyclus die al bestaat of half is betaald, wordt niet herrekend. Alleen nieuwe cycli krijgen het regime. Astra oktober blijft € 35,09.
- **Odoo.** Een nieuwe syncfout bij een 0%-factuur is een bewuste fail-loud. Er staan nu nul 0%-platformfacturen, dus er breekt niets bestaands.

### 1.6 Testplan

- Unit (vitest, zoals `src/test/billFix1.test.ts`): de pure tarief- en regimekeuze van `cycleFiscal` voor BE-B2B, NL-B2B met geldige en ongeldige VIES, buiten-EU-B2B, B2C-NL en een 6%-regel (die blijft 6).
- Lokaal `deno check` met de stub-importmap op de vier gewijzigde functies.
- Na de deploy:
  - GET-stempel op `generate-subscription-invoices`, `platform-stripe-webhook`, `stripe-connect-webhook`, `sync-tenant-plan`, `generate-payment-request-pdf` en `sync-odoo-invoices`;
  - `generate-subscription-invoices` met `{subscription_id}` op Speeltuin, na een tijdelijke NL-test-klant met een echt geldig NL-btw-nummer.
- Verwacht na die run:
  - de cyclus heeft `vat_amount = 0` en `vat_regime = 'ic_supply_services'`;
  - het PI-bedrag in Stripe is het nettobedrag;
  - de factuur na betaling heeft `vat_regime = ic_supply_services` en `is_b2b = true`, zonder mismatch-metadata;
  - de PDF bevat de art. 21 §2-tekst;
  - in Odoo komt de factuur op de 0% EU S-tax terecht.
- Non-regressie: een BE-B2B-cyclus blijft byte-identiek (`subtotal`, `vat_amount` en `total` gelijk aan vóór de wijziging).

### 1.7 Deploy (met `grep -rl` gecontroleerd)

| Wijziging in | Te deployen functies |
|---|---|
| `_shared/subscriptionCharge.ts` | `generate-subscription-invoices`, `platform-stripe-webhook`, `stripe-connect-webhook` |
| `_shared/invoiceFiscalFields.ts` (als aangeraakt) | bovenstaande drie + `generate-subscription-invoice-pdf` |
| `_shared/planProration.ts` | `sync-tenant-plan` + de drie importeurs van `subscriptionCharge` (`planProration` → `subscriptionCharge`) |
| nieuw `_shared/cycleFiscal.ts` | `generate-subscription-invoices`, `sync-tenant-plan`, `mail-billing-api` (+ `subscriptionCharge`-importeurs als die hem importeert) |
| rechtstreeks | `generate-payment-request-pdf`, `sync-odoo-invoices` |

**Totaal: 8 functies.** `regimeResolver.ts` blijft ongemoeid; wordt hij toch aangeraakt, dan komen er nog 7 bij, waaronder `storefront-api`. **Dat dus niet doen.**

### 1.8 Beslisvragen voor Akke

1. **Facturen die al verzonden zijn met `is_b2b = false`**, met als echt geval SQ-2026-0001 (Ozay, € 60,50, nog unpaid, al via Peppol `sent`). Het bedrag en het regime kloppen (BE/BE = 21%); alleen de vlag is fout. **Aanbeveling:** alleen `is_b2b`/`reporting_country` metadata-corrigeren via een UPDATE met snapshot. Geen creditnota, want het fiscale bedrag verandert niet. Testfacturen ongemoeid laten.
2. **Volgt het btw-regime de facturatieklant of `tenants.btw_number`?** **Aanbeveling:** de facturatieklant is de bron. De trigger en `ensureBillingCustomer` vullen alleen lege velden. Wijzigt een tenant later zijn btw-nummer, dan is dat een aparte sync.
3. **Odoo zonder match: syncen blokkeren of "manual_action" zetten?** **Aanbeveling:** `peppol_status = 'manual_action'` plus een melding (`notifications.category = 'integrations'`). Een factuur nooit met een gegokte tax laten vertrekken.
4. **Buiten-EU-B2B** (bv. CH): de resolver geeft `export_outside_eu` met de tekst "art. 39 uitvoer". Bij diensten is het juridisch "buiten het toepassingsgebied, art. 21 §2". **Aanbeveling:** voor nu de uitkomst accepteren (0%, met een tekstverschil) en laten nakijken door Pieter/Finobi. Komt er geen klant buiten de EU, dan parkeren.

---

## 2. BILL-3: refund-cleanup voor platformbetalingen

### 2.1 Wat er nu gebeurt

De enige refund-route voor platformfacturen is **`refund-invoice`**. De platform-admin roept die op de SellQo-tenant aan via `src/hooks/useInvoices.ts:148`, op het factuurscherm.

Wat het doet:
1. Alleen bij `status = 'paid'` (r. 69).
2. Het zoekt de PI via `metadata.stripe_payment_intent_id` (r. 93), anders via een Stripe-search op `metadata['invoice_id']` (r. 118).
3. Een volledige refund (r. 134), **zonder `idempotencyKey`**.
4. De refund-id gaat in `invoices.metadata`, met daarna een creditnota (`draft`) en `generate-credit-note` (PDF + mail).

**Wat er misloopt:**

| # | Probleem | Bewijs |
|---|---|---|
| R1 | **Pay-first-facturen zijn niet terug te betalen.** Hun PI draagt `metadata.billing_cycle_id` (`payCheckout.ts:248`, de runner), niet `invoice_id`, en de webhook zet geen PI-id op de factuur (`subscriptionCharge.ts:549-565`). De search vindt niets → 404 "Geen Stripe-betaling gevonden". De PI staat alleen in `billing_cycles.stripe_payment_intent_id`. | SQ-2026-0006, 0009 en 0010 zijn pay-first-facturen |
| R2 | **Bundelbetaling ("Alles betalen").** Eén PI met `payment_bundle_id` dekt meerdere posten (`payCheckout.ts:280`). Wordt die PI ooit gevonden, dan betaalt de **volledige** refund de hele bundel terug in plaats van één factuur. | `refunds.create` zonder `amount` (r. 134) |
| R3 | **Dubbele refund mogelijk.** De guard is read-then-write (r. 74-90) en `refunds.create` heeft geen idempotency key. Een dubbelklik kan twee echte refunds geven. | r. 134 |
| R4 | **Dode query op `tenant_settings`** (r. 97-101), dezelfde als in BILL-3 van augustus (vervolgpunt 3). Er wordt niet `getStripeContext` gebruikt. | r. 97-110 |
| R5 | **Na de refund blijft de status `paid`.** Er is geen `refunded`-status: de `invoice_status`-enum = draft, sent, paid, cancelled, processing, unpaid. De cyclus blijft `settled` (de `billing_cycle_status`-enum kent ook geen refunded). `tenant_subscriptions.current_period_*`, die BILL-FIX-1 bij settlement opschuift (`tenantPeriod.ts`, `subscriptionCharge.ts:646-650`), wordt niet teruggezet. **De tenant houdt dus de betaalde periode na een volledige terugbetaling.** | live enums |
| R6 | **`credit_notes.stripe_refund_id` wordt nooit gevuld.** De refund-id staat alleen in `invoices.metadata`. | live: CN-2026-0003/0004/0005 hebben `stripe_refund_id = NULL`, terwijl de factuur `metadata.stripe_refund_id = pyr_…` heeft |
| R7 | **Refunds via het Stripe-dashboard zijn onzichtbaar.** `platform-stripe-webhook` verwerkt `charge.refunded` en `charge.dispute.*` niet (cases r. 181-281: checkout, payout). Geen creditnota, geen status. | grep |
| R8 | **Gecrediteerde, onbetaalde facturen blijven open.** INV-2026-0001, INV-2026-0004 en SQ-2026-0005 staan op `sent` met een volledige creditnota. Ze tellen mee in dunning en in `resolveBillingState` (`useBillingState.ts:58`: invoices `unpaid`/`sent`). Dat is backlog CN-DUNNING-1. | live: alle drie op testklanten (Sandbox, demo, dus vandaag zonder effect) |
| R9 | **Race in `handleCycleCharge`.** De factuur wordt ingevoegd vóór de settle-guard (r. 549 tegenover 609-627). Bij een gelijktijdig event blijft er een **tweede betaalde factuur** staan ("invoice left in place", r. 623). Dat valt strikt buiten refunds, maar is de reden waarom er ooit een correctie-CN nodig zal zijn. | code |

**Live:**
- 9 creditnota's op de SellQo-tenant (CN-2026-0001 t/m 0009), allemaal `full`/`sent`, `auto_generated = false`, `stripe_refund_id = NULL`;
- 3 facturen met `metadata.stripe_refund_id` (INV-2026-0003, INV-2026-0005, SQ-2026-0002), alle drie nog `status = 'paid'`.

### 2.2 Voorgestelde wijzigingen

**`refund-invoice/index.ts`:**
- **PI-resolutie in deze volgorde:**
  1. `metadata.stripe_payment_intent_id`;
  2. `metadata.paid_payment_intent_id` (invoice-first, `subscriptionCharge.ts:299`);
  3. `billing_cycles.stripe_payment_intent_id where invoice_id = <id>`;
  4. `payment_bundles.payment_intent_id` via de bundel-items;
  5. pas daarna de Stripe-search.
- **Bundel-PI:** altijd `amount = round(invoice.total*100)`, nooit een volledige refund. Check vooraf dat `amount_received - amount_refunded ≥ bedrag`.
- **`idempotencyKey: refund-invoice:<invoice_id>`.**
- **Claim vooraf:** een atomische `UPDATE invoices set metadata = metadata || '{"refund_pending":…}' where id = … and not (metadata ? 'stripe_refund_id') and not (metadata ? 'refund_pending')` die precies 1 rij moet raken. Anders 409.
- De dode `tenant_settings`-query weg, vervangen door `getStripeContext` voor de SellQo-tenant (platform-account) of de bestaande connected-logica voor gewone tenants.
- `credit_notes.stripe_refund_id` vullen.
- **Toegang na de refund** (platformfacturen, `tenant_id = billing tenant`): de cyclus vinden via `invoice_id`, dan:
  - `billing_cycles.description`/`metadata` krijgt "refunded";
  - `tenant_subscriptions.current_period_end` terug naar `cycle.period_start`, **alleen als** `current_period_end = cycle.period_end`. Zo wordt nooit een latere periode teruggedraaid.
  - Daarna `refreshBillingStateForCustomer`.

**`platform-stripe-webhook/index.ts`:**
- nieuwe case `charge.refunded` (platform-account), met `charge.payment_intent` als sleutel;
- bestaat er voor die PI nog geen creditnota met dezelfde `stripe_refund_id`, dan dezelfde CN-pijplijn draaien (gedeelde helper, zie hieronder);
- `charge.dispute.created` levert alleen een melding op (`category 'payments'`).
- ⛔ **Het Connect-pad niet raken:** `stripe-connect-webhook` blijft ongemoeid.

**Nieuw `_shared/platformRefund.ts`:**
- PI-resolutie, CN-insert (de bestaande logica uit `refund-invoice` r. 166-236, ongewijzigd verplaatst) en de periodecorrectie;
- één bron voor de handmatige route en de webhookroute.

**Optioneel (CN-DUNNING-1):** `process-invoice-dunning` en `resolveBillingState` slaan facturen met een volledige, niet-geannuleerde creditnota over.

### 2.3 Migraties

- `credit_notes.stripe_refund_id` bestaat al: geen migratie nodig.
- Partiële unique index (additief), als idempotentie-anker voor webhook plus handmatige route:
  ```sql
  create unique index if not exists credit_notes_stripe_refund_id_uq
  on credit_notes(stripe_refund_id) where stripe_refund_id is not null;
  ```
  - Pre-flight: `select stripe_refund_id, count(*) … group by 1 having count(*) > 1` moet 0 rijen geven. Vandaag zijn alle waarden NULL.
- **Geen enum-uitbreiding** in deze batch. `invoice_status` uitbreiden met `refunded` raakt alle tenant-UI's en Odoo (gedeeld pad). De refund blijft herkenbaar via de creditnota plus `metadata.stripe_refund_id`.
- Backfill (na go, met snapshot): `credit_notes.stripe_refund_id` vullen uit `invoices.metadata->>'stripe_refund_id'` voor CN-2026-0003/0004/0005.

### 2.4 Risico's (geld)

- **Bundel-PI volledig refunden.** Afgedekt door de verplichte `amount`, plus de saldo-check vooraf.
- **Dubbele CN** als de webhook en de handmatige route tegelijk lopen. Afgedekt door de unique index plus `ON CONFLICT DO NOTHING`, of een vangst van 23505.
- **Periode terugzetten** kan de toegang van een tenant direct afsluiten (leesmodus). Guard: alleen bij een exacte match met `period_end`, en alleen bij een volledige refund.
- **Webhook-endpoint.** Het Stripe-endpoint "Sellqo Platform" moet geabonneerd worden op `charge.refunded` (dezelfde valkuil als in 2026.08: events niet geabonneerd). Dat moet Akke in het Stripe-dashboard doen.

### 2.5 Testplan

- Speeltuin: een pay-first-cyclus van € 2 door Akke laten betalen.
- Refund via de UI. Verwacht:
  - de refund in het Stripe-dashboard (platform) van € 2,42;
  - een creditnota met `stripe_refund_id`;
  - Speeltuin `current_period_end` teruggezet;
  - een tweede klik geeft 409, en Stripe toont maar één refund.
- Dashboard-refund op een tweede testbetaling: de webhook maakt één creditnota; een tweede event levert niets extra op.
- Bundel: twee testposten via "Alles betalen", één terugbetalen. De Stripe-refund is gelijk aan het factuurtotaal, de bundel blijft gedeeltelijk.
- **Niet testen** op Astra of SQ-2026-0001.

### 2.6 Deploy

| Wijziging | Te deployen functies |
|---|---|
| `refund-invoice` | `refund-invoice` |
| `platform-stripe-webhook` | `platform-stripe-webhook` |
| nieuw `_shared/platformRefund.ts` | alleen die twee, mits het niet in `subscriptionCharge.ts` geïmporteerd wordt |
| `generate-credit-note` (aangeroepen, niet gewijzigd) | geen |

Daarna de Stripe-event-subscription `charge.refunded` toevoegen (handmatig, Akke).

### 2.7 Beslisvragen voor Akke

1. **Toegang na een volledige refund: periode terugdraaien of laten lopen?** **Aanbeveling:** terugdraaien. Wie zijn geld terugkrijgt, heeft die periode niet betaald. Bij een coulance-refund ("gratis maand") kies je een cadeaumaand, geen refund.
2. **Gedeeltelijke refunds (partial CN) nu al?** **Aanbeveling:** nee. Alleen een volledige refund per factuur, ook binnen een bundel. Een partial refund is een eigen batch.
3. **CN-DUNNING-1 meenemen?** **Aanbeveling:** ja, als een kleine extra stap. Vandaag zitten er 3 gecrediteerde facturen open in het systeem, allemaal test, maar bij de eerste echte geeft het een onterechte leesmodus.
4. **De race R9 hier fixen** (de insert achter een claim op de cyclus zetten)? **Aanbeveling:** aparte mini-batch BILL-RACE-1, want die raakt het webhook-hartpad. Wel melden.

---

## 3. SUB-UNIFY: de oude Stripe Billing-laag ontmantelen en het lifecycle-gat dichten

### 3.1 Inventaris van de oude laag (live plus code)

FASE-B-SLOOP (6-08, role-audit r. 12434-12450) heeft het grootste deel al gesloopt. Wat er nog over is:

| Onderdeel | Status | Aanroepers | Live data |
|---|---|---|---|
| `create-addon-checkout` | **Actief gevaarlijk:** maakt echte Stripe **Billing**-abonnementen aan (`mode: "subscription"`, r. 141, € x/maand recurring). Na de webhook-sloop **activeert niets de add-on**: de klant betaalt maandelijks voor niets en opzeggen gaat nergens. | `src/components/admin/billing/PeppolUpgradeCard.tsx:57`, maar die component wordt **nergens geïmporteerd** (dood). Niet in `config.toml`. | `tenant_addons`: 0 rijen |
| `PeppolUpgradeCard.tsx` | dood bestand | geen | – |
| `tenant_addons` (+ `useTenantAddons`, `useUsageLimits.checkFeature` r. 184) | gelezen, nooit door een levend pad geschreven, behalve `confirm-platform-bank-payment:102` | – | 0 rijen |
| `platform-gift-month` | Half oud: Stripe `subscriptions.update` (r. 87-93) is dood (0 `stripe_subscription_id`). Het native deel zet `trial_end`/`current_period_end` (r. 96-102), maar **schuift `subscriptions.next_invoice_date` niet op: de runner maakt gewoon de volgende cyclus aan, dus de "gratis maand" wordt toch geïnd.** | `usePlatformBilling.ts:146`, `usePlatformPromotions.ts:276` | – |
| `platform_invoices` | **Niet dood.** Nog geschreven door `_shared/aiCreditPurchase.ts:119` (AI-credits-"betaalbewijs") en `confirm-platform-bank-payment`. Gelezen door `useTenantSubscription.ts:48`, `usePlatformBilling.ts:111`, `usePlatformAdmin.ts:243`. | – | 0 rijen; `ai_credit_purchases` 0 rijen |
| `tenant_subscriptions.stripe_subscription_id/stripe_customer_id/stripe_payment_method_id` | deprecated (`docs/stripe-billing-deprecated.md`) | platform-gift-month leest ze | 23/23 rijen NULL |
| `pricing_plans.stripe_*` | deprecated | geen | – |
| `platform-stripe-webhook` Billing-cases | al weg (r. 167-174) | – | – |
| Cron | geen enkele cron raakt de oude laag. Billing-crons: `generate-subscription-invoices` 06:00, `check-expired-trials` 06:45, `process-invoice-dunning` 07:00, `process-cycle-reminders` 07:30. **`sync-billing-state` heeft bewust geen cron** (role-audit r. 2288). | – | – |

**Bijvangst, fiscaal en buiten scope:** een AI-credits-aankoop schrijft alleen een `platform_invoices`-betaalbewijs, **geen factuur** in `invoices`, dus geen Peppol/Odoo. Dat moet een eigen batch worden (AI-CRED-INV-1) vóór de eerste echte aankoop.

### 3.2 Waar plantoegang bepaald wordt

- **Client:** `useTenantSubscription` leest `tenant_subscriptions.plan_id` → `pricing_plans.features`. Daarop bouwen `useUsageLimits.checkFeature` (r. 171-191), `FeatureGate` en `useBusinessModules`. **Kijkt naar geen enkele status of `current_period_end`.**
- **Label:** `useTenant.tsx:188-202` neemt het plan- en statuslabel uit `tenant_subscriptions`.
- **Schrijfslot:** `useBillingState` + `_shared/billingState.ts` (`resolveBillingState`) en `billingGuard` op de server. Die kijken alleen naar openstaande cycli of facturen. Status `canceled` geeft `active` (vrij schrijven). `sync-billing-state:75` slaat `canceled` expliciet over.
- **Server:** `storefront-api:2889` leest alleen `plan_id` voor de ticket-fee.
- **Er is geen DB-trigger** die `subscriptions` en `tenant_subscriptions` koppelt (live `information_schema.triggers`).

### 3.3 Het lifecycle-gat (root cause)

| # | Pad | Wat er gebeurt | Bestand:regel |
|---|---|---|---|
| L1 | `sync-tenant-plan` met `action:'cancel'` (niet-free) | billing-sub op `cancelled`, `tenant_subscriptions` op `status='canceled'`, `cancel_at_period_end=true` en **`plan_id` blijft het betaalde plan**. **Niets zet het ooit op free na `current_period_end`.** Geen cron, geen check; `check-expired-trials` kijkt alleen naar `trial_end`. | `sync-tenant-plan/index.ts:324-359` |
| L2 | Tenant kiest Free in /admin/billing (`switch` → free) | valt in dezelfde tak, maar met `plan_id:'free'` **onmiddellijk**. De betaalde resttermijn is weg ("opzeggen naar Free is meteen", audit 14-10). De runner-tak "pending downgrade to free at boundary" (`generate-subscription-invoices:470-496`) is daardoor onbereikbaar. | `sync-tenant-plan/index.ts:323-340` |
| L3 | Billing-abonnement rechtstreeks geannuleerd (Abonnementen-pagina op de SellQo-tenant, `useSubscriptions.ts:245`) | facturatie stopt, `tenant_subscriptions` blijft `active` op het betaalde plan: **gratis toegang voor altijd**. | live, zie hieronder |
| L4 | Platform-admin → tenant → Abonnement-tab | `usePlatformAdmin.updateSubscription` (r. 337-350) schrijft `plan_id`/`status` rechtstreeks, buiten de single writer om. `status:'canceled'` laat de billing-sub **doorfactureren**; een planwijziging past de factuurregel niet aan. | `TenantSubscriptionTab.tsx:37-48` |
| L5 | Cadeaumaand | verlengt de toegang, maar de facturatie loopt gewoon door (zie 3.1). | `platform-gift-month/index.ts:96-102` |

**Live bewijs voor L3** (query: `tenant_subscriptions` join `subscriptions` op `billing_subscription_id`):
- **SellQo Speeltuin:** billing-sub `cancelled` (05-08), `tenant_subscriptions.status = 'active'`, `plan_id = 'pro'`, `current_period_end` 2026-09-05 (verstreken). Heeft nog steeds Pro.
- **SellQo Sandbox:** billing-sub `cancelled`, ts `active`, `starter`, `period_end` 2026-08-09 (verstreken).
- Beide zijn demo, dus er is vandaag geen omzetverlies. Het mechanisme is wel aangetoond.
- Geen enkele echte tenant staat vandaag in een opgezegde of gat-toestand. Astra: billing-sub actief, cyclus oktober `expired`, leesmodus via BILL-LOCK-1. Mancini, Zona Dorata en Benny: `billing_on_hold`, zonder billing-sub, bewust.

### 3.4 Voorgestelde wijzigingen

**A. Lifecycle (eerst, dit is het geldgat).**

`sync-tenant-plan/index.ts:323-359`, opzeggen en Free op het einde van de periode:
- de billing-sub blijft actief tot de grens: `tenant_subscriptions.pending_plan_id = 'free'`, `pending_effective_at = current_period_end`, `cancel_at_period_end = true`, `canceled_at = now`, `status` blijft `active`;
- de bestaande runner-tak (`generate-subscription-invoices:470-496`) zet bij de grens `plan_id = free` en annuleert de sub, **zonder nieuwe cyclus**;
- uitzondering: een tenant zonder billing-sub of zonder lopende periode gaat meteen naar Free (huidig gedrag);
- de usage-plan-tak (FLEX-1, r. 286-319) blijft ongemoeid.

**Nieuwe dagelijkse sweep `apply-plan-endings`** (of een extra stap in `check-expired-trials`, zodat er geen nieuwe cron bijkomt). Hij zet `plan_id = 'free'`, ruimt pending op, lijnt `tenants.subscription_plan` uit en stuurt een melding `subscriptions/plan_ended` voor elke tenant waarbij:
- `cancel_at_period_end = true` en `current_period_end < now()` en `plan_id <> 'free'`; **of**
- `billing_subscription_id` verwijst naar een `subscriptions.status in ('cancelled','ended')`, en `current_period_end < now()`, en de tenant is niet `is_demo`, niet `billing_exempt`, niet `billing_on_hold` en niet de facturatietenant.

De tweede regel dekt L1 en L3. Het eerste draaien gebeurt **verplicht met `dry_run`**: dezelfde vorm als `sync-billing-state` `{dry_run:true}`.

**L4:** de Abonnement-tab stuurt planwissels via `sync-tenant-plan`; een platform-admin mag dat al (r. 140-165). De status-select is beperkt tot opschorten/heractiveren met een waarschuwingstekst. "Geannuleerd" gaat via `action:'cancel'`.

**L5:** `platform-gift-month` schuift ook `subscriptions.next_invoice_date` (en een openstaande `pending`/`awaiting_payment`-cyclus?) op. Dat is een beslisvraag. Of dit valt onder SUB-ADMIN-1.

**`useUsageLimits.checkFeature`** blijft lezen op `plan_id`. Na de sweep is `plan_id` de waarheid. Geen client-side periodelogica: één bron, de server.

**B. De oude laag slopen (daarna, laag risico).**
- Verwijderen: `supabase/functions/create-addon-checkout/` en `src/components/admin/billing/PeppolUpgradeCard.tsx`.
  - Pre-flight: een verse `grep -rn "create-addon-checkout\|PeppolUpgradeCard"` moet 0 levende aanroepers geven (les uit de AUDIT-VONDST van 05-08).
  - De functie ook **undeployen** via de Lovable-agent, anders blijft het endpoint live.
- `platform-gift-month`: de Stripe-tak (r. 85-93) en de `stripe_subscription_id`-select eruit.
- `fase2-backlog.md:56-58` (de `create-addon-checkout`-URL's) wordt dan overbodig: opruimen.
- **Niet droppen:**
  - de `stripe_*`-kolommen (DB-regel: geen DROP samen met code-sloop);
  - `platform_invoices` en `tenant_addons` (nog gelezen, en AI-credits schrijft erin);
  - `confirm-platform-bank-payment` en `create-platform-bank-payment` (bankpad AI-credits, levende UI `CreditPurchaseDialog`, `PendingPlatformPaymentsPage`).
- `docs/stripe-billing-deprecated.md` bijwerken. De regels "`platform_invoices` … read-only historie" en "add-on-flow loopt nog wel via Stripe Billing" kloppen niet meer.

### 3.5 Migraties

- Geen schemawijziging nodig voor A. Alle kolommen bestaan: `pending_plan_id`, `cancel_at_period_end`, `current_period_end`.
- Melding `subscriptions/plan_ended` registreren in `src/types/notification.ts`, `notificationDefaults.ts` en `notificationRoutes.ts`. De categorie `subscriptions` bestaat in de enum.
- Data-correctie (na go, met snapshot): Speeltuin en Sandbox naar free, of bewust zo laten als demo. Zie de beslisvragen.

### 3.6 Risico's

- **De sweep zet een betalende tenant ten onrechte op free.** Afgedekt door het uitsluiten van `billing_on_hold`, `billing_exempt` en `is_demo`, door `dry_run` eerst en door het controleren van `current_period_end < now()`.
- Let op: **Astra** heeft `current_period_end` 2026-10-01 (verstreken, cyclus onbetaald), maar een **actieve** billing-sub en geen `cancel_at_period_end`. Die valt dus buiten beide regels. Dat is goed, want daar is BILLING-ENFORCE de afsluiter.
- **Het runner-pad naar Free** (`summary.skipped_no_lines++; continue`) is nooit live gelopen. Het eerste gebruik meten op Speeltuin.
- **Geld:** door A wordt een opzeggende klant niet meer de lopende periode afgenomen. Er komt geen extra cyclus, want bij de grens maakt de runner geen cyclus wanneer het pending plan free is (r. 470-496).
- **Sloop:** `create-addon-checkout` heeft 0 rijen en 0 aanroepers. Het risico is minimaal, maar undeployen is nodig.

### 3.7 Testplan

1. `apply-plan-endings` met `dry_run`. Verwacht: precies Speeltuin en Sandbox (als die niet uitgesloten worden als demo), verder niemand.
2. Speeltuin: billing-sub weer actief, dan Free kiezen in /admin/billing. Verwacht `pending_plan_id = free` met het Pro-plan nog actief. De sub `next_invoice_date` op vandaag zetten en de runner draaien met `{subscription_id}`. Verwacht `plan_id = free`, sub `cancelled`, geen nieuwe `billing_cycles`-rij.
3. De platform-admin-tab: een planwissel loopt via `sync-tenant-plan`. Controleren dat `subscription_lines.unit_price` mee verandert.
4. Sloop: verse grep, `npm run build`, `tsc` tegen de baseline, `scripts/check-dead-buttons` en CI groen. Na het undeployen geeft `create-addon-checkout` 404.

### 3.8 Deploy

| Wijziging | Te deployen functies |
|---|---|
| `sync-tenant-plan` | `sync-tenant-plan` |
| sweep (nieuw, of als stap in `check-expired-trials`) | die functie; plus een cron-registratie als hij nieuw is (vault-patroon, kost 0 credits) |
| `platform-gift-month` | `platform-gift-month` |
| `create-addon-checkout` | undeploy via de agent ("Lukt dit niet, meld en STOP") |
| frontend: Billing, TenantSubscriptionTab, PeppolUpgradeCard weg, meldingtypes | `deploy_project` (sellqo.app is Lovable-hosted) **en een nieuwe app-build** (gebundelde code) |

Er wordt geen `_shared`-bestand gewijzigd. Wordt de sweep een gedeelde helper, dan alleen de importeurs ervan.

### 3.9 Beslisvragen voor Akke

1. **Opzeggen of Free kiezen: tot het einde van de betaalde periode, of meteen?** **Aanbeveling:** einde periode. Het is eerlijk, het staat zo op /pricing (claim-audit) en de runner-tak bestaat al.
2. **Moet de sweep ook demo-tenants met een geannuleerde sub terugzetten** (Speeltuin, Sandbox)? **Aanbeveling:** nee, demo's uitsluiten. Speeltuin handmatig op free zetten als hij als echte testklant moet blijven werken.
3. **Platform-admin-statusveld:** helemaal weg of beperkt? **Aanbeveling:** beperkt. Planwissel via de writer, status alleen "opschorten"/"heractiveren", geen vrije "canceled".
4. **Cadeaumaand:** de volgende cyclus overslaan (`next_invoice_date` + N maanden) of als creditregel? **Aanbeveling:** `next_invoice_date` opschuiven. Dat is het eenvoudigst en er komt geen betaalverzoek. Log in `admin_billing_actions`.
5. **AI-credits zonder echte factuur:** eigen batch plannen vóór de eerste verkoop? **Aanbeveling:** ja (AI-CRED-INV-1). Credits verkopen zonder factuur is een fiscaal probleem.

---

## 4. Volgorde en overzicht

**Volgorde:** SUB-UNIFY A (lifecycle) → BILL-2 → BILL-3 → SUB-UNIFY B (sloop).
- A dicht het enige gat dat al aantoonbaar optreedt (L3 live).
- BILL-2 moet klaar zijn vóór de eerste niet-BE-tenant.
- BILL-3 vraagt een actie van Akke in Stripe.

**Verdere bijvangst (niet in deze plannen):**
- `process-refund` (tenant-retouren) heeft nog steeds geen `idempotencyKey` (r. 210) en de valse check `refund_amount ? …` (r. 204-205), waardoor € 0 een volledige refund wordt. Dat zijn de geldpunten uit BILL-3-vervolg 1 en 2 van augustus, nog open.

## 5. Skill-onderhoud (voorstel, geen wijziging)

Dit hoort in **`sellqo-gedeelde-paden`**:

> "Elke nieuwe plek die een `billing_cycles`-rij of een abonnementsregel aanmaakt, haalt btw-tarief en regime uit `_shared/cycleFiscal.ts`. Nooit een hardcoded `21`. Abonnementsregels gaan als `product_category: 'digital_service'` naar de resolver, anders classificeert die SaaS als goederenlevering (vak 46 in plaats van 44)."

Dit hoort in **`sellqo-engineering-rules`**:

> "`customers.billing_country` heeft DB-default `'NL'`: elke insert zonder land is een Nederlandse klant. Zet het land altijd expliciet."

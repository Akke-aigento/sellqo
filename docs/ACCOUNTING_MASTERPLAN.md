# SellQo — Accounting & Reports Masterplan

**Versie:** 1.0
**Datum:** 13 mei 2026
**Auteur:** Akke (Nomadix BV) — opgesteld in samenwerking met Claude
**Scope:** Volledige herziening van de rapportage- en boekhoudkundige integratielagen van SellQo
**Tijdshorizon:** 14 werkdagen (parallel met andere SellQo-werk haalbaar in 3-4 weken)
**Deadline-context:** Q2-2026 BTW-aangifte (deadline 22 juli 2026), Peppol-compliance reeds verplicht sinds 1 januari 2026

---

## 0. Inhoudsopgave

- [Executive Summary](#1-executive-summary)
- [Deel A — Strategisch kader: SellQo als boekhouders-bondgenoot](#deel-a--strategisch-kader)
- [Deel B — Diagnose: wat is er fout aan de huidige rapportage](#deel-b--diagnose)
- [Deel C — De Masterplan-fases](#deel-c--de-masterplan-fases)
  - [Fase 1 — Database & Data Quality Foundation](#fase-1--database--data-quality-foundation)
  - [Fase 2 — Canonical VAT Engine](#fase-2--canonical-vat-engine)
  - [Fase 3 — Export-formaten & Rapportage UI](#fase-3--export-formaten--rapportage-ui)
  - [Fase 4 — Odoo Bridge & Peppol Compliance](#fase-4--odoo-bridge--peppol-compliance)
- [Deel D — Belgische compliance-referentie](#deel-d--belgische-compliance-referentie)
- [Deel E — Odoo-integratie-architectuur](#deel-e--odoo-integratie-architectuur)
- [Deel F — Peppol-roadmap](#deel-f--peppol-roadmap)
- [Deel G — Database-migraties (concrete SQL)](#deel-g--database-migraties-concrete-sql)
- [Deel H — Meeting prep met de boekhouder](#deel-h--meeting-prep-met-de-boekhouder)
- [Appendix — File-inventaris voor uitvoering](#appendix--file-inventaris-voor-uitvoering)

---

## 1. Executive Summary

SellQo heeft op dit moment **8 rapportagecategorieën met 30+ exports**, maar de fiscaal-relevante rapporten zijn boekhoudkundig niet bruikbaar. De BTW-aangifte gebruikt het verkeerde datumveld (`created_at` in plaats van `issue_date`), filtert enkel op betaalde facturen (terwijl België onder factureringsstelsel werkt), en agregeert alles op de 21%-bucket omdat het de `invoice_lines` per BTW-tarief niet gebruikt. Dat moet weg.

Tegelijk staan we voor twee externe verplichtingen waarvan één al actief is:
- **Peppol B2B is verplicht sinds 1 januari 2026** in België. SellQo loopt 4+ maanden achter. Boetes lopen op tot €5.000 per herhaalde inbreuk.
- **Near-real-time e-rapportering komt eraan in 2028** (ViDA-aligned). Wie nu z'n data-architectuur goed legt, is dan klaar zonder herwerk.

Dit document beschrijft een **4-fasen herziening** die SellQo van een "snel-rapport-exporter" naar een **boekhoudkundig betrouwbare omzetbron** maakt die direct doorvoedt in Odoo (en straks elke andere boekhoudsoftware) en standaard Peppol-compliant factureert. Dit is geen feature — dit is een fundamentele upgrade van het waardevoorstel.

**Bijkomende strategische opbrengst:** boekhouders worden **distributiekanaal**. Eén boekhouder beheert 50 tot 200 KMO-dossiers. Wie SellQo serieus neemt als data-bron, krijgt minder uren consult per kwartaal en meer marge. Dat is de verkoopinvalshoek voor de meeting van komende week.

---

## Deel A — Strategisch kader

### A.1 Hoe ziet de Belgische boekhoudmarkt er nu uit (mei 2026)

Sinds 1 januari is e-facturatie via Peppol verplicht voor alle binnenlandse B2B-transacties tussen Belgische BTW-plichtigen. Een kwartaal later blijken volgens onderzoek slechts ±80% van de KMO's effectief overgeschakeld. Een derde verliest tijd door slecht voorbereide systemen, 40% rapporteert hogere kosten. Boekhouders zitten in het oog van de storm: zij moeten Peppol-data ontvangen, valideren, importeren in hun boekhoudpakket (Odoo / Octopus / BOB / WinBooks / Yuki / Exact Online), én daarbovenop de klassieke BTW-aangifte, IC-listing, klantenlisting en OSS afhandelen.

De pijn die boekhouders nu voelen:
- **Slechte brondata** uit webshops (Shopify, WooCommerce, eigen builds): geen Peppol-output, slechte BTW-categorisatie, geen IC-listing-velden, OSS-verkopen niet apart geboekt
- **Manueel hercategoriseren** per kwartaal: een gemiddelde e-commerce-klant met 500 facturen per maand kost 4-8 uur extra werk per BTW-aangifte
- **VIES-validatie ontbreekt** in de meeste webshops, waardoor IC-leveringen achteraf moeten gecorrigeerd worden
- **Stripe payouts matchen niet** met factuurbedragen (door fees, refunds, foreign exchange) — boekhouder moet handmatig reconcileren
- **Bol.com marketplace-verkopen** worden vaak fout geboekt: in veel gevallen is Bol.com **deemed supplier** (B2C cross-border) en geldt 0% BTW voor de verkoper, maar dat staat nergens netjes geclassificeerd

### A.2 Hoe SellQo zich positioneert

SellQo wordt **niet** verkocht als "nog een webshop-platform". Voor de boekhouder is het waardevoorstel:

> "Uw e-commerce-klanten draaien op een platform dat hun data Peppol-compliant en INTERVAT-ready aanlevert. U importeert in Odoo, doet de cross-check, en bent klaar. Geen handmatige hercategorisatie meer."

Concrete tijdsbesparing per klant per kwartaal:
- **BTW-aangifte voorbereiding**: van 4-8 uur naar 30-45 minuten (cross-check, validatie, INTERVAT-XML upload)
- **IC-listing**: van 1-2 uur naar 5 minuten (XML al gegenereerd, gevalideerd)
- **Klantenlisting**: van 2-3 uur naar 10 minuten (automatisch jaar-gegenereerd)
- **OSS-aangifte**: van 2-4 uur naar 15 minuten (per land al opgesplitst)

Aan een gemiddeld boekhouderuurloon van €85-€120/uur is dat **€500-€900 minder uren** per klant per kwartaal. Wie betaalt dit verschil? De klant (lagere factuur) of de boekhouder (hogere marge). Beide scenario's verkopen.

### A.3 Het partnermodel (om voor te stellen aan de boekhouder)

Drie samenwerkingsmodellen, in oplopende intensiteit:

**Model 1 — Referral partner.** Boekhouder verwijst klanten naar SellQo, krijgt 15-20% van de eerste 12 maanden recurring revenue. Geen werk aan zijn kant, transparante revenue share. Goed voor cold-start.

**Model 2 — White-label / Co-brand.** "Boekhoudkantoor X powered by SellQo." De boekhouder krijgt een eigen subdomein, eigen logo, eigen pricing-laag bovenop. Per-klant licentie aan korting (bv. €19/maand i.p.v. €29). Boekhouder verkoopt aan zijn klanten met opslag.

**Model 3 — Accountant Portal (productontwikkeling, fase 5+).** Eigen interface waar de boekhouder al zijn klant-tenants ziet, met dashboard per klant: openstaande BTW-aangifte, IC-listing klaar, klantenlisting status. Eén login, alle dossiers. Vergelijkbaar met wat Yuki en Dexxter aanbieden, maar voor e-commerce-specifieke data.

Voor de meeting volgende week: pitch model 1 als laagdrempelige start, plant zaadje voor model 2.

### A.4 Wat we de boekhouder concreet moeten laten zien

In de meeting:
1. **Live demo** van een Mancini-rapport voor Q1-2026 zoals het nu is, en hoe het na fase 2 zal zijn
2. **Een sample INTERVAT-XML** die we al manueel hebben gegenereerd uit de bestaande data
3. **Eén Peppol-UBL voorbeeld** die we tonen valideren tegen de officiële XSD
4. **Roadmap-poster** met 4 fases en tijdslijnen
5. **Vraag stellen**: welke 3 dingen zou hij absoluut willen kunnen in een ideaal rapport? Die input weegt boven al onze aannames.

---

## Deel B — Diagnose

### B.1 Wat werkt al goed

- **Multi-tenant scheiding** op database-niveau via RLS (geverifieerd in security work)
- **`invoice_lines` tabel** met `vat_rate`, `vat_category`, `vat_amount` per regel bestaat reeds (migratie `20260116131132`)
- **Credit-notes** met aparte `credit_notes` + `credit_note_lines` tabellen
- **Stripe Connect-integratie** met directe charges (geen platform-fee in de tussenstroom)
- **OGM-referentie** op facturen reeds aanwezig
- **`ubl_url`-kolom** op invoices bestaat — basis-infrastructuur voor Peppol staat klaar
- **Algemene exportarchitectuur** met `xlsx`/`csv`-keuze per rapport is goed gestructureerd

### B.2 Wat er fundamenteel fout zit

Een per-file diagnose, met regelverwijzing waar relevant:

**`src/hooks/useReportExports.ts` — `exportVatReport` (regels 612-687)**

| Probleem | Impact |
|---|---|
| Filter `.eq('status', 'paid')` op regel 624 | Mist alle openstaande facturen. België werkt onder factureringsstelsel — BTW is verschuldigd bij factuuruitreiking, niet bij betaling. |
| Filter op `created_at` (regels 625-626) | Verkeerde datum. Bij timezone-verschuiving kan een factuur van 31 maart 23:30 als 1 april UTC worden opgeslagen → verkeerd kwartaal. Moet `issue_date` zijn. |
| Geen gebruik van `invoice_lines` | Alle omzet wordt op 21% gegooid, ongeacht het werkelijke tarief per lijn. |
| Hardcoded EU-lijst op regel 644 | Cyprus en Kroatië correct, maar UK ontbreekt (post-Brexit) niet eens als export-categorie gemarkeerd. Geen dynamische bron. |
| Geen B2C-EU OSS-detectie | OSS-drempel van €10.000 wordt niet bewaakt; cross-border B2C-verkopen verkeerd geclassificeerd. |
| Geen creditnota-integratie | Creditnota's worden niet afgetrokken in de juiste vakken 48/49/64. |
| Geen aankoop-BTW | Alleen verkoop wordt gerapporteerd — vakken 81/82/83/86/87/88 en 59 ontbreken volledig. |
| Geen vakken-mapping | Output is een onleesbare tabel; niet aansluitend bij INTERVAT-aangifteformulier. |

**`src/hooks/useReportExports.ts` — `exportIcListing` (regels 689-759)**

| Probleem | Impact |
|---|---|
| Filter `.eq('status', 'paid')` | Idem als bovenstaand: openstaande IC-leveringen ontbreken. |
| Geen onderscheid L / S / T-code | INTERVAT XML vereist verplicht type-code per regel. |
| Geen VIES-validatie van BTW-nummer op moment van factuur | IC-leveringen aan ongeldig BTW-nummer = belastbaar in BE met 21%. Risico op naheffing. |
| Filter op `issue_date` is correct, maar inconsistent met VAT-report die op `created_at` filtert | Twee rapporten geven verschillende totalen voor dezelfde periode. |
| Geen XML-export | INTERVAT-formaat ontbreekt. |

**`src/hooks/useVatReturns.ts` — `useCalculateVatReturn` (regels 96-204)**

| Probleem | Impact |
|---|---|
| Tweede VAT-implementatie naast `useReportExports.exportVatReport` met **andere logica** | DRY-violation. Twee bronnen-van-waarheid voor BTW. |
| Filter op `created_at` (regels 122-123) | Idem timezone-issue. |
| `.in('status', ['sent', 'paid'])` mist 'overdue' en 'partially_paid' | Onvolledig. |
| Creditnota's enkel afgetrokken van 21% (regel 175-178) | Catastrofaal fout: een creditnota op een 6%-factuur trekt jij van de 21%-bucket af. |
| Geen IC-leveringen B2C of B2B-zonder-VAT-nummer detectie | B2B EU zonder geldig BTW-nummer wordt als IC-levering gerapporteerd, terwijl het 21% BE-belastbaar zou moeten zijn. |
| Geen vakken-mapping naar INTERVAT | Idem. |

**`src/lib/euVatRates.ts`** — bevat statische EU BTW-tarieven, maar wordt nergens gebruikt door de exportfuncties. Code-dood.

**`src/components/admin/VatExportCard.tsx`** — UI-component die geen connectie heeft met de echte engine. Verwarrend voor onderhoud.

### B.3 Compliance-gaten — overzicht

| Verplichting | Status | Risico |
|---|---|---|
| BTW-aangifte vakken-mapping (INTERVAT XSD) | Ontbreekt | Boekhouder herwerkt alles manueel |
| IC-listing XML (INTERVAT 723) | Ontbreekt | Idem |
| Jaarlijkse klantenlisting (725) | Ontbreekt | Idem |
| OSS-aangifte (B2C EU cross-border) | Ontbreekt | Mancini en Loveke loopt risico zodra zij €10k+ EU B2C draaien |
| Peppol BIS 3.0 UBL-uitgaand | Onbekend (kolom bestaat, validatie onzeker) | Wettelijk verplicht sinds jan 2026 |
| Peppol-ontvangst (inbound) | Ontbreekt | Idem |
| BTW-afronding per tarief (niet line-by-line) | Onbekend, vermoedelijk fout | Vanaf 1 jan 2026 verplicht voor e-facturen |
| Stripe payout-reconciliatie | Ontbreekt | Boekhouder kan niet zien wat Stripe daadwerkelijk uitbetaalde vs. gefactureerd |
| Marketplace deemed-supplier (Bol.com) | Niet apart geclassificeerd | VanXcel verkeerd geboekt |
| VIES-validatie op moment van factuur | Bestaat (`validate-vat` edge function) maar wordt niet bevroren in `invoices` op moment van factuur | Geen audit-trail bij latere VIES-fout |
| MAR-grootboekrekening-mapping | Ontbreekt | Geen Odoo-/Exact-import mogelijk zonder hercategorisatie |

---

## Deel C — De Masterplan-fases

Vier fases, sequentieel, met duidelijke deliverables, files, en geschatte tijd. Elke fase heeft een **acceptance-test** voor we doorgaan naar de volgende.

### Fase 1 — Database & Data Quality Foundation

**Tijd:** 2 werkdagen
**Goal:** De brondata correct labelen op het moment van factuur-aanmaak, niet bij rapportage.
**Waarom eerst:** Zonder correcte input zijn rapporten enkel rookgordijn. We lossen het probleem aan de bron op.

#### Deliverables Fase 1

**1.1 Database-migratie — nieuwe kolommen op `invoices`**

```
- vat_regime VARCHAR(40) NOT NULL DEFAULT 'domestic_standard'
- issue_date DATE NOT NULL (gemigreerd uit sent_at::date of created_at::date)
- vat_point_date DATE (datum belastbaar feit, default = issue_date)
- reporting_country CHAR(2) (waar het tarief geldt — voor OSS = land consument)
- vat_number_validated_at TIMESTAMPTZ (snapshot VIES-validatie moment van factuur)
- vat_number_validated_value VARCHAR(20) (gevalideerde nummer, voor audit)
- vat_rounding_strategy VARCHAR(20) DEFAULT 'per_rate' (voor BIS 3.0 compliance)
```

**1.2 Database-migratie — nieuwe kolommen op `invoice_lines`**

```
- gl_account_code VARCHAR(10) (MAR-grootboekrekening, bv. 700000, 706000)
- vat_category VARCHAR(30) (verfijning van bestaand veld: 'standard', 'reduced_6', 
  'reduced_12', 'zero_ic', 'zero_export', 'oss_target', 'reverse_charge_construction',
  'exempt_article_44', 'marketplace_deemed_supplier')
- vat_box_code VARCHAR(3) (welk vak van de BTW-aangifte: '03', '46', '47', etc.)
```

**1.3 Enum/lookup-tabellen**

```sql
CREATE TABLE vat_regimes (
  code VARCHAR(40) PRIMARY KEY,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT,
  applies_vat BOOLEAN,        -- moet BTW worden aangerekend?
  reverse_charge BOOLEAN,     -- verlegging van heffing?
  output_vat_box VARCHAR(3),  -- standaard-vak uitgaande zijde
  invoice_text_required TEXT  -- verplichte vermelding op factuur (NL/FR)
);
```

Voorbeeldwaarden: `domestic_standard`, `domestic_reduced_6`, `ic_supply_goods`, `ic_supply_services`, `oss_b2c_nl`, `oss_b2c_de`, etc.

**1.4 Edge function `resolve-vat-regime`**

Eén centrale plek die bij elke factuur-aanmaak de juiste `vat_regime`, `reporting_country` en `vat_box_code` bepaalt op basis van:
- Klantland + (B2B/B2C)
- Klant-BTW-nummer (gevalideerd via VIES — bevroren in factuur)
- Productcategorie (digitaal goed vs. fysiek goed)
- Verkoopkanaal (eigen webshop vs. Bol.com vs. POS)
- Tenant-instellingen (OSS-opt-in, kleine-onderneming-regeling, etc.)

Returnt: `{ vat_regime, vat_box_code, vat_rate, reporting_country, invoice_text }`.

**1.5 VIES-snapshot-mechanisme**

Bij factuur-aanmaak met EU B2B-klant: roep `validate-vat` aan, sla resultaat op in `vat_number_validated_at` + `vat_number_validated_value`. Bij latere wijziging van het klant-BTW-nummer **niet** retroactief overschrijven — historische facturen behouden hun snapshot. Dit beschermt bij controle.

**1.6 Migratiescript voor bestaande data**

```sql
UPDATE invoices SET 
  issue_date = COALESCE(sent_at::date, created_at::date),
  vat_point_date = COALESCE(sent_at::date, created_at::date),
  reporting_country = (SELECT billing_country FROM customers WHERE id = customer_id)
WHERE issue_date IS NULL;
```

Daarna één-malig de `resolve-vat-regime` runnen op alle bestaande facturen om backfilling te doen.

#### Acceptance-test Fase 1

- [ ] 100% van bestaande facturen heeft `issue_date`, `vat_regime`, `reporting_country` gevuld
- [ ] Alle nieuwe facturen worden bij aanmaak met deze velden gevuld via `resolve-vat-regime`
- [ ] VIES-snapshot wordt opgeslagen bij EU B2B-factuur
- [ ] Een spotcheck van 20 willekeurige Mancini-facturen geeft het juiste `vat_regime` per factuur
- [ ] Trigger-test: bewust een factuur creëren waar `customer_id` na aanmaak wordt aangepast → snapshot blijft behouden

#### Files Fase 1

```
Nieuw:
  supabase/migrations/<timestamp>_accounting_foundation_phase1.sql
  supabase/functions/resolve-vat-regime/index.ts
  src/lib/vatRegimes.ts (constants & types, gedeeld met edge function)
  src/types/accounting.ts (TypeScript types voor VatRegime, VatBox, etc.)

Wijzigen:
  supabase/functions/_shared/vat.ts (uitbreiden met resolve-functie)
  src/hooks/useInvoiceForm.ts (bij aanmaak vat_regime resolven)
  src/components/admin/invoices/InvoiceForm.tsx (UI-feedback over regime)
```

---

### Fase 2 — Canonical VAT Engine

**Tijd:** 3 werkdagen
**Goal:** Eén enkele bron-van-waarheid voor alle fiscaal-relevante berekeningen.
**Waarom nu:** Met correcte input data kan de engine deterministisch werken. Twee verschillende implementaties (in `useReportExports` en `useVatReturns`) worden vervangen door één.

#### Deliverables Fase 2

**2.1 Edge function `vat-report-engine`**

Locatie: `supabase/functions/vat-report-engine/index.ts`

Input (POST body):
```typescript
{
  tenant_id: string;
  period_start: string;  // ISO date
  period_end: string;
  period_type: 'monthly' | 'quarterly' | 'annual' | 'custom';
  include_drafts: boolean; // default false
  include_audit_trail: boolean; // default true
}
```

Output (JSON):
```typescript
interface VatReportPayload {
  metadata: {
    tenant: { name: string; vat_number: string; kbo: string };
    period: { start: string; end: string; type: string };
    generated_at: string;
    invoice_count: number;
    credit_note_count: number;
    currency: string;
  };
  
  // BE BTW-aangifte vakken
  declaration_boxes: {
    '00': BoxData;
    '01': BoxData;
    '02': BoxData;
    '03': BoxData;
    '44': BoxData;
    '45': BoxData;
    '46': BoxData;
    '47': BoxData;
    '48': BoxData;
    '49': BoxData;
    '54': BoxData;
    '55': BoxData;
    '56': BoxData;
    '57': BoxData;
    '59': BoxData;
    '61': BoxData;
    '62': BoxData;
    '63': BoxData;
    '64': BoxData;
    '71': BoxData;
    '72': BoxData;
    '81': BoxData;
    '82': BoxData;
    '83': BoxData;
    '84': BoxData;
    '85': BoxData;
    '86': BoxData;
    '87': BoxData;
    '88': BoxData;
  };
  
  // OSS detail
  oss_by_country: {
    country_code: string;
    base_amount: number;
    vat_rate: number;
    vat_amount: number;
    invoice_count: number;
  }[];
  
  // IC-listing entries
  ic_listing: {
    vat_number: string;
    country_code: string;
    company_name: string;
    amount: number;
    type_code: 'L' | 'T' | 'S';  // Levering, Triangulatie, Service
    invoice_ids: string[];
  }[];
  
  // Klantenlisting (jaarlijks; voor kwartaal-aangifte leeg)
  client_listing: {
    vat_number: string;
    company_name: string;
    turnover_excl_vat: number;
    total_vat: number;
    invoice_count: number;
  }[];
  
  // Per-tarief samenvatting (cross-check tabel)
  by_rate: {
    rate: number;       // 0, 6, 12, 21
    regime: string;     // 'domestic', 'ic', 'oss', 'export'
    base_amount: number;
    vat_amount: number;
    invoice_count: number;
  }[];
  
  // Per-land samenvatting
  by_country: {
    country_code: string;
    regime: string;
    base_amount: number;
    vat_amount: number;
    invoice_count: number;
  }[];
  
  // Stripe reconciliatie (indien Stripe verbonden)
  stripe_reconciliation: {
    period_payouts_eur: number;
    expected_payouts_based_on_invoices: number;
    stripe_fees: number;
    refunds: number;
    fx_differences: number;
    discrepancy: number;
  } | null;
  
  // Audit trail
  audit_trail: {
    invoice_id: string;
    invoice_number: string;
    issue_date: string;
    customer: string;
    vat_regime: string;
    declaration_box: string;
    base_amount: number;
    vat_amount: number;
    is_credit_note: boolean;
  }[];
}

interface BoxData {
  amount: number;
  vat: number;
  source_invoice_count: number;
  source_line_count: number;
}
```

**2.2 Kerngedrag van de engine**

- Filtert op `invoices.issue_date BETWEEN period_start AND period_end`
- Filtert op `invoices.status IN ('sent', 'paid', 'overdue', 'partially_paid')` (alles wat uitgereikt is)
- Aggregeert op `invoice_lines` niveau, niet op header
- Voegt creditnota's toe als negatieve bedragen, gemapped naar de juiste compenserende vakken (uitgaande creditnota op 21%-verkoop → vak 49)
- Past `vat_regime` toe op factuur-niveau om vak-mapping te bepalen
- VIES-snapshot wordt gerespecteerd: indien `vat_number_validated_at` ontbreekt op een factuur die als IC werd geboekt, wordt deze in een `warnings` array toegevoegd
- Round-tripping: totalen moeten optellen (saldo vak 71 of 72 = vakken 54+55+56+57 - 59 - 61 + 64)

**2.3 Caching-laag**

Resultaten van afgesloten kwartalen worden gecached in een `vat_report_cache` tabel met TTL of explicit-invalidate. Een afgesloten kwartaal hoeft niet opnieuw berekend te worden tenzij er een retroactieve factuur of creditnota wordt toegevoegd. Bij wijziging triggert een DB-trigger cache-invalidation.

**2.4 React-hook `useVatReport(dateRange, options)`**

Vervangt `useVatReturns` en de VAT-delen van `useReportExports`. Eén hook, één bron.

**2.5 Schrappen van oude implementaties**

- `useReportExports.exportVatReport` → ROEPT nu `vat-report-engine` aan en transformeert output naar XLSX
- `useReportExports.exportIcListing` → idem, transformeert `ic_listing` array naar XLSX
- `useVatReturns.useCalculateVatReturn` → DEPRECATED, behoudt facade die naar nieuwe engine wijst voor backwards-compat
- `useVatReturns` table → blijft als snapshot-archief, maar wordt gevoed door de nieuwe engine

#### Acceptance-test Fase 2

- [ ] Engine geeft voor Mancini Q1-2026 een vakken-overzicht dat exact aansluit bij wat manueel uit Supabase via raw SQL berekend wordt
- [ ] Cross-check: vak 54 = sum(vakken 01*0.06 + 02*0.12 + 03*0.21)
- [ ] Cross-check: vak 71 = vak 54 - vak 59 + vak 64 (vereenvoudigd; mits geen IC-aankopen)
- [ ] IC-listing per klant matcht met handmatige som per BTW-nummer
- [ ] Creditnota's correct in vakken 48/49/64
- [ ] OSS-verkopen niet in vakken 01/02/03 maar in `oss_by_country` array
- [ ] Performance: engine draait in <3 seconden voor een tenant met 1000 facturen/periode

#### Files Fase 2

```
Nieuw:
  supabase/functions/vat-report-engine/index.ts
  supabase/functions/vat-report-engine/box-mapping.ts
  supabase/functions/vat-report-engine/aggregator.ts
  supabase/functions/vat-report-engine/types.ts
  supabase/migrations/<timestamp>_vat_report_cache.sql
  src/hooks/useVatReport.ts
  src/lib/vatBoxMapping.ts (gedeeld TS)

Wijzigen:
  src/hooks/useReportExports.ts (VAT-delen herschrijven om engine te gebruiken)
  src/hooks/useVatReturns.ts (deprecaten met facade)
  src/pages/admin/Reports.tsx (UI ververversen voor nieuwe output)

Schrappen:
  Dead code paths in oude VAT-calculatie
```

---

### Fase 3 — Export-formaten & Rapportage UI

**Tijd:** 2 werkdagen
**Goal:** Eén rapport, vijf uitvoerformaten, een professionele rapportagepagina.
**Waarom nu:** Met de engine af kan UI gewoon transformeren.

#### Deliverables Fase 3

**3.1 Export-formaten matrix**

Per rapport ondersteunen we tot 5 formaten. Niet elk rapport heeft elk formaat zinvol — onderstaande tabel toont welke:

| Rapport | XLSX | PDF | CSV (Odoo) | XML (INTERVAT) | JSON (API) |
|---|---|---|---|---|---|
| BTW-aangifte | ✅ | ✅ | ✅ | ✅ | ✅ |
| IC-Listing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Klantenlisting | ✅ | ✅ | ✅ | ✅ | ✅ |
| OSS-rapport | ✅ | ✅ | ✅ | ❌ (geen XML voor OSS) | ✅ |
| Omzetrapport | ✅ | ✅ | ✅ | ❌ | ✅ |
| Factuuroverzicht | ✅ | ❌ | ✅ | ❌ | ✅ |
| Creditnota-overzicht | ✅ | ❌ | ✅ | ❌ | ✅ |
| Aging-rapport | ✅ | ✅ | ❌ | ❌ | ✅ |
| Stripe-reconciliatie | ✅ | ✅ | ❌ | ❌ | ✅ |

**3.2 XLSX-structuur voor BTW-aangifte**

Eén workbook, meerdere tabs:
- **Tab 1: Aangifte-formulier** — Visuele weergave die overeenstemt met het MyMinFin-formulier. Per vak: code, omschrijving, bedrag. Cellen die uitkomsten zijn van een formule (zoals 54 = som van 01-03 × tarief) blijven editeerbaar maar tonen de formule in commentaar.
- **Tab 2: Audit per vak** — Drill-down: welke facturen droegen bij aan welk vak. Pivotabel, sorteerbaar.
- **Tab 3: BTW per tarief** — 0% / 6% / 12% / 21% met basisbedrag en BTW-bedrag.
- **Tab 4: Verkopen per land** — Landcode, regime, basisbedrag, BTW, aantal facturen.
- **Tab 5: IC-listing** — Klaar voor INTERVAT-XML conversie.
- **Tab 6: OSS-detail** — Per land buiten BE: tarief, basis, BTW.
- **Tab 7: Creditnota's** — Per regime/vak afgetrokken bedragen.
- **Tab 8: Stripe reconciliatie** — Periode payouts vs. factureerde bedragen, fees, refunds, discrepanties.
- **Tab 9: Checksum & waarschuwingen** — Optelling per kant, eventuele VIES-fouten, ontbrekende klantdata.

Visueel: header met tenant-info, periode, generatiedatum, paginering, kolom-formatting (EUR, percentage), conditional formatting voor afwijkingen >€1.

**3.3 PDF-formaat**

Mooi opgemaakt rapport (puppeteer of @react-pdf/renderer), ideaal voor archief of mail-naar-boekhouder. Eén PDF bevat:
- Cover met tenant-info en periode
- Samenvattende tabel BE BTW-vakken
- IC-listing pagina
- OSS-detail pagina (indien van toepassing)
- Audit-trail pagina
- Validatie-checksum sectie
- Optioneel: signed door tenant-admin (Belgisch digitaal handtekeningsysteem indien geïmplementeerd; anders eenvoudige hash)

**3.4 CSV (Odoo-compatible)**

Twee CSV-bestanden:
- `<period>_invoices_odoo.csv` — Factuurkop-regels met Odoo-kolommen (External ID, Customer, Date, Currency, Total)
- `<period>_invoice_lines_odoo.csv` — Factuurregels met Odoo-kolommen (Invoice External ID, Product, Description, Quantity, Unit Price, Account, Taxes)

Mapping naar Odoo standard-accounts:
- 700000: Sales of goods (BE 21%)
- 700100: Sales of goods (BE 6%)
- 700200: Sales of services
- 700300: Sales of goods (IC-supply)
- 700400: Sales of goods (Export)
- 700500: Sales OSS
- 451054: VAT to pay
- 411000: Trade receivables

Plus mapping naar Odoo's `l10n_be` tax-codes (`l10n_be.1_attn_VAT-OUT-21-S`, etc.).

**3.5 XML (INTERVAT)**

INTERVAT vereist een specifiek XML-schema voor BTW-aangifte (XSD beschikbaar via FOD Financiën). Onze engine genereert deze XML uit de declaration_boxes-structuur:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ns2:VATConsignment xmlns:ns2="http://www.minfin.fgov.be/InputCommon">
  <ns2:VATDeclaration SequenceNumber="1" DeclarantReference="...">
    <ns2:Declarant>
      <VATNumber>BE0XXXXXXXXX</VATNumber>
      <Name>Nomadix BV</Name>
      <Street>...</Street>
      <PostCode>...</PostCode>
      <City>...</City>
      <CountryCode>BE</CountryCode>
    </ns2:Declarant>
    <ns2:Period>
      <ns2:Quarter>2</ns2:Quarter>
      <ns2:Year>2026</ns2:Year>
    </ns2:Period>
    <ns2:Data>
      <Amount GridNumber="01">0.00</Amount>
      <Amount GridNumber="03">12453.20</Amount>
      <Amount GridNumber="46">3200.00</Amount>
      <Amount GridNumber="54">2615.17</Amount>
      <Amount GridNumber="59">450.00</Amount>
      <Amount GridNumber="71">2165.17</Amount>
    </ns2:Data>
  </ns2:VATDeclaration>
</ns2:VATConsignment>
```

Voor IC-listing een aparte XML met `IntraConsignment`-root.

**3.6 Reports.tsx-pagina herstructurering**

Nieuwe tab-volgorde, gegroepeerd naar gebruiksdoel:

| Tab | Voor wie | Wat |
|---|---|---|
| **Aangiftes** | Boekhouder | BTW, IC, OSS, klantenlisting — directe fiscale rapporten |
| **Boekhouding** | Boekhouder + intern | Omzet per periode, journaalbladen, Stripe-reconciliatie |
| **Handelsgegevens** | Intern | Facturen, creditnota's, bestellingen, klanten |
| **Operationeel** | Intern | Producten, voorraad, abonnementen, kassa |
| **Inkoop** | Boekhouder + intern | Crediteuren, inkooporders, leveranciersdocumenten |
| **Bulk Downloads** | Boekhouder | ZIP-pakketten per kwartaal: alle facturen-PDF + UBL + rapporten in één |

**3.7 Snelle Acties — herziening**

Vervang de huidige knoppen door:
- **"Q-Pakket voor Boekhouder"** — XLSX BTW-aangifte + XLSX IC-listing + PDF samenvattend + ZIP factuur-PDF's + ZIP UBL-XML's + Odoo-CSV's, alles voor het geselecteerde kwartaal
- **"INTERVAT Export"** — XML BTW-aangifte + XML IC-listing klaar voor upload
- **"Jaarafsluiting"** — Volledige jaarklantenlisting + jaaroverzicht omzet + alle Q-XML's
- **"Audit Trail Periode"** — JSON-dump van alle data inclusief facturen, lijnen, klanten, betalingen, voor onafhankelijke controle

#### Acceptance-test Fase 3

- [ ] XLSX BTW-aangifte opent in Excel/LibreOffice met alle 9 tabs correct opgemaakt
- [ ] PDF opent en is leesbaar, paginabreuken correct
- [ ] CSV importeert in Odoo zonder fouten (test met sandbox Odoo-instance)
- [ ] XML valideert tegen INTERVAT XSD (officiële XSD downloaden van FOD Financiën site)
- [ ] Snelle Actie "Q-Pakket" levert ZIP binnen 30 seconden voor 500 facturen
- [ ] Reports.tsx pagina volgt nieuwe tab-volgorde

#### Files Fase 3

```
Nieuw:
  supabase/functions/export-vat-xlsx/index.ts
  supabase/functions/export-vat-pdf/index.ts
  supabase/functions/export-vat-xml/index.ts
  supabase/functions/export-ic-listing-xml/index.ts
  supabase/functions/export-odoo-csv/index.ts
  supabase/functions/export-q-bundle/index.ts
  src/lib/exporters/xlsxBuilder.ts
  src/lib/exporters/pdfBuilder.ts
  src/lib/exporters/intervatXml.ts
  src/lib/exporters/odooCsv.ts
  src/components/admin/reports/QuarterBundleCard.tsx

Wijzigen:
  src/pages/admin/Reports.tsx (volledige herstructurering)
  src/components/admin/reports/ReportCard.tsx (format-keuze uitbreiden)
  src/hooks/useReportExports.ts (alle exporters omleiden naar engine)
```

---

### Fase 4 — Odoo Bridge & Peppol Compliance

**Tijd:** 7 werkdagen
**Goal:** Eén-klik export naar Odoo + actieve Peppol uitgaand & inkomend.
**Waarom als laatste:** Dit is afhankelijk van schone data uit fase 1+2 en exporters uit fase 3.

#### Deliverables Fase 4

**4.1 Peppol BIS 3.0 UBL-generator**

Edge function `generate-peppol-ubl` die een geldige UBL 2.1 BIS Billing 3.0 XML produceert per factuur. Validatie tegen XSD voor verzending.

Belangrijke elementen:
- `cbc:CustomizationID` = `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`
- `cbc:ProfileID` = `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`
- Verkoper-identifier: `0208:<KBO-nummer>` (NIET BTW-nummer)
- Koper-identifier: zelfde schema indien BE-koper, anders schema per land (0184 NL, 0007 SE, etc.)
- BTW per tarief geaggregeerd in `cac:TaxTotal/cac:TaxSubtotal` (per-rate afronding, niet line-by-line — sinds 1 jan 2026)
- `cac:OrderReference` en `cac:ContractDocumentReference` indien beschikbaar
- `cac:PaymentMeans` met `cbc:PaymentMeansCode` (30 voor SEPA), IBAN, OGM-referentie in `cbc:PaymentID`
- Creditnota's: zelfde structuur met `<CreditNote>` root i.p.v. `<Invoice>`, referentie naar originele factuur via `cac:BillingReference`

**4.2 Peppol Access Point integratie**

Optie A: **Storecove** API-first AP. Per factuur een POST naar `/v2/document_submissions`. Webhook-callback voor delivery status. Pricing: per verzonden document (~€0.07-0.15). Pro: snelle integratie, EU-host. Con: kosten lopen op.

Optie B: **Let's Peppol** (gratis, BARGE vzw, open-source). Geen API maar SMTP/inbox-gebaseerd. Pro: gratis. Con: minder geschikt voor SaaS-platform, geen multi-tenant native.

Optie C: **Eigen AS4 access point** via OASIS AS4 protocol. Vereist Belgian Peppol Authority certificering (FOD BOSA-procedure). Pro: volledige controle, geen per-document-kosten. Con: 2-4 weken implementatie + certificering, juridische verantwoordelijkheid.

**Aanbeveling:** Start met Storecove voor snelle compliance. Migreer naar eigen AS4 zodra volume >5000 docs/maand rechtvaardigt.

**4.3 Peppol uitgaande flow**

```
Invoice created (status: sent)
    ↓
Trigger: B2B + EU + heeft Peppol-ID?
    ↓ ja
generate-peppol-ubl edge function
    ↓
Validate against BIS 3.0 XSD
    ↓
Save to Supabase Storage (private bucket)
    ↓
Update invoices.ubl_url + invoices.peppol_status = 'pending'
    ↓
send-via-peppol edge function (async via queue)
    ↓
POST to Storecove API
    ↓
Update invoices.peppol_message_id, peppol_status = 'sent'
    ↓
Storecove webhook → update peppol_status = 'delivered' | 'rejected'
    ↓
Bij rejected: notification naar tenant-admin
```

**4.4 Peppol-ontvangst (inbound)**

Inbound endpoint via Storecove receives webhook met inkomende UBL. Edge function `receive-peppol-document` parseert UBL en creëert:
- `supplier_documents` record (type: invoice)
- Lines in een nieuwe `supplier_document_lines` tabel
- BTW-vakken op aankoop-zijde (81/82/83/86/87/88) toegewezen
- Notification naar tenant-admin: "Nieuwe factuur ontvangen via Peppol van <leverancier>"

**4.5 Odoo Bridge — Phase 1 (CSV-export)**

Reeds in Fase 3 ingebouwd. In Fase 4 verfijnen we met:
- **Tenant-instellingen** voor Odoo: company_id, account_mapping per regime, default-tax-codes
- **Validatie-prepass** voor import: ontbrekende klantenkoppelingen, ontbrekende product-koppelingen
- **Import-handleiding PDF** per tenant: stappenplan voor de boekhouder om Q-pakket in zijn Odoo te importeren

**4.6 Odoo Bridge — Phase 2 (Direct API, optioneel)**

Voor tenants die Odoo Online of self-hosted Odoo gebruiken:
- OAuth-koppeling vanuit SellQo naar Odoo
- Direct `account.move` posten via XML-RPC of REST
- Bi-directional sync: betalingen die in Odoo worden geboekt syncen terug naar SellQo invoice.status
- Per-tenant configureerbaar

Dit is fase 5+, vermeld hier ter completeness.

**4.7 BTW-rounding compliance check**

Verifieer dat alle factuur-totalen sinds 1 jan 2026 worden afgerond per BTW-tarief, niet per regel. Refactor `useInvoiceCalculations` en eventuele edge functions die totalen berekenen.

Concreet:
- Lijn-bedragen: blijven met cent-precisie
- BTW-bedrag per lijn: BLIJFT berekenbaar (per_rate aggregatie nodig)
- BTW per tarief: SOM van lijn-BTW × tarief, dan afgerond op 2 decimalen
- Totaal-BTW: som van per-tarief-afgerond
- Subtotaal excl. BTW: som van lijn-totalen excl.
- Totaal incl. BTW: subtotaal + totaal-BTW

#### Acceptance-test Fase 4

- [ ] 10 willekeurige B2B EU-facturen genereren geldig UBL dat valideert tegen BIS 3.0 XSD
- [ ] Storecove sandbox-tests: verstuur 5 testfacturen, allen ontvangen status 'delivered'
- [ ] Inbound: simuleer Peppol-bericht via Storecove sandbox, supplier_document wordt correct aangemaakt
- [ ] Odoo CSV-import: importeer Q1-2026 Mancini-bundle in Odoo demo-instance, alle lijnen op juiste rekening en BTW-code
- [ ] BTW-afronding check: vergelijk totaal-BTW per tarief met som van lijn-BTW (mag niet meer dan 1 cent verschillen)

#### Files Fase 4

```
Nieuw:
  supabase/functions/generate-peppol-ubl/index.ts
  supabase/functions/send-via-peppol/index.ts
  supabase/functions/receive-peppol-document/index.ts
  supabase/functions/peppol-webhook-handler/index.ts
  supabase/migrations/<timestamp>_peppol_columns.sql
  src/lib/peppol/ubl-builder.ts
  src/lib/peppol/xsd-validator.ts
  src/components/admin/settings/PeppolSettings.tsx
  docs/odoo-import-handleiding.pdf (gegenereerd per tenant via PDF-edge function)

Wijzigen:
  src/lib/calculations/invoiceTotals.ts (afronding per-rate)
  supabase/functions/_shared/invoice.ts (idem)
  src/pages/admin/invoices/InvoiceDetail.tsx (Peppol-status badge)
```

---

## Deel D — Belgische compliance-referentie

### D.1 BTW-aangifte vakken — volledig

| Vak | Naam | Wanneer gebruiken | SellQo-mapping |
|---|---|---|---|
| 00 | Bijzondere regelingen | Reisbureaus, kunst, oud-metaal, etc. | Edge case |
| 01 | Verkopen 6% (BE binnenland) | Boeken, voeding, vervoer, geneesmiddelen | `vat_regime = 'domestic_reduced_6'` |
| 02 | Verkopen 12% (BE binnenland) | Restaurant, kabel-TV, sociale huisvesting | `vat_regime = 'domestic_reduced_12'` |
| 03 | Verkopen 21% (BE binnenland) | Standaardtarief | `vat_regime = 'domestic_standard'` |
| 44 | Diensten met verlegging aan EU-B2B-klant | Software, consulting, licenties B2B EU | `vat_regime = 'ic_supply_services'` |
| 45 | Werk in onroerend goed met medecontractant | Bouw, sloop, installatie aan BTW-plichtige | Edge case |
| 46 | IC-leveringen goederen B2B EU | Fysieke producten naar EU B2B met geldig VAT-nummer | `vat_regime = 'ic_supply_goods'` |
| 47 | Andere vrijgestelde + export buiten EU | UK, Zwitserland, US, etc. | `vat_regime = 'export_outside_eu'` |
| 48 | Creditnota's op vak 44/45/46 | Negatief op IC-leveringen | Bereken uit credit_notes |
| 49 | Creditnota's op vak 00/01/02/03 | Negatief op binnenlandse verkopen | Bereken uit credit_notes |
| 54 | Verschuldigde BTW op verkopen | Som van (vak 01 × 6% + 02 × 12% + 03 × 21%) | Auto |
| 55 | BTW op IC-aankopen | Aankoop-zijde | Aankopen-flow |
| 56 | BTW op medecontractant (binnenland) | Aankoop-zijde | Aankopen-flow |
| 57 | BTW op import (regime 42) | Edge case import | Aankopen-flow |
| 59 | Aftrekbare BTW totaal | Aankoop-zijde, alle aftrekbare BTW | Aankopen-flow |
| 61 | Correcties verschuldigde BTW | Manuele correcties | Manueel |
| 62 | Correcties aftrekbare BTW | Idem | Manueel |
| 63 | Te storten BTW (saldo) | = 54 + 55 + 56 + 57 - 59 + 61 - 62 - 64 | Auto |
| 64 | Te recupereren BTW van uitgaande creditnota | BTW-deel van vak 48 + 49 | Auto |
| 71 | Te betalen aan Staat | Indien 63 > 0 | Auto |
| 72 | Te recupereren van Staat | Indien 63 < 0 | Auto |
| 81 | Aankopen handelsgoederen | Aankoop-zijde | Aankopen-flow |
| 82 | Aankopen diversen + diensten | Aankoop-zijde | Aankopen-flow |
| 83 | Investeringen | Aankoop-zijde | Aankopen-flow |
| 84 | Inkomende creditnota's op 81/82/83 | Aankoop-zijde | Aankopen-flow |
| 85 | Inkomende creditnota's op IC- en medecontractant-aankopen | Aankoop-zijde | Aankopen-flow |
| 86 | IC-aankopen | Aankoop-zijde | Aankopen-flow |
| 87 | Medecontractant + binnenkomende handelingen met verlegging | Aankoop-zijde | Aankopen-flow |
| 88 | IC-diensten met verlegging | Aankoop-zijde | Aankopen-flow |

### D.2 IC-Listing (INTERVAT formulier 723)

Verplicht kwartaalaangifte voor leveringen onder vakken 44, 46 en 48. Per klant met geldig EU BTW-nummer:

| Veld | Inhoud |
|---|---|
| Land | ISO 3166-1 alpha-2 (NL, DE, FR, ...) |
| BTW-nummer | Zonder landcode (in INTERVAT XML) |
| Bedrag | Som excl. BTW per klant per kwartaal |
| Code | L = Levering goederen, T = Driehoekshandel, S = Diensten |

Drempel: vanaf €1 cumulatief per kwartaal aan een EU-klant verplicht in IC-listing.

XSD: download via [https://www.belgium.be](https://www.belgium.be) → MyMinFin → INTERVAT-documentatie. Onze engine moet hiertegen valideren.

### D.3 Jaarlijkse klantenlisting (formulier 725)

Verplicht uiterlijk 31 maart van het jaar volgend op het belastbaar jaar. Bevat:
- Alle Belgische klanten met geldig BE-BTW-nummer
- Aan wie meer dan €250 excl. BTW werd gefactureerd in het jaar
- Per klant: BTW-nummer, totaal-omzet excl. BTW, totaal-BTW

**Niet meegenomen:** verkopen aan particulieren, verkopen aan EU/non-EU, verkopen onder vrijstelling artikel 44.

### D.4 OSS-aangifte (Mini One Stop Shop voor B2C-EU)

Vanaf het moment dat de cumulatieve omzet aan EU-consumenten (niet-BE) >€10.000 op kalenderjaarbasis, ben je verplicht om OSS-aangifte te doen of je te registreren in elk EU-land waar je aan B2C verkoopt.

OSS-flow:
- Belgische BTW-plichtige doet één geconsolideerde aangifte via MyMinFin OSS-module
- Per land afzonderlijk: omzet, lokaal BTW-tarief, BTW-bedrag
- BTW wordt afgedragen aan FOD Financiën, die verdeelt naar lidstaten

SellQo-implementatie:
- Per tenant een `oss_threshold_reached_at` veld op tenants-tabel
- Cumulatieve teller van B2C-EU-omzet over kalenderjaar
- Bij overschrijding: alert naar tenant-admin + automatische switch van `domestic_standard` naar `oss_b2c_<country>` voor alle nieuwe B2C-EU-facturen
- Per land het correcte lokale tarief gebruiken (uit `euVatRates.ts`, gevuld met huidige tarieven)
- OSS-rapport genereert per land overzicht

### D.5 Stripe payouts reconciliatie

Stripe betaalt niet per factuur uit. Stripe bundelt transacties in een **payout** (dagelijks of wekelijks) en verrekent fees + refunds + chargebacks. Boekhouder heeft nodig:

| Element | Bron in SellQo |
|---|---|
| Periode bruto factuurbedragen | invoices.total (status sent/paid in periode) |
| Periode netto Stripe payouts | Stripe API: Balance Transactions, filter type=payout |
| Periode Stripe fees | Stripe API: Balance Transactions, filter type=stripe_fee |
| Periode refunds | credit_notes WHERE refund_method = 'stripe' AND issue_date IN periode |
| FX-verschillen | Indien multi-currency: Stripe rapporteert in account currency |
| Discrepantie | bruto - fees - refunds - payouts (zou 0 moeten zijn binnen €1) |

Reconciliatie-tabel hoort in Q-pakket XLSX tab 8. Discrepanties >€1 worden in waarschuwingen-tab gerapporteerd.

---

## Deel E — Odoo-integratie-architectuur

### E.1 Fiscal Position mapping

Odoo gebruikt **Fiscal Positions** om automatisch het juiste BTW-tarief en de juiste grootboekrekening te kiezen op basis van klantkenmerken. Voor BE-localization:

| SellQo `vat_regime` | Odoo Fiscal Position | Default Tax | Default Revenue Account |
|---|---|---|---|
| `domestic_standard` | (geen — default BE) | `21% S` | 700000 |
| `domestic_reduced_6` | (geen) | `6% S` | 700100 |
| `domestic_reduced_12` | (geen) | `12% S` | 700200 |
| `ic_supply_goods` | `Régime Intra-Communautaire B2B` | `0% EU G` | 700300 |
| `ic_supply_services` | `Régime Intra-Communautaire B2B` | `0% EU S` | 700300 |
| `export_outside_eu` | `Régime Extra-Communautaire` | `0% EX` | 700400 |
| `oss_b2c_nl` | `OSS - Netherlands` | `21% NL OSS` | 700500 |
| `oss_b2c_de` | `OSS - Germany` | `19% DE OSS` | 700500 |
| `reverse_charge_construction` | `Cocontractant - Werk in onroerend goed` | `0% CO` | 700600 |
| `marketplace_deemed_supplier` | `Régime Marketplace - Deemed Supplier` | `0% MD` | 700700 |

Bij Odoo-CSV-import voegen we per regel de juiste `Account/External ID` en `Taxes/External ID` toe.

### E.2 MAR-grootboekrekeningen (uittreksel)

Het Minimum Algemeen Rekeningstelsel (MAR) is verplicht voor Belgische ondernemingen. Belangrijkste 7-klasse rekeningen voor e-commerce:

| MAR-rekening | Omschrijving | Wanneer gebruiken |
|---|---|---|
| 700000 | Verkopen handelsgoederen — BE 21% | Standaard binnenland |
| 700010 | Verkopen handelsgoederen — BE 6% | Boeken, voeding |
| 700020 | Verkopen handelsgoederen — BE 12% | Restaurant, sociale huisvesting |
| 700100 | Verkopen IC-leveringen | EU B2B met geldig VAT |
| 700200 | Verkopen export buiten EU | Niet-EU |
| 700300 | Verkopen OSS B2C-EU | B2C EU cross-border |
| 700900 | Verkoopkortingen | Negatief |
| 706000 | Verkopen diensten | Indien van toepassing |
| 740000 | Andere bedrijfsopbrengsten | Bv. herstelfees |
| 451054 | Te betalen BTW 21% | Output VAT |
| 451064 | Te betalen BTW 6% | Output VAT |
| 411000 | Handelsdebiteuren | Open vorderingen |
| 416000 | Diverse debiteuren | Niet-handelsklanten |
| 440000 | Leveranciers | Open schulden |
| 550000 | Kredietinstellingen — zichtrekening | Bank |
| 580000 | Interne overboekingen | Stripe → bank |

### E.3 Odoo-import-bestandsformaat (CSV)

Twee bestanden per periode, met deze exacte kolommen:

**`invoices.csv`:**
```
External ID, Customer, Invoice Date, Due Date, Currency, 
Journal, Communication, Salesperson, Source Document
```

**`invoice_lines.csv`:**
```
Invoice External ID, Product, Description, Account, 
Quantity, Unit Price, Discount (%), Taxes
```

Validatie-prepass in SellQo: alle klanten in CSV moeten matchen met een Odoo-customer (op email of VAT-nummer). Indien niet: lijst van ontbrekende klanten apart leveren met "Create in Odoo first" instructie.

### E.4 Direct API-integratie (toekomstig, Fase 5+)

Odoo biedt **XML-RPC** en sinds Odoo 16 ook een **JSON-RPC** endpoint. Authenticatie via OAuth (Odoo Online) of API-key (self-hosted).

Per-tenant Odoo-instelling:
```typescript
interface OdooConnection {
  url: string;              // bv. https://mancini-milano.odoo.com
  database: string;
  username: string;
  api_key: string;          // encrypted in DB
  default_journal_id: number;
  default_account_id_per_regime: Record<string, number>;
  default_tax_id_per_regime: Record<string, number>;
  default_partner_id_b2c: number;  // voor anonieme B2C-verkopen
}
```

Post-flow:
1. Bij invoice sent in SellQo → edge function `post-to-odoo`
2. Map invoice naar Odoo `account.move` object
3. POST via JSON-RPC
4. Bij success: sla Odoo `move_id` op in `invoices.external_id`
5. Bi-directional: Odoo webhook bij betaling → update `invoices.status`

---

## Deel F — Peppol-roadmap

### F.1 Wettelijke vereisten (samengevat)

- Sinds 1 jan 2026: alle B2B-facturen tussen Belgische BTW-plichtigen via Peppol
- Formaat: Peppol BIS Billing 3.0 (UBL 2.1, EN 16931-compliant)
- Toepasselijk op uitgaand én inkomend
- Boetes: €1.500 eerste overtreding, oplopend tot €5.000 bij herhaling
- B2C uitgezonderd voor uitgaand
- Buitenlandse klanten uitgezonderd, tenzij beide partijen Peppol verkiezen

### F.2 Architectuurkeuzes

**SMP-lookup** (Service Metadata Publisher) — vóór verzending wordt opgevraagd waar de ontvanger zijn Peppol-berichten wenst te ontvangen. Wij doen dit via onze Access Point (Storecove handelt dit transparant af).

**Access Point selectie:**
- **Korte termijn (fase 4):** Storecove API-integratie. Snelle compliance, betaalbaar bij <10k docs/maand.
- **Lange termijn (fase 6+):** Eigen AS4 Access Point via FOD BOSA-procedure. Volledige controle, geen marge per document.

### F.3 UBL BIS 3.0 — verplichte velden

Een correct UBL voor B2B BE-verzending:

| XPath | Inhoud |
|---|---|
| `/Invoice/cbc:CustomizationID` | `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0` |
| `/Invoice/cbc:ProfileID` | `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` |
| `/Invoice/cbc:ID` | Factuurnummer (uniek per tenant) |
| `/Invoice/cbc:IssueDate` | `issue_date` |
| `/Invoice/cbc:DueDate` | Vervaldag |
| `/Invoice/cbc:InvoiceTypeCode` | 380 (commercial invoice) of 381 (credit note - use CreditNote root) |
| `/Invoice/cbc:DocumentCurrencyCode` | EUR |
| `/Invoice/cac:AccountingSupplierParty/cac:Party/cbc:EndpointID@schemeID` | 0208 (BE KBO) |
| `/Invoice/cac:AccountingSupplierParty/cac:Party/cbc:EndpointID` | KBO-nummer (10 cijfers) |
| `/Invoice/cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID` | Volledig BTW-nummer met landcode (BE0XXXXXXXXX) |
| `/Invoice/cac:AccountingCustomerParty/...` | Klantdata, identiek schema |
| `/Invoice/cac:PaymentMeans/cbc:PaymentMeansCode` | 30 (credit transfer SEPA) |
| `/Invoice/cac:PaymentMeans/cbc:PaymentID` | OGM-referentie |
| `/Invoice/cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID@schemeID` | IBAN |
| `/Invoice/cac:TaxTotal/cbc:TaxAmount` | Totaal BTW |
| `/Invoice/cac:TaxTotal/cac:TaxSubtotal` | Per BTW-tarief één |
| `/Invoice/cac:LegalMonetaryTotal/cbc:LineExtensionAmount` | Subtotaal excl. BTW |
| `/Invoice/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount` | Idem |
| `/Invoice/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount` | Totaal incl. BTW |
| `/Invoice/cac:LegalMonetaryTotal/cbc:PayableAmount` | Te betalen |
| `/Invoice/cac:InvoiceLine` | Per factuurregel |

### F.4 Validatie

Vóór verzending: schema-validatie + Schematron-validatie (BIS 3.0 specifieke regels).
Tools: `peppol-bis-invoice-3` Schematron-files (openbaar, GitHub OpenPeppol).
In edge function: gebruik `libxmljs2` + `node-schematron` of equivalent.

### F.5 Inbound-flow

Bij Storecove-webhook met inkomend document:
1. Parse UBL → extract: sender VAT, invoice number, lines, totals, BTW-detail
2. Match sender met `suppliers` tabel op VAT-nummer
3. Indien niet bestaand: maak nieuw `supplier`-record met `auto_created_via_peppol = true`
4. Maak `supplier_documents` record (type: invoice)
5. Maak `supplier_document_lines` records
6. Suggereer BTW-vakken op aankoop-zijde (81/82/83/86/87/88)
7. Notification naar tenant-admin voor goedkeuring + betaling

### F.6 Peppol-statussen op invoices

```sql
ALTER TABLE invoices ADD COLUMN peppol_status VARCHAR(20);
-- Possible: 'not_applicable', 'pending', 'sent', 'delivered', 'rejected', 'failed'

ALTER TABLE invoices ADD COLUMN peppol_message_id VARCHAR(100);
ALTER TABLE invoices ADD COLUMN peppol_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN peppol_delivered_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN peppol_error TEXT;
```

UI: badge per factuur die status toont (groen = delivered, oranje = sent maar nog niet bevestigd, rood = rejected/failed met details).

---

## Deel G — Database-migraties (concrete SQL)

### G.1 Migratie 1 — Foundation (Fase 1)

```sql
-- File: supabase/migrations/<timestamp>_accounting_foundation_phase1.sql

-- Step 1: vat_regimes lookup table
CREATE TABLE IF NOT EXISTS public.vat_regimes (
  code VARCHAR(40) PRIMARY KEY,
  description_nl TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  applies_vat BOOLEAN NOT NULL DEFAULT true,
  reverse_charge BOOLEAN NOT NULL DEFAULT false,
  output_vat_box VARCHAR(3),
  invoice_text_nl TEXT,
  invoice_text_fr TEXT,
  invoice_text_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.vat_regimes (code, description_nl, applies_vat, reverse_charge, output_vat_box, invoice_text_nl) VALUES
  ('domestic_standard', 'Binnenland standaardtarief 21%', true, false, '03', NULL),
  ('domestic_reduced_6', 'Binnenland verlaagd tarief 6%', true, false, '01', NULL),
  ('domestic_reduced_12', 'Binnenland verlaagd tarief 12%', true, false, '02', NULL),
  ('domestic_zero', 'Binnenland 0%', true, false, '00', NULL),
  ('ic_supply_goods', 'Intracommunautaire levering goederen', false, true, '46', 'Vrijgesteld van btw - Intracommunautaire levering - artikel 39bis WBTW'),
  ('ic_supply_services', 'Intracommunautaire dienst (verlegging)', false, true, '44', 'Btw verlegd - artikel 21 §2 WBTW'),
  ('ic_triangulation', 'Driehoekshandel', false, true, '46', 'Driehoekshandel - artikel 25ter WBTW'),
  ('oss_b2c_eu', 'OSS B2C EU (één-loket)', true, false, NULL, NULL),
  ('export_outside_eu', 'Export buiten EU', false, false, '47', 'Vrijgesteld van btw - Uitvoer - artikel 39 WBTW'),
  ('reverse_charge_construction', 'Werk in onroerend goed met verlegging', false, true, '45', 'Btw verlegd - artikel 20 KB1'),
  ('marketplace_deemed_supplier', 'Marketplace deemed supplier (Bol.com B2C EU)', false, false, '47', 'Vrijgesteld - marketplace deemed supplier - art. 13bis WBTW'),
  ('exempt_article_44', 'Vrijgesteld onder artikel 44 WBTW', false, false, NULL, 'Vrijgesteld van btw - artikel 44 WBTW');

-- Step 2: Add columns to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS vat_regime VARCHAR(40) REFERENCES public.vat_regimes(code) DEFAULT 'domestic_standard',
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS vat_point_date DATE,
  ADD COLUMN IF NOT EXISTS reporting_country CHAR(2),
  ADD COLUMN IF NOT EXISTS vat_number_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vat_number_validated_value VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vat_rounding_strategy VARCHAR(20) DEFAULT 'per_rate' CHECK (vat_rounding_strategy IN ('per_rate', 'per_line', 'document_total')),
  ADD COLUMN IF NOT EXISTS peppol_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS peppol_message_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS peppol_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peppol_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peppol_error TEXT;

-- Step 3: Migrate existing data
UPDATE public.invoices 
SET 
  issue_date = COALESCE(sent_at::date, created_at::date),
  vat_point_date = COALESCE(sent_at::date, created_at::date)
WHERE issue_date IS NULL;

UPDATE public.invoices i
SET reporting_country = c.billing_country
FROM public.customers c
WHERE i.customer_id = c.id AND i.reporting_country IS NULL;

-- Now make issue_date NOT NULL
ALTER TABLE public.invoices ALTER COLUMN issue_date SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN issue_date SET DEFAULT CURRENT_DATE;

-- Step 4: Indexes for reporting performance
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date 
  ON public.invoices(tenant_id, issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date_status 
  ON public.invoices(tenant_id, issue_date, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_regime 
  ON public.invoices(tenant_id, vat_regime);

-- Step 5: Add columns to invoice_lines
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS vat_box_code VARCHAR(3);

-- Step 6: vat_report_cache for performance (Fase 2)
CREATE TABLE IF NOT EXISTS public.vat_report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, period_start, period_end, period_type)
);

CREATE INDEX idx_vat_report_cache_lookup 
  ON public.vat_report_cache(tenant_id, period_start, period_end) 
  WHERE invalidated_at IS NULL;

-- RLS for cache
ALTER TABLE public.vat_report_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant's cache"
  ON public.vat_report_cache FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Step 7: Trigger to invalidate cache when invoices change
CREATE OR REPLACE FUNCTION public.invalidate_vat_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vat_report_cache 
  SET invalidated_at = now()
  WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
    AND (
      (NEW.issue_date BETWEEN period_start AND period_end)
      OR (OLD.issue_date BETWEEN period_start AND period_end)
    )
    AND invalidated_at IS NULL;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_invoices_invalidate_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_vat_cache();
```

### G.2 Migratie 2 — Peppol velden (Fase 4)

(Reeds opgenomen in G.1; aparte migratie indien Fase 1 reeds gerold zonder Peppol-velden.)

### G.3 Backfill-script

Na deployment van migratie G.1: één-malig de `resolve-vat-regime` edge function runnen op alle bestaande facturen om `vat_regime` correct te zetten op basis van klant + content. Geschat: 5-10 minuten voor 10.000 facturen.

---

## Deel H — Meeting prep met de boekhouder

### H.1 Voorbereidings-checklist (10 dagen tot meeting)

| Dag | Actie | Owner |
|---|---|---|
| Dag 1-2 | Document doorlezen + feedback geven aan Claude voor finetuning | Akke |
| Dag 3-4 | Sample-rapport bouwen (Mancini Q1-2026 zoals het NU is) + sample zoals het NA fase 2 zal zijn | Akke + Claude Code |
| Dag 5 | Demo-deck (5-7 slides) met visuele samenvatting | Akke (eventueel pptx-deck genereren) |
| Dag 6 | Sample UBL BIS 3.0 met validatie tegen XSD — print twee versies (one-pager) | Claude Code |
| Dag 7 | Sample INTERVAT-XML printen + INTERVAT-handleiding klaarleggen | Claude Code |
| Dag 8 | Vragen-lijst opstellen voor de boekhouder | Akke |
| Dag 9 | Demo trial run — 30 minuten doorlopen wat je gaat tonen | Akke |
| Dag 10 | Meeting | Akke + boekhouder |

### H.2 Demo-script (30-45 minuten)

**Minuut 0-3 — Introductie**
"Ik werk al twee jaar aan een e-commerce platform genaamd SellQo dat zich onderscheidt van Shopify en WooCommerce door één ding: het is gebouwd vanaf de eerste regel code voor de Belgische BTW-realiteit. Geen plug-ins, geen workarounds. Vandaag wil ik je laten zien wat we hebben en vragen wat we nog beter kunnen doen vanuit jouw perspectief."

**Minuut 3-10 — De pijn**
"Wat ik wil oplossen is de uren die jij elke maand verliest aan slechte brondata. Mag ik even een idee krijgen: bij een gemiddelde e-commerce klant met 500 facturen per maand, hoeveel tijd schat je dat je per kwartaal extra besteedt aan hercategorisatie en cross-check?" → noteer antwoord, gebruik in vervolg.

**Minuut 10-20 — De demo**
1. Open SellQo admin van een testtenant
2. Toon factuur-aanmaak met automatische `vat_regime`-detectie + VIES-validatie live
3. Toon Reports-pagina, ga naar "Q-Pakket voor Boekhouder"
4. Klik download, open ZIP, doorloop:
   - XLSX BTW-aangifte met alle vakken
   - PDF samenvatting
   - INTERVAT-XML (toon validatie tegen XSD)
   - Odoo-CSV import-bestand
   - IC-listing
5. Open Peppol-sectie, toon UBL-export per factuur, verstuur testfactuur via Storecove sandbox

**Minuut 20-25 — Het partnermodel**
"Drie manieren waarop we kunnen samenwerken: referral, white-label, of straks een accountant-portal. Wat past in jouw kantoor?"

**Minuut 25-40 — Q&A + Discovery**
Stel deze vragen:
1. **"Welke boekhoudsoftware gebruik je voor je e-commerce klanten?"** — bevestigt Odoo-prioriteit of toont alternatief (Octopus, BOB, WinBooks, Yuki)
2. **"Wat zijn de drie meest tijdrovende dingen aan een e-commerce klant per kwartaal?"** — input voor product-prioritering
3. **"Welke 3 elementen MOETEN absoluut op een BTW-aangifte-rapport staan dat je vandaag niet altijd krijgt?"** — direct actionable feedback
4. **"Heb je klanten met cross-border B2C die struikelen op OSS?"** — markt-validatie
5. **"Is Peppol-implementatie bij jouw klanten al rond, of zit je nog met problemen?"** — pijn-identificatie
6. **"Zou je SellQo aanbevelen aan een klant als alles dat we vandaag besproken hebben werkt zoals beloofd?"** — close

**Minuut 40-45 — Vervolgafspraken**
- Schrijf actiepunten op
- Stuur binnen 24u meeting-recap met afgesproken next steps
- Sluit af met concrete vervolgafspraak binnen 4-6 weken (wanneer Fase 2 live is)

### H.3 Materialen te brengen

- [ ] Laptop met SellQo testtenant geladen (Mancini sandbox indien beschikbaar)
- [ ] Geprinte one-pager met SellQo-USP's vs. Shopify/Woo
- [ ] Geprinte sample BTW-aangifte XLSX (Q1-2026 Mancini)
- [ ] Geprinte sample INTERVAT-XML met XSD-validatieoutput
- [ ] Geprinte sample UBL BIS 3.0
- [ ] Geprinte 1-pager partnermodellen (3 modellen, voor- en nadelen)
- [ ] Voorbeeld-contract referral (eenvoudig, één pagina)
- [ ] Visitekaartje

### H.4 Anti-pattern — wat NIET doen

- Niet vertellen dat de huidige rapporten fout zijn (verkopen we de oplossing, niet het probleem)
- Niet beloven dat alles binnen 14 dagen werkt — pitch de roadmap, niet de release
- Niet pricing in dit gesprek vastleggen voor partnermodel; verwijs naar follow-up
- Niet meer dan 3 USP's tegelijk pitchen — focus op Peppol + Odoo + tijdsbesparing
- Niet de technische details (RLS, edge functions, etc.) bovendrijven — boekhouder wil weten WAT en WAAROM, niet HOE
- Niet te lang praten — geef hem de helft van de tijd

### H.5 Verwachte vragen + voorbereide antwoorden

| Vraag | Antwoord |
|---|---|
| "Wat als mijn klant al een ander e-commerce platform heeft?" | "We bouwen migratiepaden van Shopify, WooCommerce en BigCommerce. Eerste klant migratie is gratis als pilot." |
| "Wat als de fiscus van regelgeving verandert?" | "Onze BTW-regimes-tabel is een lookup; bij wijziging update we het centraal, alle tenants worden automatisch up-to-date." |
| "Hoe veilig is mijn klant z'n data?" | "We hebben net een security-hardening afgerond met externe pentest. RLS op database-niveau. JWT-auth op admin-functies. GDPR-compliant. We kunnen het pentest-rapport delen onder NDA." |
| "Kan ik de data van mijn klant ook downloaden als hij overstapt?" | "Volledige data-export in CSV, JSON of XLSX, inclusief alle facturen-PDF en UBL's. Geen lock-in." |
| "Wat kost het de klant?" | "Starter €29/maand, Pro €79/maand, Enterprise €199. Voor jouw klanten met >50 facturen/maand standaard Pro." |
| "Hoeveel klanten heb je nu?" | "Ik bouw met focus op kwaliteit, niet kwantiteit. Eerste paying tenant draait sinds maart 2026, twee meer in pipeline. Ik zoek 5 ankerklanten via partners zoals jij." |
| "Heb je referenties?" | "Mancini Milano (Belgisch streetwear, B2C met Stripe Connect) is mijn eerste live tenant. Onder NDA kan ik je een walkthrough geven van hun setup." |

---

## Appendix — File-inventaris voor uitvoering

### Bestaande files te wijzigen

```
src/
  hooks/
    useReportExports.ts          [REFACTOR — gebruik vat-report-engine voor VAT-delen]
    useVatReturns.ts             [DEPRECATE — facade naar engine]
    useVatRates.ts               [REVIEW — uitbreiden voor OSS-tarieven]
    useInvoiceForm.ts            [WIJZIG — resolve vat_regime bij aanmaak]
  lib/
    euVatRates.ts                [WIJZIG — actuele tarieven 2026, OSS-data toevoegen]
    exportUtils.ts               [WIJZIG — XLSX-builder uitbreiden voor multi-tab]
    exportGuides.ts              [REVIEW — handleidingen updaten]
    vatInvoiceTexts.ts           [WIJZIG — verplichte vermeldingen per regime]
  components/
    admin/
      VatExportCard.tsx          [VERWIJDEREN — vervangen door nieuwe Quarter Bundle]
      VatInput.tsx               [REVIEW — koppelen aan vat_regime]
      reports/
        ReportCard.tsx           [WIJZIG — format-keuze uitbreiden naar 5 formaten]
        GlobalDateRangePicker.tsx [REVIEW — period-quick-select uitbreiden]
        BulkDownloadCard.tsx     [WIJZIG — Q-Pakket integreren]
      settings/
        TaxSettings.tsx          [WIJZIG — OSS-instellingen, Peppol-instellingen]
        VatRatesSettings.tsx     [REVIEW]
      invoices/
        InvoiceForm.tsx          [WIJZIG — regime-feedback in UI]
        InvoiceDetail.tsx        [WIJZIG — Peppol-status badge]
  pages/admin/
    Reports.tsx                  [HERSCHRIJVEN — nieuwe tab-structuur]
    invoices/
      InvoiceDetail.tsx          [WIJZIG — Peppol-status sectie]
  types/
    vatRate.ts                   [WIJZIG — uitbreiden voor regime, box-codes]

supabase/
  functions/
    validate-vat/                [REVIEW — VIES-snapshot opslaan]
    _shared/vat.ts               [UITBREIDEN — resolve-functie toevoegen]
```

### Nieuwe files

```
src/
  hooks/
    useVatReport.ts              [NIEUW — facade voor engine]
    usePeppolStatus.ts           [NIEUW — Peppol-status per invoice]
    useOdooExport.ts             [NIEUW — Odoo-CSV export]
  lib/
    vatRegimes.ts                [NIEUW — constanten + helpers]
    vatBoxMapping.ts             [NIEUW — gedeelde mapping logica]
    accounting/
      reportEngine.ts            [NIEUW — TS-facade voor engine]
      glAccountMapping.ts        [NIEUW — MAR-rekening lookup]
    exporters/
      xlsxBuilder.ts             [NIEUW — multi-tab XLSX]
      pdfBuilder.ts              [NIEUW — PDF rapporten]
      intervatXml.ts             [NIEUW — INTERVAT XML]
      odooCsv.ts                 [NIEUW — Odoo CSV]
    peppol/
      ubl-builder.ts             [NIEUW]
      xsd-validator.ts           [NIEUW]
      schematron-validator.ts    [NIEUW]
      identifiers.ts             [NIEUW — 0208/0184/etc.]
  components/admin/
    reports/
      QuarterBundleCard.tsx      [NIEUW]
      VatBoxAuditTable.tsx       [NIEUW]
      OssCountrySummary.tsx      [NIEUW]
      PeppolStatusBadge.tsx      [NIEUW]
    settings/
      PeppolSettings.tsx         [NIEUW]
      OssSettings.tsx            [NIEUW]
      OdooConnectionSettings.tsx [NIEUW]
  types/
    accounting.ts                [NIEUW — types voor regime, box, payload]
    peppol.ts                    [NIEUW — types]

supabase/
  migrations/
    <ts>_accounting_foundation_phase1.sql   [NIEUW — Fase 1]
    <ts>_peppol_columns.sql                 [NIEUW — Fase 4]
  functions/
    resolve-vat-regime/index.ts             [NIEUW — Fase 1]
    vat-report-engine/                      [NIEUW — Fase 2]
      index.ts
      box-mapping.ts
      aggregator.ts
      types.ts
    export-vat-xlsx/index.ts                [NIEUW — Fase 3]
    export-vat-pdf/index.ts                 [NIEUW — Fase 3]
    export-vat-xml/index.ts                 [NIEUW — Fase 3]
    export-ic-listing-xml/index.ts          [NIEUW — Fase 3]
    export-odoo-csv/index.ts                [NIEUW — Fase 3]
    export-q-bundle/index.ts                [NIEUW — Fase 3]
    generate-peppol-ubl/index.ts            [NIEUW — Fase 4]
    send-via-peppol/index.ts                [NIEUW — Fase 4]
    receive-peppol-document/index.ts        [NIEUW — Fase 4]
    peppol-webhook-handler/index.ts         [NIEUW — Fase 4]
```

### Schrappen na refactor

```
src/components/admin/VatExportCard.tsx     [vervangen door Quarter Bundle]
```

(Verifieer dat geen enkele import-naar-VatExportCard verbreekt voor je het verwijdert.)

---

## Slotbedenking

Dit document is opzettelijk lang, want het beslaat zowel de tactische uitvoering (Fase 1-4 met SQL-migraties klaar voor copy-paste in Claude Code) als de strategische verkoopstuk voor de boekhoudersmeeting. Snij wat je niet nodig hebt — bewaar dit als referentie.

De **kritieke beslissing** is fase 1 starten in de volgende 48 uur, anders is het onmogelijk om vóór 22 juli een vertrouwbare Q2-aangifte uit SellQo te trekken. De rest kan parallel.

Voor de meeting volgende week is de belangrijkste les: **niet verkopen wat er is, maar wat er gaat zijn**. De boekhouder ziet meer pijn dan jij vermoedt — laat hem die pijn benoemen, en breng SellQo als de oplossing aan. Niet andersom.

Veel succes maat.

— Akke + Claude

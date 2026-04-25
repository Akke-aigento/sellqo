## UBL XML altijd meesturen voor Odoo-digitalisering

Klein, chirurgisch fix. De UBL XML wordt vandaag al gegenereerd door `generate-invoice` (Peppol BIS 3.0 / UBL 2.1) en de Factur-X CII XML zit zelfs al embedded in de PDF. Het enige wat ontbreekt: `send-invoice-email` hangt de UBL alleen aan als `tenant.invoice_format` op `ubl` of `both` staat — voor de meeste tenants staat die op `pdf`, dus krijgt Odoo geen XML.

We zetten de gating uit en sturen UBL altijd mee als die beschikbaar is.

### Wijziging 1 — `supabase/functions/generate-invoice/index.ts`

UBL altijd genereren (niet meer alleen voor B2B of als format = ubl/both). Eén regel:

```ts
// regel 1417 — was:
if (invoiceFormat === 'ubl' || invoiceFormat === 'both' || isB2B) {
// wordt:
if (true) { // Always generate UBL for Odoo / Peppol compatibility
```

Resultaat: elke factuur krijgt een `ubl_url` in de DB en in storage.

### Wijziging 2 — `supabase/functions/send-invoice-email/index.ts`

UBL-bijlage en download-link niet meer afhankelijk maken van `invoiceFormat`:

```ts
// regel 140 — was:
if (invoice.ubl_url && (invoiceFormat === 'ubl' || invoiceFormat === 'both')) {
// wordt:
if (invoice.ubl_url) {

// regel 162 — was:
if (invoice.ubl_url && (invoiceFormat === 'ubl' || invoiceFormat === 'both')) {
// wordt:
if (invoice.ubl_url) {
```

PDF-gating blijft ongemoeid (PDF werd al altijd meegestuurd). De Factur-X embedded XML in de PDF blijft ook ongemoeid — dat is je tweede laag (CII) voor Odoo 16+.

### Resultaat per email

Elke automatische factuur-mail (klant + CC + BCC boekhouding) krijgt nu:
- `factuur-2025-001.pdf` — met embedded Factur-X CII XML voor mens + Odoo hybrid
- `factuur-2025-001.xml` — losse UBL 2.1 / Peppol BIS 3.0 voor Odoo's "Upload e-invoice" digitalisering

Odoo's e-factuur-importer pikt de losse `.xml` automatisch op en boekt de factuur direct in zonder OCR. De PDF blijft als visueel archief.

### Deploy & verificatie

1. Redeploy `generate-invoice` en `send-invoice-email`.
2. Genereer 1 testfactuur via `auto-invoice-cron` of een handmatige bestelling.
3. Check in `/admin/invoices` dat de nieuwe factuur een `ubl_url` heeft.
4. Open de mail in de inbox en bevestig: 2 bijlagen (`.pdf` + `.xml`).

### Niet aanraken

- Geen wijzigingen aan `auto-invoice-cron`, `create-manual-invoice`, `sync-odoo-invoices`.
- Geen DB-migraties (de `ubl_url`-kolom bestaat al).
- Geen UI-wijzigingen in `InvoiceAutomationSettings.tsx` — `invoice_format` blijft bestaan voor downstream gebruik (bv. download-knoppen elders), maar bepaalt niet meer of de XML wordt meegestuurd.
- Geen wijziging aan de Factur-X embedded-XML logica (regels 1139-1141).
- Geen wijzigingen aan `generateUBL()` of `generateCII()` — XML-formaat blijft Peppol BIS 3.0 / UBL 2.1.

### Final report

- Diff van de 3 gewijzigde regels (1× generate-invoice, 2× send-invoice-email)
- Deploy status: ✅/❌ per functie
- Bevestiging: testfactuur heeft 2 bijlagen in mail

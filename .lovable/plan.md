

## Rapportage uitbreiden: de boekhouder van z'n sokken blazen

### Huidige staat
Er zijn al 8 tabs met ~25 exportrapporten. Goed basis, maar een boekhouder mist de kernrapporten die hij nodig heeft voor zijn werk: winstberekening, BTW-reconciliatie, voorraadwaardering, betaaloverzichten en een compleet jaarpakket.

### Nieuwe rapporten per tab

#### Tab "Financieel" (4 bestaand + 5 nieuw)

1. **Winst & Verlies overzicht** -- DIT is wat elke boekhouder als eerste vraagt. Omzet (facturen paid) minus inkoop (supplier documents paid) minus verzendkosten = bruto marge. Per maand. Multi-sheet Excel met samenvattingsrij.

2. **Omzet per BTW-tarief** -- Uitsplitsing alle factuurregels per BTW-tarief (21%, 12%, 6%, 0%). Maatstaf + BTW bedrag. Essentieel voor de BTW-aangifte controle.

3. **Omzet per Verkoopkanaal** -- Webshop vs POS vs Marketplace vs Handmatig. Per kanaal: omzet, aantal orders, gem. orderbedrag, BTW.

4. **Betalingsoverzicht** -- Alle ontvangen betalingen met datum, methode (Stripe/bankoverschrijving/contant/PIN), referentie, factuurnummer, bedrag. Dit is het reconciliatie-rapport voor de bankafschriften.

5. **Marge-analyse per Product** -- Per product: verkoopprijs, kostprijs, marge (absoluut + %), aantal verkocht, totale omzet, totale marge. Gesorteerd op marge%.

#### Tab "Producten" (2 bestaand + 1 nieuw)

6. **Voorraadwaardering** -- Per product: SKU, naam, voorraad, kostprijs, totale waarde (voorraad x kostprijs). Met totaalrij onderaan. Dit is een balanspost die de boekhouder elk kwartaal nodig heeft.

#### Tab "Kassa" (4 bestaand + 1 nieuw)

7. **Kassasessies (verrijkt)** -- De bestaande sessie-export uitbreiden met: totale omzet per sessie, aantal transacties, medewerker (opened_by naam), sessieduur. Dit is het rapport dat we van de POS-pagina haalden.

#### "Snelle Acties" sectie (4 bestaand + 2 nieuw)

8. **Jaarafsluiting Pakket** -- Eén klik: multi-sheet Excel met W&V, omzetrapport, BTW per kwartaal, debiteurenoverzicht, crediteurenoverzicht, voorraadwaardering, klantenbestand. Alles in één bestand.

9. **BTW Kwartaal Pakket** -- Voorgeselecteerd op huidig kwartaal: BTW-aangifte + IC-listing + betalingsoverzicht.

### Technische aanpak

**`src/hooks/useReportExports.ts`** -- 6 nieuwe export hooks toevoegen:
- `useProfitLossExport` -- query invoices (paid) + supplier_documents (paid) per maand, bereken bruto marge
- `useVatBreakdownExport` -- query invoices met order_items voor BTW per tarief
- `useChannelRevenueExport` -- query orders grouped by sales_channel
- `usePaymentReconciliationExport` -- query orders (paid) met payment_method, stripe refs, dates
- `useProductMarginExport` -- query order_items joined met products (cost_price), bereken marge
- `useInventoryValuationExport` -- query products met stock * cost_price

**`src/hooks/useReportExports.ts`** -- Bestaande POS sessie export verrijken met extra kolommen (omzet, transacties, medewerker, duur).

**`src/hooks/useReportExports.ts`** -- `useYearEndExport` hook die `generateExcelMultiSheet` gebruikt (bestaat al in exportUtils).

**`src/pages/admin/Reports.tsx`** -- Nieuwe ReportCards toevoegen in de juiste tabs + nieuwe snelle acties.

**`src/lib/exportUtils.ts`** -- Geen wijzigingen nodig, `generateExcelMultiSheet` bestaat al.

### Geen database wijzigingen nodig
Alle data zit al in bestaande tabellen (orders, invoices, order_items, products, supplier_documents, pos_transactions, pos_sessions). We aggregeren client-side.




## Rapportage: De boekhouder van z'n sokken blazen -- Fase 2

### Wat er al is (30+ rapporten)
P&L, BTW-uitsplitsing, kanaalomzet, betalingsoverzicht, marge-analyse, voorraadwaardering, verrijkte POS sessies, jaarafsluiting pakket, BTW kwartaalpakket. Goed fundament.

### Wat er nog mist om een boekhouder echt "WTF" te laten zeggen

#### 1. Grootboekjournaal (General Ledger Journal)
Elke betaalde factuur, POS-transactie en inkoopfactuur als debet/credit boeking. Dit is het absolute kernrapport -- hiermee kan de boekhouder alles direct importeren in zijn boekhoudpakket (Exact, Octopus, Bob50, Yuki) zonder handmatig overtypen.

Kolommen: Datum | Boekingsnr | Omschrijving | Grootboekrekening | Debet | Credit | BTW-code | Tegenrekening

#### 2. Klantensaldo / Openstaande Posten per Klant (Debiteuren Subledger)
Per klant: alle facturen, creditnota's, betalingen, openstaand saldo. Met verouderingsanalyse (0-30d, 31-60d, 61-90d, 90d+). Dit is wat de boekhouder nodig heeft voor de balans onder "Handelsvorderingen".

#### 3. Leverancierssaldo / Openstaande Posten per Leverancier (Crediteuren Subledger)
Zelfde maar dan inkoop: per leverancier alle inkoopfacturen, betalingen, openstaand saldo + veroudering. Balanspost "Handelsschulden".

#### 4. Belgische Jaarlijkse Klantenlisting
Wettelijk verplicht in België: alle B2B-klanten met BTW-nummer, totale omzet en BTW per klant voor het volledige jaar. Export in het juiste formaat. De boekhouder moet dit elk jaar indienen bij de FOD Financiën.

#### 5. Dagboek Verkopen + Dagboek Aankopen
Chronologisch journaal van alle verkoopfacturen resp. inkoopfacturen. Niet gegroepeerd, maar regel per regel. Dit is hoe Belgische boekhouders denken: per dagboek.

#### 6. Cashflow Overzicht
Inkomend geld (betaalde facturen + POS) minus uitgaand geld (betaalde leveranciersfacturen) per week/maand. De boekhouder ziet in één oogopslag of er liquiditeitsproblemen aankomen.

#### 7. Export naar Boekhoudpakket (Exact/Octopus CSV)
Geformatteerd exportbestand dat de boekhouder direct kan importeren in populaire Belgische/Nederlandse boekhoudpakketten. Geen handmatig overtypen meer. DIT is de "no way" factor.

### Technische aanpak

**`src/hooks/useAccountingExports.ts`** -- 7 nieuwe export hooks toevoegen:
- `useGeneralLedgerExport` -- journaalposten met grootboekrekeningnummers (701000 Omzet, 400000 Klanten, 440000 Leveranciers, 604000 Inkoop, etc.)
- `useDebtorBalanceExport` -- facturen per klant met aging buckets
- `useCreditorBalanceExport` -- inkoopfacturen per leverancier met aging buckets  
- `useBelgianCustomerListingExport` -- B2B klanten + omzet + BTW, volledig jaar
- `useSalesJournalExport` -- chronologisch verkoopfactuurjournaal
- `usePurchaseJournalExport` -- chronologisch inkoopfactuurjournaal
- `useCashflowExport` -- inkomend vs uitgaand per week/maand

**`src/pages/admin/Reports.tsx`** -- Nieuwe ReportCards in "Financieel" tab + een nieuwe "Boekhouding" tab voor de journalen en subledgers. Nieuwe snelle actie "Export naar Boekhoudpakket".

### Geen database wijzigingen nodig
Alle data komt uit bestaande tabellen (invoices, orders, customers, supplier_documents, suppliers, pos_transactions, credit_notes).


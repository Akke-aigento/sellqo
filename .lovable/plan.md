

## Transactiekosten uitklapbaar maken

### Wat er verandert

Het "Transactiekosten — Standaard Stripe tarieven" blok in `PaymentSettings.tsx` wordt een uitklapbare sectie. Dicht toont het alleen de titel, open toont het een overzichtelijke lijst met alle Stripe tarieven.

### Implementatie

**Bestand: `src/components/admin/settings/PaymentSettings.tsx`**

- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` uit `@/components/ui/collapsible` en `ChevronDown` icoon
- Het bestaande transactiekosten-blok (regels 255-261) wordt een `Collapsible` component
- De trigger toont "Transactiekosten" + "Standaard Stripe tarieven" + een chevron-icoon dat roteert bij openen
- De content toont een nette tabel/lijst met tarieven:
  - **iDEAL** — €0,29 per transactie
  - **Bancontact** — €0,39 per transactie  
  - **Credit-/debitcards (EU)** — 1,5% + €0,25
  - **Credit-/debitcards (niet-EU)** — 2,9% + €0,25
  - **SEPA Incasso** — €0,35 per transactie
  - Kleine voetnoot: "Tarieven kunnen wijzigen. Zie je Stripe Dashboard voor actuele tarieven."
- Alleen tarieven tonen voor actieve capabilities (op basis van `status.capabilities`)

### Geen database wijzigingen nodig


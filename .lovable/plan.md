

## Fix: QR betaling — 3 bugs

### Probleem 1: Dubbele QR optie
`checkoutGetPaymentMethods` (regel 1920-1923) voegt zowel `bank_transfer` als `qr_transfer` toe als de tenant een IBAN heeft. Beide zijn dezelfde betaalmethode (SEPA overschrijving). De frontend toont ze als twee aparte keuzes met dezelfde beschrijving.

**Fix:** Merge naar één betaalmethode `bank_transfer` die op de bedankt-pagina zowel bankgegevens als een QR-code toont. Verwijder `qr_transfer` als aparte optie.

### Probleem 2: QR code bevat geen BIC
De tenant query (regel 1614) haalt `bic` NIET op, waardoor de EPC QR-code geen BIC bevat. Sommige bank-apps vereisen dit. Ook wordt de referentie in het verkeerde veld gezet (regel 1734: `\n\n\n${ref}\n` — dit zet het in het "remittance text" veld i.p.v. het "structured reference" veld).

**Fix:** Voeg `bic` toe aan de tenant select. Zet de referentie in het juiste EPC-veld.

### Probleem 3: Order wordt aangemaakt + stock verlaagd vóór betaling
Bij `bank_transfer`/`qr_transfer` wordt de order direct aangemaakt met stock decrement (regel 1689-1701). De klant ziet meteen "Bedankt voor je bestelling!" terwijl er nog niet betaald is. Dit is hetzelfde "spookorder" probleem als eerder.

**Fix:** Voor bankoverschrijvingen is het wél correct om de order aan te maken (anders weet je niet wat er betaald moet worden). Maar:
- De `payment_status` moet `awaiting_payment` zijn (niet `pending` wat verwarrend is)
- De response moet `status: 'awaiting_payment'` retourneren zodat de frontend een "wacht op betaling" pagina toont i.p.v. een success pagina
- Stock decrement is acceptabel (reservering) maar de frontend moet duidelijk maken dat de bestelling pas definitief is na betaling

### Technische aanpak

**`supabase/functions/storefront-api/index.ts`**

1. **`checkoutGetPaymentMethods`** (regels 1916-1923): Verwijder `qr_transfer`. Wijzig `bank_transfer` beschrijving naar "Betaal via overschrijving of scan de QR-code met je bankapp".

2. **`checkoutComplete`** (regels 1612-1744):
   - Voeg `bic` toe aan tenant select (regel 1614)
   - Merge de `bank_transfer` en `qr_transfer` response: `bank_transfer` retourneert nu ALTIJD zowel `bank_details` als `qr_data`
   - Verwijder de aparte `qr_transfer` case
   - Fix de EPC QR payload: voeg BIC toe, zet referentie in correct veld
   - Wijzig `createOrderFromCart` call van `'pending'` naar `'pending'` (payment_status) maar retourneer `status: 'awaiting_payment'` in de response

3. **Response shape voor bank_transfer wordt:**
```typescript
{
  order_id, order_number,
  status: 'awaiting_payment',
  payment_type: 'bank_transfer',
  total, currency,
  bank_details: { account_holder, iban, bic, reference },
  qr_data: { payload, image_url }
}
```

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Merge bank_transfer/qr_transfer, fix BIC, fix status |

### Geen database wijzigingen nodig


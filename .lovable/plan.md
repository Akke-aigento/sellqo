
# Betalingsinfrastructuur Klant → Merchant Optimalisatie

## Huidige Status ✅

De kerninfrastructuur is reeds werkend:
- **Stripe Connect Express**: Merchants kunnen onboarden en betalingen ontvangen
- **Dynamische Checkout**: Producten worden on-the-fly geprijsd (geen Stripe product setup nodig)
- **Platform Fee**: 5% wordt automatisch afgetrokken via `application_fee_amount`
- **Bankoverschrijving**: OGM/EPC QR-code flow werkt

---

## Te Implementeren

### 1. Stripe Webhook Productie Setup
**Prioriteit: HOOG** | **Complexiteit: Laag**

Huidige situatie: Webhook functie bestaat (`stripe-connect-webhook`) maar vereist configuratie.

**Taken:**
- [ ] `STRIPE_WEBHOOK_SECRET` secret toevoegen voor productie
- [ ] Webhook endpoint registreren in Stripe Dashboard
- [ ] Testen van `checkout.session.completed` flow
- [ ] Testen van `payment_intent.succeeded` en `payment_intent.payment_failed`

**Endpoint:** `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/stripe-connect-webhook`

---

### 2. Automatische Bank Reconciliatie
**Prioriteit: MIDDEL** | **Complexiteit: Hoog**

Doel: Automatisch matchen van binnenkomende bankoverschrijvingen met openstaande orders.

**Opties:**

| Optie | Beschrijving | Voordeel | Nadeel |
|-------|--------------|----------|--------|
| A. Handmatig | Merchant markeert order als betaald in admin | Simpel | Arbeidsintensief |
| B. OGM Matching | Cron job die bank CSV importeert en OGM matcht | Betrouwbaar | Vereist bank export |
| C. Open Banking API | Realtime via Plaid/Salt Edge/Tink | Volledig automatisch | Kosten + complexiteit |

**Aanbevolen: Optie A + B**
- Start met handmatige verificatie (snel te bouwen)
- Voeg later CSV import toe voor bulk matching

**Taken Optie A:**
- [ ] "Markeer als betaald" knop in order detail
- [ ] Betalingsstatus update flow
- [ ] Audit log voor handmatige betalingsregistratie

**Taken Optie B (later):**
- [ ] Bank CSV import functie
- [ ] OGM parsing en matching logica
- [ ] Automatische order status update

---

### 3. Merchant Betalingsdashboard
**Prioriteit: MIDDEL** | **Complexiteit: Middel**

Doel: Merchants inzicht geven in hun transacties, fees en uitbetalingen.

**Componenten:**

```
📊 Betalingsdashboard
├── Transactie Overzicht
│   ├── Lijst alle transacties
│   ├── Filter: periode, status, type
│   └── Totalen: omzet, fees, netto
├── Platform Fee Inzicht
│   ├── Totaal afgedragen fees
│   └── Fee per transactie
├── Uitbetalingen (Stripe Payouts)
│   ├── Geplande uitbetalingen
│   └── Voltooide uitbetalingen
└── Bankoverschrijvingen
    ├── Openstaand
    ├── Gematcht
    └── Te verifiëren
```

**Taken:**
- [ ] Nieuwe pagina: `/admin/payments` of tab in instellingen
- [ ] Edge function: `get-merchant-transactions` (Stripe Balance Transactions API)
- [ ] Edge function: `get-merchant-payouts` (Stripe Payouts API)
- [ ] UI componenten voor transactie lijst en filters
- [ ] Samenvattingskaarten (totaal, fees, pending)

---

### 4. Stripe Connect Status Monitoring
**Prioriteit: LAAG** | **Complexiteit: Laag**

Doel: Merchants informeren over hun account status.

**Taken:**
- [ ] Account verificatie status tonen
- [ ] Waarschuwing bij incomplete onboarding
- [ ] Link naar Stripe om problemen op te lossen
- [ ] Payout schedule informatie

---

## Implementatie Volgorde

```
Week 1: Webhook Setup + Handmatige Betaling Markering
        └── Core functionaliteit werkend

Week 2: Betalingsdashboard Basis
        └── Transactie overzicht voor merchants

Week 3: Dashboard Uitbreiding + Status Monitoring
        └── Payouts, fees, account status

Week 4+: Automatische Bank Reconciliatie (optioneel)
         └── CSV import of Open Banking
```

---

## Technische Details

### Stripe APIs te gebruiken:
- `stripe.balanceTransactions.list()` - Transacties ophalen
- `stripe.payouts.list()` - Uitbetalingen ophalen
- `stripe.accounts.retrieve()` - Account status
- `stripe.accounts.createLoginLink()` - Dashboard toegang (reeds geïmplementeerd)

### Database wijzigingen:
- Mogelijk nieuwe tabel `payment_reconciliations` voor bank matching
- Index op `orders.ogm_reference` voor snelle lookups

---

## Samenvatting Merchant Experience

Na implementatie:
1. **Geen Stripe setup nodig** - Alleen onboarding, geen producten aanmaken
2. **Automatische fee afdracht** - 5% wordt direct afgetrokken
3. **Inzicht in transacties** - Dashboard met alle betalingen
4. **Flexibele betaalmethodes** - Stripe + Bankoverschrijving
5. **Eenvoudige reconciliatie** - Handmatig of automatisch

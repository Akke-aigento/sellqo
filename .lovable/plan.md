
# Volledige Betalingsinfrastructuur Plan: Klant → Merchant

## Executive Summary

Dit plan beschrijft de volledige implementatie van het betalingssysteem tussen eindklanten en merchants, inclusief automatische verwerking, handmatige verificatie, en een merchant betalingsdashboard.

---

## Huidige Status (Reeds Werkend)

| Component | Status | Beschrijving |
|-----------|--------|--------------|
| Stripe Connect Express | ✅ | Merchants onboarden via Express accounts |
| Dynamische Checkout | ✅ | `price_data` on-the-fly, geen Stripe producten nodig |
| Platform Fee (5%) | ✅ | `application_fee_amount` in checkout session |
| Bankoverschrijving | ✅ | OGM/EPC QR-code generatie in `create-bank-transfer-order` |
| Webhook Handler | ✅ | Basis structuur in `stripe-connect-webhook` |
| Order Status Updates | ✅ | Via Select dropdown in OrderDetail |

---

## Te Implementeren Features

### 1. Stripe Webhook Productie Setup
**Prioriteit: KRITIEK** | **Geschatte tijd: 30 min**

De webhook functie bestaat (`stripe-connect-webhook/index.ts`) maar moet geconfigureerd worden voor productie.

**Taken:**
- [ ] `STRIPE_WEBHOOK_SECRET` secret toevoegen
- [ ] Webhook endpoint registreren in Stripe Dashboard
- [ ] Events te registreren:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `account.updated`

**Endpoint URL:**
```
https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/stripe-connect-webhook
```

---

### 2. "Markeer als Betaald" Functionaliteit
**Prioriteit: HOOG** | **Geschatte tijd: 2 uur**

Voor bankoverschrijvingen is handmatige verificatie nodig. Deze feature moet prominent zijn in de order detail pagina.

**Nieuw UI Component: `MarkAsPaidButton.tsx`**
```text
┌─────────────────────────────────────────┐
│ 💳 Betaling Bevestigen                  │
├─────────────────────────────────────────┤
│ [Dropdown: Betaalmethode]               │
│   ○ Bankoverschrijving                  │
│   ○ Contant                             │
│   ○ Anders                              │
│                                         │
│ [Optioneel: Referentie/Opmerking]       │
│                                         │
│ [✓ Markeer als Betaald]                 │
└─────────────────────────────────────────┘
```

**Database wijzigingen:**
- Nieuwe tabel: `payment_confirmations` voor audit trail
  - `id`, `order_id`, `confirmed_by` (user_id), `method`, `reference`, `confirmed_at`, `notes`

**Bestanden te maken/wijzigen:**

| Bestand | Actie |
|---------|-------|
| `src/components/admin/MarkAsPaidButton.tsx` | Nieuw |
| `src/pages/admin/OrderDetail.tsx` | Wijzigen - knop toevoegen |
| `src/hooks/useOrders.ts` | Wijzigen - `confirmPayment` functie toevoegen |
| Database migratie | Nieuw - `payment_confirmations` tabel |

---

### 3. Merchant Betalingsdashboard
**Prioriteit: MIDDEL** | **Geschatte tijd: 6 uur**

Een nieuw dashboard waar merchants hun transacties, fees en uitbetalingen kunnen bekijken.

**Nieuwe pagina: `/admin/payments`**

```text
┌──────────────────────────────────────────────────────────────────┐
│ 📊 Betalingsdashboard                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ €12.450  │  │ €622,50  │  │ €11.827  │  │ €2.340   │          │
│  │ Omzet    │  │ Platform │  │ Netto    │  │ Pending  │          │
│  │ (MTD)    │  │ Fee (5%) │  │ Ontvangen│  │ Uitbet.  │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                  │
│  ┌─ Transacties ─────────────────────────────────────────────┐   │
│  │ Datum       │ Type    │ Order      │ Bedrag  │ Fee   │ Netto│ │
│  │ 27-01-2026  │ Stripe  │ #0042      │ €89,00  │ €4,45 │€84,55│ │
│  │ 26-01-2026  │ Bank    │ #0041      │ €156,00 │ €0    │€156  │ │
│  │ 26-01-2026  │ Stripe  │ #0040      │ €234,00 │ €11,70│€222  │ │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Uitbetalingen ───────────────────────────────────────────┐   │
│  │ Geplande uitbetaling: €2.340,55 op 28-01-2026            │   │
│  │ Laatste uitbetaling: €1.890,00 op 21-01-2026             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Nieuwe Edge Functions:**

1. **`get-merchant-transactions`**: Haalt transacties op via Stripe Balance Transactions API
2. **`get-merchant-payouts`**: Haalt uitbetalingen op via Stripe Payouts API

**Bestanden te maken:**

| Bestand | Beschrijving |
|---------|--------------|
| `supabase/functions/get-merchant-transactions/index.ts` | Stripe transactions ophalen |
| `supabase/functions/get-merchant-payouts/index.ts` | Stripe payouts ophalen |
| `src/pages/admin/Payments.tsx` | Nieuwe dashboard pagina |
| `src/hooks/useMerchantPayments.ts` | Hook voor data fetching |
| `src/components/admin/PaymentTransactionsList.tsx` | Transactie tabel component |
| `src/components/admin/PayoutCard.tsx` | Uitbetalingen info card |

---

### 4. Stripe Connect Status Monitoring
**Prioriteit: LAAG** | **Geschatte tijd: 2 uur**

Verbeterde weergave van de Stripe account status met waarschuwingen.

**UI Verbetering in PaymentSettings:**

```text
┌─────────────────────────────────────────────────────────────┐
│ Stripe Connect Status                                       │
├─────────────────────────────────────────────────────────────┤
│ ✅ Account geverifieerd                                     │
│ ✅ Betalingen ingeschakeld                                  │
│ ✅ Uitbetalingen actief                                     │
│                                                             │
│ Volgende uitbetaling: €2.340,55 op 28-01-2026              │
│ Uitbetalingsschema: Dagelijks                               │
│                                                             │
│ [Stripe Dashboard openen]                                   │
└─────────────────────────────────────────────────────────────┘
```

**OF bij problemen:**

```text
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Account Verificatie Vereist                              │
├─────────────────────────────────────────────────────────────┤
│ Ontbrekende informatie:                                     │
│ • Identiteitsbewijs                                         │
│ • Bankrekening verificatie                                  │
│                                                             │
│ [Verificatie Voltooien]                                     │
└─────────────────────────────────────────────────────────────┘
```

**Bestanden te wijzigen:**

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/settings/PaymentSettings.tsx` | Status details uitbreiden |
| `src/hooks/useStripeConnect.ts` | Requirements info toevoegen |

---

### 5. Automatische Bank Reconciliatie (Optioneel - Fase 2)
**Prioriteit: LAAG** | **Geschatte tijd: 8+ uur**

Automatisch matchen van binnenkomende bankoverschrijvingen met openstaande orders.

**Opties:**

| Optie | Beschrijving | Voordeel | Nadeel |
|-------|--------------|----------|--------|
| A. CSV Import | Merchant uploadt bank export | Simpel te bouwen | Handmatig werk |
| B. Open Banking | Automatisch via Plaid/Tink | Volledig automatisch | Kosten + complexiteit |

**Aanbeveling:** Start met CSV import, Open Banking als toekomstige upgrade.

**Database index voor performance:**
```sql
CREATE INDEX idx_orders_ogm_reference ON orders(ogm_reference) 
WHERE ogm_reference IS NOT NULL;
```

---

## Implementatie Volgorde

```text
Week 1: Fundament
├── Dag 1-2: Stripe Webhook productie setup
├── Dag 3-4: "Markeer als Betaald" functionaliteit
└── Dag 5: Testing & QA

Week 2: Dashboard
├── Dag 1-2: Edge functions voor transactions/payouts
├── Dag 3-4: Payments dashboard UI
└── Dag 5: Integratie & testing

Week 3: Polish
├── Dag 1-2: Stripe status monitoring verbetering
├── Dag 3: Sidebar integratie & navigatie
└── Dag 4-5: Buffer voor fixes

Week 4+ (Optioneel):
└── Automatische bank reconciliatie (CSV import)
```

---

## Technische Details

### Stripe APIs te gebruiken:

```javascript
// Transacties ophalen (voor merchant)
stripe.balanceTransactions.list({
  limit: 100,
  created: { gte: startDate, lte: endDate }
}, {
  stripeAccount: tenant.stripe_account_id
});

// Uitbetalingen ophalen
stripe.payouts.list({
  limit: 10
}, {
  stripeAccount: tenant.stripe_account_id
});

// Account status
stripe.accounts.retrieve(tenant.stripe_account_id);
```

### Database Schema Uitbreiding:

```sql
-- Payment confirmations audit log
CREATE TABLE payment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  confirmed_by UUID REFERENCES auth.users(id),
  payment_method TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant confirmations"
  ON payment_confirmations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Staff+ can insert confirmations"
  ON payment_confirmations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'staff', 'accountant')
  ));
```

---

## Samenvatting: Merchant Experience Na Implementatie

1. **Geen Stripe product setup nodig** - Dynamische prijzen via database
2. **Automatische betalingsverwerking** - Webhook handelt Stripe betalingen af
3. **Eenvoudige bankoverschrijving verificatie** - 1-click "Markeer als Betaald"
4. **Volledig transactie-inzicht** - Dashboard met omzet, fees, uitbetalingen
5. **Transparante platform fee** - 5% automatisch afgetrokken (niet zichtbaar voor internal tenant)
6. **Audit trail** - Alle handmatige betalingsbevestigingen worden gelogd

---

## Volgende Stappen

Wil je dat ik begin met implementatie? Ik raad aan te starten met:

1. **Stripe Webhook Secret configureren** (vereist handmatige actie in Stripe Dashboard)
2. **"Markeer als Betaald" functionaliteit** (direct bruikbaar voor bankoverschrijvingen)
3. **Merchant Betalingsdashboard** (volledige visibility voor merchants)

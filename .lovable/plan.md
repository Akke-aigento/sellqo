

# Commissievrije Betalingen met Geïntegreerd Transactie-Model

## Het Slimme Idee

Je hebt **drie briljante inzichten** gecombineerd:

1. **SEPA Instant** - QR-code betaling is real-time (geen 1-2 dagen meer!)
2. **Transactiekosten in abonnementen** - "Tot X transacties inclusief" maakt plans waardevoller
3. **Geen korting, wel doorberekenen** - Laat tenants zelf kiezen of ze kosten doorrekenen aan hun klant

Dit is een **SaaS-model zoals Shopify Payments** maar dan beter: je geeft tenants de keuze én je creëert upgrade-incentive.

---

## Het Business Model

### Huidige Pricing Plans (uit database)

| Plan | Prijs | Order Limiet |
|------|-------|--------------|
| Free | €0 | 50 orders/maand |
| Starter | €29 | 500 orders/maand |
| Pro | €79 | 5.000 orders/maand |
| Enterprise | €199 | Onbeperkt |

### Nieuw: Transactiekosten Geïntegreerd

| Plan | Inclusief Transacties | Overage Fee | Effectief per transactie |
|------|----------------------|-------------|-------------------------|
| Free | 0 (altijd fee) | 2.5% | €2.50 per €100 |
| Starter | 100/maand | €0.50/transactie | €0.00-0.50 |
| Pro | 500/maand | €0.30/transactie | €0.00-0.30 |
| Enterprise | Onbeperkt | €0.00 | Altijd gratis! |

### Waarom Dit Werkt

1. **Upgrade incentive** - Meer verkopen = upgrade naar Pro/Enterprise loont
2. **Voorspelbare kosten** - Tenant weet precies wat ze betalen
3. **Win-win** - SellQo verdient aan volume, tenant bespaart bij groei
4. **Concurrentievoordeel** - Uniek in de markt!

---

## Implementatie: 3 Componenten

### Component 1: Instant Bankoverschrijving (QR) als Betaalmethode

**Wat**: SEPA Instant via QR-code in checkout (webshop) en POS

```text
┌─────────────────────────────────────────────────────────────────┐
│ Kies je betaalmethode                                           │
├─────────────────────────────────────────────────────────────────┤
│ ○ iDEAL / Creditcard                                            │
│   Direct afrekenen via Stripe                                   │
│                                                                 │
│ ○ Directe Bankoverschrijving                                    │
│   Scan QR-code met je bank-app - direct betaald!                │
│   ┌──────────────┐                                              │
│   │  [QR CODE]   │  Bedrag: €127,45                             │
│   │              │  IBAN: BE68 5390 0754 7034                   │
│   │              │  Mededeling: +++123/4567/89012+++            │
│   └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Bestaande infrastructuur**:
- `src/lib/epcQrCode.ts` → EPC QR generator ✅
- `src/lib/ogm.ts` → OGM referentie generator ✅
- `tenants.iban` / `tenants.bic` → Bankgegevens opslag ✅

---

### Component 2: Transactie Tracking & Limieten

**Database wijzigingen**:

```sql
-- Pricing plans uitbreiden
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS 
  included_transactions_monthly integer DEFAULT 0;

ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS 
  transaction_overage_fee decimal(5,2) DEFAULT 0.50;

-- Tenant transactie tracking
CREATE TABLE IF NOT EXISTS tenant_transaction_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  month_year text NOT NULL, -- '2026-01'
  stripe_transactions integer DEFAULT 0,
  bank_transfer_transactions integer DEFAULT 0,
  pos_cash_transactions integer DEFAULT 0,
  pos_card_transactions integer DEFAULT 0,
  overage_fee_total decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month_year)
);

-- Orders uitbreiden
ALTER TABLE orders ADD COLUMN IF NOT EXISTS 
  payment_method text; -- 'stripe_ideal', 'stripe_card', 'bank_transfer'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS 
  transaction_fee_charged decimal(10,2) DEFAULT 0;
```

---

### Component 3: Transactiekosten Doorberekenen (Tenant Keuze)

**Tenant instellingen**:

```sql
-- Tenant payment settings
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  payment_methods_enabled jsonb DEFAULT '["stripe"]';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  pass_transaction_fee_to_customer boolean DEFAULT false;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  transaction_fee_label text DEFAULT 'Transactiekosten';
```

**Checkout flow** (indien doorberekenen aan):

```text
┌─────────────────────────────────────────────────────────────────┐
│ Overzicht                                                       │
├─────────────────────────────────────────────────────────────────┤
│ Subtotaal                                    €100.00            │
│ Verzending                                   €5.95              │
│ BTW (21%)                                    €22.25             │
├─────────────────────────────────────────────────────────────────┤
│ Transactiekosten (iDEAL)                     €0.29              │
├─────────────────────────────────────────────────────────────────┤
│ Totaal                                       €128.49            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bestandswijzigingen

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/components/storefront/PaymentMethodSelector.tsx` | Betaalmethode keuze in checkout |
| `src/components/storefront/BankTransferPayment.tsx` | QR-code + instructies component |
| `src/components/admin/pos/POSBankTransferDialog.tsx` | QR-code voor POS bank betaling |
| `supabase/functions/create-bank-transfer-order/index.ts` | Order aanmaken zonder Stripe |
| `src/hooks/useTransactionUsage.ts` | Track transactie limieten |
| `src/components/admin/settings/TransactionFeeSettings.tsx` | Tenant instellingen |

### Bestaande Bestanden Aanpassen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/storefront/CheckoutForm.tsx` | Betaalmethode selector toevoegen |
| `src/pages/storefront/ShopCart.tsx` | Afrekenen flow uitbreiden |
| `src/pages/admin/POSTerminal.tsx` | Bank transfer optie toevoegen |
| `supabase/functions/create-checkout-session/index.ts` | Transaction fee berekening |
| `src/types/billing.ts` | Nieuwe velden voor plans |
| Admin settings | Nieuwe payment/fee configuratie tab |

---

## Visueel: POS Bank Transfer

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  🛒 POS Terminal                                         [× Annuleren]     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Scan met bank-app voor directe betaling                                   │
│                                                                            │
│       ┌─────────────────────────┐                                          │
│       │                         │                                          │
│       │      ████████████       │       Te betalen: €127,45                │
│       │      ██        ██       │                                          │
│       │      ██  QR    ██       │       Klant scant → betaling direct op   │
│       │      ██  CODE  ██       │       uw rekening!                       │
│       │      ██        ██       │                                          │
│       │      ████████████       │       Mededeling:                        │
│       │                         │       +++123/4567/89012+++               │
│       └─────────────────────────┘                                          │
│                                                                            │
│   [ Wachten op betaling... ]              [ Handmatig bevestigen ]         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Fasering

### Fase 1: Database & Types (10 min)
- Pricing plans uitbreiden met transactie velden
- Tenant payment settings
- Transaction usage tracking tabel

### Fase 2: Webshop Checkout (20 min)
- `PaymentMethodSelector.tsx` - betaalmethode keuze
- `BankTransferPayment.tsx` - QR-code + instructies
- `create-bank-transfer-order` edge function
- Update `CheckoutForm.tsx` en cart flow

### Fase 3: POS Integratie (15 min)
- `POSBankTransferDialog.tsx` - QR op kasscherm
- Bank transfer als betaaloptie in POS
- Handmatige bevestiging flow

### Fase 4: Transactie Tracking (15 min)
- `useTransactionUsage.ts` hook
- Automatisch tellen per transactie type
- Overage fee berekening
- Dashboard widget voor usage

### Fase 5: Admin Instellingen (10 min)
- Payment methods in/uitschakelen
- "Kosten doorberekenen" toggle
- Fee label customization
- Plan usage overzicht

---

## Belangrijke Details

### SEPA Instant Beschikbaarheid
- **België**: ~95% van banken ondersteunt instant
- **Nederland**: ~98% van banken ondersteunt instant
- Fallback: reguliere SEPA (max 1 werkdag)

### Handmatige Bevestiging vs Automatisch
- **Fase 1**: Handmatige bevestiging (tenant markeert als betaald)
- **Fase 2 (later)**: MT940/CAMT bank import voor automatische matching op OGM

### POS Specifiek
- Cash blijft 0% kosten (al geïmplementeerd)
- PIN/Card via Stripe (bestaande flow)
- Bank QR = nieuw, ook 0% kosten

---

## ROI voor SellQo

Bij 100 actieve tenants met gemiddeld €5.000 omzet/maand:

**Oud model (5% platform fee)**:
- 100 × €5.000 × 5% = €25.000/maand SellQo revenue

**Nieuw model (abonnement + overage)**:
- Abonnementen: ~€5.000/maand (mix van plans)
- Overage fees: ~€2.000/maand (geschat)
- Totaal: ~€7.000/maand

**Verschil**: -€18.000 maar...
- Veel lagere churn (tenants blijven langer)
- Hogere perceived value
- Concurrentievoordeel
- Schaalbaar naar duizenden tenants

*Dit is typisch SaaS: lagere margin, hogere retentie, betere unit economics op lange termijn.*

---

## Samenvatting

Na implementatie:

1. ✅ **Webshop** - Klant kiest: Stripe of QR Bank
2. ✅ **POS** - Contant, PIN, of QR Bank
3. ✅ **Geen korting** - Professionele checkout
4. ✅ **Kosten doorberekenen** - Tenant keuze
5. ✅ **Inclusief transacties** - Per plan limiet
6. ✅ **Overage tracking** - Automatisch tellen + factureren


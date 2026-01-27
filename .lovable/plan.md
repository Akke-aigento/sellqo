

# Hybride Betalingsmethode voor Platform (Add-ons & AI Credits)

## Concept

Jullie eten je eigen dogfood! Dezelfde QR-code betalingsflow die werkt voor jullie klanten kan ook worden gebruikt voor platform betalingen zoals add-ons en AI credits.

---

## Huidige Situatie vs. Nieuwe Aanpak

| Aspect | Huidig | Hybride Aanpak |
|--------|--------|----------------|
| **Add-ons (Peppol, POS, etc.)** | Stripe-only (recurring) | Stripe voor recurring OF vooruitbetaling via bankoverschrijving |
| **AI Credits** | Stripe-only (eenmalig) | Keuze: Stripe kaart OF directe bankoverschrijving |
| **Transactiekosten** | ~2-3% Stripe fees | €0 bij bankoverschrijving |
| **Verificatie** | Automatisch via webhook | Automatisch via OGM-matching of manueel |

---

## Technische Architectuur

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    CREDIT/ADDON PURCHASE DIALOG                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐   │
│  │ € Direct Betalen    │      │ 💳 Betalen met Kaart           │   │
│  │ (Bankoverschrijving)│      │ (Stripe Checkout)              │   │
│  │                     │      │                                 │   │
│  │ • Geen kosten       │      │ • Direct actief                │   │
│  │ • Instant SEPA      │      │ • Automatische verwerking      │   │
│  └─────────────────────┘      └─────────────────────────────────┘   │
│                                                                      │
│  [QR Code + OGM]                              [Redirect → Stripe]    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementatie Stappen

### Stap 1: Database Uitbreiding

Nieuw veld in `platform_invoices` tabel:
- `payment_method` (text): 'stripe' | 'bank_transfer'
- `ogm_reference` (text): OGM code voor bankbetalingen
- `payment_type` (text): 'subscription' | 'addon' | 'ai_credits'

Nieuwe tabel `pending_platform_payments`:
- Voor het tracken van lopende bankoverschrijvingen
- Koppelt OGM aan verwachte betaling (tenant, bedrag, type)

### Stap 2: SellQo Platform Bankgegevens

Centrale configuratie voor SellQo's eigen bankrekening:
```typescript
const SELLQO_BANK = {
  iban: 'BE00 0000 0000 0000',  // SellQo's zakelijke rekening
  bic: 'GEBABEBB',              // Bank BIC code
  beneficiary: 'SellQo BV'
};
```

Dit kan worden opgeslagen als environment variables of in een platform_settings tabel.

### Stap 3: Nieuwe Payment Selector Component

`PlatformPaymentMethodSelector.tsx`:
- Twee opties: Bank (gratis) vs Kaart (Stripe)
- Bij "Bank": toon QR-code met OGM
- Bij "Kaart": redirect naar Stripe checkout

### Stap 4: Aangepaste Dialogen

**AI Credits Dialog Update:**
- Voeg betalingsmethode selectie toe
- Bij bankkeuze: genereer OGM, maak pending_platform_payment record, toon QR

**Add-on Checkout Update:**
- Idem voor module add-ons
- Voor recurring add-ons: eerste betaling via bank, daarna automatisch of reminder

### Stap 5: Bank Payment Verificatie

Twee opties:

**Optie A - Manuele Verificatie (eenvoudig)**
- Admin ziet pending payments in dashboard
- Matcht OGM met bankrekeningafschrift
- Klikt "Bevestigen" → credits worden toegekend

**Optie B - Automatisch via Bank API (geavanceerd)**
- Integratie met bank API (bijv. Tink, Plaid, of directe bank feed)
- Automatische OGM matching
- Realtime activatie

### Stap 6: Notificatie Systeem

Wanneer tenant bank kiest:
1. Email met betalingsinstructies + QR-code
2. Pending status in hun dashboard
3. Na bevestiging: email dat credits/addon actief is

---

## Frontend Wijzigingen

### Bestanden te wijzigen/maken:

1. **`src/components/platform/PlatformPaymentMethodSelector.tsx`** (nieuw)
   - Radio keuze: Bank vs Kaart
   - Toon kostenvoordeel bank (€0 vs Stripe fees)

2. **`src/components/platform/PlatformBankPaymentDialog.tsx`** (nieuw)
   - Hergebruik `POSBankTransferDialog` logica
   - Aangepast voor platform context met SellQo bankgegevens

3. **`src/components/admin/marketing/CreditPurchaseDialog.tsx`** (aanpassen)
   - Voeg PaymentMethodSelector toe
   - Conditionally render Stripe button OF Bank dialog

4. **`src/components/admin/billing/AddonCheckoutButton.tsx`** (aanpassen)
   - Idem: keuze voor betaalmethode

5. **`src/pages/admin/PendingPlatformPayments.tsx`** (nieuw)
   - Admin view voor pending bankoverschrijvingen
   - Mogelijkheid tot bevestigen/annuleren

---

## Backend Wijzigingen

### Edge Functions:

1. **`create-platform-bank-payment`** (nieuw)
   - Genereert OGM
   - Maakt pending payment record
   - Stuurt email met instructies

2. **`confirm-platform-bank-payment`** (nieuw)
   - Valideert OGM
   - Activeert credits/addon
   - Maakt platform_invoice record

3. **`platform-stripe-webhook`** (bestaand)
   - Blijft werken voor Stripe betalingen
   - Geen wijzigingen nodig

---

## Visueel Voorbeeld - Nieuwe Credit Purchase Flow

```text
┌──────────────────────────────────────────────────────────┐
│                  AI Credits Bijkopen                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ○ 50 credits   - €4,99                                  │
│  ● 100 credits  - €8,99  [POPULAIR]                      │
│  ○ 250 credits  - €19,99                                 │
│  ○ 500 credits  - €34,99                                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  Hoe wil je betalen?                                      │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────────┐│
│  │ € BANK              │  │ 💳 KAART                   ││
│  │                     │  │                             ││
│  │ Geen transactie-    │  │ Betaal direct met          ││
│  │ kosten              │  │ creditcard of iDEAL        ││
│  │                     │  │                             ││
│  │ [Geselecteerd ✓]    │  │                             ││
│  └─────────────────────┘  └─────────────────────────────┘│
│                                                           │
│                        [Verder →]                         │
└──────────────────────────────────────────────────────────┘

         ↓ Bij keuze "BANK" ↓

┌──────────────────────────────────────────────────────────┐
│              Directe Bankoverschrijving                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│              ┌─────────────────────┐                      │
│              │    [QR CODE]        │                      │
│              │                     │                      │
│              └─────────────────────┘                      │
│                                                           │
│              Te betalen: €8,99                            │
│                                                           │
│  Begunstigde:  SellQo BV                                 │
│  IBAN:         BE00 0000 0000 0000  [📋]                 │
│  Mededeling:   +++123/4567/89012+++ [📋]                 │
│                                                           │
│  ⓘ Scan de QR-code met je bank-app of voer de           │
│    gegevens handmatig in. Je credits worden binnen       │
│    24 uur geactiveerd na ontvangst.                      │
│                                                           │
│                   [Sluiten]                               │
└──────────────────────────────────────────────────────────┘
```

---

## Voordelen van deze Aanpak

| Voordeel | Impact |
|----------|--------|
| **Geen transactiekosten** | ~3% besparing per transactie |
| **Dogfooding** | Je gebruikt je eigen product |
| **Vertrouwen** | Klanten zien dat het werkt |
| **Flexibiliteit** | Klanten kunnen kiezen |
| **Marketing** | "Wij gebruiken het zelf ook!" |

---

## Overwegingen

### Voor AI Credits (eenmalige betaling):
- Bank optie is ideaal
- Korte verificatietijd acceptabel (binnen 24u)

### Voor Add-ons (recurring):
- Eerste betaling via bank
- Daarna: maandelijkse reminder email met QR OF automatische incasso
- Alternatief: jaarlijkse vooruitbetaling (12 maanden korting) via bank

### Admin Verificatie:
- Start met manuele verificatie (simpel)
- Later: bank feed integratie voor automatisering

---

## Aanbevolen Eerste Stap

Begin met **AI Credits** (eenmalige betalingen) omdat:
1. Geen recurring complexiteit
2. Directe waarde zichtbaar
3. Lagere drempel om te testen
4. Snelle implementatie (1-2 dagen)

Daarna uitbreiden naar add-ons.

---

## Volgende Stappen

1. Bevestig SellQo's bankgegevens (IBAN/BIC)
2. Kies: manuele of automatische verificatie
3. Implementatie starten


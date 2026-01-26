
# Naadloze Integratie Payment & Transaction Model

## Analyse Bevindingen

Na grondige review van de codebase heb ik de volgende **gaps** geïdentificeerd die moeten worden aangepakt om het nieuwe payment/transaction model naadloos te laten werken:

---

## 1. Ontbrekende Integraties

### Gap 1: Stripe Webhook mist `record_transaction`
**Probleem**: De `stripe-connect-webhook` roept NIET `record_transaction` aan wanneer een Stripe betaling succesvol is. Dit betekent dat Stripe transacties niet geteld worden in de maandelijkse limieten.

**Locatie**: `supabase/functions/stripe-connect-webhook/index.ts` lijn 90-174

**Fix**: Na het updaten van de order status, `record_transaction` aanroepen met type `'stripe'`.

---

### Gap 2: POS Transacties missen `record_transaction`
**Probleem**: De `usePOS.ts` hook roept `record_transaction` niet aan wanneer POS transacties worden gemaakt. Dit betekent dat POS cash en card transacties niet geteld worden.

**Locatie**: `src/hooks/usePOS.ts` lijn 307-332

**Fix**: Na succesvolle transactie creatie, via edge function `record_transaction` aanroepen met type `'pos_cash'` of `'pos_card'`.

---

### Gap 3: Webshop Checkout Pagina ontbreekt
**Probleem**: Er is geen dedicated checkout pagina (`ShopCheckout.tsx`) die de nieuwe `PaymentMethodSelector` en `BankTransferPayment` componenten gebruikt. De huidige `ShopCart.tsx` heeft alleen een "Afrekenen" knop zonder flow.

**Locatie**: `src/pages/storefront/ShopCart.tsx` lijn 216-225

**Fix**: Nieuwe `ShopCheckout.tsx` pagina maken die:
1. `CheckoutForm` voor klantgegevens
2. `PaymentMethodSelector` voor betaalmethode keuze
3. Bij Stripe: redirect naar Stripe Checkout
4. Bij Bank Transfer: order aanmaken en `BankTransferPayment` tonen

---

### Gap 4: Order Confirmation Page ontbreekt
**Probleem**: Er is geen bevestigingspagina voor klanten na bestelling. Voor bank transfers moet deze de QR-code en betalingsinstructies tonen.

**Locatie**: Ontbreekt in `src/pages/storefront/`

**Fix**: Nieuwe `ShopOrderConfirmation.tsx` pagina maken.

---

### Gap 5: POS Bank Transfer mist `record_transaction`
**Probleem**: De `handleBankTransferPayment` in `POSTerminal.tsx` roept geen `record_transaction` aan.

**Locatie**: `src/pages/admin/POSTerminal.tsx` lijn 464-506

**Fix**: Na succesvolle transactie, `record_transaction` aanroepen.

---

### Gap 6: Cart Context ontbreekt
**Probleem**: `ShopCart.tsx` gebruikt lokale state i.p.v. een gedeelde cart context, wat betekent dat de winkelwagen niet persistent is tussen pagina's.

**Locatie**: `src/pages/storefront/ShopCart.tsx` lijn 27

**Fix**: Cart context toevoegen (buiten scope van huidige taak, maar belangrijk).

---

## 2. Implementatie Aanpassingen

### File 1: `supabase/functions/stripe-connect-webhook/index.ts`
**Wijziging**: `record_transaction` aanroepen na succesvolle betaling

```typescript
// Na lijn 113 (Order updated to paid)
// Record transaction for usage tracking
try {
  const { data: order } = await supabaseClient
    .from("orders")
    .select("tenant_id")
    .eq("id", orderId)
    .single();
    
  if (order) {
    await supabaseClient.rpc('record_transaction', {
      p_tenant_id: order.tenant_id,
      p_transaction_type: 'stripe',
      p_order_id: orderId,
    });
    logStep("Transaction recorded for usage tracking");
  }
} catch (txError) {
  logStep("Warning: Failed to record transaction", { error: String(txError) });
}
```

---

### File 2: `src/hooks/usePOS.ts`
**Wijziging**: `record_transaction` aanroepen na POS transactie

```typescript
// Na succesvolle insert, bepaal payment method en roep RPC aan
// Dit vereist een edge function of directe RPC call
const primaryMethod = payments[0]?.method;
const transactionType = primaryMethod === 'cash' ? 'pos_cash' : 
                        primaryMethod === 'card' ? 'pos_card' : 
                        primaryMethod === 'manual' ? 'bank_transfer' : 'pos_cash';

await supabase.rpc('record_transaction', {
  p_tenant_id: currentTenant.id,
  p_transaction_type: transactionType,
  p_order_id: null, // POS transacties hebben geen order_id
});
```

---

### File 3: Nieuwe `src/pages/storefront/ShopCheckout.tsx`
**Nieuw bestand**: Complete checkout pagina met payment method selection

**Functionaliteit**:
- Laadt tenant payment settings (`payment_methods_enabled`)
- Toont `CheckoutForm` voor klantgegevens
- Toont `PaymentMethodSelector` (alleen als meerdere methodes enabled)
- Bij Stripe keuze: roept `create-checkout-session` aan
- Bij Bank Transfer keuze: roept `create-bank-transfer-order` aan
- Na Bank Transfer order: redirect naar confirmation met QR-code

---

### File 4: Nieuwe `src/pages/storefront/ShopOrderConfirmation.tsx`
**Nieuw bestand**: Order bevestigingspagina

**Functionaliteit**:
- Voor Stripe: bedank-bericht, order samenvatting
- Voor Bank Transfer: `BankTransferPayment` component met QR-code
- Order tracking info

---

### File 5: Update `src/App.tsx` Routes
**Wijziging**: Routes toevoegen voor checkout en confirmation

```typescript
<Route path="/shop/:tenantSlug/checkout" element={<ShopCheckout />} />
<Route path="/shop/:tenantSlug/order/:orderId" element={<ShopOrderConfirmation />} />
```

---

### File 6: Update `src/pages/storefront/ShopCart.tsx`
**Wijziging**: "Afrekenen" knop linken naar checkout pagina

```typescript
<Button asChild>
  <Link to={`/shop/${tenantSlug}/checkout`}>
    Afrekenen
    <ArrowRight className="h-4 w-4 ml-2" />
  </Link>
</Button>
```

---

## 3. Technische Details

### Transaction Recording Flow

```text
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    Transaction Sources                       │
                    └─────────────────────────────────────────────────────────────┘
                                                │
          ┌─────────────────┬───────────────────┼───────────────────┬─────────────────┐
          ▼                 ▼                   ▼                   ▼                 ▼
    ┌───────────┐     ┌───────────┐       ┌───────────┐       ┌───────────┐     ┌───────────┐
    │  Webshop  │     │  Webshop  │       │POS Cash   │       │POS Card   │     │POS Bank   │
    │  Stripe   │     │Bank Trans │       │           │       │           │     │Transfer   │
    └─────┬─────┘     └─────┬─────┘       └─────┬─────┘       └─────┬─────┘     └─────┬─────┘
          │                 │                   │                   │                 │
          ▼                 ▼                   ▼                   ▼                 ▼
    ┌───────────┐     ┌───────────┐       ┌───────────┐       ┌───────────┐     ┌───────────┐
    │stripe-    │     │create-    │       │usePOS.ts  │       │usePOS.ts  │     │usePOS.ts  │
    │connect-   │     │bank-      │       │createTxn  │       │createTxn  │     │createTxn  │
    │webhook    │     │transfer-  │       │           │       │           │     │           │
    │           │     │order      │       │           │       │           │     │           │
    └─────┬─────┘     └─────┬─────┘       └─────┬─────┘       └─────┬─────┘     └─────┬─────┘
          │                 │                   │                   │                 │
          │                 │                   │                   │                 │
          └────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                               ┌────────────────────────────────┐
                               │ record_transaction(            │
                               │   p_tenant_id,                 │
                               │   p_transaction_type,          │
                               │   p_order_id                   │
                               │ )                              │
                               └────────────────┬───────────────┘
                                                │
                                                ▼
                               ┌────────────────────────────────┐
                               │ tenant_transaction_usage       │
                               │ - stripe_transactions          │
                               │ - bank_transfer_transactions   │
                               │ - pos_cash_transactions        │
                               │ - pos_card_transactions        │
                               │ - overage_fee_total            │
                               └────────────────────────────────┘
```

---

## 4. Bestanden Overzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `supabase/functions/stripe-connect-webhook/index.ts` | Wijzigen | `record_transaction` toevoegen voor Stripe betalingen |
| `src/hooks/usePOS.ts` | Wijzigen | `record_transaction` toevoegen na POS transacties |
| `src/pages/storefront/ShopCheckout.tsx` | Nieuw | Checkout pagina met payment method selector |
| `src/pages/storefront/ShopOrderConfirmation.tsx` | Nieuw | Order bevestiging met QR-code voor bank transfer |
| `src/pages/storefront/ShopCart.tsx` | Wijzigen | Link naar checkout pagina |
| `src/App.tsx` | Wijzigen | Routes toevoegen |
| `src/hooks/useCart.tsx` | Nieuw (optioneel) | Cart context voor persistente winkelwagen |

---

## 5. Prioriteit & Volgorde

1. **Kritiek**: `stripe-connect-webhook` - Stripe transacties moeten geteld worden
2. **Kritiek**: `usePOS.ts` - POS transacties moeten geteld worden  
3. **Hoog**: `ShopCheckout.tsx` - Klanten moeten kunnen kiezen
4. **Hoog**: `ShopOrderConfirmation.tsx` - QR-code moet getoond worden
5. **Medium**: Routes & Cart link updates
6. **Later**: Cart context voor betere UX

---

## 6. Samenvatting

Het nieuwe payment/transaction model is database-technisch gereed, maar de **integratie** in de flows ontbreekt nog:

- Stripe webhook telt geen transacties
- POS telt geen transacties
- Webshop checkout flow bestaat niet
- Bank transfer confirmation pagina bestaat niet

Na deze aanpassingen werkt het volledige systeem:
1. Tenant kiest payment methods in admin
2. Klant ziet keuze in checkout
3. Elke transactie wordt geteld
4. Overage fees worden berekend
5. Dashboard toont usage stats

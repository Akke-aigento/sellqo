
## Fix: Bol.com facturen moeten automatisch status "betaald" krijgen

### Probleem
De `generate-invoice` functie zet **alle** facturen op `status: 'draft'` (lijn 1384), ongeacht of de bestelling al betaald is. Bij Bol.com orders is betaling altijd gegarandeerd, maar de factuur wordt na auto-send alleen naar `'sent'` gezet — nooit naar `'paid'`.

Interessant: `paid_at` wordt wél altijd ingevuld (lijn 1391), maar de status klopt niet.

### Oplossing

**1. `generate-invoice` functie: status bepalen op basis van betaalstatus**

In `supabase/functions/generate-invoice/index.ts` rond lijn 1384, de status dynamisch bepalen:
- Als `order.payment_status === 'paid'` → `status: 'paid'`
- Anders → `status: 'draft'`

Dit geldt automatisch voor alle Bol.com orders (altijd `payment_status: 'paid'`), maar ook voor Stripe orders die al betaald zijn voordat de factuur wordt gegenereerd.

**2. Bestaande facturen fixen**

Database update via insert tool: alle facturen met `status: 'sent'` waarvan de gekoppelde order `payment_status: 'paid'` is en `marketplace_source: 'bol_com'`, updaten naar `status: 'paid'`.

```sql
UPDATE invoices SET status = 'paid' 
WHERE status IN ('draft', 'sent') 
  AND order_id IN (
    SELECT id FROM orders 
    WHERE payment_status = 'paid' 
    AND marketplace_source = 'bol_com'
  );
```

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/generate-invoice/index.ts` | Status dynamisch: `'paid'` als order al betaald is |
| Database (insert tool) | Eenmalige correctie bestaande facturen |

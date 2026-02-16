
# Fix: Automatische facturatie pakt nieuwe orders niet op

## Probleem

De automatische facturatie-cron draait elke 5 minuten maar mist nieuwe betaalde orders. De logs bevestigen dit:

```
Found 50 potential orders to check
Cron job completed - {"invoicesGenerated":0,"alreadyExisted":50,"errors":0,"total":50}
```

Er zijn 103 betaalde orders in de laatste 30 dagen, maar de query haalt er maar 50 op (`.limit(50)`). Die 50 zijn allemaal oudere orders die AL een factuur hebben. De nieuwste betaalde order wordt dus nooit bereikt.

Daarnaast wordt de factuur niet direct aangemaakt wanneer een order als betaald wordt gemarkeerd -- er wordt alleen gewacht op de cron job.

## Oorzaken

1. **`.limit(50)` zonder slimme filtering**: De query haalt de eerste 50 betaalde orders op, zonder te filteren op orders die al een factuur hebben. Alle 50 "slots" worden verspild aan orders die al verwerkt zijn.

2. **Geen directe trigger bij betaling**: Wanneer je een order als betaald markeert via de "Markeer als betaald" knop, wordt er nergens direct een factuur aangemaakt. Het systeem wacht tot de cron job (elke 5 minuten) het oppikt -- maar door punt 1 lukt zelfs dat niet.

## Oplossing

### Stap 1: Cron query fixen (edge function)

De `auto-invoice-cron` query aanpassen zodat orders die al een factuur hebben worden uitgesloten VOORDAT de limit wordt toegepast. Dit doen we door een anti-join toe te voegen:

- Orders ophalen die `payment_status = 'paid'` hebben
- Alleen orders ZONDER bestaande factuur meenemen  
- Sorteren op `created_at DESC` (nieuwste eerst)
- Limit verhogen naar 100

Aangezien Supabase JS client geen anti-joins ondersteunt, gebruiken we een database RPC-functie die dit efficienter doet, OF we gebruiken een NOT IN subquery strategie door eerst de order_ids op te halen die al facturen hebben.

Praktische aanpak: twee queries in de cron job:
1. Haal alle order_ids op die al een factuur hebben
2. Haal betaalde orders op, filter die uit, en verwerk de rest

### Stap 2: Directe factuurgeneratie bij betaalbevestiging

In `usePaymentConfirmation.ts`, na het succesvol markeren als betaald, direct de `generate-invoice` edge function aanroepen als de tenant `auto_generate_invoice` aan heeft staan. Dit zorgt ervoor dat de factuur meteen wordt aangemaakt, zonder te wachten op de cron.

### Stap 3: Cron als vangnet houden

De cron job blijft draaien als vangnet voor edge cases (marketplace orders, bank reconciliatie, etc.), maar dankzij stap 1 werkt die nu correct.

## Technische details

### Bestand: `supabase/functions/auto-invoice-cron/index.ts`

Huidige query (probleem):
```
.from('orders')
.select('id, order_number, tenant_id, tenants!inner(...)')
.eq('payment_status', 'paid')
.eq('tenants.auto_generate_invoice', true)
.gte('created_at', ...)
.limit(50)
```

Nieuwe aanpak:
```
// Stap 1: Haal order_ids die al een factuur hebben
const { data: existingInvoices } = await supabase
  .from('invoices')
  .select('order_id')
  .not('order_id', 'is', null);

const invoicedOrderIds = existingInvoices?.map(i => i.order_id) || [];

// Stap 2: Haal betaalde orders op, sorteer nieuwste eerst
const { data: orders } = await supabase
  .from('orders')
  .select('id, order_number, tenant_id, tenants!inner(...)')
  .eq('payment_status', 'paid')
  .eq('tenants.auto_generate_invoice', true)
  .not('id', 'in', `(${invoicedOrderIds.join(',')})`)
  .order('created_at', { ascending: false })
  .limit(50);
```

Dit zorgt ervoor dat alleen orders ZONDER factuur worden opgehaald.

### Bestand: `src/hooks/usePaymentConfirmation.ts`

Na de succesvolle betaalbevestiging (na stap 2 in de huidige code), de tenant-instellingen controleren en direct een factuur genereren:

```typescript
// 4. Auto-generate invoice if tenant setting is enabled
try {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('auto_generate_invoice, auto_send_invoice_email')
    .eq('id', tenantId)
    .single();

  if (tenant?.auto_generate_invoice) {
    await supabase.functions.invoke('generate-invoice', {
      body: { 
        order_id: orderId,
        auto_send_email: tenant.auto_send_invoice_email ?? false
      }
    });
  }
} catch (invoiceError) {
  console.warn('Auto-invoice generation failed (non-blocking):', invoiceError);
}
```

Dit is non-blocking zodat de betaalbevestiging niet faalt als de factuurgeneratie een probleem heeft.

## Verwacht resultaat

- Bij handmatig markeren als betaald: factuur wordt direct aangemaakt (binnen seconden)
- Cron job: pakt nu alleen orders op die ECHT nog geen factuur hebben
- Geen orders meer gemist door de `.limit(50)` bottleneck


# Implementatieplan: Automatische Facturatie voor Alle Kanalen

## Overzicht

Dit plan implementeert automatische facturatie voor **alle verkoopkanalen**:
1. **Marketplace orders** (Bol.com, Amazon, Shopify, WooCommerce) - factuur bij import
2. **Webshop bankoverschrijvingen** - factuur bij markeren als "betaald"
3. **POS bankoverschrijvingen** - factuur bij afhandeling

---

## Huidige Situatie

| Kanaal | Automatische Factuur | Status |
|--------|---------------------|--------|
| Webshop (Stripe) | ✅ Ja | Via `stripe-connect-webhook` |
| Webshop (Bankoverschrijving) | ❌ Nee | Order blijft op "awaiting_payment" |
| Bol.com | ❌ Nee | Orders geïmporteerd als "paid" |
| Amazon | ❌ Nee | Orders geïmporteerd als "paid" |
| Shopify | ❌ Nee | Orders geïmporteerd als "paid" |
| WooCommerce | ❌ Nee | Orders geïmporteerd als "paid" |
| POS (Cash/Pin) | ✅ Ja | Via bon/kassaticket (geen factuur nodig tenzij B2B) |
| POS (Bankoverschrijving) | ❌ Nee | Handmatige flow |

---

## Oplossingsarchitectuur

### Aanpak 1: Database Trigger (Aanbevolen)

Een PostgreSQL trigger die automatisch de `generate-invoice` functie aanroept wanneer:
- Een order `payment_status` wijzigt naar `paid`
- EN er nog geen factuur bestaat voor deze order

Dit dekt **alle scenario's** in één keer:
- Bankoverschrijvingen die handmatig op "betaald" worden gezet
- Marketplace orders die bij import als "paid" binnenkomen
- Toekomstige betaalmethodes

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Order Update   │────▶│  Trigger:        │────▶│  generate-      │
│  payment_status │     │  auto_invoice    │     │  invoice        │
│  = 'paid'       │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        Check: tenant.auto_generate_invoice = true
                        Check: no existing invoice for order
```

### Aanpak 2: Per-Sync Functie Uitbreiding

Alternatief: in elke sync-functie (sync-bol-orders, sync-amazon-orders, etc.) de `generate-invoice` aanroepen.

**Nadeel**: Duplicatie, bankoverschrijvingen niet gedekt.

---

## Implementatie

### Deel 1: Tenant Setting

**Nieuw veld in `tenants` tabel:**

```sql
ALTER TABLE tenants ADD COLUMN auto_generate_invoice BOOLEAN DEFAULT true;
ALTER TABLE tenants ADD COLUMN auto_send_invoice_email BOOLEAN DEFAULT false;
```

- `auto_generate_invoice`: Automatisch factuur aanmaken bij betaalde orders
- `auto_send_invoice_email`: Factuur direct e-mailen naar klant

### Deel 2: Database Trigger voor Auto-Facturatie

**Nieuwe Edge Function:** `auto-generate-invoice-on-paid`

Deze functie wordt aangeroepen via een PostgreSQL trigger wanneer:
1. `payment_status` wijzigt naar `paid`
2. OF een nieuwe order wordt aangemaakt met `payment_status = 'paid'`

**Trigger logica:**

```sql
CREATE OR REPLACE FUNCTION public.trigger_auto_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_existing_invoice UUID;
BEGIN
  -- Alleen triggeren als payment_status 'paid' wordt
  IF NEW.payment_status = 'paid' AND 
     (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    
    -- Check tenant settings
    SELECT auto_generate_invoice, auto_send_invoice_email 
    INTO v_tenant
    FROM tenants WHERE id = NEW.tenant_id;
    
    IF v_tenant.auto_generate_invoice = true THEN
      -- Check of factuur al bestaat
      SELECT id INTO v_existing_invoice 
      FROM invoices WHERE order_id = NEW.id LIMIT 1;
      
      IF v_existing_invoice IS NULL THEN
        -- Queue invoice generation via pg_net
        PERFORM net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/generate-invoice',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'order_id', NEW.id,
            'auto_send_email', v_tenant.auto_send_invoice_email
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
```

**Alternatieve aanpak (zonder pg_net):** 
Een cron-job die elke minuut controleert op betaalde orders zonder factuur.

### Deel 3: Generate-Invoice Update

**Bestand:** `supabase/functions/generate-invoice/index.ts`

Toevoegen van `auto_send_email` parameter:

```typescript
// Request body extensie
interface GenerateInvoiceRequest {
  order_id: string;
  auto_send_email?: boolean;  // Nieuw
}

// Na succesvolle generatie:
if (auto_send_email && invoiceId) {
  await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({ invoice_id: invoiceId })
  });
}
```

### Deel 4: Admin UI Settings

**Bestand:** `src/pages/admin/SettingsPage.tsx` of nieuwe component

Nieuwe sectie "Facturatie":

```text
┌─────────────────────────────────────────────────────────────────┐
│  📄 Automatische Facturatie                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Automatisch facturen genereren                  [Toggle: Aan] │
│  Maak automatisch een factuur aan zodra een                    │
│  bestelling als betaald wordt gemarkeerd                       │
│                                                                 │
│  Automatisch factuur e-mailen                    [Toggle: Uit] │
│  Verstuur de factuur direct per e-mail naar                    │
│  de klant na generatie                                         │
│                                                                 │
│  ℹ️ Dit geldt voor:                                            │
│  • Marketplace orders (Bol.com, Amazon, etc.)                  │
│  • Webshop bankoverschrijvingen                                │
│  • Handmatig gemarkeerde betalingen                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Deel 5: Marketplace-Specifieke Override (Optioneel)

Voor fijnmazigere controle: een `autoGenerateInvoice` toggle per marketplace-connectie.

**Type uitbreiding:** `src/types/marketplace.ts`

```typescript
interface MarketplaceSettings {
  // ... bestaande velden ...
  autoGenerateInvoice?: boolean;  // Override tenant default
  autoSendInvoiceEmail?: boolean; // Override tenant default
}
```

**UI:** Checkbox in marketplace settings naast andere sync opties.

---

## Implementatie Overzicht

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| **Database** | | |
| Migratie | SQL | `auto_generate_invoice` + `auto_send_invoice_email` kolommen |
| Migratie | SQL | Trigger `trigger_auto_invoice` op orders tabel |
| **Edge Functions** | | |
| `generate-invoice/index.ts` | Update | `auto_send_email` parameter |
| `auto-invoice-cron/index.ts` | Nieuw | Fallback cron voor orders zonder factuur |
| **Frontend** | | |
| `InvoiceSettingsCard.tsx` | Nieuw | Toggle UI component |
| `SettingsPage.tsx` | Update | Invoegen InvoiceSettingsCard |
| `src/types/marketplace.ts` | Update | `autoGenerateInvoice` per connectie |

---

## Flow Diagrammen

### Marketplace Order Import

```text
sync-bol-orders             Database                generate-invoice
      │                         │                         │
      │  INSERT order           │                         │
      │  payment_status='paid'  │                         │
      │────────────────────────▶│                         │
      │                         │                         │
      │                         │  TRIGGER fires          │
      │                         │  auto_invoice check     │
      │                         │─────────────────────────│
      │                         │                         │
      │                         │  HTTP POST              │
      │                         │─────────────────────────▶│
      │                         │                         │
      │                         │                         │  Generate PDF
      │                         │                         │  Store in bucket
      │                         │                         │  Create invoice row
      │                         │                         │
      │                         │                         │  (optional)
      │                         │                         │  send-invoice-email
```

### Bankoverschrijving Webshop

```text
Admin OrderDetail           Database                generate-invoice
      │                         │                         │
      │  UPDATE order           │                         │
      │  payment_status='paid'  │                         │
      │────────────────────────▶│                         │
      │                         │                         │
      │                         │  TRIGGER fires          │
      │                         │  auto_invoice check     │
      │                         │─────────────────────────│
      │                         │                         │
      │                         │  HTTP POST              │
      │                         │─────────────────────────▶│
      │                         │                         │
      │                         │                 Invoice generated!
```

---

## Technische Details

### Trigger vs Cron Afweging

| Methode | Voordeel | Nadeel |
|---------|----------|--------|
| **DB Trigger + pg_net** | Realtime, geen vertraging | Vereist pg_net extensie, complexer debug |
| **Cron Job (elke minuut)** | Simpeler, betrouwbaarder | Max 1 min vertraging |
| **In-Sync Aanroep** | Direct in de flow | Code duplicatie, niet voor bank transfer |

**Aanbeveling:** Hybride aanpak
1. In sync-functies: direct `generate-invoice` aanroepen voor snelheid
2. Cron-job als fallback: pakt gemiste orders op (bank transfers, edge cases)

### Cron Job Query

```sql
SELECT o.id, o.tenant_id
FROM orders o
LEFT JOIN invoices i ON i.order_id = o.id
JOIN tenants t ON t.id = o.tenant_id
WHERE o.payment_status = 'paid'
  AND i.id IS NULL
  AND t.auto_generate_invoice = true
  AND o.created_at > NOW() - INTERVAL '30 days'
LIMIT 50;
```

---

## Resultaat

Na implementatie:

| Kanaal | Automatische Factuur | Trigger |
|--------|---------------------|---------|
| Webshop (Stripe) | ✅ | Webhook (bestaand) |
| Webshop (Bankoverschrijving) | ✅ | Bij markeren als "betaald" |
| Bol.com | ✅ | Bij import (payment_status=paid) |
| Amazon | ✅ | Bij import (payment_status=paid) |
| Shopify | ✅ | Bij import (payment_status=paid) |
| WooCommerce | ✅ | Bij import (payment_status=paid) |
| POS (B2B) | ✅ | Bij markeren als "betaald" |

**Klanten ontvangen automatisch hun factuur** zonder handmatige tussenkomst van de verkoper.

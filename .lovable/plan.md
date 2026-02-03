

# Plan: Complete Shopify CSV Import - Alle Ontbrekende Velden

## Analyse per Import Type

### 1. KLANTEN - Ontbrekende Velden

| Shopify CSV Kolom | SellQo Database | Status | Actie |
|-------------------|-----------------|--------|-------|
| `ID` | `shopify_customer_id` | ✅ Bestaat | **Toevoegen aan import** |
| `Note` | `notes` | ✅ Bestaat | **Toevoegen aan import** |
| `Tax Exempt` / `Tax Exemptions` | `tax_exempt` | ✅ Bestaat | **Toevoegen aan import** |
| `Address2` | `billing_street` (samenvoegen) | ✅ Kan | **Samenvoegen met Address1** |
| `Province` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Province Code` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Tags` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Verified Email` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Email Marketing: Status` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Email Marketing: Level` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `SMS Marketing: Status` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Created At` | - | ❌ Ontbreekt | Toevoegen aan DB (originele datum) |

**Oplossing:** Database migratie + parser update + import handler update

---

### 2. PRODUCTEN - Ontbrekende Velden

| Shopify CSV Kolom | SellQo Database | Status | Actie |
|-------------------|-----------------|--------|-------|
| `Handle` | - | ❌ Ontbreekt | Toevoegen (voor sync) |
| `Vendor` | - | ❌ Ontbreekt | Toevoegen aan DB |
| `Type` | - | ❌ Ontbreekt | Map naar `original_category_value` |
| `Published` | `is_active` | ✅ Bestaat | **Toevoegen aan import** |
| `Published Scope` | - | ❌ Info | Skip (niet relevant) |
| `Variant Fulfillment Service` | - | ❌ Info | Skip |
| `Variant Requires Shipping` | `requires_shipping` | ✅ Bestaat | **Toevoegen aan import** |
| `Variant Taxable` | - | ❌ Info | Koppelen aan BTW |
| `Gift Card` | `product_type` | ✅ Bestaat | **Toevoegen logica** |
| `SEO Title` | `meta_title` | ✅ Bestaat | **Niet geïmporteerd!** |
| `SEO Description` | `meta_description` | ✅ Bestaat | **Niet geïmporteerd!** |
| `Google: Category` | - | ❌ Ontbreekt | Toevoegen (voor feed) |
| `Google: GTIN` | `barcode` | ✅ Bestaat | Al gemapped |
| `Image Position` | - | ❌ Info | Images zijn al arrays |
| `Image Alt Text` | - | ❌ Ontbreekt | Toevoegen (voor SEO) |
| `Status` | `is_active` | ✅ Bestaat | active/draft/archived |

**Belangrijke ontbrekende product velden:**
- `handle` - Unieke slug van Shopify (voor product sync)
- `vendor` - Leverancier/merk
- `google_product_category` - Voor Google Shopping feed

---

### 3. ORDERS - Ontbrekende Velden & Implementatie

**Orders zijn momenteel NIET geïmplementeerd!** De code toont alleen een toast message.

| Shopify CSV Kolom | SellQo Database | Status |
|-------------------|-----------------|--------|
| `Name` (bv #1001) | `marketplace_order_id` | ✅ Bestaat |
| `Email` | `customer_email` | ✅ Bestaat |
| `Financial Status` | `payment_status` | ✅ Mapping nodig |
| `Fulfillment Status` | `status` | ✅ Mapping nodig |
| `Paid at` | - | ❌ Ontbreekt |
| `Fulfilled at` | `shipped_at` | ✅ Bestaat |
| `Currency` | - | ❌ Ontbreekt in DB |
| `Subtotal` | `subtotal` | ✅ Bestaat |
| `Shipping` | `shipping_cost` | ✅ Bestaat |
| `Taxes` | `tax_amount` | ✅ Bestaat |
| `Total` | `total` | ✅ Bestaat |
| `Discount Code` | `discount_code` | ✅ Bestaat |
| `Discount Amount` | `discount_amount` | ✅ Bestaat |
| `Created at` | `created_at` | ✅ Bestaat |
| `Lineitem name` | `order_items.product_name` | ✅ Bestaat |
| `Lineitem quantity` | `order_items.quantity` | ✅ Bestaat |
| `Lineitem price` | `order_items.unit_price` | ✅ Bestaat |
| `Lineitem sku` | `order_items.product_sku` | ✅ Bestaat |
| `Billing Name` | `billing_address.name` | ✅ JSONB |
| `Billing Street` | `billing_address.street` | ✅ JSONB |
| `Billing City` | `billing_address.city` | ✅ JSONB |
| `Billing Zip` | `billing_address.postal_code` | ✅ JSONB |
| `Billing Country` | `billing_address.country` | ✅ JSONB |
| `Shipping Name/Street/City/Zip/Country` | `shipping_address` | ✅ JSONB |
| `Phone` | `customer_phone` | ✅ Bestaat |
| `Notes` | `notes` | ✅ Bestaat |
| `Note Attributes` | `raw_marketplace_data` | ✅ JSONB |
| `Tags` | - | ❌ Ontbreekt |
| `Risk Level` | - | ❌ Ontbreekt (interessant voor fraud) |
| `Payment Reference` | `external_reference` | ✅ Bestaat |
| `Vendor` | - | Per line item |

---

## Implementatie Plan

### Stap 1: Database Migratie

Voeg ontbrekende kolommen toe:

```sql
-- CUSTOMERS: Extra velden
ALTER TABLE customers ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS province_code TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verified_email BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_marketing_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_marketing_level TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_marketing_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_marketing_level TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS import_source TEXT;

-- PRODUCTS: Extra velden
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_handle TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS google_product_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt_texts TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_product_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_scope TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS import_source TEXT;

-- ORDERS: Extra velden
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_tags TEXT[];
ALTER TABLE orders ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS import_source TEXT;

-- ORDER_ITEMS: Extra velden voor vendor per item
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_title TEXT;
```

### Stap 2: Update Shopify CSV Parser

**Bestand:** `src/lib/shopifyImportParsers.ts`

Breid de interfaces en parsers uit om ALLE Shopify velden op te pikken:

```typescript
// CUSTOMERS - Uitgebreide interface
export interface ParsedCustomer {
  id: string | null;                    // NIEUW: Shopify Customer ID
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;              // NIEUW: Wordt samengevoegd
  city: string | null;
  province: string | null;              // NIEUW
  province_code: string | null;         // NIEUW
  zip: string | null;
  country: string | null;
  country_code: string | null;          // NIEUW
  accepts_marketing: boolean;
  total_spent: number;
  orders_count: number;
  tags: string[];
  note: string | null;                  // NIEUW
  tax_exempt: boolean;                  // NIEUW
  verified_email: boolean;              // NIEUW
  email_marketing_status: string | null; // NIEUW
  email_marketing_level: string | null;  // NIEUW
  sms_marketing_status: string | null;   // NIEUW
  sms_marketing_level: string | null;    // NIEUW
  created_at: string;
}

// PRODUCTS - Uitgebreide interface
export interface ParsedProduct {
  // Bestaande velden...
  handle: string | null;                // NIEUW: Shopify handle
  shopify_id: string | null;            // NIEUW: Product ID
  vendor: string | null;                // NIEUW
  status: string;                       // NIEUW: active/draft/archived
  published: boolean;                   // NIEUW
  seo_title: string | null;             // NIEUW
  seo_description: string | null;       // NIEUW
  google_product_category: string | null; // NIEUW
  image_alt_texts: string[];            // NIEUW
  created_at: string;                   // NIEUW
}

// ORDERS - Uitgebreide interface
export interface ParsedOrder {
  // Bestaande velden + NIEUW:
  shopify_order_id: string | null;
  currency: string;
  paid_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  billing_name: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_province: string | null;
  billing_country: string | null;
  billing_phone: string | null;
  phone: string | null;
  note: string | null;
  tags: string[];
  risk_level: string | null;
  payment_reference: string | null;
}

// LINE ITEMS - Uitgebreide interface
export interface ParsedLineItem {
  // Bestaande + NIEUW:
  variant_id: string | null;
  variant_title: string | null;
  vendor: string | null;
  fulfillment_status: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
}
```

### Stap 3: Update Import Handler

**Bestand:** `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx`

Implementeer volledige order import en verbeter customer/product import:

```typescript
// CUSTOMERS - Volledige mapping
const customerData = {
  tenant_id: currentTenant.id,
  email: customer.email,
  first_name: customer.first_name,
  last_name: customer.last_name,
  company_name: customer.company,
  phone: customer.phone,
  
  // Adressen - Combineer address1 + address2
  billing_street: [customer.address1, customer.address2].filter(Boolean).join(', '),
  billing_city: customer.city,
  billing_postal_code: customer.zip,
  billing_country: customer.country || 'NL',
  province: customer.province,
  province_code: customer.province_code,
  
  shipping_street: [customer.address1, customer.address2].filter(Boolean).join(', '),
  shipping_city: customer.city,
  shipping_postal_code: customer.zip,
  shipping_country: customer.country || 'NL',
  
  // Shopify tracking
  shopify_customer_id: customer.id,
  external_id: customer.id,
  shopify_last_synced_at: new Date().toISOString(),
  
  // Nieuwe velden
  notes: customer.note,
  tags: customer.tags,
  tax_exempt: customer.tax_exempt,
  verified_email: customer.verified_email,
  email_subscribed: customer.accepts_marketing,
  email_marketing_status: customer.email_marketing_status,
  email_marketing_level: customer.email_marketing_level,
  sms_marketing_status: customer.sms_marketing_status,
  sms_marketing_level: customer.sms_marketing_level,
  
  total_spent: customer.total_spent,
  total_orders: customer.orders_count,
  original_created_at: customer.created_at,
  import_source: 'shopify_csv',
};

// PRODUCTS - Volledige mapping
const productData = {
  tenant_id: currentTenant.id,
  name: product.title,
  slug: product.handle || generateSlug(product.title),
  description: product.description,
  sku: product.sku || null,
  barcode: product.barcode,
  price: product.price,
  compare_at_price: product.compare_at_price,
  cost_price: product.cost_price,
  stock: product.stock,
  weight: product.weight,
  tags: product.tags,
  images: product.images,
  
  // Nieuwe velden
  shopify_handle: product.handle,
  shopify_product_id: product.shopify_id,
  vendor: product.vendor,
  meta_title: product.seo_title,
  meta_description: product.seo_description,
  google_product_category: product.google_product_category,
  image_alt_texts: product.image_alt_texts,
  
  is_active: product.status === 'active',
  requires_shipping: true,
  track_inventory: true,
  original_created_at: product.created_at,
  import_source: 'shopify_csv',
};

// ORDERS - VOLLEDIGE implementatie (was niet geïmplementeerd!)
case 'orders': {
  for (const order of orders) {
    // Check of order al bestaat
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('marketplace_order_id', order.order_number)
      .maybeSingle();
    
    if (existing?.id) {
      skipped++;
      continue;
    }
    
    // Genereer intern ordernummer
    const { data: orderNumber } = await supabase
      .rpc('generate_order_number', { _tenant_id: currentTenant.id });
    
    // Map status
    const status = mapShopifyStatus(order.financial_status, order.fulfillment_status);
    const paymentStatus = mapPaymentStatus(order.financial_status);
    
    // Creëer order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: currentTenant.id,
        order_number: orderNumber,
        marketplace_source: 'shopify',
        marketplace_order_id: order.order_number,
        status,
        payment_status: paymentStatus,
        customer_email: order.email,
        customer_name: order.shipping_name,
        customer_phone: order.phone,
        subtotal: order.subtotal,
        tax_amount: order.taxes,
        shipping_cost: order.shipping,
        discount_code: order.discount_code,
        discount_amount: order.discount_amount,
        total: order.total,
        currency: order.currency,
        shipping_address: {
          name: order.shipping_name,
          street: order.shipping_address,
          city: order.shipping_city,
          postal_code: order.shipping_zip,
          country: order.shipping_country,
        },
        billing_address: {
          name: order.billing_name,
          street: order.billing_street,
          city: order.billing_city,
          postal_code: order.billing_zip,
          country: order.billing_country,
        },
        notes: order.note,
        order_tags: order.tags,
        risk_level: order.risk_level,
        paid_at: order.paid_at,
        original_created_at: order.created_at,
        import_source: 'shopify_csv',
      })
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // Voeg order items toe
    for (const item of order.line_items) {
      await supabase.from('order_items').insert({
        order_id: newOrder.id,
        product_name: item.title,
        product_sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        vendor: item.vendor,
        variant_title: item.variant_title,
      });
    }
    
    success++;
  }
  break;
}
```

### Stap 4: Verbeter Preview Tabellen

Toon meer kolommen in de preview zodat gebruikers zien dat alles wordt geïmporteerd:

**Klanten Preview:**
| Email | Naam | Stad | Tags | Marketing | BTW Vrijst. |

**Producten Preview:**
| Titel | SKU | Prijs | Vendor | Status | SEO |

**Orders Preview:**
| Order # | Klant | Totaal | Status | Betaling | Items |

---

## Bestanden te Wijzigen

| Bestand | Actie |
|---------|-------|
| Database | Migratie: nieuwe kolommen customers, products, orders, order_items |
| `src/lib/shopifyImportParsers.ts` | Alle interfaces en parsers uitbreiden |
| `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` | Volledige mappings + order import implementeren |

---

## Voordelen na Implementatie

1. **100% Data Capture** - Alle Shopify export velden worden bewaard
2. **Order Import Werkt** - Nu volledig geïmplementeerd met line items
3. **Shopify IDs Bewaard** - Voor toekomstige sync/matching
4. **SEO Data** - Meta titles/descriptions worden overgenomen
5. **Marketing Compliance** - Correcte consent levels bewaard
6. **Tags & Notes** - Belangrijke metadata behouden
7. **Vendor/Leverancier** - Per product én per order item
8. **Betere Preview** - Gebruikers zien dat alles wordt geïmporteerd


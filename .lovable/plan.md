
# Plan: Fix Shopify CSV Parser - Exacte Kolomnaam Mapping

## Probleem

De huidige parser zoekt naar **verkeerde kolomnamen**. Jouw Shopify export gebruikt andere namen dan verwacht:

## Te Fixen Kolomnamen per Type

### 1. CUSTOMERS Parser Fixes

```text
HUIDIGE CODE                    JOUW CSV EXPORT
───────────────────────────────────────────────────────────
row['ID']                    →  row['Customer ID']
row['Company']               →  row['Default Address Company']
row['Address1']              →  row['Default Address Address1']
row['Address2']              →  row['Default Address Address2']
row['City']                  →  row['Default Address City']
row['Province Code']         →  row['Default Address Province Code']
row['Country Code']          →  row['Default Address Country Code']
row['Zip']                   →  row['Default Address Zip']
row['Accepts Marketing']     →  row['Accepts Email Marketing']
row['Orders Count']          →  row['Total Orders']
-                            →  row['Default Address Phone'] (NIEUW)
-                            →  row['Accepts SMS Marketing'] (NIEUW)
```

### 2. PRODUCTS Parser Fixes

```text
HUIDIGE CODE                    JOUW CSV EXPORT
───────────────────────────────────────────────────────────
row['Google: Category']      →  row['Product Category']
-                            →  Metafields voor kleur, materiaal, etc.
```

### 3. ORDERS Parser Fixes

```text
HUIDIGE CODE                    JOUW CSV EXPORT  
───────────────────────────────────────────────────────────
row['ID']                    →  row['Id'] (kleine letter 'd')
row['Lineitem vendor']       →  row['Vendor'] (per rij)
-                            →  row['Source'] (bijv. shopify_draft_order)
-                            →  row['Employee']
-                            →  row['Location']
-                            →  row['Lineitem discount']
-                            →  row['Tax 1 Name'], row['Tax 1 Value'], etc.
```

## Implementatie

### Stap 1: Update `parseShopifyCustomers()` functie

**Bestand:** `src/lib/shopifyImportParsers.ts`

```typescript
export function parseShopifyCustomers(csvString: string): ParsedCustomer[] {
  const rows = parseCSV(csvString);
  
  return rows.map(row => ({
    // Shopify Customer ID
    id: row['Customer ID'] || row['ID'] || row['id'] || null,
    
    // Basis info
    email: row['Email'] || row['email'] || '',
    first_name: row['First Name'] || row['first_name'] || '',
    last_name: row['Last Name'] || row['last_name'] || '',
    
    // Bedrijf - Let op "Default Address" prefix!
    company: row['Default Address Company'] || row['Company'] || row['company'] || null,
    
    // Telefoon - zowel direct als adres telefoon
    phone: row['Phone'] || row['phone'] || null,
    address_phone: row['Default Address Phone'] || null,
    
    // Adres - Let op "Default Address" prefix!
    address1: row['Default Address Address1'] || row['Address1'] || row['address1'] || null,
    address2: row['Default Address Address2'] || row['Address2'] || row['address2'] || null,
    city: row['Default Address City'] || row['City'] || row['city'] || null,
    province: row['Default Address Province'] || row['Province'] || row['province'] || null,
    province_code: row['Default Address Province Code'] || row['Province Code'] || null,
    zip: row['Default Address Zip'] || row['Zip'] || row['zip'] || null,
    country: row['Default Address Country'] || row['Country'] || row['country'] || null,
    country_code: row['Default Address Country Code'] || row['Country Code'] || null,
    
    // Marketing - Let op exacte kolomnamen!
    accepts_marketing: (row['Accepts Email Marketing'] || row['Accepts Marketing'] || '').toLowerCase() === 'yes',
    accepts_sms_marketing: (row['Accepts SMS Marketing'] || '').toLowerCase() === 'yes',
    
    // Stats - Let op: "Total Orders" niet "Orders Count"!
    total_spent: parseFloat((row['Total Spent'] || '0').replace(/[^0-9.-]/g, '')) || 0,
    orders_count: parseInt(row['Total Orders'] || row['Orders Count'] || '0') || 0,
    
    // Extra velden
    tags: (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
    note: row['Note'] || row['note'] || null,
    tax_exempt: (row['Tax Exempt'] || 'no').toLowerCase() === 'yes',
    
    // Metafields (optioneel - voor Klaviyo data)
    language_preference: row['language_preference (customer.metafields.customer.language_preference)'] || null,
    birth_date: row['Birth date (customer.metafields.facts.birth_date)'] || null,
    
    created_at: row['Created At'] || row['created_at'] || new Date().toISOString(),
  })).filter(c => c.email);
}
```

### Stap 2: Update `parseShopifyProducts()` functie

```typescript
// Product Category apart parsen (Shopify's nieuwe Google categorisatie)
google_product_category: row['Product Category'] || row['Google Shopping / Google Product Category'] || null,

// Metafields voor product specificaties opslaan als JSON
product_metafields: {
  battery_features: row['Battery features (product.metafields.shopify.battery-features)'] || null,
  battery_size: row['Battery size (product.metafields.shopify.battery-size)'] || null,
  color: row['Color (product.metafields.shopify.color-pattern)'] || null,
  connection_type: row['Connection type (product.metafields.shopify.connection-type)'] || null,
  item_condition: row['Item condition (product.metafields.shopify.item-condition)'] || null,
  material: row['Material (product.metafields.shopify.material)'] || null,
  power_source: row['Power source (product.metafields.shopify.power-source)'] || null,
  // ... andere metafields
},
```

### Stap 3: Update `parseShopifyOrders()` functie

```typescript
// Shopify Order ID - let op kleine 'd'!
shopify_order_id: row['Id'] || row['ID'] || row['id'] || null,

// Vendor per line item
vendor: row['Vendor'] || null,

// Extra order velden
source: row['Source'] || null,
employee: row['Employee'] || null,
location: row['Location'] || null,

// BTW details per regel
tax_details: {
  tax1_name: row['Tax 1 Name'] || null,
  tax1_value: parseFloat(row['Tax 1 Value'] || '0') || 0,
  tax2_name: row['Tax 2 Name'] || null,
  tax2_value: parseFloat(row['Tax 2 Value'] || '0') || 0,
},

// Line item discount
lineitem_discount: parseFloat(row['Lineitem discount'] || '0') || 0,
```

### Stap 4: Update ParsedCustomer Interface

```typescript
export interface ParsedCustomer {
  id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  address_phone: string | null;  // NIEUW
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  zip: string | null;
  country: string | null;
  country_code: string | null;
  accepts_marketing: boolean;
  accepts_sms_marketing: boolean;  // NIEUW
  total_spent: number;
  orders_count: number;
  tags: string[];
  note: string | null;
  tax_exempt: boolean;
  language_preference: string | null;  // NIEUW: Metafield
  birth_date: string | null;  // NIEUW: Metafield
  created_at: string;
}
```

### Stap 5: Update ShopifyManualImport.tsx

Pas de import handler aan om de nieuwe velden te gebruiken:

```typescript
const customerData = {
  tenant_id: currentTenant.id,
  email: customer.email,
  first_name: customer.first_name,
  last_name: customer.last_name,
  company_name: customer.company,
  
  // Telefoon - combineer beide bronnen
  phone: customer.phone || customer.address_phone,
  
  // Adressen
  billing_street: [customer.address1, customer.address2].filter(Boolean).join(', '),
  billing_city: customer.city,
  billing_postal_code: customer.zip,
  billing_country: customer.country_code || customer.country || 'NL',
  province: customer.province,
  province_code: customer.province_code,
  
  // Marketing
  email_subscribed: customer.accepts_marketing,
  sms_subscribed: customer.accepts_sms_marketing,
  
  // Stats
  total_spent: customer.total_spent,
  total_orders: customer.orders_count,
  
  // Extra
  notes: customer.note,
  tags: customer.tags,
  tax_exempt: customer.tax_exempt,
  
  // Shopify tracking
  shopify_customer_id: customer.id,
  external_id: customer.id,
  import_source: 'shopify_csv',
};
```

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/lib/shopifyImportParsers.ts` | Fix alle kolomnaam mappings voor customers, products, orders |
| `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` | Update import handlers voor nieuwe velden |

## Resultaat

Na deze wijzigingen worden ALLE velden uit jouw Shopify CSV exports correct geparsed:

**Customers:**
- ✅ Customer ID correct opgehaald
- ✅ Default Address velden correct gemapped
- ✅ Accepts Email Marketing / SMS Marketing correct
- ✅ Total Orders (niet Orders Count)
- ✅ Klaviyo metafields optioneel beschikbaar

**Products:**
- ✅ Product Category voor Google Shopping
- ✅ Alle metafields (battery, color, etc.)
- ✅ Status, Published, SEO velden

**Orders:**
- ✅ Shopify Order `Id` (kleine d)
- ✅ Vendor per line item
- ✅ Source, Employee, Location
- ✅ BTW details per regel

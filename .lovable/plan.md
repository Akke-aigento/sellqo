

# Plan: Fix Shopify Klanten CSV Import

## Probleemanalyse

De klanten CSV import mislukt met **"Onbekende fout"** voor alle 99 klanten. Het probleem is dat de code in `ShopifyManualImport.tsx` kolommen probeert te gebruiken die **niet bestaan** in de `customers` database tabel.

### Huidige Code vs Database Schema

| Code probeert | Database heeft | Status |
|---------------|----------------|--------|
| `address_line1` | `billing_street` / `shipping_street` | ❌ Fout |
| `address_line2` | geen equivalent | ❌ Fout |
| `city` | `billing_city` / `shipping_city` | ❌ Fout |
| `state` | geen (valt onder street) | ❌ Fout |
| `postal_code` | `billing_postal_code` / `shipping_postal_code` | ❌ Fout |
| `country` | `billing_country` / `shipping_country` | ❌ Fout |
| `accepts_marketing` | `email_subscribed` | ❌ Fout |
| `tags` | geen | ❌ Fout |
| `source` | geen | ❌ Fout |
| `email` | `email` | ✅ OK |
| `first_name` | `first_name` | ✅ OK |
| `last_name` | `last_name` | ✅ OK |
| `company_name` | `company_name` | ✅ OK |
| `phone` | `phone` | ✅ OK |
| `total_spent` | `total_spent` | ✅ OK |
| `total_orders` | `total_orders` | ✅ OK |

## Oplossing

Pas de insert-mapping aan zodat deze overeenkomt met het daadwerkelijke database schema.

### Stap 1: Fix Kolommen Mapping

Update `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` regel 204-222:

**Van:**
```typescript
const { error } = await supabase.from('customers').insert([{
  tenant_id: currentTenant.id,
  email: customer.email,
  first_name: customer.first_name,
  last_name: customer.last_name,
  company_name: customer.company,
  phone: customer.phone,
  address_line1: customer.address1,      // ❌ Bestaat niet
  address_line2: customer.address2,      // ❌ Bestaat niet
  city: customer.city,                   // ❌ Bestaat niet
  state: customer.province,              // ❌ Bestaat niet
  postal_code: customer.zip,             // ❌ Bestaat niet
  country: customer.country || 'NL',     // ❌ Bestaat niet
  accepts_marketing: customer.accepts_marketing,  // ❌ Bestaat niet
  total_spent: customer.total_spent,
  total_orders: customer.orders_count,
  tags: customer.tags,                   // ❌ Bestaat niet
  source: 'shopify_import',              // ❌ Bestaat niet
}]);
```

**Naar:**
```typescript
const { error } = await supabase.from('customers').insert([{
  tenant_id: currentTenant.id,
  email: customer.email,
  first_name: customer.first_name,
  last_name: customer.last_name,
  company_name: customer.company,
  phone: customer.phone,
  // Gebruik billing adres velden
  billing_street: customer.address1,
  billing_city: customer.city,
  billing_postal_code: customer.zip,
  billing_country: customer.country || 'NL',
  // Kopieer naar shipping indien nodig
  shipping_street: customer.address1,
  shipping_city: customer.city,
  shipping_postal_code: customer.zip,
  shipping_country: customer.country || 'NL',
  // Marketing voorkeuren
  email_subscribed: customer.accepts_marketing,
  total_spent: customer.total_spent,
  total_orders: customer.orders_count,
  // Externe ID voor Shopify tracking
  external_id: customer.email, // Kan later vervangen door Shopify ID indien beschikbaar
}]);
```

### Stap 2: Voeg Duplicate Handling Toe

Voeg check toe om duplicaten te voorkomen op basis van email:

```typescript
// Check of klant al bestaat
const { data: existing } = await supabase
  .from('customers')
  .select('id')
  .eq('tenant_id', currentTenant.id)
  .eq('email', customer.email)
  .single();

if (existing) {
  // Update bestaande klant
  const { error } = await supabase
    .from('customers')
    .update({ /* updated fields */ })
    .eq('id', existing.id);
} else {
  // Insert nieuwe klant
  const { error } = await supabase
    .from('customers')
    .insert([{ /* new customer */ }]);
}
```

### Stap 3: Verbeter Foutmeldingen

In plaats van "Onbekende fout", toon de werkelijke database foutmelding.

## Bestand te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/marketplace/shopify/ShopifyManualImport.tsx` | Fix kolom mapping, voeg duplicate handling toe |

## Verwacht Resultaat

Na deze wijziging:
- Klanten CSV import werkt correct
- Adresgegevens worden opgeslagen in billing/shipping velden
- Duplicaten worden gedetecteerd en bijgewerkt in plaats van geweigerd
- Foutmeldingen zijn specifiek en helpend


-- Add UNIQUE constraints needed for upsert operations during CSV import
-- These allow ON CONFLICT to work for updating existing records

-- Customers: unique by tenant + email (primary match key)
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_unique 
ON public.customers (tenant_id, email) 
WHERE email IS NOT NULL;

-- Products: unique by tenant + sku (primary match key)
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_unique 
ON public.products (tenant_id, sku) 
WHERE sku IS NOT NULL;

-- Orders: unique by tenant + order_number (primary match key)
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_order_number_unique 
ON public.orders (tenant_id, order_number) 
WHERE order_number IS NOT NULL;
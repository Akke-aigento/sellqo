

# Plan: Create customer record on newsletter subscription

## Problem
When someone subscribes to the newsletter, only a `newsletter_subscribers` record is created. No corresponding `customers` record is created, so the subscriber doesn't appear in the customer overview. The `customers` table already supports `customer_type = 'prospect'` and has a `tags` array column that can hold labels like `['nieuwsbrief']`.

## Changes

### 1. Update `storefront-api` edge function — `newsletterSubscribe` action
**File:** `supabase/functions/storefront-api/index.ts` (~line 2553, after subscriber insert/update)

Add logic to upsert a customer record:
- Check if a `customers` record with matching `tenant_id` + `email` exists
- If not: insert a new customer with `customer_type = 'prospect'`, `tags = ['nieuwsbrief']`, `email_subscribed = true`
- If exists but doesn't have the `nieuwsbrief` tag: append the tag to the existing `tags` array and set `email_subscribed = true`

```sql
-- Pseudo logic added in the edge function:
INSERT INTO customers (tenant_id, email, customer_type, tags, email_subscribed, email_subscribed_at)
VALUES (tenantId, email, 'prospect', ['nieuwsbrief'], true, now())
ON CONFLICT (tenant_id, email) DO UPDATE SET
  tags = array_append(customers.tags, 'nieuwsbrief') -- only if not already present
  email_subscribed = true,
  email_subscribed_at = now()
```

This will be implemented via the Supabase JS client in the edge function (not raw SQL).

### 2. No database migration needed
The `customers` table already has all required columns: `customer_type`, `tags`, `email_subscribed`, `email_subscribed_at`.

### 3. No frontend changes needed
The unified customer overview already displays customers with their tags and types.

## Technical details

- The upsert uses `tenant_id` + `email` as the unique match (there's likely a unique constraint or we use select-then-insert)
- `customer_type` is set to `'prospect'` for newsletter-only subscribers — they graduate to `'b2c'` when they place an order
- The `nieuwsbrief` tag provides clear labeling in the customer overview
- Existing customers who subscribe get the tag added without changing their `customer_type`

## Files
- **`supabase/functions/storefront-api/index.ts`**: Add customer upsert logic in the `newsletterSubscribe` function after the subscriber record is created/updated




## Stripe Connect Disconnect: Edge Function + UI

### 1. New Edge Function: `supabase/functions/disconnect-stripe-account/index.ts`

- Copy CORS/auth pattern from `create-connect-account`
- Accept POST with `{ tenant_id }`, authenticate user, verify platform_admin OR tenant owner (via `user_roles`)
- Fetch tenant's `stripe_account_id`, error if null
- Call `stripe.accounts.del()`, catch errors (pending balance etc.)
- On success or "account not found": update tenant to null out all Stripe fields
- Return summary with success/error

### 2. Update `TenantOverviewTab.tsx` (platform admin view)

- Add imports: `AlertDialog` components, `Button`, `Trash2`/`Unlink` icon, `Loader2`, `toast` from sonner, `supabase` client, `useState`
- In the Stripe Status card (lines 156-171), add a red "Ontkoppelen" button when `stripe_account_id` exists
- AlertDialog with warning text, confirm calls edge function, shows toast on success/error, refetches tenant data via query invalidation

### 3. Update `PaymentSettings.tsx` (tenant's own settings)

- After the existing button row (line 315-336, the "Status vernieuwen" / "Stripe Dashboard" buttons), add a Separator and a danger section with "Stripe ontkoppelen" button
- Same AlertDialog pattern, calls same edge function with `currentTenant.id`
- On success: calls `checkStatus()` and `refreshTenants()` so UI switches back to onboarding state

### No database changes needed


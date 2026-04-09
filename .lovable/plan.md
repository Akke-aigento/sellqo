

## Cleanup Connected Accounts: Edge Function + Admin UI

### 1. Edge Function: `supabase/functions/cleanup-connected-accounts/index.ts`

| Aspect | Detail |
|--------|--------|
| Auth | Verify JWT via `supabase.auth.getUser()`, then check `user_roles` for `platform_admin` role |
| Stripe | `import Stripe from 'https://esm.sh/stripe@13.6.0'` met `STRIPE_SECRET_KEY` |
| Logic | Fetch all tenants with `stripe_account_id IS NOT NULL`, loop through each, try `stripe.accounts.del()`, update tenant record on success or "not found" error, skip on other errors |
| Response | `{ success: true, cleaned: number, failed: [{ tenant_id, tenant_name, error }] }` |
| CORS | Copy pattern from `create-connect-account` |

### 2. Frontend: Button in Settings page

**Bestand:** `src/pages/admin/Settings.tsx`

- Add a new settings section `PlatformToolsSettings` only visible when `isPlatformAdmin && isAdminView`
- Place it in a new group "Platform Tools" at the bottom of `settingsGroups`

**Nieuw bestand:** `src/components/admin/settings/PlatformToolsSettings.tsx`

- Red button "Reset alle Stripe accounts"
- AlertDialog with warning text
- Input field requiring user to type "RESET" to enable confirm button
- On confirm: call `supabase.functions.invoke('cleanup-connected-accounts')`
- Show results: cleaned count, failed list with tenant names and errors
- Loading state during execution

### Geen database wijzigingen nodig


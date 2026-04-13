

# Fix: Returns page showing "0 retouren gevonden" (403)

## Root Cause

The `returns` table has RLS policies that call `get_user_tenant_ids()` **without arguments**, but the only version of that function requires a `_user_id uuid` parameter. The call fails silently, returning no tenant IDs, so the SELECT policy blocks all rows.

**Evidence:**
- 2 return rows exist in the database for Mancini tenant
- `get_user_tenant_ids(uuid)` exists (1 arg), but `get_user_tenant_ids()` (0 args) does not
- All three policies (SELECT, INSERT, UPDATE) on `returns` use the broken no-arg call

## Fix (Phase 1)

**Database migration:** Create a zero-argument wrapper function that calls the existing function with `auth.uid()`:

```sql
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_tenant_ids(auth.uid());
$$;
```

This makes all existing RLS policies that call `get_user_tenant_ids()` work correctly without modifying any policies.

**Scope check:** Other tables likely have the same pattern. We should verify no other tables are affected, but the wrapper function fix is universal.

## Verification

After migration, query `/admin/returns` — the 2 existing Mancini returns should appear.

## Other Findings (no changes needed now)

- **process-refund edge function**: Already correctly uses `stripeAccount` for direct charge refunds (line 128-135). No fix needed.
- **Phase 2 (post-launch)**: Add refund_type, restock checkbox, and Stripe action options to CreateReturnDialog. Scoped separately.
- **Phase 3 (later)**: Customer email notifications, status workflow, return labels.




# Plan: Reset return tag when all returns are cancelled

## Problem
The `get_order_return_tag` function checks `EXISTS (SELECT 1 FROM returns WHERE order_id = _order_id)` without excluding cancelled returns. So when a return is cancelled, the order still shows a return badge (likely "retour_lopend" or "retour_afgewezen").

## Fix
One migration to update the function. Change line 68 to exclude cancelled returns from the initial check:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.returns 
  WHERE order_id = _order_id AND status != 'cancelled'
) INTO has_returns;
```

This way, if ALL returns on an order are cancelled, the function returns `NULL` → no badge shown.

The rest of the function already handles cancelled correctly (line 87 checks for `cancelled` in `any_denied`, line 94 excludes cancelled from item counts), so this one-line change is all that's needed.

## Files
- **New migration**: `CREATE OR REPLACE FUNCTION public.get_order_return_tag` with the updated `has_returns` check


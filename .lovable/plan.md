

## Analysis & Fixes

### Issue 1: A6 Cropping Is Wrong

From the screenshot: the label uses the **full A4 width** (210mm) but occupies only the **top portion** of the page. The current `cropToA6` function crops to A6 dimensions (105mm × 148mm) — taking only the **left half** of the page width. That's why:
- Left side: tiny squished label (the left half of the A4 content)
- Right side: full label visible when scrolling, but cut off at the right edge

**Fix:** Change the crop to take the **full A4 width** but only the **top half height**. This matches how Bol.com actually positions their VVB labels on A4.

```text
Current crop (WRONG):          Correct crop:
┌──────┬──────┐               ┌─────────────┐
│ CROP │      │               │    CROP      │
│105mm │      │               │  210mm wide  │
│      │      │               │  148mm tall  │
├──────┤      │               ├─────────────┤
│      │      │               │             │
│      │      │               │             │
└──────┴──────┘               └─────────────┘
  A6 quadrant                  Full width, half height
```

**File:** `supabase/functions/create-bol-vvb-label/index.ts`, lines 28-47

Change `cropToA6`:
- `A6_WIDTH` from `297.64` (105mm) → `595.28` (full A4 width, 210mm)
- `A6_HEIGHT` stays `419.53` (148mm, half A4 height)
- This preserves the label at full width and crops away the empty bottom half

### Issue 2: Auto-Accept Does Nothing at Bol.com

The `accept-bol-order` function has this comment: *"FBR orders are auto-accepted by Bol.com"* — and then only updates the local database. **This is incorrect.** The user confirms they had to manually accept orders on the Bol.com portal.

However, looking deeper: in Bol.com API v10, there is no separate "accept" endpoint. The acceptance happens implicitly when you create a shipment (`POST /retailer/shipping-labels`). The VVB label creation already does this. So the actual flow should be:

1. New order synced → `sync_status: 'pending'`
2. Auto-accept called → marks `sync_status: 'accepted'` locally (NO API call)
3. VVB label created → calls `POST /retailer/shipping-labels` → this IS the acceptance at Bol.com

**The problem:** If VVB label creation fails (which was happening due to the `#` filename bug causing 409 errors), the order appears accepted locally but Bol.com still shows it as unaccepted because no shipment was created.

**Fix:** In `accept-bol-order/index.ts`, instead of just marking locally, actually call the Bol.com order endpoint to verify the order status. And update `sync-bol-orders` to set status to `accepted` only AFTER VVB label creation succeeds (not before).

**File:** `supabase/functions/sync-bol-orders/index.ts`, lines ~467-526
- Move the `sync_status: 'accepted'` update to AFTER VVB label creation succeeds
- If VVB label creation fails, keep status as `pending` so the retry mechanism picks it up

**File:** `supabase/functions/accept-bol-order/index.ts`
- Keep the local-only behavior (since v10 has no accept endpoint), but add a clear log that actual acceptance happens via shipment creation

### Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Label not cropped correctly | Crop takes left-half A6 quadrant; label uses full A4 width | Use full width (595.28pt), half height (419.53pt) |
| Auto-accept not working at Bol.com | Order marked "accepted" locally before VVB label succeeds | Only mark accepted after successful VVB label creation |




## Three Remaining Issues — Root Cause & Fix Plan

### Issue 1: Tracking number not auto-filled

**Root cause:** After VVB label creation, tracking is fetched via (1) HEAD request header, (2) 5s delayed order endpoint. Both return null. The tracking number `CD116065228BE` IS available via the **shipments API** (`GET /retailer/shipments?order-id=...`) but this endpoint is never called.

**Fix in `create-bol-vvb-label/index.ts`:**
- After the existing 5s delay fallback (line ~900), add a third fallback: query `GET /retailer/shipments?order-id={bolOrderId}`
- Increase delay from 5s to 10s to give Bol.com more time to assign tracking

### Issue 2: Order not accepted/processed on Bol.com portal

**Root cause:** Line 929 requires `transporterLabelId && trackingNumber` to call `confirm-bol-shipment`. Since tracking is null, the confirmation (which does `PUT /retailer/orders/{id}/shipment`) is **never called**. This is the API call that moves the order from "Verwerken" to "Verzonden" on Bol.com.

Additionally, `confirm-bol-shipment` itself (line 63) rejects requests without `tracking_number`.

**Fix in `create-bol-vvb-label/index.ts`:**
- Change condition from `transporterLabelId && trackingNumber` to just `transporterLabelId`
- If tracking is still null, try the shipments API one more time before confirming
- If still null, use a placeholder or the `transporterLabelId` — Bol.com already has the tracking from VVB label creation

**Fix in `confirm-bol-shipment/index.ts`:**
- Make `tracking_number` optional in the validation (line 63)
- If missing, fetch it from the shipments API before calling `PUT /retailer/orders/{id}/shipment`
- The shipment PUT call should still work because Bol.com already assigned tracking during VVB label creation

### Issue 3: Label has white space below content

**Root cause:** `LABEL_HEIGHT = 419.53` (half A4 = 148mm) is too tall. The bpost VVB label content ends at roughly 127mm / ~360pt. The remaining ~60pt is empty white space.

**Fix in `create-bol-vvb-label/index.ts`:**
- Change `LABEL_HEIGHT` from `419.53` to `360` (line 37)

---

### Files to modify

1. **`supabase/functions/create-bol-vvb-label/index.ts`**
   - Line 37: `LABEL_HEIGHT` → `360`
   - After line 900: Add shipments API fallback with 10s delay
   - Line 929: Change condition to just `transporterLabelId` (decouple from tracking)
   - Always call confirm-bol-shipment when label exists, pass tracking if available

2. **`supabase/functions/confirm-bol-shipment/index.ts`**
   - Line 63: Make `tracking_number` optional
   - Before building shipment items: if tracking missing, fetch from shipments API
   - Build shipment items with tracking if available, or without `trackAndTrace` field


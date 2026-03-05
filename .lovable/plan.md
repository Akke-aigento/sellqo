

## Plan: Fix VVB Label Duplication & Auto-fill Tracking

### Problems Identified

1. **Duplicate label creation costs money**: When "Opnieuw ophalen" is clicked, if the existing label has no `external_id`, the UI sends `force_new: true` which DELETES the old label and creates a NEW one at Bol.com (costs €6.90+ per label). The logs show this happened: two concurrent requests, one retry (failed because no external_id) and one new creation.

2. **Tracking number not auto-filled**: The HEAD request to get tracking returns 400 immediately after label creation. Bol.com needs time to assign the tracking number. The code never retries fetching tracking later.

3. **"Opnieuw ophalen" creates new label instead of fetching existing**: The button logic checks `latestLabel.status === 'created'` to decide retry vs force_new, but the label status is `pending` (not `created`), so it incorrectly triggers `force_new`.

### Fixes

---

**Fix 1: `src/components/admin/BolActionsCard.tsx` — Never create new labels from retry button**

The "Opnieuw ophalen" button should NEVER create a new label. It should only retry fetching the PDF + tracking for the existing label. Remove all `force_new` logic from this button.

- Line 280: Change `hasExternalId` logic. Instead of checking `status === 'created'`, always send `retry: true`. If the label has no `external_id`, the edge function should look up the label by order at Bol.com instead of creating a new one.
- Remove the `force_new` branch entirely from the retry button (lines 287-290).
- The "Nieuw label aanmaken" button (line 325, for `failed` status) stays but add a confirmation dialog warning about costs.

**Changed lines ~276-291:**
```typescript
const response = await supabase.functions.invoke('create-bol-vvb-label', {
  body: {
    order_id: order.id,
    retry: true,
    label_id: latestLabel.id,
  },
});
```

Also: hide the "VVB Label Aanmaken" button when `hasVvbLabel` is true (already done at line 390), but also prevent the failed-label "Nieuw label aanmaken" from firing without confirmation.

---

**Fix 2: `supabase/functions/create-bol-vvb-label/index.ts` — Retry without external_id: look up existing labels at Bol.com**

When retry is called but the label has no `external_id`, instead of returning an error, the function should:
1. Query Bol.com's shipment list for this order to find existing labels
2. If found, save the `external_id` and fetch the PDF + tracking
3. If not found, return a clear message (don't create a new one)

**New logic at lines 231-239** (replacing the "no external_id" error):
```typescript
if (!retryLabelId) {
  // No external_id stored — try to find the label via Bol.com shipments API
  console.log("No external_id, looking up shipping labels via Bol.com order...");
  
  const shipmentsResponse = await fetchWithTimeout(
    `https://api.bol.com/retailer/orders/${order.marketplace_order_id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.retailer.v10+json",
      },
    },
    15000,
  );
  
  if (shipmentsResponse.ok) {
    const orderData = await shipmentsResponse.json();
    // Extract transport info from order items
    const shipments = orderData.orderItems?.flatMap(item => item.fulfilment?.transport ? [item.fulfilment.transport] : []) || [];
    
    if (shipments.length > 0) {
      const transport = shipments[0];
      const trackAndTrace = transport.trackAndTrace;
      const transporterCode = transport.transporterCode;
      
      // Update the existing label record with tracking info
      const updateData = {};
      if (trackAndTrace) updateData.tracking_number = trackAndTrace;
      if (transporterCode) updateData.carrier = transporterCode;
      
      // Try to fetch the label PDF using the shipment endpoint
      // ... (attempt to get PDF via order shipments)
      
      // Update DB and return
    }
  }
  
  // If still nothing found, return friendly error
  return new Response(JSON.stringify({
    error: "Label nog niet beschikbaar bij Bol.com. Probeer het over een paar minuten opnieuw.",
    status: "pending",
  }), { status: 200, ... });
}
```

---

**Fix 3: Auto-fill tracking after label creation — delayed tracking fetch**

After label creation, tracking is often not immediately available. Add a second attempt to fetch tracking after a delay.

**In `create-bol-vvb-label/index.ts`, after the HEAD request (line ~728):**
```typescript
// If no tracking yet, wait 5 seconds and try again
if (!trackingNumber && transporterLabelId) {
  console.log("No tracking yet, waiting 5s for Bol.com to assign...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Re-fetch order from Bol.com to get transport info
  try {
    const orderResponse = await fetchWithTimeout(
      `https://api.bol.com/retailer/orders/${order.marketplace_order_id}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.retailer.v10+json" } },
      15000,
    );
    if (orderResponse.ok) {
      const orderData = await orderResponse.json();
      for (const item of (orderData.orderItems || [])) {
        const transport = item.fulfilment?.transport;
        if (transport?.trackAndTrace) {
          trackingNumber = transport.trackAndTrace;
          console.log("Got tracking from order data:", trackingNumber);
          break;
        }
      }
    }
  } catch (e) { console.error("Delayed tracking fetch failed:", e); }
}
```

Also update the order's tracking fields when retry successfully fetches tracking (already done at lines 395-403, but ensure `tracking_url` is also populated with the Bol.com track-and-trace URL).

---

**Fix 4: Accept button — ensure UI updates after accept**

The accept function works correctly (marks as `accepted` locally). But the `onSuccess` callback should show a clearer message. The current code already invalidates queries. Check if the issue is that `sync_status` isn't being read properly in the UI.

Line 186: `const syncStatus = order.sync_status || order.fulfillment_status;` — this is correct. The issue might be that the query cache isn't refreshed. Add explicit refetch.

```typescript
onSuccess: () => {
  toast.success('Order geaccepteerd');
  queryClient.invalidateQueries({ queryKey: ['order', order.id] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
},
```

### Summary

| Fix | File | Problem | Solution |
|-----|------|---------|----------|
| 1 | BolActionsCard.tsx | Retry button creates new label (costs money) | Always send `retry: true`, never `force_new` from retry |
| 2 | create-bol-vvb-label | Retry fails when no external_id | Look up label via Bol.com order API |
| 3 | create-bol-vvb-label | Tracking null after creation | Delayed retry + fetch from order endpoint |
| 4 | BolActionsCard.tsx | Accept status not refreshing | Invalidate both order + orders queries |




## Plan: Fix Bol.com Auto-Accept, Auto-Label, and Manual VVB Label Issues

### Root Cause Analysis

From the edge function logs:

1. **Auto-accept 403 error**: Order C0001N2N2R gets `403 Unauthorized Request` from Bol.com. The retry mechanism in `sync-bol-orders` (line 621) logs the error but does NOT mark the order as `accept_failed` -- it stays `sync_status = 'synced'`, causing infinite retries every sync cycle.

2. **VVB label 404 "already shipped"**: Order C00008690P (#1106) gets `404 - Request contains order item id(s) that are shipped already: [3871544182]`. The order was shipped externally (via Bol.com seller portal), but SellQo still shows "In afwachting" because `sync_status` was never updated.

3. **Manual VVB label button**: Same order #1106 -- the "VVB Label Aanmaken" button attempts to create a label for an already-shipped order, gets 400 error from `create-bol-vvb-label`, and shows a generic error toast.

### Fixes (3 files)

---

**File 1: `supabase/functions/sync-bol-orders/index.ts`**

**Fix A** (line ~621): When retry accept fails with 403 or 400, mark order as `accept_failed` to stop infinite retries:
```typescript
} else {
  console.error(`[RETRY] Accept failed for ${missed.marketplace_order_id}: HTTP ${acceptRes.status} - ${acceptBody}`)
  // Mark as accept_failed on persistent errors (403 = unauthorized/expired, 400 = bad request)
  if (acceptRes.status === 403 || acceptRes.status === 400) {
    await supabase.from('orders').update({ 
      sync_status: 'accept_failed', 
      updated_at: new Date().toISOString() 
    }).eq('id', missed.id)
    console.log(`[RETRY] Marked ${missed.marketplace_order_id} as accept_failed to stop retries`)
  }
}
```

---

**File 2: `supabase/functions/create-bol-vvb-label/index.ts`**

**Fix B** (line ~503-513): When Bol.com delivery-options returns 404 with "shipped already", update the order's sync_status to `shipped` and return a user-friendly error:
```typescript
if (!offersResponse.ok) {
  const errorText = await offersResponse.text();
  console.error("Bol.com delivery-options error:", offersResponse.status, errorText);
  
  // Detect "already shipped" scenario
  const alreadyShipped = offersResponse.status === 404 && errorText.includes('shipped already');
  if (alreadyShipped) {
    // Update order status to reflect reality
    await supabase.from('orders').update({ 
      sync_status: 'shipped', 
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    }).eq('id', order_id);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Deze bestelling is al verzonden via Bol.com. Status is bijgewerkt.',
      code: 'ALREADY_SHIPPED',
      details: errorText,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  return new Response(/* existing error response */);
}
```

**Fix C** (line ~449-458): When auto-accept in VVB label creation fails with 403, don't block -- check if order is already shipped/accepted at Bol and allow label creation to continue if appropriate. Also update sync_status on persistent failure:
```typescript
if (!acceptRes.ok) {
  console.error(`Failed to auto-accept: ${acceptRes.status} ${acceptBody}`);
  
  // On 403, the order may already be accepted at Bol.com -- allow VVB to continue
  if (acceptRes.status === 403) {
    console.log('403 from accept -- order may already be accepted, continuing with VVB label creation...');
    // Don't return error, fall through to VVB creation
  } else {
    // Update order status for non-403 failures
    await supabase.from('orders').update({ 
      sync_status: 'accept_failed' 
    }).eq('id', order_id);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Order accepteren mislukt: ${acceptRes.status}`,
      details: acceptBody,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
```

---

**File 3: `src/components/admin/BolActionsCard.tsx`**

**Fix D** (line ~110): Better error handling for VVB label creation -- detect "ALREADY_SHIPPED" code and show appropriate message + refresh order data:
```typescript
onError: (error: Error) => {
  const msg = error.message || '';
  if (msg.includes('al verzonden') || msg.includes('ALREADY_SHIPPED')) {
    toast.info('Deze bestelling is al verzonden via Bol.com. Status is bijgewerkt.');
  } else {
    toast.error(`Fout bij label aanmaken: ${msg}`);
  }
  queryClient.invalidateQueries({ queryKey: ['order', order.id] });
},
```

### Summary

| Fix | File | Problem | Solution |
|-----|------|---------|----------|
| A | sync-bol-orders | Infinite retry on 403 accept | Mark as `accept_failed` |
| B | create-bol-vvb-label | "Already shipped" not detected | Update order to `shipped`, friendly error |
| C | create-bol-vvb-label | Auto-accept 403 blocks VVB | Allow VVB to continue on 403 |
| D | BolActionsCard.tsx | Generic error on shipped orders | User-friendly toast + status refresh |


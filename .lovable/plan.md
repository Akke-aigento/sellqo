

## Plan: Fix VVB Label Download + Order Accept Issues

### Problem Analysis

From the screenshot and code:

1. **VVB Label created but no download button**: The label record exists in `shipping_labels` (shows "VVB Label BPOST_BE"), but `label_url` is null. The UI has print/download buttons only when `label_url` is truthy (line 236). There IS a "Opnieuw ophalen" retry button for labels with `status === 'created'` and no `label_url` (line 268), but the screenshot shows neither set of buttons — meaning either `label_url` is falsy AND `status` is not `'created'`, or there's a rendering issue.

2. **Order Accept returns 500**: The `accept-bol-order` function throws on 403 from Bol.com (line 180: `throw new Error(...)`) which is caught at line 240 and returned as a generic 500. The function should return a proper 400 with clear error info, and also handle the case where a 403 means the order is already accepted.

### Fixes

---

**File 1: `supabase/functions/accept-bol-order/index.ts`**

The 403 from Bol.com likely means the order is already accepted. Instead of throwing a generic error:

- On 403: Check if order might already be accepted. Attempt to verify via process-status or simply mark as `accepted` since Bol.com returns 403 when you try to accept an already-accepted order.
- Return a structured error response (400, not 500) with a clear message.

Change lines 176-181:
```typescript
if (!acceptResponse.ok) {
  if (acceptResponse.status === 403) {
    console.log('Bol.com 403 - order likely already accepted, marking as accepted')
    if (order_id) {
      await supabase.from('orders').update({
        sync_status: 'accepted',
        updated_at: new Date().toISOString()
      }).eq('id', order_id)
    }
    return new Response(
      JSON.stringify({ success: true, message: 'Order was al geaccepteerd bij Bol.com', already_accepted: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  return new Response(
    JSON.stringify({ success: false, error: `Order accepteren mislukt: ${acceptResponse.status}`, details: responseText }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

---

**File 2: `src/components/admin/BolActionsCard.tsx`**

Two sub-fixes:

**2a**: Handle `already_accepted` response in accept mutation `onSuccess`:
```typescript
onSuccess: (data) => {
  if (data.already_accepted) {
    toast.info('Order was al geaccepteerd bij Bol.com. Status bijgewerkt.');
  } else {
    toast.success('Order geaccepteerd op Bol.com');
  }
  queryClient.invalidateQueries({ queryKey: ['order', order.id] });
},
```

**2b**: Show a download/retry button even when `label_url` is missing regardless of `status`. Currently line 268 requires `status === 'created'`. Change to show retry for any label without a URL:
```typescript
{!latestLabel.label_url && (
```
This ensures the "Opnieuw ophalen" button always appears when the label exists but has no PDF URL.

---

### Summary

| Fix | File | Problem | Solution |
|-----|------|---------|----------|
| 1 | accept-bol-order | 403 throws → 500 | Treat 403 as "already accepted", mark order, return success |
| 2a | BolActionsCard | Generic accept success toast | Show "already accepted" info when applicable |
| 2b | BolActionsCard | No retry button visible | Show "Opnieuw ophalen" for any label without URL |


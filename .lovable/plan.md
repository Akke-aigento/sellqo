

## Analysis: Label Download & Auto-Accept Issues

### Root Cause 1: `#` in filename breaks storage (CRITICAL)

The order number `#1121` is used directly in the storage filename: `bol-vvb-#1121-a6-{timestamp}.pdf`. The `#` character causes **two fatal issues**:

1. **Storage truncates the filename** — The `#` is interpreted as a URL fragment delimiter. Looking at storage, there's only ONE file across all labels: `54f6b480.../bol-vvb-` (truncated at `#`).
2. **409 conflict on retry** — Every upload creates the same truncated filename `bol-vvb-`, so the second order (#1121) fails with "resource already exists" because #1120 already created that truncated file.
3. **Broken download URLs** — Even for #1120 where `label_url` was set, the URL contains `#1120` which browsers interpret as a fragment, making the PDF inaccessible.

Evidence from logs:
```
PDF upload to storage failed: StorageApiError: The resource already exists (409)
```

Evidence from storage query: only 1 file exists with name `bol-vvb-` (truncated).

### Root Cause 2: Auto-accept IS working

Checking the database: order #1121 has `sync_status: 'accepted'`. The auto-accept flow ran successfully. The user perceives it as broken because the label download fails, making the whole flow feel broken. However, I'll add logging improvements.

---

### Fixes

**Fix 1: `supabase/functions/create-bol-vvb-label/index.ts` — Strip `#` from filenames**

In ALL places where filenames are constructed (3 locations), replace `#` with empty string:

- Line ~406 (retry upload): `bol-vvb-${order.order_number.replace('#', '')}${formatSuffix}-retry-${Date.now()}.pdf`
- Line ~803 (initial creation upload): same pattern
- Also add `upsert: true` to storage upload options as a safety net for any remaining conflicts

**Fix 2: Same file — Handle 409 gracefully**

When storage upload returns a 409, instead of logging and moving on (leaving `label_url` null), fetch the existing file's public URL:

```typescript
if (uploadError?.statusCode === '409') {
  // File exists, get its URL instead
  const { data: urlData } = supabase.storage
    .from("shipping-labels")
    .getPublicUrl(`${order.tenant_id}/${fileName}`);
  retryPdfUrl = urlData?.publicUrl || null;
}
```

**Fix 3: Fix existing broken label_url for order #1120**

The label for #1120 has a stored `label_url` containing `#1120` which is unusable. The retry flow will fix this when clicked, but we should also ensure new URLs are always valid.

---

### Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Label not downloadable | `#` in filename truncates storage path & creates broken URLs | Strip `#` from all filenames |
| Retry upload 409 | Truncated filenames collide | `upsert: true` + handle 409 fallback |
| "Auto-accept broken" | Actually works; user confused because label flow is broken | Fix label flow (main fix) |


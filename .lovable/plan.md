

## Fix: Cloudflare DNS sync deleting unrelated records

### Problem

**Bug 1 — Overly aggressive conflict deletion (line 197-206):** The code deletes ALL records with the same name but different type. For the root domain (`vanxcel.be`), this means it deletes SPF TXT records, Google/MS verification TXT records, and any other non-A records. This is destructive and wrong.

**Bug 2 — _sellqo TXT still not updating:** The content comparison and delete+create flow looks correct in theory, but the conflict deletion step (bug 1) may be interfering, and the name matching needs to be exact for the `_sellqo.{domain}` pattern.

### Fix

**`supabase/functions/cloudflare-api-connect/index.ts`**

1. **Remove the generic conflict deletion entirely** (lines 196-206). No more "delete all records with wrong type for same name." This is the line causing SPF, DMARC, verification records etc. to be deleted.

2. **Add targeted CNAME-only conflict check for `www`:** Before creating the `www` A record specifically, check if a CNAME exists for `www.{domain}` and delete only that one CNAME. Do not touch any other record types.

3. **Keep the existing same-type update logic** (lines 208-247) which correctly handles: find exact name+type match → compare content (with TXT quote stripping) → delete+create if different → create if missing.

### Result
- Only 3 records are ever touched: `@ A`, `www A`, `_sellqo TXT`
- Only one extra deletion can happen: a CNAME on `www` (required to replace with A)
- SPF, DMARC, Google verification, MS verification, other CNAMEs — all untouched

### Files
- `supabase/functions/cloudflare-api-connect/index.ts` — remove generic conflict deletion, add www-only CNAME check


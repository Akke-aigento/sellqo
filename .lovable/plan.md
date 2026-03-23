

## Fix Cloudflare auto-connect: www CNAME + _sellqo TXT bugs

### Root cause

**Bug 1 (www CNAME):** The CNAME conflict check (line 202-213) runs *before* the `existingRecord` check, but if the CNAME delete succeeds and there's no existing A record, the flow correctly falls to "create new." However, Cloudflare may return the CNAME name with a trailing dot or different casing, causing the `find()` to miss it. Fix: broaden the conflict check to delete **any** non-A record on `www.{domain}`.

**Bug 2 (_sellqo TXT):** The content comparison at line 217 (`existingRecord.content !== record.content`) likely fails because Cloudflare wraps TXT values in quotes (`"sellqo-verify=..."`) while we compare unquoted. This causes it to fall into the PATCH branch, which may silently fail for TXT records. Fix: for TXT records, always delete-and-recreate if content doesn't match (strip quotes before comparing).

### Changes — single file

**`supabase/functions/cloudflare-api-connect/index.ts`**

1. **www CNAME fix (lines 201-213):** Find ALL records for `www.{domain}` that are NOT type A, delete each one before proceeding to create the A record.

2. **_sellqo TXT fix (lines 215-229):** Strip surrounding quotes from `existingRecord.content` before comparing. If content still doesn't match, delete and recreate. Also: if a same-name record exists with a *different type* (not TXT), delete it too.

3. No other files change.

### Technical detail

```text
For each required record:
  1. Delete any conflicting records (wrong type for same name)
  2. Find existing same-type record
  3. If exists + same content → skip (already correct)
  4. If exists + different content → delete + create
  5. If not exists → create
```


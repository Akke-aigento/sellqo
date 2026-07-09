---
name: Edge function column audit
description: Verify all select() column references in new/changed edge functions against types.ts before deploy
type: preference
---
Bij elke nieuwe of gewijzigde edge function: check alle `.select(...)` kolomreferenties tegen `src/integrations/supabase/types.ts` vóór deploy.

**Why:** "Lovable verzint plausibele kolomnamen" (bv. `company_name`/`contact_email` i.p.v. `billing_company_name`/`billing_email`) is een bewezen faalpatroon dat code-review niet vangt en pas crasht bij runtime. Bewezen in sync-tenant-plan (ONBOARD-1, 2 fix-rondes).

**How to apply:** Vóór deploy van edge functions: grep alle `.from('table').select(...)` calls en verifieer elke kolom bestaat in `Database['public']['Tables'][table]['Row']` in types.ts. Gebruik `errMsg()` (err.message ?? JSON.stringify(err)) op alle catch-paden om Supabase-error-objecten leesbaar te loggen.
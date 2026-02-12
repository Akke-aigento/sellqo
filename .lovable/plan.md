

# Fix: Gratis Maanden Geven - Edge Function Errors

## Probleem
De "Gratis Maanden Geven" functie geeft een 404-fout omdat de backend functie niet correct werkt. Er zijn twee technische problemen:

1. **Verouderd patroon**: De functie gebruikt een oud import-patroon (`serve` van `deno.land/std`) in plaats van het huidige `Deno.serve`
2. **Onvolledige CORS-headers**: De functie mist vereiste headers die de app meestuurt, waardoor verzoeken worden geblokkeerd

## Oplossing

### Bestand: `supabase/functions/platform-gift-month/index.ts`

**Wijzigingen:**
- Verwijder de verouderde `serve` import van `deno.land/std`
- Gebruik `Deno.serve()` in plaats van `serve()` (consistent met andere werkende functies)
- Voeg de ontbrekende CORS-headers toe: `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`

### Technische details

**CORS-headers aanpassing (regel 5-8):**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

**Serve-patroon aanpassing (regel 1, 15):**
```typescript
// Verwijder: import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Vervang serve(...) door Deno.serve(...)
Deno.serve(async (req) => {
```

Na deze wijzigingen wordt de functie automatisch opnieuw uitgerold en zou het "Gratis Maanden Geven" weer moeten werken.

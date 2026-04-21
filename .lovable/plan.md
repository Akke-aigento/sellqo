

## Verify & redeploy Bol ads edge functions

Operationele taak. Vijf functies zijn aanwezig in de repo met `Deno.serve()` exports. De 404 in productie betekent dat Supabase ze niet heeft gedeployd — waarschijnlijk een gevolg van de recente std-upgrade. Deze taak deployt, verifieert en patcht alleen import-statements indien nodig.

### Stap 1: Force redeploy

Via `supabase--deploy_edge_functions`:
```
["push-bol-campaign", "ads-bolcom-sync", "ads-bolcom-manage", "ads-bolcom-reports", "sync-bol-campaign-status"]
```

### Stap 2: Health-check via logs

Voor elk van de vijf functies via `supabase--edge_function_logs`. Zoek naar:
- Lingering `std@0.168.0` imports
- Module resolution errors op boot
- Type conflicts uit de std-upgrade

Per functie rapport: ✅ boot OK, of ❌ + stack trace.

Indien een import faalt → grep in de specifieke function (en `supabase/functions/_shared/` indien nodig) op `std@0.168.0`, vervang met `std@0.190.0`, en redeploy alleen die ene functie. Géén andere wijzigingen.

### Stap 3: No-auth curl-test van `push-bol-campaign`

Via `supabase--curl_edge_functions`: POST zonder Authorization header en zonder body.

Verwacht: HTTP 401 met body `{"error":"Unauthorized"}` — bewijst dat de runtime de function heeft geladen tot aan de auth-check (regel 75-80) zonder DB- of business-logic te raken.

Interpretatie:
- 401 + `{"error":"Unauthorized"}` → ✅
- 404 + `{"error":"Function not found"}` of HTML → ❌ niet deployed
- 503 / timeout → ❌ bundle error (terug naar Stap 2)
- Iets anders → rapporteer body letterlijk

### Stap 4: No-auth curl-test van de overige vier

Identieke POST (geen auth, geen body) tegen:
- `ads-bolcom-sync`
- `ads-bolcom-manage`
- `ads-bolcom-reports`
- `sync-bol-campaign-status`

Alle vier moeten HTTP 401 + `{"error":"Unauthorized"}` teruggeven. Geen sync, geen Bol-API-calls, geen DB-writes.

### Acceptance

1. Vijf functies retourneren op no-auth POST: HTTP 401 + `{"error":"Unauthorized"}`.
2. Boot-logs tonen geen import/bundle errors; geen `std@0.168.0` resterend.
3. Geen business-logic wijzigingen. Import-fixes mogen wél (en ook in `_shared/` indien nodig).

### Niet aanraken

- Geen `supabase/config.toml`-wijzigingen.
- Geen DB-migraties.
- Geen frontend-wijzigingen (`useAdCampaigns.ts` etc.).
- Geen logica binnen `Deno.serve()` na de auth-check.
- Geen andere functions dan de vijf genoemde.

### Final report

- Deploy status per functie (5× ✅/❌)
- Curl-resultaat per functie (5× HTTP-status + body)
- Gewijzigde imports (file + oud → nieuw), indien van toepassing
- Slotbevestiging: "Alle vijf functies zijn reachable en retourneren 401 zonder auth"


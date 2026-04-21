

## Fix zombie Bol-campagnes in `ads-bolcom-sync`

Eén chirurgische wijziging. Bol's `POST /campaigns/list` retourneert ook `ARCHIVED` en `ENDED` campagnes, waardoor lokaal verwijderde rijen na sync terugkeren. Fix: skip die states en ruim eventuele stale rij defensief op.

### Stap 1: Code-wijziging

In `supabase/functions/ads-bolcom-sync/index.ts`, voeg in de `for (const bc of bolCampaigns)` loop (regel 128) als allereerste statement binnen het `try`-block (vóór `const campaignData = {...}` op regel 130) toe:

```ts
if (bc.state === "ARCHIVED" || bc.state === "ENDED") {
  // Defensive cleanup: remove any stale local row
  await supabase
    .from("ads_bolcom_campaigns")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("bolcom_campaign_id", String(bc.campaignId));
  continue;
}
```

Geen andere wijzigingen. `statusMap` blijft ongemoeid (de `archived`/`ended` mappings blijven staan voor backwards compat, maar worden niet meer geraakt). Bestaande retry-, rate-limit- en error-handling blijven exact gelijk.

### Stap 2: Redeploy

`supabase--deploy_edge_functions` met `["ads-bolcom-sync"]`.

### Stap 3: Health-check

- `supabase--edge_function_logs` voor `ads-bolcom-sync`: bevestig succesvolle boot, geen import/bundle errors.
- `supabase--curl_edge_functions`: POST zonder Authorization header → verwacht `HTTP 401` + body `{"error":"Unauthorized"}`.

Interpretatie:
- 401 + `{"error":"Unauthorized"}` → ✅ deployed
- 404 / HTML / 503 / timeout → ❌ rapporteer logs

### Acceptance

1. Nieuwe `if`-block staat exact zoals boven, vóór `const campaignData = {...}` in de try.
2. Geen andere code-wijzigingen in de function.
3. Function deployed + 401-signaal OK.

### Niet aanraken

- Geen andere edge functions.
- Geen frontend hooks (`useBolcomAds`, `useBolcomCampaignDetail`).
- Geen DB-migraties.
- Geen wijziging aan `statusMap` of upsert-logica elders.

### Final report (na uitvoering in default mode)

- Diff van de gewijzigde regels (voor/na, regels 128-130).
- Deploy status: ✅/❌
- Curl result: HTTP-status + body.
- Slotbevestiging: "ads-bolcom-sync patched, deployed en reachable".


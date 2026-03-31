

## Fix: push-bol-campaign — Bulk Payloads voor Bol v11 API

### Probleem
De Bol Advertising API v11 verwacht bulk arrays (`{ campaigns: [...] }`, `{ adGroups: [...] }`, `{ ads: [...] }`), maar de code stuurt enkelvoudige objecten. Dit veroorzaakt 500 errors.

### Wijzigingen (alleen `supabase/functions/push-bol-campaign/index.ts`)

**1. `bolApi()` helper — betere logging**
- Log request method, URL, body vóór de fetch
- Log response status + body na de fetch

**2. Campaign payload (regel 214-243)**
- Voeg `targetCountries: ["NL", "BE"]` en `targetChannels: ["DESKTOP", "MOBILE", "TABLET", "APP"]` toe
- Wrap in `{ campaigns: [singleCampaign] }` bulk format
- Response parsing: check `campaigns.success[0].campaignId` eerst
- Failure checking: als `campaigns.failure` niet leeg is, return 400 met details

**3. Ad group payload (regel 281-302)**
- Verwijder `targetPages` (geen geldig v11 veld)
- Wrap in `{ adGroups: [{ campaignId, name, state }] }` bulk format
- Response parsing: check `adGroups.success[0].adGroupId` eerst

**4. Ads payload (regel 309-324)**
- Vervang de per-EAN loop door één bulk call: `{ ads: eans.map(ean => ({ adGroupId, ean, state: "ENABLED" })) }`

### Geen andere bestanden worden aangeraakt


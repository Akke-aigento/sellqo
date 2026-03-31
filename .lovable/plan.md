

## Fix: Bol.com Advertising API — Verkeerde URL, Methode en Headers

### Root cause (bevestigd via officiële Bol API docs)

De edge function faalt met **403 Unauthorized** omdat alles fout is aan de API calls:

| Wat | Nu (FOUT) | Moet zijn (officiële docs) |
|---|---|---|
| Base URL | `https://api.bol.com/retailer/advertising/v11` | `https://api.bol.com/advertiser/sponsored-products/campaign-management` |
| Campagne aanmaken | `PUT /sponsored-products/campaigns` | `POST /campaigns` |
| Ad group aanmaken | `PUT /sponsored-products/ad-groups` | `POST /ad-groups` |
| Ads aanmaken | `PUT /sponsored-products/ads` | `POST /ads` |
| Accept header | `application/vnd.retailer.v11+json` | `application/json` |
| Content-Type | `application/vnd.retailer.v11+json` | `application/json` |

De `vnd.retailer` headers zijn voor de Retailer API, niet de Advertising API. Daarom geeft Bol 403 terug.

### Aanpak

**Bestand: `supabase/functions/push-bol-campaign/index.ts`**

1. **Base URL** wijzigen naar `https://api.bol.com/advertiser/sponsored-products/campaign-management`
2. **Headers** in `bolApi()` wijzigen naar `application/json`
3. **HTTP methodes** wijzigen:
   - Campagne: `POST /campaigns` (was `PUT /sponsored-products/campaigns`)
   - Ad group: `POST /ad-groups` (was `PUT /sponsored-products/ad-groups`)
   - Ads: `POST /ads` (was `PUT /sponsored-products/ads`)
4. **Response parsing** aanpassen: Bol retourneert nu 207 Multi-Status met `success[]` en `error[]` arrays
   - Campaign ID zit in `response.campaigns.success[0].campaignId`
   - Ad group ID in `response.adGroups.success[0].adGroupId`
5. **Ad group payload** aanpassen: `targetPages` toevoegen (`["SEARCH", "PRODUCT", "CATEGORY"]`)

**Bestand: `supabase/functions/sync-bol-campaign-status/index.ts`**

Zelfde URL/header fixes + campagnes ophalen via `POST /campaigns/list` met filter body.

### Geen migraties nodig
Alleen edge function code wijzigingen.


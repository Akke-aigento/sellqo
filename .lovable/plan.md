

## Bol.com Ads: Campagnes daadwerkelijk naar Bol pushen

### Huidige situatie
De wizard slaat campagnes alleen op in de lokale `ad_campaigns` tabel. Er wordt **geen API call** gedaan naar Bol.com. Daarom verschijnt de campagne niet in Bol Adverteren.

### Wat er nodig is

**1. Edge function `push-bol-campaign`**

Nieuwe edge function die:
- De campagne + gekoppelde producten ophaalt uit de database
- De Bol.com Advertising API aanroept om een Sponsored Products campagne aan te maken
- De `platform_campaign_id` en `platform_status` terugschrijft naar `ad_campaigns`
- EAN-nummers van de geselecteerde producten meestuurt (Bol vereist EANs)

Bol.com Advertising API endpoints:
- `POST /retailer/advertising/sponsored-products/campaigns` — campagne aanmaken
- `POST /retailer/advertising/sponsored-products/campaigns/{id}/product-targets` — producten toevoegen
- Budget en bid strategy instellen

**2. Authenticatie**

De Bol Advertising API gebruikt **aparte** client credentials (`advertisingClientId` / `advertisingClientSecret`), die al worden opgeslagen in de marketplace connection credentials. De edge function moet:
- De marketplace connection ophalen voor de tenant
- Met de advertising credentials een OAuth token aanvragen bij `https://login.bol.com/token`
- Dit token gebruiken voor de API calls

**3. Frontend aanpassing**

In `useAdCampaigns.ts` → `createCampaign`:
- Na succesvolle lokale insert, de edge function `push-bol-campaign` aanroepen
- Status op `pending_approval` zetten (Bol reviewt campagnes)
- Bij succes: `platform_campaign_id` opslaan
- Bij fout: gebruiker informeren, campagne blijft als `draft`

**4. Campagne status sync**

Aparte edge function `sync-bol-campaign-status` die periodiek of on-demand:
- Alle actieve Bol-campagnes ophaalt
- Status (active/paused/rejected), impressies, clicks, spend, conversies bijwerkt
- Dit kan later aan de scheduler worden toegevoegd

### Beperkingen / aandachtspunten

- Bol.com Advertising API is **niet publiek gedocumenteerd** op dezelfde manier als de Retailer API. De exacte endpoints en payloads moeten geverifieerd worden tegen hun API docs.
- Producten moeten een **EAN** hebben om als target toegevoegd te worden.
- Bol reviewt campagnes — status gaat niet direct naar `active`.

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/push-bol-campaign/index.ts` | **Nieuw**: campagne + producten naar Bol Advertising API pushen |
| `supabase/functions/sync-bol-campaign-status/index.ts` | **Nieuw**: campagnestatus en stats ophalen van Bol |
| `src/hooks/useAdCampaigns.ts` | Na create/update de push-functie aanroepen |
| `src/components/admin/ads/CampaignCard.tsx` | `platform_status` en `platform_campaign_id` tonen |

### Openstaande vraag

Ik moet de exacte Bol.com Advertising API documentatie raadplegen om de juiste endpoints en payloads te gebruiken. Heb je toegang tot hun API docs, of wil je dat ik het opzoek?


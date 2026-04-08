

## Bol.com campagne verwijderen toevoegen

### Probleem
Er is geen verwijder-optie voor Bol.com campagnes. Je kunt alleen pauzeren/hervatten. Een verwijderknop is nodig.

### Aanpak
De Bol.com Advertiser API ondersteunt geen DELETE voor campagnes — je kunt ze alleen pauzeren. Daarom: we voegen een "Verwijderen" actie toe die de campagne **lokaal** verwijdert uit de database (en optioneel eerst pauzeert op Bol.com als hij actief is). Dit houdt je dashboard schoon.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `supabase/functions/ads-bolcom-manage/index.ts` | Nieuwe `delete_campaign` action toevoegen |
| `src/hooks/useBolcomCampaignDetail.ts` | `deleteCampaign` mutation toevoegen |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | Verwijder-knop + bevestigingsdialog toevoegen |

### Detail

**1. Edge Function — `delete_campaign` action**
- Pauzeert campagne eerst op Bol.com (als `bolcom_campaign_id` bestaat en status active)
- Verwijdert gerelateerde keywords, adgroups, performance data en campagne uit DB
- Cascade: `ads_bolcom_keywords` → `ads_bolcom_adgroups` → `ads_bolcom_performance` → `ads_bolcom_campaigns`

**2. Hook — deleteCampaign mutation**
- Roept edge function aan met `action: 'delete_campaign'`
- Bij succes: navigeert terug naar `/admin/ads/bolcom`
- Invalidateert queries

**3. UI — Verwijder-knop met bevestiging**
- Rode `Trash2` knop naast de bestaande knoppen
- AlertDialog bevestiging: "Weet je zeker dat je deze campagne wilt verwijderen? De campagne wordt gepauzeerd op Bol.com en lokaal verwijderd."
- Na bevestiging: uitvoeren + redirect naar overzicht

### Geen database migraties nodig
De deletes worden via de edge function gedaan met service-level access (of user-level als RLS het toelaat).




## Fix: Campagne archiveren op Bol.com vóór lokaal verwijderen

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/hooks/useAdCampaigns.ts` | deleteCampaign: eerst platform check + archive call, dan lokale delete |
| `supabase/functions/push-bol-campaign/index.ts` | `action` parameter parsen, archive-blok toevoegen vóór stap 4 |

### Detail

**1. `useAdCampaigns.ts` (regel 174-182)**
Vervang de simpele delete door: eerst campaign ophalen (platform + platform_campaign_id), dan bij `bol_ads` + bestaande `platform_campaign_id` de edge function aanroepen met `action: 'archive'`, daarna lokaal verwijderen. Archive-fouten worden gelogd maar blokkeren de lokale delete niet.

**2. `push-bol-campaign/index.ts`**
- Regel 96: `action` toevoegen aan destructuring
- Na regel 181 (bolToken verkregen), vóór regel 182 (stap 4): archive-blok invoegen dat bij `action === 'archive'` een PUT doet naar `/campaigns/{id}` met `{ state: "ARCHIVED" }` en direct returnt

### Geen database wijzigingen nodig


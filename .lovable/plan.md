

## Fix: Negatieve keywords, push-naar-Bol knop & AI analyse zonder data

### Drie problemen

1. **Negatieve keywords toevoegen werkt niet** — De "Toevoegen" knop is `disabled={!firstAdGroupId}` (regel 320). Als er geen ad groups zijn (wat het geval is voor deze campagne), is de knop altijd disabled. Het probleem is dat negatieve keywords aan een ad group moeten hangen, maar als er geen ad groups bestaan kan dat niet.

2. **Geen "Push naar Bol" knop na bewerken** — Na het opslaan van wijzigingen in het bewerkformulier is er geen manier om die wijzigingen door te pushen naar Bol.com. Er moet een "Synchroniseer naar Bol.com" knop komen.

3. **AI analyse draait zonder data en toont geen suggesties** — De edge function stuurt altijd een request naar de AI, ook als er 0 keywords en 0 performance data is. De AI hallucineer dan suggesties. Bovendien slaat de functie suggesties op in de DB maar de query in de UI filtert niet op `campaign_id` — dus suggesties van álle campagnes worden getoond (of juist niet als er geen match is).

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `supabase/functions/ads-campaign-analyze/index.ts` | Early return als er geen keywords EN geen performance data is |
| `src/components/admin/ads/CampaignAIAnalysis.tsx` | Query filteren op campaign_id; suggesties inline tonen na analyse (niet alleen uit DB) |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | "Synchroniseer naar Bol.com" knop toevoegen in header; negatieve keywords knop ook werken als er geen ad groups zijn (lokaal opslaan) |
| `src/components/admin/ads/BolCampaignEditForm.tsx` | Negatieve keywords sectie toevoegen met add/remove |

### Detail

**1. `ads-campaign-analyze/index.ts`**
- Na het ophalen van data: check `keywords.length === 0 && performance.length === 0`
- Als true: return `{ suggestions: [], count: 0, message: "Geen data beschikbaar om te analyseren" }` (status 200)
- Voeg `campaign_id` toe aan elk record dat wordt opgeslagen in `ads_ai_recommendations`

**2. `CampaignAIAnalysis.tsx`**
- Query filteren: `.eq('entity_id', ...)` werkt niet goed hier — voeg een custom filter toe op basis van campaign gerelateerde entity IDs, OF sla `campaign_id` op in de recommendation records (beter)
- Na het analyseren: gebruik de direct teruggekomen `suggestions` uit de response om ze inline te tonen (state), zodat ze meteen zichtbaar zijn zonder DB-roundtrip
- Bij "Geen data" message van edge function: toon info-bericht i.p.v. "X suggesties gegenereerd"

**3. `AdsBolcomCampaignDetail.tsx`**
- Header: nieuwe knop "Synchroniseer naar Bol.com" die `push-bol-campaign` aanroept met `force_repush: true`
- Met loading state en progress toasts (zelfde pattern als CampaignCard)
- Negatieve keywords "Toevoegen" knop: als er geen ad groups zijn, toon een info-tekst "Voeg eerst producten toe aan de campagne" i.p.v. een disabled knop

**4. `BolCampaignEditForm.tsx`**
- Voeg een sectie "Negatieve Keywords" toe onderaan met:
  - Lijst van huidige negatieve keywords (uit props of via eigen query)
  - Input + match type selector + "Toevoegen" knop
  - Roept `addNegativeKeyword` aan (via props callback of directe supabase.functions.invoke)

### Database
- Voeg `campaign_id` kolom toe aan `ads_ai_recommendations` records bij insert (als het veld bestaat), of sla het op in een metadata/context veld — check eerst of de kolom bestaat

### Geen database migraties nodig
De `ads_ai_recommendations` tabel heeft al voldoende velden; we gebruiken bestaande kolommen of slaan campaign_id op als context.


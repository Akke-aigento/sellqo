

## Bol.com Advertising: AUTO/MANUAL keuze + re-push + error handling

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/ads/CampaignWizard.tsx` | `bid_strategy` toevoegen aan state, AUTO/MANUAL radio in budget stap, meesturen bij submit, tonen in review |
| `src/components/admin/ads/CampaignCard.tsx` | "Producten opnieuw pushen" menu-item + handler met `force_repush: true` |
| `supabase/functions/push-bol-campaign/index.ts` | `force_repush` parameter, skip campaign creation bij repush, error responses bij ad group/ads failures |

### Detail per bestand

**1. CampaignWizard.tsx**
- Import `BidStrategy` type
- Voeg `bid_strategy: 'auto' as BidStrategy` toe aan formData state
- In budget stap: Bol-specifieke RadioGroup met AUTO (aanbevolen) en MANUAL opties, boven het Budget Type select
- `handleSubmit`: stuur `bid_strategy` mee bij `createCampaign.mutateAsync`
- Review stap: toon "Campagne modus" rij voor Bol campagnes
- Edit mode useEffect: laad `bid_strategy` uit campaign

**2. CampaignCard.tsx**
- `handleRepushToBol` functie: roept `push-bol-campaign` aan met `force_repush: true`
- Nieuw DropdownMenuItem "Producten opnieuw pushen" voor Bol campagnes die al een `platform_campaign_id` hebben

**3. push-bol-campaign/index.ts**
- Parse `force_repush` uit request body
- "Already pushed" check: skip alleen als `!force_repush`
- Bij `force_repush`: gebruik bestaande `platform_campaign_id`, skip campaign creation (stap 5)
- Ad group/ads catch blocks: return 500 error response i.p.v. stil falen

### Geen database wijzigingen nodig


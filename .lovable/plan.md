

## Bewerken: Inline bewerkingsformulier i.p.v. wizard

### Probleem
De "Bewerken" knop opent nu de volledige CampaignWizard met stappen — je moet door 5 schermen klikken terwijl alle data al bekend is. Bij bewerken wil je gewoon één overzichtelijk formulier met alle huidige waarden die je direct kunt aanpassen.

### Oplossing
Vervang de CampaignWizard in de edit-dialog door een nieuw `BolCampaignEditForm` component — één enkel formulier met alle velden zichtbaar, pre-filled met de huidige campagne-data.

### Nieuw component: `src/components/admin/ads/BolCampaignEditForm.tsx`

Eén formulier in een Dialog met secties:

**Sectie 1 — Algemeen**
- Campagnenaam (Input, pre-filled)
- Campagne modus: AUTO/MANUAL (RadioGroup, pre-filled uit `targeting_type`)
- Status badge (read-only)

**Sectie 2 — Budget**
- Dagbudget (Input number, pre-filled)
- Totaalbudget (Input number, optioneel, pre-filled)
- Doel-ROAS (Slider, pre-filled als beschikbaar)

**Sectie 3 — Planning**
- Startdatum (Input date, pre-filled)
- Einddatum (Input date, optioneel, pre-filled)

**Onderaan**: "Opslaan" + "Annuleren" knoppen

Bij opslaan: `updateCampaign.mutateAsync` aanroepen met de gewijzigde velden, dan dialog sluiten en data invalidaten.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/ads/BolCampaignEditForm.tsx` | Nieuw — single-page edit formulier |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | `CampaignWizard` import vervangen door `BolCampaignEditForm`, campaign data direct doorgeven (geen adapter meer nodig) |

### Detail

**BolCampaignEditForm.tsx**
- Props: `campaign` (de Bol campaign data uit `useBolcomCampaignDetail`), `onClose`, `onSaved`
- Lokale state voor elk veld, geïnitialiseerd vanuit campaign
- Gebruikt `useAdCampaigns().updateCampaign` of directe supabase update op `ads_bolcom_campaigns`
- Alle velden in één scroll-vrij formulier met duidelijke labels

**AdsBolcomCampaignDetail.tsx**
- Verwijder `CampaignWizard` import en `campaignForWizard` useMemo adapter
- Import `BolCampaignEditForm`
- Dialog content: `<BolCampaignEditForm campaign={campaign} onClose={() => setShowEdit(false)} />`

### Geen database wijzigingen nodig


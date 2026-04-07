

## Ads module volledig functioneel maken

### Problemen gevonden

1. **404 bij "Verbind je marketplace account"** — Link gaat naar `/admin/marketplace` maar de route is `/admin/connect`
2. **"Nieuwe campagne" knop is disabled** — Op de BolAds pagina staat `<Button disabled>` hardcoded
3. **"Bewerken" knop is disabled** — Op de campaign detail pagina staat `<Button disabled>` hardcoded
4. **Geen CampaignWizard integratie** — De wizard bestaat en werkt (met AUTO/MANUAL keuze), maar wordt nergens gebruikt vanuit de Bol.com pagina's
5. **Edit mode ontbreekt in campaign detail** — De "Bewerken" knop doet niets

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Ads.tsx` | Fix link: `/admin/marketplace` → `/admin/connect` |
| `src/pages/admin/AdsBolcom.tsx` | "Nieuwe campagne" knop activeren met CampaignWizard in een Dialog |
| `src/pages/admin/AdsBolcomCampaignDetail.tsx` | "Bewerken" knop activeren met CampaignWizard in edit mode via Dialog |

### Detail

**Ads.tsx** — Eenvoudige link fix (regel 87): `/admin/marketplace` → `/admin/connect`

**AdsBolcom.tsx**
- Import `CampaignWizard` en `Dialog`/`DialogContent`
- State toevoegen: `showWizard` (boolean)
- "Nieuwe campagne" knop: verwijder `disabled`, voeg `onClick={() => setShowWizard(true)}` toe
- Dialog met `CampaignWizard` renderen met `onClose={() => setShowWizard(false)}`

**AdsBolcomCampaignDetail.tsx**
- Import `CampaignWizard`, `Dialog`/`DialogContent` en `useAdCampaigns`
- State toevoegen: `showEdit` (boolean)
- De lokale `campaign` data uit `useBolcomCampaignDetail` bevat niet alle velden die CampaignWizard verwacht (het is Bol-specifiek met velden als `daily_budget`, `targeting_type`)
- Maak een adapter die de Bol campaign data mapt naar een `AdCampaign`-achtig object voor de wizard
- "Bewerken" knop: verwijder `disabled`, voeg `onClick={() => setShowEdit(true)}` toe
- Dialog met CampaignWizard in edit mode renderen

### Geen database wijzigingen nodig


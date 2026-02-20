
# Dashboard Layout Opschonen: Geen Whitespace Meer

## Probleem

Het dashboard heeft te veel whitespace en de widgets sluiten niet harmonisch op elkaar aan:
- De 3-kolom grid (`gap-6`) met widgets van verschillende breedtes (full, lg, md) laat grote lege vlakken achter
- De Health Categories widget (lg = 2 kolommen) en Today widget (md = 1 kolom) staan op dezelfde rij, maar de volgende rij (Health Actions + Quick Actions) heeft ongelijke hoogtes
- POS en Marketplace widgets staan met veel ruimte ertussen
- De `space-y-6` in DashboardGrid.tsx en `gap-6` in de grid zorgen voor te veel ademruimte

## Oplossing

Een strakke, harmonische layout door:

1. **Kleinere gaps**: `gap-6` naar `gap-4` in de widget grid, `space-y-6` naar `space-y-4` in de container
2. **Alle widgets dezelfde hoogte per rij** via `h-full` op alle Card-componenten
3. **Betere size-verdeling**: Health Actions en Quick Actions worden `sm` (1 kolom) zodat er 3 per rij passen, minder lege ruimte
4. **Header compacter**: minder padding tussen titel en widgets

## Technische wijzigingen

### 1. `src/components/admin/DashboardGrid.tsx`
- `space-y-6` wordt `space-y-4` (container)
- `gap-6` wordt `gap-4` (widget grid)
- Header spacing verkleinen: `gap-4` naar `gap-2`

### 2. `src/config/dashboardWidgets.ts`
- Widget sizes herindelen voor een betere 3-kolom fit:
  - `health-banner`: `full` (blijft, volle breedte)
  - `health-categories`: `lg` (2 kolommen, blijft)
  - `health-actions`: `md` (1 kolom, past naast categories)
  - `today-widget`: `md` (1 kolom)
  - `quick-actions`: `md` (1 kolom)
  - `ai-marketing`: `md` (1 kolom)
  - `pos-overview`: `md` (1 kolom)
  - `marketplace`: `md` (1 kolom, was `lg` -- past nu beter)
  - `badges`: `full` (volle breedte)

Door marketplace van `lg` naar `md` te maken, passen POS + Marketplace + Quick Actions netjes op 1 rij (3 kolommen).

### 3. Widget componenten met `h-full`
De volgende widgets krijgen `h-full` op hun root Card zodat ze per rij dezelfde hoogte hebben:
- `QuickActionsWidget.tsx`: `<Card>` wordt `<Card className="h-full">`
- `DashboardPOSWidget.tsx`: alle `<Card>` elementen krijgen `h-full`
- `DashboardMarketplaceWidget.tsx`: alle `<Card>` elementen krijgen `h-full`
- `HealthActionsWidget.tsx`: de HealthActionList wrapper krijgt een Card met `h-full`

### 4. `src/components/admin/DashboardWidgetWrapper.tsx`
- De wrapper div krijgt `h-full` zodat de widget-inhoud de volledige rij-hoogte benut

### Verwacht resultaat

```text
Rij 1: [========= Health Banner (full) ==========]
Rij 2: [=== Health Categories (lg) ===] [Actions]
Rij 3: [  Today  ] [ POS Overview ] [ Marketplace ]
Rij 4: [Quick Act.] [AI Marketing] [  (leeg/vult) ]
Rij 5: [========= Badges (full) =================]
```

Elke rij is compact, widgets hebben gelijke hoogte, en de gaps zijn kleiner -- alles sluit harmonisch aan.

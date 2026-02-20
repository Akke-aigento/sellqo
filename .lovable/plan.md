
# Dashboard Tweaks: Grotere Actie-items + Uniforme Onderkant

## Twee verbeteringen

### 1. Actie-items kaart vergroten

De tekst in de actie-items wordt nu afgekapt met `line-clamp-1` en `line-clamp-2`. Dit maakt de kaart onleesbaar. We verwijderen de line-clamp beperkingen zodat de volledige titel en beschrijving zichtbaar zijn.

### 2. Laatste rij widgets laten groeien tot aan badges

CSS columns kan dit niet -- het verdeelt widgets automatisch zonder controle over individuele hoogtes. De oplossing: overschakelen naar een **handmatige flexbox-kolom layout**. Hierbij verdelen we de widgets zelf over 3 kolommen en geven de laatste widget in elke kolom `flex-grow: 1` zodat alle kolommen dezelfde hoogte hebben.

## Technische aanpak

### `src/components/shop-health/HealthActionList.tsx`
- Verwijder `line-clamp-1` van de titel (regel 65)
- Verwijder `line-clamp-2` van de beschrijving (regel 66)
- De kaart toont nu alle content volledig

### `src/components/admin/DashboardGrid.tsx`
Vervang de CSS `columns-1 md:columns-2 lg:columns-3` layout door een handmatige kolom-verdeling met flexbox:

- Bereken het aantal kolommen op basis van een responsive breakpoint (1 kolom mobile, 2 tablet, 3 desktop)
- Verdeel de `columnWidgets` array round-robin over de kolommen
- Render elke kolom als een `flex flex-col gap-4` container
- De laatste widget in elke kolom krijgt `flex-grow: 1` via een `isLastInColumn` prop

```text
Voorbeeld (3 kolommen, 7 widgets):
Kolom 1: [widget 0] [widget 3] [widget 6 -- groeit]
Kolom 2: [widget 1] [widget 4] -- groeit
Kolom 3: [widget 2] [widget 5] -- groeit

Alle kolommen eindigen op dezelfde hoogte!
```

### `src/components/admin/DashboardWidgetWrapper.tsx`
- Voeg een `isLastInColumn` prop toe
- Wanneer `isLastInColumn` true is, voeg `flex-grow` toe aan de wrapper
- Voeg ook `[&>div]:h-full` toe zodat de child Card meegroeit
- Verwijder `break-inside-avoid` (niet meer nodig met flexbox)

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/shop-health/HealthActionList.tsx` | Verwijder `line-clamp-1` en `line-clamp-2` |
| `src/components/admin/DashboardGrid.tsx` | CSS columns vervangen door handmatige flexbox-kolommen met round-robin verdeling |
| `src/components/admin/DashboardWidgetWrapper.tsx` | `isLastInColumn` prop toevoegen voor flex-grow gedrag |

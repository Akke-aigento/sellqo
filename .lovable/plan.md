
# Mood Presets Horizontaal Scrollbaar Maken

## Probleem

De mood preset pills (Luxury, Playful, Bold, Organic, etc.) zitten in een `flex overflow-x-auto` container, maar de parent containers clippen de overflow niet correct. Hierdoor breidt de rij zich uit voorbij het zichtbare gebied zonder dat je kunt scrollen.

## Oplossing

Twee kleine CSS-aanpassingen in `ThemeMoodPresets.tsx`:

1. **Wrapper `min-w-0 overflow-hidden`** toevoegen aan de buitenste `div`, zodat de flex-children niet buiten de container groeien
2. **`max-w-full`** op de scroll-container zodat `overflow-x-auto` daadwerkelijk triggert

## Technische Wijziging

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/ThemeMoodPresets.tsx` | Buitenste div: `min-w-0` toevoegen. Scroll-container div: `max-w-full` toevoegen zodat overflow correct werkt binnen de smalle accordion. |

Concreet wordt regel 150 en 154 aangepast:
- Regel 150: `<div className="space-y-2">` wordt `<div className="space-y-2 min-w-0">`
- Regel 154: `<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">` wordt `<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin max-w-full">`

Dit is een 2-regel CSS fix in 1 bestand.

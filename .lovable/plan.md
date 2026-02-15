
# Mood Presets: Wrappen in plaats van Scrollen

## Probleem

De horizontale scroll werkt niet goed binnen de smalle accordion-sidebar. Slechts 2 mood pills zijn zichtbaar en de rest is onbereikbaar.

## Oplossing

Vervang de horizontale scroll-layout door een **flex-wrap** grid zodat alle pills zichtbaar zijn op meerdere regels.

## Technische Wijziging

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/ThemeMoodPresets.tsx` | Verander de flex-container van `overflow-x-auto` + `shrink-0` naar `flex-wrap`. Pills worden niet meer `whitespace-nowrap shrink-0` maar mogen wrappen. |

Concreet:
- Regel 154: `flex gap-2 overflow-x-auto pb-1 scrollbar-thin max-w-full` wordt `flex flex-wrap gap-1.5`
- Regel 161: Verwijder `whitespace-nowrap shrink-0` van de button classes zodat pills zich aanpassen aan de beschikbare breedte

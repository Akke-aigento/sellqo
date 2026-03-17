

## Plan: AI Help Widget — groter + minimaliseren naar streepje

### Wat verandert

De floating button gaat terug naar de grotere maat (`h-12 w-12`). Bij "minimaliseren" (klikken op het kruisje) verdwijnt de button niet volledig, maar wordt hij een dun verticaal streepje aan de rechterkant van het scherm. Klik je op dat streepje, dan komt de volledige button weer terug.

### Drie states

1. **Normaal** — Grote ronde button rechtsonder (zoals voorheen)
2. **Geminimaliseerd** — Dun verticaal streepje (~4px breed, ~40px hoog) aan de rechterrand, met subtiele kleur. Klik = terug naar normaal
3. **Chat open** — Het chatvenster is zichtbaar

### Wijzigingen

**`src/components/admin/help/AIHelpWidget.tsx`**
- Button terug naar `h-12 w-12` met `h-5 w-5` icoon
- `isDismissed` hernoemen naar `isMinimized`
- Wanneer `isMinimized`: toon een smal verticaal streepje (`w-1 h-10 rounded-full bg-primary/40 hover:bg-primary/70`) fixed aan de rechterrand, halverwege het scherm
- Klik op streepje → `setIsMinimized(false)`
- Route-change reset blijft behouden


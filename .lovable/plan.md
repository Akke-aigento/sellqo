

## Swipe-acties & long-press selectie op mobiel/tablet

### Wat verandert

Op mobiel en tablet (< 1024px):
- **Checkbox + drag-handle kolom verdwijnt** — meer ruimte voor het bericht
- **Long-press (500ms)** op een bericht → selecteert het (zoals WhatsApp/Gmail)
- **Swipe naar links** → rode "Verwijderen" actie verschijnt
- **Swipe naar rechts** → blauwe "Archiveren" actie verschijnt
- Op desktop blijft alles zoals het nu is (checkbox + drag handle)

### Technische aanpak

**Nieuw component: `SwipeableConversationItem.tsx`**
- Puur voor mobiel/tablet, vervangt `SelectableConversationItem` in de lijst
- Gebruikt touch events (`touchstart`, `touchmove`, `touchend`) voor swipe-detectie
- Threshold van ~80px voordat actie zichtbaar wordt
- Achter het item zitten twee gekleurde vlakken (links = archiveren, rechts = verwijderen) met iconen
- Bij loslaten voorbij threshold → actie uitvoeren + item terugsliden
- Long-press via `setTimeout` (500ms) op `touchstart`, geannuleerd bij `touchmove` > 10px

**Wijzigingen in `ConversationList.tsx`**
- Import `useIsMobile` / `useIsTablet` check
- Op mobiel/tablet: render `SwipeableConversationItem` in plaats van `SelectableConversationItem`
- Props blijven hetzelfde (onArchive, onDelete, onToggleCheck etc.)

**Wijzigingen in `SelectableConversationItem.tsx`**
- Geen wijzigingen — blijft voor desktop

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/SwipeableConversationItem.tsx` | **Nieuw** — touch swipe + long-press component |
| `src/components/admin/inbox/ConversationList.tsx` | Conditionally render swipeable variant op mobiel |

### Swipe-gedrag detail

```text
 ┌──────────────────────────────────┐
 │  [Archiveren]  ← BERICHT →  [Verwijderen]  │
 └──────────────────────────────────┘
   swipe rechts →    ← swipe links
```

- Swipe translateX het item, achterliggende kleurvlakken worden zichtbaar
- Spring terug met CSS transition als niet voorbij threshold
- Haptic feedback hint via klein `transform: scale(1.02)` bij threshold


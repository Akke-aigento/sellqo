
# Plan: Inbox UX Verbeteringen + Platform Owner AI Credits

## Samenvatting Wijzigingen

1. **Groter antwoordvak** - Textarea vergroten voor betere bewerking
2. **Inklapbare mappenlijst** - Sidebar kan worden ingeklapt om meer ruimte te geven
3. **Drag & drop gesprekken naar mappen** - Visueel verslepen van gesprekken
4. **Platform owner onbeperkte AI credits** - `is_internal_tenant` = ongelimiteerd

---

## 1. Groter Antwoordvak

### Wijzigingen in `ReplyComposer.tsx`

De textarea wordt vergroot van `min-h-[80px]` naar `min-h-[120px]` en gebruikers kunnen de hoogte aanpassen:

```text
VOOR:  <Textarea className="min-h-[80px] resize-none pr-10" />
NA:    <Textarea className="min-h-[120px] resize-y pr-10" />
```

De `resize-y` class maakt het mogelijk de hoogte aan te passen door te slepen.

---

## 2. Inklapbare Mappenlijst

### Nieuwe State + UI

**Messages.tsx:**
- Voeg `isSidebarCollapsed` state toe
- Collapsed state: alleen iconen tonen (w-12 ipv w-44)
- Toggle knop bovenaan de sidebar

```text
┌──────────────────────────────────────────────────┐
│ [<<] MAPPEN          │  Zoek...        │ Detail │
│ ──────────────────   │                 │        │
│ 📥 Inbox (5)         │  Gesprek 1      │        │
│ 📁 Gearchiveerd (3)  │  Gesprek 2      │        │
│ 🗑️ Prullenbak        │                 │        │
└──────────────────────────────────────────────────┘

        ⬇️ Na inklappen ⬇️

┌──────────────────────────────────────────────────┐
│ [>>] │  Zoek...              │ Meer detail      │
│ ──── │                       │ ruimte!          │
│ 📥 5 │  Gesprek 1            │                  │
│ 📁 3 │  Gesprek 2            │                  │
│ 🗑️   │                       │                  │
└──────────────────────────────────────────────────┘
```

**FolderList.tsx:**
- Nieuwe `collapsed` prop accepteren
- In collapsed mode: alleen icoon + badge tonen
- Header met toggle knop

---

## 3. Drag & Drop Gesprekken naar Mappen

### Implementatie met `@dnd-kit` (al geïnstalleerd)

**Bestanden te wijzigen:**

| Bestand | Wijziging |
|---------|-----------|
| `Messages.tsx` | Wrap met `DndContext`, `DragOverlay` voor visuele feedback |
| `ConversationList.tsx` | Maak items `Draggable` via `useDraggable` |
| `ConversationItem.tsx` | Voeg drag handle toe |
| `FolderList.tsx` | Maak mappen `Droppable` via `useDroppable` |

### Flow
1. Gebruiker pakt gesprek vast (drag handle of hele item)
2. Sleept naar een map in de sidebar
3. Map highlight wanneer er overheen gesleept wordt
4. Bij loslaten → `moveToFolder` mutation wordt aangeroepen

### Visuele Feedback
- Dragging item: opacity 50%, schaal 1.02
- Drop target (actieve map): border-primary, bg-primary/10
- Cursor: grabbing tijdens sleep

---

## 4. Platform Owner Onbeperkte AI Credits

### Huidige Situatie

`useAISuggestion.ts` en andere AI hooks checken credits via `useAICredits()`:

```typescript
if (!hasCredits(1)) {
  toast({ title: 'Onvoldoende AI credits', ... });
  return;
}
```

### Oplossing

**useAICredits.ts aanpassen:**

```typescript
export function useAICredits() {
  const { currentTenant } = useTenant();

  // Platform owner heeft ONBEPERKTE credits
  const isUnlimited = currentTenant?.is_internal_tenant === true;

  // ... existing query code ...

  const hasCredits = (required: number) => {
    // Platform owner altijd true
    if (isUnlimited) return true;
    return (credits?.available || 0) >= required;
  };

  return {
    credits: isUnlimited ? {
      ...credits,
      available: Infinity,  // of een hoog getal voor UI
      credits_total: 999999,
    } : credits,
    isUnlimited,
    hasCredits,
    // ...
  };
}
```

Dit zorgt ervoor dat:
- `hasCredits()` altijd `true` retourneert voor platform owner
- De UI toont "Onbeperkt" in plaats van een getal
- Alle AI features werken zonder credit check

---

## Technische Details

### Bestanden te Wijzigen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/components/admin/inbox/ReplyComposer.tsx` | Wijzigen | Grotere textarea + resize-y |
| `src/pages/admin/Messages.tsx` | Wijzigen | DndContext wrapper, collapsed state |
| `src/components/admin/inbox/FolderList.tsx` | Wijzigen | Collapsed mode, droppable zones |
| `src/components/admin/inbox/ConversationList.tsx` | Wijzigen | Draggable items |
| `src/components/admin/inbox/ConversationItem.tsx` | Wijzigen | Drag handle styling |
| `src/hooks/useAICredits.ts` | Wijzigen | is_internal_tenant bypass |

### Afhankelijkheden
- `@dnd-kit/core` - al geïnstalleerd ✅
- `@dnd-kit/utilities` - al geïnstalleerd ✅

### Geen Database Wijzigingen Nodig
Alle functionaliteit maakt gebruik van bestaande `moveToFolder` mutation en tenant flags.

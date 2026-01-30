
# Plan: Fix Inbox UI - Bulk Actions, Checkbox Shift & Filter Layout

## Geïdentificeerde Problemen

### 1. Bulk Actions Niet Zichtbaar
In screenshot 1 zijn alleen "Herstellen" zichtbaar maar Archiveren/Verwijderen worden afgekapt. De toolbar is te breed voor de beschikbare ruimte.

### 2. Checkbox Verschuift Content (Meest Irritant!)
Wanneer je over een gesprek hovert, gaat de checkbox van `w-0` naar `w-10`, waardoor de hele preview naar rechts schuift. Dit is vermoeiend voor de ogen.

### 3. Filter Layout Nog Rommelig
De filters zijn beter maar nog steeds niet optimaal georganiseerd.

---

## Oplossingen

### Fix 1: Bulk Actions Toolbar Verbeteren

**Probleem**: Horizontale layout past niet in smalle ruimte.

**Oplossing**: 
- Verander naar 2-rij layout wanneer krap
- Of: Gebruik icon-only buttons met tooltips
- Verplaats "Alles selecteren" naar eigen rij

```text
Huidige layout (1 rij, te breed):
┌─────────────────────────────────────────────────────┐
│ [✕] 2 geselecteerd [Alles sel.] | [Herstel] [🗑]   │  ← Afgekapt!
└─────────────────────────────────────────────────────┘

Nieuwe layout (gestapeld):
┌─────────────────────────────────────────────────────┐
│ [✕] 2 geselecteerd   [Alles selecteren (5)]        │
├─────────────────────────────────────────────────────┤
│ [📁 Verplaats] [📦 Archiveer] [🗑 Verwijder]       │
└─────────────────────────────────────────────────────┘
```

### Fix 2: Checkbox Altijd Dezelfde Ruimte (Belangrijkste Fix!)

**Probleem**: Animatie van `w-0` naar `w-10` veroorzaakt layout shift.

**Oplossing**: Checkbox-kolom heeft **altijd vaste breedte**, maar de checkbox zelf is alleen zichtbaar op hover/selectie. Dit voorkomt layout shift.

```typescript
// HUIDIGE CODE (veroorzaakt shift):
<div className={cn(
  showCheckboxes || isChecked 
    ? 'w-10 opacity-100' 
    : 'w-0 group-hover:w-10 opacity-0 group-hover:opacity-100'
)}>

// NIEUWE CODE (geen shift):
<div className="w-8 flex items-center justify-center shrink-0">
  <Checkbox 
    className={cn(
      'transition-opacity duration-150',
      showCheckboxes || isChecked 
        ? 'opacity-100' 
        : 'opacity-0 group-hover:opacity-100'
    )}
  />
</div>
```

**Resultaat**: De kolom is altijd 8px breed, alleen de checkbox fade in/out. Geen beweging van de preview!

### Fix 3: Filter Layout Opschonen

**Verbeteringen**:
- Minder verticale ruimte tussen secties
- "Zoek op" op één regel met "Kanalen"
- Compactere styling

---

## Technische Implementatie

### Bestand 1: `SelectableConversationItem.tsx`

**Wijziging**: Vaste breedte voor checkbox-kolom, alleen opacity animatie.

```typescript
// Oude code (layout shift):
<div className={cn(
  'flex items-center justify-center transition-all duration-200 border-b',
  showCheckboxes || isChecked 
    ? 'w-10 opacity-100' 
    : 'w-0 group-hover:w-10 opacity-0 group-hover:opacity-100 overflow-hidden'
)}>

// Nieuwe code (geen shift):
<div className="w-8 flex items-center justify-center shrink-0 border-b">
  <Checkbox
    checked={isChecked}
    className={cn(
      'transition-opacity duration-150 data-[state=checked]:bg-primary',
      showCheckboxes || isChecked 
        ? 'opacity-100' 
        : 'opacity-0 group-hover:opacity-100'
    )}
    onClick={onToggleCheck}
  />
</div>
```

### Bestand 2: `BulkActionsToolbar.tsx`

**Wijziging**: Gestapelde layout voor betere leesbaarheid in smalle ruimte.

```typescript
return (
  <div className="p-2 bg-primary/5 border-b space-y-2">
    {/* Rij 1: Selectie info */}
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        <X className="h-3.5 w-3.5" />
      </Button>
      <span className="text-sm font-medium whitespace-nowrap">
        {selectedCount} geselecteerd
      </span>
      <div className="flex-1" />
      {!allSelected && (
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          <CheckSquare className="h-3.5 w-3.5 mr-1" />
          Alles selecteren ({totalCount})
        </Button>
      )}
    </div>
    
    {/* Rij 2: Acties */}
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Verplaatsen, Archiveren, Verwijderen buttons */}
    </div>
  </div>
);
```

### Bestand 3: `AdvancedSearchFilters.tsx`

**Wijziging**: Compactere layout, minder witruimte.

```typescript
<CollapsibleContent className="space-y-2 pt-2">  {/* Was space-y-3 */}
  {/* Dropdowns grid blijft gelijk */}
  
  {/* Kanalen + Zoek op op compactere manier */}
  <div className="space-y-1">
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {/* Kanalen checkboxes */}
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span>Zoek op:</span>
      {/* Zoek op checkboxes */}
    </div>
  </div>
</CollapsibleContent>
```

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/SelectableConversationItem.tsx` | Vaste breedte checkbox kolom, alleen opacity animatie |
| `src/components/admin/inbox/BulkActionsToolbar.tsx` | 2-rij layout voor bulk acties |
| `src/components/admin/inbox/AdvancedSearchFilters.tsx` | Compactere spacing en layout |

---

## Visueel Resultaat

### Conversation Item (geen shift meer)

```text
Hover OFF:
┌─────────────────────────────────────────┐
│ [  ] [⋮⋮] VanXcel@outlook.com    2u    │  ← Checkbox onzichtbaar maar ruimte behouden
│            Sellqo app                   │
│            Hey vriend, ik hoorde...     │
└─────────────────────────────────────────┘

Hover ON:
┌─────────────────────────────────────────┐
│ [☐] [⋮⋮] VanXcel@outlook.com    2u    │  ← Checkbox fade in, GEEN verschuiving!
│            Sellqo app                   │
│            Hey vriend, ik hoorde...     │
└─────────────────────────────────────────┘
```

### Bulk Actions Toolbar (gestapeld)

```text
┌─────────────────────────────────────────┐
│ [✕] 2 geselecteerd    Alles selecteren (5)│
├─────────────────────────────────────────┤
│ [📁 Verplaats] [📦 Archiveer] [🗑 Verwijd]│
└─────────────────────────────────────────┘
```

### Filters (compacter)

```text
┌─────────────────────────────────────────┐
│ Zoek in          Periode                │
│ [Alle mappen ▼]  [Alles ▼]              │
├─────────────────────────────────────────┤
│ ☑ Email ☑ WhatsApp ☑ Facebook ☑ Insta  │
│ Zoek op: ☑ Onderwerp ☑ Inhoud ☑ Afzender│
├─────────────────────────────────────────┤
│                    [✕ Wis zoekopdracht] │
└─────────────────────────────────────────┘
```

---

## Samenvatting

1. **Checkbox kolom vaste breedte** - Voorkomt irritante layout shift bij hover
2. **Bulk toolbar gestapeld** - Alle acties zichtbaar, niet afgekapt
3. **Filters compacter** - Minder witruimte, betere organisatie

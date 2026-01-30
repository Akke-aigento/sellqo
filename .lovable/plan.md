
# Plan: Fix Inbox UI Issues

## Geïdentificeerde Problemen

### 1. Filter Layout (te krap)
De geavanceerde zoekfilters worden afgekapt doordat 3 dropdown selects naast elkaar staan in een te smalle ruimte.

### 2. Preview Afkapping
- Email adressen worden afgekapt ("aaron.mercken@hotmail.c...")
- Preview tekst eindigt abrupt zonder ellipsis indicator

### 3. Bulk Selectie Ontoegankelijk
De checkboxes voor bulk selectie zijn verborgen totdat er al iets geselecteerd is - maar er is geen manier om die eerste selectie te maken!

---

## Oplossingen

### Fix 1: Verbeterde Filter Layout

**Probleem**: 3 dropdowns op 1 rij passen niet in de smalle sidebar.

**Oplossing**: Verander naar een 2-rij layout:
- Rij 1: Zoekbereik + Periode (2 kolommen)
- Rij 2: Kanaal checkboxes horizontaal (altijd zichtbaar, geen dropdown)
- Rij 3: "Zoek op" checkboxes

```text
Huidige layout (1 rij, 3 dropdowns):
┌─────────────────────────────────────────┐
│ [Overal (in...▼] [Alle ▼] [Alles ▼]    │  ← Te krap!
└─────────────────────────────────────────┘

Nieuwe layout (meer ruimte):
┌─────────────────────────────────────────┐
│ Zoek in: [Alle mappen        ▼]        │
│ Periode: [Alles              ▼]        │
├─────────────────────────────────────────┤
│ ☑ Email ☑ WhatsApp ☑ Facebook ☑ Insta  │
├─────────────────────────────────────────┤
│ Zoek op: ☑ Onderwerp ☑ Inhoud ☑ Afzender│
└─────────────────────────────────────────┘
```

### Fix 2: Preview Tekst Verbetering

**Probleem**: Email en preview worden afgekapt zonder duidelijke ellipsis.

**Oplossing**: 
- Gebruik `line-clamp-1` in combinatie met `break-all` voor emails
- Voeg expliciete `...` indicator toe voor lange tekst
- Zorg dat subject en preview op aparte regels staan met duidelijke truncatie

### Fix 3: Bulk Selectie Toegankelijk Maken

**Probleem**: Checkboxes zijn verborgen, geen manier om selectie te starten.

**Oplossing**: Voeg een "Selecteren" knop toe in de filter header:
- Knop boven de gesprekkenlijst: "☑ Selecteren" 
- Bij klik: toon alle checkboxes (ook als nog niets geselecteerd)
- Of: Toon checkboxes altijd bij hover over een item

```text
┌─────────────────────────────────────────┐
│ 🔍 Zoek in gesprekken...               │
├─────────────────────────────────────────┤
│ [Alle] [Email] [Social ▼]              │
│ [Alle] [Ongelezen] [Te beantw.]        │
├─────────────────────────────────────────┤
│ [☑ Selecteren]              Sorteer ▼  │  ← Nieuwe knop
└─────────────────────────────────────────┘
```

---

## Technische Implementatie

### Bestand 1: `AdvancedSearchFilters.tsx`

Wijzig de layout van 1 rij met 3 dropdowns naar een verticale stack:

```typescript
// Huidige structuur (1 rij):
<div className="flex gap-1.5">
  <Select>...</Select>  {/* Scope */}
  <Select>...</Select>  {/* Kanalen */}
  <Select>...</Select>  {/* Periode */}
</div>

// Nieuwe structuur (verticaal):
<div className="space-y-2">
  {/* Rij 1: Scope en Periode */}
  <div className="grid grid-cols-2 gap-2">
    <div>
      <Label className="text-xs">Zoek in</Label>
      <Select>...</Select>
    </div>
    <div>
      <Label className="text-xs">Periode</Label>
      <Select>...</Select>
    </div>
  </div>
  
  {/* Rij 2: Kanalen als checkboxes */}
  <div className="flex flex-wrap gap-3">
    <Label>Kanalen:</Label>
    <Checkbox /> Email
    <Checkbox /> WhatsApp
    ...
  </div>
  
  {/* Rij 3: Zoek op */}
  <div className="flex flex-wrap gap-3">
    ...bestaande checkboxes
  </div>
</div>
```

### Bestand 2: `ConversationItem.tsx`

Verbeter de tekstafkapping:

```typescript
// Email: gebruik text-ellipsis met overflow
<span className="font-medium truncate max-w-[180px]">
  {customer?.name || 'Onbekend'}
</span>

// Preview: gebruik line-clamp
<p className="text-xs text-muted-foreground line-clamp-1">
  {previewText || '(Geen inhoud)'}
</p>
```

### Bestand 3: `SelectableConversationItem.tsx` + `ConversationList.tsx`

Maak checkboxes altijd zichtbaar bij hover:

```typescript
// In SelectableConversationItem.tsx
// Verander de logica zodat checkbox zichtbaar is bij hover OF wanneer in selectiemodus

<div
  className={cn(
    'flex items-center justify-center transition-all duration-200 border-b',
    // Altijd tonen bij hover, of wanneer selectie actief
    showCheckboxes || isChecked 
      ? 'w-10 opacity-100' 
      : 'w-0 group-hover:w-10 opacity-0 group-hover:opacity-100'
  )}
>
```

### Bestand 4: `InboxFilters.tsx` of nieuwe component

Voeg een "Selecteren" toggle knop toe:

```typescript
// Nieuwe prop: onToggleSelectionMode
// Knop onder de status tabs

<div className="flex items-center justify-between pt-1 border-t mt-2">
  <Button 
    variant="ghost" 
    size="sm"
    onClick={onToggleSelectionMode}
  >
    <CheckSquare className="h-3.5 w-3.5 mr-1" />
    Selecteren
  </Button>
</div>
```

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/AdvancedSearchFilters.tsx` | Verticale layout voor filters |
| `src/components/admin/inbox/ConversationItem.tsx` | Betere truncatie voor email/preview |
| `src/components/admin/inbox/SelectableConversationItem.tsx` | Checkbox zichtbaar bij hover |
| `src/components/admin/inbox/ConversationList.tsx` | Selectiemodus state handling |
| `src/pages/admin/Messages.tsx` | Toggle selectiemodus functie |

---

## Visueel Resultaat

### Geavanceerde Zoekfilters (verbeterd)

```text
┌─────────────────────────────────────────┐
│ 🔍 retour                            ✕  │
├─────────────────────────────────────────┤
│ Zoek in            Periode              │
│ [Alle mappen ▼]    [Alles ▼]            │
├─────────────────────────────────────────┤
│ Kanalen:                                │
│ ☑ Email  ☑ WhatsApp  ☑ Facebook  ☑ Insta│
├─────────────────────────────────────────┤
│ Zoek op:                                │
│ ☑ Onderwerp  ☑ Inhoud  ☑ Afzender       │
├─────────────────────────────────────────┤
│                    [✕ Wis zoekopdracht] │
└─────────────────────────────────────────┘
```

### Gesprekkenlijst met Bulk Selectie

```text
┌─────────────────────────────────────────┐
│ [☑ Selecteren]                          │  ← Klik om selectiemodus te starten
├─────────────────────────────────────────┤
│ [☐][⋮⋮] V  VanXcel@outlook.com    2u   │  ← Checkbox zichtbaar bij hover
│           Sellqo app                    │
│           Hey vriend, ik hoorde...      │
├─────────────────────────────────────────┤
│ [☑][⋮⋮] A  aaron.mercken@hotm...  1d   │  ← Geselecteerd
│           Sellqo app                    │
│           (Geen inhoud)                 │
└─────────────────────────────────────────┘

Wanneer geselecteerd:
┌─────────────────────────────────────────┐
│ [✕] 2 geselecteerd  [Alles (5)]         │
│        [Verplaatsen ▼] [Archiveren] [🗑] │
└─────────────────────────────────────────┘
```

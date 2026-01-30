
# Plan: Checkbox en Drag Handle Verticaal Stapelen

## Huidige Situatie

De checkbox en het drag handle icoon staan **naast elkaar** horizontaal:

```text
┌───────────────────────────────────────────────────┐
│ [☐] [⋮⋮] │ VanXcel@outlook.com              2u   │
│          │ Sellqo app                            │
│          │ Hey vriend, ik hoorde...              │
└───────────────────────────────────────────────────┘
   ↑    ↑
  w-8  w-6  = samen ~14 breed → duwt content naar rechts
```

## Gewenste Situatie

Checkbox en drag handle **boven elkaar** in één smalle kolom:

```text
┌───────────────────────────────────────────────────┐
│ [☐] │ VanXcel@outlook.com                   2u   │
│ [⋮⋮]│ Sellqo app                                 │
│     │ Hey vriend, ik hoorde dat jij me...        │
└───────────────────────────────────────────────────┘
  ↑
 w-7  = slechts 1 smalle kolom → meer ruimte voor content!
```

## Technische Oplossing

Combineer checkbox en drag handle in één verticale kolom met `flex-col`:

```typescript
// Van: 2 aparte horizontale kolommen
<div className="flex items-stretch">
  <div className="w-8">  {/* Checkbox */}
  <div className="w-6">  {/* Drag handle */}
  <div className="flex-1">  {/* Content */}
</div>

// Naar: 1 verticale kolom met beide iconen gestapeld
<div className="flex items-stretch">
  <div className="w-7 flex flex-col items-center justify-center gap-1 border-b">
    <Checkbox />      {/* Boven */}
    <GripVertical />  {/* Onder */}
  </div>
  <div className="flex-1">  {/* Content - krijgt nu meer ruimte! */}
</div>
```

## Bestand te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/SelectableConversationItem.tsx` | Combineer checkbox + drag handle in 1 verticale kolom |

## Visueel Resultaat

```text
Hover OFF:
┌───────────────────────────────────────────────────┐
│     │ VanXcel@outlook.com                   2u   │
│     │ Sellqo app                                 │
│     │ Hey vriend, ik hoorde dat jij me...        │
└───────────────────────────────────────────────────┘

Hover ON:
┌───────────────────────────────────────────────────┐
│ [☐] │ VanXcel@outlook.com                   2u   │
│ [⋮⋮]│ Sellqo app                                 │
│     │ Hey vriend, ik hoorde dat jij me...        │
└───────────────────────────────────────────────────┘

Geselecteerd:
┌───────────────────────────────────────────────────┐
│ [☑] │ VanXcel@outlook.com                   2u   │
│ [⋮⋮]│ Sellqo app                                 │
│     │ Hey vriend, ik hoorde dat jij me...        │
└───────────────────────────────────────────────────┘
```

De berichten zijn nu minder naar rechts geduwd en de controls staan netjes boven elkaar!


# Plan: Filter Checkboxes Uitlijnen in 2 Kolommen

## Huidige Situatie

De checkboxes staan nu in een `flex-wrap` layout waardoor ze niet mooi uitgelijnd zijn:

```text
☑ Email  ☑ WhatsApp  ☑ Facebook  ☑ Instagram
☑ Onderwerp  ☑ Inhoud  ☑ Afzender
```

## Gewenste Situatie

Nette 2-koloms grid waarbij de tweede kolom mooi uitgelijnd is:

```text
☑ Email       ☑ WhatsApp
☑ Facebook    ☑ Instagram
☑ Onderwerp   ☑ Inhoud
☑ Afzender
```

## Technische Oplossing

Verander beide checkbox-secties van `flex flex-wrap` naar een `grid grid-cols-2` layout:

### Kanalen (Row 2)

```typescript
// Van:
<div className="flex flex-wrap gap-x-3 gap-y-1">

// Naar:
<div className="grid grid-cols-2 gap-x-3 gap-y-1">
```

### Zoek op (Row 3)

```typescript
// Van:
<div className="flex flex-wrap items-center gap-x-3 gap-y-1">

// Naar:
<div className="grid grid-cols-2 gap-x-3 gap-y-1">
```

## Bestand te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/AdvancedSearchFilters.tsx` | `flex flex-wrap` → `grid grid-cols-2` voor beide checkbox secties |

## Visueel Resultaat

```text
┌─────────────────────────────────────────┐
│ Zoek in          Periode                │
│ [Alle mappen ▼]  [Alles ▼]              │
├─────────────────────────────────────────┤
│ ☑ 📧 Email       ☑ 💬 WhatsApp          │
│ ☑ 📘 Facebook    ☑ 📷 Instagram         │
├─────────────────────────────────────────┤
│ ☑ Onderwerp      ☑ Inhoud               │
│ ☑ Afzender                              │
├─────────────────────────────────────────┤
│                         [✕ Wissen]      │
└─────────────────────────────────────────┘
```

Alle vinkjes in de tweede kolom (WhatsApp, Instagram, Inhoud) staan nu perfect boven elkaar!

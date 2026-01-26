
# Plan: Verkoopkanalen in Grid View

## Huidige Situatie

De bulk editing voor kanalen werkt al via de `BulkChannelsTab` in de ProductBulkEditDialog. Nu gaan we dit ook toevoegen aan de spreadsheet grid view zodat je:

1. **Per product** direct kunt zien op welke kanalen het actief is
2. **Inline** kanalen aan/uit kunt zetten
3. **Bulk** meerdere kanalencellen tegelijk kunt bewerken

## Visueel Ontwerp Grid Cel

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  Naam              │ SKU      │ Prijs    │ Voorraad │ Kanalen                   │ Actief │
├────────────────────┼──────────┼──────────┼──────────┼───────────────────────────┼────────┤
│  iPhone 15 Pro     │ IPH-15   │ €1.299   │    45    │ [G] [F] [I] [ ] [P]       │   ●    │
├────────────────────┼──────────┼──────────┼──────────┼───────────────────────────┼────────┤
│  Samsung Galaxy    │ SAM-S24  │ €999     │    32    │ [G] [ ] [ ] [ ] [ ]       │   ●    │
├────────────────────┼──────────┼──────────┼──────────┼───────────────────────────┼────────┤
│  MacBook Pro       │ MBP-16   │ €2.899   │    12    │ [G] [F] [I] [ ] [P]       │   ○    │
└────────────────────┴──────────┴──────────┴──────────┴───────────────────────────┴────────┘

Legenda:
[G] = Google Shopping (actief)
[F] = Facebook Shop (actief)
[I] = Instagram Shop (actief)
[P] = Pinterest (actief)
[ ] = Niet actief
```

### Cel Klikken → Popover

Wanneer je op de kanalen-cel klikt, opent een popover:

```text
                    ┌─────────────────────────────────────┐
                    │  Verkoopkanalen                     │
                    ├─────────────────────────────────────┤
                    │                                     │
                    │  SOCIAL COMMERCE                    │
                    │  ☑ Google Shopping                  │
                    │  ☑ Facebook Shop                    │
                    │  ☑ Instagram Shop                   │
                    │  ☐ TikTok Shop                      │
                    │  ☑ Pinterest                        │
                    │  ☐ WhatsApp Business                │
                    │  ☐ Microsoft Shopping               │
                    │  ☐ Snapchat                         │
                    │                                     │
                    │  MARKETPLACES                       │
                    │  ☑ Bol.com                          │
                    │  ☐ Amazon                           │
                    │  ☐ Shopify                          │
                    │                                     │
                    │              [Opslaan]  [Annuleren] │
                    └─────────────────────────────────────┘
```

### Bulk Bewerking Kanalen

Wanneer meerdere kanalen-cellen geselecteerd:

```text
┌─────────────────────────────────────────────────────┐
│  5 producten geselecteerd - Kanalen bewerken        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Kanalen inschakelen:                               │
│  ☐ Google Shopping                                  │
│  ☐ Facebook Shop                                    │
│  ☐ Instagram Shop                                   │
│  ☐ Pinterest                                        │
│                                                     │
│  Kanalen uitschakelen:                              │
│  ☐ Google Shopping                                  │
│  ☐ Facebook Shop                                    │
│  ...                                                │
│                                                     │
│                 [Annuleren]  [Toepassen]            │
└─────────────────────────────────────────────────────┘
```

## Technische Implementatie

### Nieuwe/Gewijzigde Bestanden

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/components/admin/products/grid/GridChannelsCell.tsx` | Nieuw | Cel component voor kanalen met badges en popover |
| `src/components/admin/products/grid/gridTypes.ts` | Update | Nieuwe `channels` cell type toevoegen |
| `src/components/admin/products/grid/ProductGridView.tsx` | Update | GridChannelsCell renderen |
| `src/components/admin/products/grid/CellBulkEditor.tsx` | Update | Bulk kanalen bewerking toevoegen |

### Nieuwe Cell Type

```typescript
// gridTypes.ts - nieuwe cell type
export type CellType = 
  | 'text'
  | 'number'
  | 'currency'
  | 'select'
  | 'toggle'
  | 'tags'
  | 'channels'  // NIEUW
  | 'readonly';

// Nieuwe kolom definitie
{ 
  field: 'social_channels', 
  header: 'Kanalen', 
  type: 'channels', 
  width: 180, 
  minWidth: 120, 
  editable: true, 
  bulkEditable: true 
}
```

### GridChannelsCell Component

```typescript
// GridChannelsCell.tsx
interface GridChannelsCellProps {
  value: ProductSocialChannels | null;
  isEditing: boolean;
  isSelected: boolean;
  onChange: (value: ProductSocialChannels) => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

// Weergave in cel (compact met iconen)
function GridChannelsCell({ value, ... }) {
  const channels = value || {};
  const activeChannels = Object.entries(channels)
    .filter(([_, active]) => active);
  
  return (
    <div className="flex items-center gap-1">
      {activeChannels.length === 0 ? (
        <span className="text-muted-foreground text-xs">Geen</span>
      ) : (
        activeChannels.map(([type]) => (
          <ChannelBadge key={type} type={type} size="sm" />
        ))
      )}
    </div>
  );
}
```

### Kanaal Badges (compact)

Kleine icoontjes met tooltips voor elke kanaal:

| Kanaal | Badge | Kleur |
|--------|-------|-------|
| Google Shopping | G | Blauw |
| Facebook Shop | f | Donkerblauw |
| Instagram Shop | 📷 | Roze |
| TikTok Shop | ♪ | Zwart |
| Pinterest | P | Rood |
| WhatsApp | W | Groen |
| Microsoft | M | Cyaan |
| Snapchat | 👻 | Geel |
| Bol.com | B | Blauw |
| Amazon | A | Oranje |

## Implementatie Stappen

### Fase 1: Grid Cell Component
1. `GridChannelsCell.tsx` maken met compacte badge weergave
2. Popover voor inline editing met alle kanaalopties
3. Integratie met `useSocialChannels` hook voor actieve kanalen

### Fase 2: Grid Integratie  
4. `gridTypes.ts` uitbreiden met `channels` type
5. `ProductGridView.tsx` updaten om nieuwe cel te renderen
6. Kolom toevoegen aan `DEFAULT_VISIBLE_COLUMNS` (optioneel)

### Fase 3: Bulk Editing
7. `CellBulkEditor.tsx` uitbreiden voor kanalen bulk operaties
8. Logica voor "inschakelen" en "uitschakelen" van geselecteerde kanalen

## Resultaat

Na implementatie kan de merchant:

1. **In één oogopslag** zien welke producten op welke kanalen staan
2. **Direct klikken** om kanalen per product aan te passen
3. **Meerdere producten** selecteren en kanalen in bulk wijzigen
4. **Gecombineerd** met andere velden in dezelfde sessie bewerken

Dit maakt kanaalmanagement net zo snel als prijs- of voorraadwijzigingen!



## Kruisje (X) toevoegen aan alle actiebalken voor deselecteren

### Probleem
Als je items selecteert, verschijnt er een actiebalk onderaan. Om te deselecteren moet je scrollen naar de "Deselecteer" knop of door de lijst. Er mist een duidelijk kruisje rechtsboven om snel alles te deselecteren.

### Overzicht van de 5 actiebalken

| Component | Huidige situatie | Actie |
|-----------|-----------------|-------|
| `CategoryBulkActions.tsx` | Heeft "Deselecteer" knop met X icoon rechts, maar zit in de flow — niet rechtsboven | Verplaats naar absolute rechtsboven positie |
| `OrderBulkActions.tsx` | Heeft "Deselecteer" knop met XCircle rechts (`ml-auto`) | Maak prominenter als absolute X rechtsboven |
| `FulfillmentBulkActions.tsx` | Heeft "Deselecteer" knop met XCircle rechts (`ml-auto`) | Zelfde aanpak |
| `TenantBulkActions.tsx` | Heeft "Deselecteren" knop inline | Zelfde aanpak |
| `BulkActionsToolbar.tsx` (Inbox) | Heeft X knop linksboven — al goed | Eventueel consistent maken |

### Aanpak
Elke fixed bottom bar krijgt een **absolute gepositioneerd X-kruisje rechtsboven** (`absolute -top-3 -right-3` of `top-2 right-2`) dat als een ronde knop fungeert. Dit is onmiddellijk zichtbaar en klikbaar zonder te scrollen.

### Wijzigingen per bestand

**1. `CategoryBulkActions.tsx`** (regel 59, de fixed bar div)
- Voeg `relative` toe aan de bar container
- Voeg een absolute X-knop toe: `absolute top-1 right-1` of `top-2 right-2`
- Verwijder de bestaande "Deselecteer" knop onderaan (regel 127-130)

**2. `OrderBulkActions.tsx`** (regel 236, de fixed bar)
- Voeg `relative` toe
- Voeg absolute X-knop rechtsboven toe
- Verwijder de inline "Deselecteer" knop (regel 320-323)

**3. `FulfillmentBulkActions.tsx`** (regel 210, de fixed bar)
- Zelfde patroon: `relative` + absolute X-knop
- Verwijder inline "Deselecteer" knop (regel 249-252)

**4. `TenantBulkActions.tsx`** (regel 128, de inline bar)
- Voeg `relative` toe aan de container
- Voeg absolute X-knop rechtsboven toe
- Verwijder de inline "Deselecteren" knop (regel 154-156)

**5. `BulkActionsToolbar.tsx`** (Inbox) — al OK, heeft X linksboven. Optioneel consistent maken.

### Visueel
Elke bar krijgt een compact rond kruisje rechtsboven:
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={onClearSelection/onDeselectAll}
  className="absolute top-1 right-1 h-7 w-7 rounded-full"
>
  <X className="h-4 w-4" />
</Button>
```

### Geen database wijzigingen nodig


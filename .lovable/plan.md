

# Inbox Responsive Maken voor Tablet en Mobiel

## Probleem

De inbox pagina heeft een vaste 3-kolommen layout die altijd wordt getoond, ongeacht schermgrootte. Op mobiel (390px) en tablet (768px) past dit niet en verdwijnt alles.

## Aanpak: Paneel-gebaseerde navigatie op kleinere schermen

### Mobiel (< 768px)
- Toon **een paneel tegelijk**: gesprekkenlijst OF gesprekdetail
- Mappenlijst wordt automatisch ingeklapt (alleen iconen)
- Wanneer je een gesprek selecteert, schuift het detail-paneel in beeld
- Terugknop in de detail-header om terug te gaan naar de lijst
- Header wordt compacter (kleinere titel, knop past beter)

### Tablet (768px - 1024px)
- Mappenlijst automatisch ingeklapt (iconen-modus)
- Gesprekkenlijst smaller (w-60 i.p.v. w-72)
- Detail-paneel neemt de rest in

### Desktop (> 1024px)
- Huidige layout blijft exact hetzelfde

## Technische wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/Messages.tsx` | Responsieve layout-logica: `useIsMobile()` hook, state voor actief paneel (list/detail), conditioneel tonen van panelen, automatisch sidebar collapsen op tablet |
| `src/components/admin/inbox/ConversationDetail.tsx` | Terugknop toevoegen in de header op mobiel (callback `onBack`) |

### Messages.tsx - Kernwijzigingen

1. Import `useIsMobile` hook en voeg een `md` breakpoint check toe
2. Voeg `mobileView` state toe: `'list' | 'detail'`
3. Bij gesprek selectie op mobiel: schakel naar detail-view
4. Sidebar automatisch collapsen op schermen < 1024px
5. Conditionele rendering:
   - Mobiel: toon alleen het actieve paneel
   - Tablet/desktop: toon alle panelen maar met aangepaste breedtes
6. Header compacter op mobiel (kleinere padding, kortere tekst)

### ConversationDetail.tsx - Kernwijzigingen

1. Nieuwe prop: `onBack?: () => void`
2. Op mobiel een terugknop tonen links in de header
3. Header layout iets compacter voor kleinere schermen

### Layout classes (voorbeeld)

```text
Mobiel:
  - Folders: verborgen (of w-10 collapsed)
  - List: volledig breed wanneer actief
  - Detail: volledig breed wanneer actief, met terugknop

Tablet:
  - Folders: w-12 (collapsed)
  - List: w-60
  - Detail: flex-1

Desktop (ongewijzigd):
  - Folders: w-44 (of w-12 collapsed)
  - List: w-72
  - Detail: flex-1
```

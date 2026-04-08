

## Categorieën pagina mobiel-optimalisatie

### Problemen (390px viewport)

1. **Header knoppen vallen uit scherm** — drie knoppen ("Alles openklappen", "Alles inklappen", "Nieuwe categorie") staan horizontaal naast de titel, past niet op 390px
2. **Categorienamen onzichtbaar** — elke rij heeft 7+ elementen horizontaal: checkbox, grip, expand, folder-icoon, naam, badge, 4 actieknoppen. De naam wordt weggedrukt
3. **Actieknoppen te klein en te veel** — Move, Add child, Edit, Delete knoppen zijn elk 28px breed, onbruikbaar op touch

### Oplossing

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Categories.tsx` | Header responsive maken, Card styling op mobiel aanpassen |
| `src/components/admin/CategoryTreeItem.tsx` | Rij-layout herschikken voor mobiel |

### Detail

**1. Categories.tsx — Header (regels 346-367)**
- Titel + beschrijving bovenaan, knoppen eronder in een `flex-wrap` rij
- Op mobiel: "Alles openklappen/inklappen" tonen als icon-only knoppen (geen tekst)
- "Nieuwe categorie" wordt een icon-only FAB-achtige knop of compacte knop
- Structuur: `flex flex-col gap-3` i.p.v. `flex items-center justify-between`

**2. Categories.tsx — Card wrapper**
- Op mobiel: geen Card wrapper, direct content renderen (zoals Inbox/Producten patroon)
- `CardHeader` titel/beschrijving verbergen op mobiel (staat al in page header)

**3. CategoryTreeItem.tsx — Rij-layout mobiel (regels 114-265)**
- **Twee-regels layout op mobiel**: 
  - Regel 1: checkbox + grip + expand + folder + categorienaam + status badge
  - Regel 2 (of swipe/long-press menu): actieknoppen
- Concreet: actieknoppen (`div` regels 232-265) verbergen op mobiel (`hidden md:flex`), vervangen door een compact overflow menu (three-dot `DropdownMenu`) dat alleen op mobiel verschijnt
- Dit geeft de categorienaam maximale ruimte
- De status badge (Online/Inactief) blijft zichtbaar — is compact genoeg

**4. CategoryTreeItem.tsx — Touch-friendly**
- Grip handle iets groter op mobiel (`p-1.5` i.p.v. `p-1`)
- Categorienaam krijgt meer ruimte door actieknoppen in dropdown te stoppen

### Resultaat
- Categorienamen volledig leesbaar op 390px
- Alle acties bereikbaar via compact dropdown menu
- Header knoppen passen op het scherm
- Consistente mobile-first aanpak zoals andere admin pagina's


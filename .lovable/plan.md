

# Fix: Categorieën UX + AI Popover Scrolling

## Drie problemen, drie oplossingen

### 1. Actieknoppen altijd zichtbaar
De knoppen (verplaatsen, subcategorie, bewerken, verwijderen) verschijnen nu alleen bij hover. Dit is frustrerend op touch-apparaten en maakt de interface traag in gebruik.

**Oplossing**: De `opacity-0 group-hover:opacity-100` classes worden verwijderd van de actieknoppen in `CategoryTreeItem.tsx`. De knoppen worden altijd zichtbaar, met subtiele styling zodat ze niet afleiden.

### 2. Klik op categorienaam opent bewerkscherm
Nu moet je eerst hoveren en dan op het potloodje klikken. Sneller: klik direct op de naam om het bewerkformulier te openen.

**Oplossing**: De categorienaam in `CategoryTreeItem.tsx` wordt een klikbaar element dat direct `onEdit(category)` aanroept, met een cursor-pointer en hover-underline als visuele hint.

### 3. AI Popover scrolling - andere aanpak
De Radix Popover in een Portal beperkt de hoogte niet correct, waardoor `overflow-y-auto` niet werkt. ScrollArea heeft hetzelfde probleem. De huidige popover-aanpak is niet geschikt voor lange content.

**Oplossing**: Vervang de Popover door een Dialog (modal) voor het resultaatvenster. Een Dialog heeft een gegarandeerd scrollbare body en ziet er professioneler uit. De trigger-knop (sparkles) blijft hetzelfde, maar de resultaten openen in een compact Dialog-venster in plaats van een popover.

---

## Technische Details

### `src/components/admin/CategoryTreeItem.tsx`

1. Verwijder `opacity-0 group-hover:opacity-100 transition-opacity` van de actieknoppen-div (regel 182)
2. Wrap de categorienaam (`span.font-medium`) in een `button` met `onClick={() => onEdit(category)}`, voeg `hover:underline cursor-pointer` toe

### `src/components/admin/ai/AIFieldAssistant.tsx`

Volledige herstructurering van de resultaatweergave:

- De **trigger** blijft een kleine knop met het sparkles-icoon (onveranderd)
- De **input-view** (tabs voor auto/briefing) blijft in de Popover (die is klein genoeg)
- Het **resultaatvenster** (variaties/voorstel) wordt een `Dialog` in plaats van popover-content
- De Dialog krijgt `max-h-[80vh] overflow-y-auto` op de `DialogContent`, wat betrouwbaar scrollt
- Flow: klik sparkles -> popover met genereer-opties -> na generatie sluit popover, opent Dialog met resultaten

| Bestand | Wijziging |
|---|---|
| `src/components/admin/CategoryTreeItem.tsx` | Actieknoppen altijd zichtbaar, naam klikbaar voor edit |
| `src/components/admin/ai/AIFieldAssistant.tsx` | Resultaten in Dialog i.p.v. Popover voor betrouwbaar scrollen |


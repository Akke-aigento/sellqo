

## Gesprekken pagina: "scherm-in-scherm" effect weghalen op mobiel

### Probleem
Op 390px viewport zie je: admin shell → padding → Card met border/schaduw → folder sidebar (48px icons) → gesprekkenlijst. Dat geeft het "in screen, in screen, in screen" gevoel. Drie visuele lagen nesting op een klein scherm.

### Oplossing

Wijzigingen in `src/pages/admin/Messages.tsx`:

| Wat | Hoe |
|-----|-----|
| **Card wrapper weg op mobiel** | Op `isSinglePanel`: geen `<Card>` maar gewoon een `<div>` zonder border/shadow/rounded — content gaat full-width |
| **Folder sidebar verbergen op mobiel** | De collapsed sidebar (48px iconen) helemaal weg op mobiel. Folders beschikbaar maken via een dropdown/sheet in de filters-balk |
| **Padding minimaliseren** | Op mobiel: `p-0` in plaats van `p-3`, zodat de lijst tot aan de randen loopt |
| **Header compacter** | Minder verticale ruimte voor de header op mobiel |

Resultaat: op mobiel voelt de gesprekkenlijst aan als een native inbox (zoals WhatsApp/Mail) zonder extra kaders eromheen.

Eén bestand: `src/pages/admin/Messages.tsx`. Puur layout-wijzigingen, geen functionele veranderingen.


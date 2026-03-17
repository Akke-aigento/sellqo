

## Fix: Filters herstructureren, mapjes terugbrengen, en berichten openen op mobiel

### Drie problemen

**1. Dubbele/overbodige filters**
Er zijn nu twee rijen: kanaal-tabs (Alle / Email / Social) en status-tabs (Alle / Ongelezen / Te beantw.). Twee keer "Alle" is verwarrend. Op mobiel is verticale ruimte kostbaar.

**Oplossing**: Combineer tot een enkele filterbalk:
- Kanaalfilters (Alle / Email / Social dropdown) blijven als hoofdrij
- Ongelezen/Te beantwoorden wordt een klein filter-icoon of badge-toggle naast de zoekbalk, niet een aparte tab-rij
- Concreet: vervang de status-tabs door een dropdown/toggle-button rechts naast de zoekbalk met opties: "Alle", "Ongelezen", "Te beantwoorden"

**2. Mapjes verdwenen op mobiel**  
De folder-sidebar is verborgen op mobiel zonder alternatief.

**Oplossing**: Voeg een folder-dropdown/selector toe bovenaan de filterbalk op mobiel. Een horizontale scrollbare rij met folder-chips (Inbox / Gearchiveerd / Prullenbak / Klanten) of een dropdown-knop met het huidige mapje als label.

**3. Berichten openen werkt niet**  
In `SwipeableConversationItem` wordt de `ConversationItem` gerenderd met `onClick={() => {}}`. De tap wordt afgehandeld via `touchEnd` → `onClick()`. Maar de `<button>` in `ConversationItem` kan de click event consumeren voordat de touch handler volledig werkt op sommige browsers. Fix: geef de echte `onClick` door aan `ConversationItem` als fallback, en zorg dat mouse-click ook werkt (voor tablets met toetsenbord/muis).

### Wijzigingen

| Bestand | Wat |
|---------|-----|
| `InboxFilters.tsx` | Verwijder status-tabs, voeg status-dropdown toe naast zoekbalk. Voeg folder-selector toe op mobiel (nieuwe prop `folders`, `selectedFolderId`, `onFolderSelect`) |
| `SwipeableConversationItem.tsx` | Fix: geef `onClick` door aan ConversationItem zodat ook reguliere clicks werken |
| `Messages.tsx` | Geef folders en folder-select handler mee aan InboxFilters op mobiel |

### InboxFilters nieuw design op mobiel

```text
┌─────────────────────────────────────┐
│ 🔍 Zoek...              [▼ Filter]  │  ← status dropdown (Alle/Ongelezen/Te beantw.)
├─────────────────────────────────────┤
│ [Inbox ▼]  [Alle] [📧 Email] [👥▼] │  ← folder dropdown + kanaal tabs
└─────────────────────────────────────┘
```

Eenmalige filterbalk in plaats van drie lagen. Folder-dropdown links toont de huidige map met mogelijkheid om te wisselen.




## Mapje aanmaken op mobiel + ontbrekende inbox-functionaliteit

### Probleem 1: Map aanmaken niet bereikbaar op mobiel
De "Nieuwe map" knop zit in de `FolderList` sidebar, die op mobiel verborgen is. De folder-dropdown in `InboxFilters` toont alleen bestaande mappen, geen optie om er eentje aan te maken.

### Probleem 2: Ontbrekende functionaliteit
De inbox mist nog een aantal features die je in een serieuze unified inbox verwacht:

### Plan

**A. "Nieuwe map" toevoegen aan folder-dropdown (InboxFilters.tsx)**
- Onderaan de folder-dropdown een `+ Nieuwe map` optie toevoegen
- Bij klik: open een kleine dialog om de mapnaam in te voeren (hergebruik bestaande create-dialog logica)
- Nieuwe props: `onCreateFolder` doorgeven vanuit `Messages.tsx`

**B. Ontbrekende functionaliteit toevoegen aan de mobiele inbox:**

| Feature | Waar | Wat |
|---------|------|-----|
| **Snelle acties bij long-press** | `SwipeableConversationItem` | Bij long-press: in plaats van alleen selecteren, toon een bottom sheet/action menu met: Archiveren, Verwijderen, Verplaatsen naar map, Markeren als (on)gelezen, Toewijzen |
| **Markeren als ongelezen** | Swipe-actie of action menu | Mogelijkheid om een gelezen bericht weer als ongelezen te markeren |
| **Verplaatsen naar map** | Action menu bij long-press | Kies een map om het gesprek naartoe te verplaatsen (custom folders + systeem) |
| **Pull-to-refresh** | `ConversationList` | Trek de lijst naar beneden om te verversen — standaard mobiel patroon |
| **Lege folder-state** | `ConversationList` | Als een map leeg is, toon een passende illustratie en tekst per maptype |

**C. Wijzigingen per bestand:**

| Bestand | Wijziging |
|---------|-----------|
| `InboxFilters.tsx` | `+ Nieuwe map` item onderaan folder dropdown + create dialog |
| `Messages.tsx` | `createFolder` doorgeven als prop aan InboxFilters |
| `SwipeableConversationItem.tsx` | Long-press opent action sheet i.p.v. alleen toggle check |
| Nieuw: `ConversationActionSheet.tsx` | Bottom sheet component met alle acties (archiveren, verwijderen, verplaatsen, markeren als ongelezen) |
| `ConversationList.tsx` | Props uitbreiden voor mark-as-unread en move-to-folder acties |

### Long-press Action Sheet design

```text
┌─────────────────────────────┐
│  Jan de Vries                │  ← klant naam + preview
│  "Vraag over retournering"   │
├─────────────────────────────┤
│  📬 Markeren als ongelezen   │
│  📁 Verplaatsen naar map...  │  → sub-menu met mappen
│  📦 Archiveren               │
│  🗑️ Verwijderen              │
│  ──────────────────────────  │
│  ❌ Annuleren                │
└─────────────────────────────┘
```

Dit maakt de inbox op mobiel volledig functioneel: mappen aanmaken, berichten organiseren, en alle acties beschikbaar via touch-gestures.




## Plan: Mobiele Settings — Inklapbaar Menu + Auto-scroll

### Probleem
Op mobiel neemt het settings-navigatiemenu de hele viewport in beslag. Je moet eerst voorbij ~20 menu-items scrollen voordat je de daadwerkelijke instellingen ziet.

### Oplossing
Op mobiel wordt het navigatiemenu **inklapbaar** (collapsed by default) met een compacte knop die de huidige sectie toont. Bij klik op een menu-item:
1. Sectie wordt geselecteerd
2. Menu klapt automatisch dicht
3. Er wordt gescrold naar de content

### Aanpak in `src/pages/admin/Settings.tsx`

- Import `useIsMobile()` hook
- Voeg `const [menuOpen, setMenuOpen] = useState(false)` toe (alleen relevant op mobiel)
- Voeg een `ref` toe op de `<main>` sectie voor scroll-into-view
- **Mobiel**: Vervang de altijd-open Card door een compacte toggle-knop die de actieve sectie toont (icoon + naam + chevron). Bij klik opent/sluit het menu als een collapsible.
- Bij `handleSectionChange`: sluit menu + `scrollIntoView` naar de content
- **Desktop**: Geen wijzigingen, sidebar blijft zoals het is

### Visueel (mobiel)

```text
┌─────────────────────────┐
│ ⚙ Teamleden        ▼   │  ← Compacte toggle (klikbaar)
├─────────────────────────┤
│ (menu items, als open)  │  ← Alleen zichtbaar als menuOpen=true
└─────────────────────────┘
┌─────────────────────────┐
│ [Daadwerkelijke          │  ← Direct zichtbaar
│  instellingen content]   │
└─────────────────────────┘
```

### Bestand

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/pages/admin/Settings.tsx` — `useIsMobile`, collapsible nav, scrollIntoView |


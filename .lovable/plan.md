

## Twee aanpassingen: bottom nav verbergen op desktop + sidebar verrijken

### 1. AdminBottomNav alleen op mobiel/tablet
De bottom nav toont nu bij `lg:hidden` (< 1024px). Op schermen waar de admin-sidebar zichtbaar is, is de bottom nav overbodig. Aanpassing: verberg de bottom nav ook wanneer de sidebar open is, of verhoog het breakpoint zodat het alleen op echte mobiel/tablet toont.

**Bestand**: `AdminBottomNav.tsx`
- Verander `lg:hidden` naar een logica die checkt of de sidebar zichtbaar is, of gebruik het `md:hidden` breakpoint (768px) zodat het alleen op mobiel verschijnt. Aangezien de gebruiker "tablet en mobiel" zegt, blijft `lg:hidden` correct maar we moeten ook de admin sidebar-staat meenemen: als de sidebar expanded is, verberg de bottom nav.

### 2. Sidebar combineert klant- EN bestelinfo + snelkoppelingen verwijderen uit header

**Probleem**: De header van ConversationDetail heeft aparte knoppen "Bestelling" en "Klantprofiel" naast de sidebar-toggle. De gebruiker wil dat die info IN de sidebar zit, niet als losse knoppen.

**Bestand**: `ConversationDetail.tsx`
- Verwijder de "Bestelling" en "Klantprofiel" knoppen uit de header (regels 191-218)
- Houd alleen: avatar, naam/email, sidebar-toggle (PanelRight), en ConversationActions dropdown
- Geef `linkedOrderId` door aan `CustomerInfoPanel` als prop

**Bestand**: `CustomerInfoPanel.tsx`
- Voeg bovenaan de sidebar snelkoppelingen toe als compacte links:
  - "Klantprofiel bekijken" → `/admin/customers/:id`
  - "Bestelling bekijken" → `/admin/orders/:id` (als linkedOrderId aanwezig)
- Toon uitgebreidere bestelinfo: status, betaalstatus, producten in de bestelling
- Fetch order_items voor de gekoppelde bestelling om productlijnen te tonen
- Verplaats de "Maak klant aan" actie ook naar de sidebar (voor wanneer er geen klant gekoppeld is)

### Resultaat header
Strakke header: `[←] [Avatar] Naam + email [📋 sidebar-toggle] [⋯ acties]`
Alle klant/bestel-details zitten in de uitklapbare sidebar.


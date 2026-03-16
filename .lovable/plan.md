

## Plan: AI Help Widget verbergen in POS + Fullscreen als dedicated POS modus

### Probleem 1: AI Help Widget in de weg
De floating AI-assistent knop overlapt met de POS-interface (zichtbaar in de screenshot rechtsonder). Dit moet weg op POS-pagina's.

### Probleem 2: Fullscreen toont nog steeds sidebar
De fullscreen-modus activeert alleen de browser Fullscreen API, maar de pagina draait nog binnen `AdminLayout` — dus de sidebar, header, trial banner en AI widget blijven zichtbaar. Dat is geen dedicated POS.

### Oplossing

#### 1. AI Help Widget verbergen op POS-pagina's
In `AIHelpWidget.tsx`: check de huidige route via `useLocation()`. Als het pad begint met `/admin/pos/` of `/kassa/`, render niets (`return null`).

#### 2. Fullscreen = standalone modus
Wanneer fullscreen actief is in `POSTerminal.tsx`, gedraag je als standalone:
- Verberg de terug-knop (net als standalone modus)
- Het component draait al in `h-screen flex flex-col` dus het vult het hele scherm

**Maar het echte probleem**: vanuit `/admin/pos/:terminalId` zit de pagina binnen `AdminLayout` (sidebar + header + main padding). Fullscreen API maakt het browservenster fullscreen, maar de AdminLayout DOM-structuur blijft.

**Oplossing**: Bij fullscreen, navigeer automatisch naar `/kassa/:terminalId` (de standalone route zonder AdminLayout). Bij exit fullscreen, navigeer terug naar `/admin/pos/:terminalId`. Dit geeft een écht dedicated POS-scherm.

Alternatief (eenvoudiger): de fullscreen-knop op de POS admin-pagina opent gewoon `/kassa/:terminalId?fullscreen=1` — combineert standalone route + fullscreen API. Geen heen-en-weer navigatie nodig.

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/help/AIHelpWidget.tsx` | Route-check: verberg op `/admin/pos/` en `/kassa/` |
| `src/pages/admin/POSTerminal.tsx` | Fullscreen-knop navigeert naar `/kassa/:terminalId?fullscreen=1` vanuit admin-route. In standalone modus blijft de toggle lokaal. |




## Fix: Inbox volle breedte + "Nieuw" knop positie

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Messages.tsx` | Padding naar 0 op mobiel, Card border/rounded verwijderen, "Nieuw" knop hoger plaatsen |

### Detail

**1. Padding volledig verwijderen op mobiel**
- Regel 154: `px-1 pt-2 pb-0` → `px-0 pt-1 pb-0`
- Regel 176: `px-1 pb-1` → `px-0 pb-0`

**2. Card styling op mobiel**
- De `Card` component (regel 177) heeft standaard `rounded-lg border shadow-sm` — op mobiel voegt dit visuele marges toe
- Voeg conditionele class toe: `isSinglePanel ? 'h-full flex overflow-hidden rounded-none border-x-0' : 'h-full flex overflow-hidden'`

**3. "Nieuw" knop hoger/compacter**
- De header `div` (regel 154-174) heeft `pt-2` padding die de knop te laag duwt
- Verander naar `pt-0.5` zodat de titel en knop dichter bij de top zitten
- Optioneel: de flex container (regel 155) `items-start` i.p.v. `items-center` zodat de knop beter uitlijnt met de titel

### Geen database wijzigingen nodig


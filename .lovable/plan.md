

## Recente Sessies verwijderen van POS-pagina

### Wat
De "Recente Sessies" sectie (regels 219-296) verwijderen van de POS overzichtspagina. De data is inderdaad te beperkt — alleen terminal naam, datum, status en kasverschil. Zonder omzet, transactieaantallen, medewerker en sessieduur is het niet nuttig.

### Aanpak
1. **Verwijder het hele "Recent Sessions Summary" blok** in `src/pages/admin/POS.tsx` (regels 218-296)
2. **Verwijder ongebruikte imports**: `Pause`, `CheckCircle2`, `AlertCircle` (als die nergens anders worden gebruikt), en de `usePOSSessions` hook call als die alleen hiervoor wordt gebruikt
3. De POS-pagina toont dan alleen de terminal-kaarten + aanmaak-dialog — schoon en gefocust

Sessie-historie met rijkere data (omzet per sessie, aantal transacties, medewerker, duur) kan later in een rapportage-sectie komen.

### Bestanden
- `src/pages/admin/POS.tsx` — verwijder sessie-sectie + cleanup imports




## Fix: Order Detail content wordt rechts afgeknipt op mobiel

### Probleem
Op 390px viewport wordt de rechterkant van alle content afgeknipt. Prijzen bij totalen, lange productnamen en e-mailadressen vallen buiten het scherm. Dit is een overflow-probleem: de kaarten en hun inhoud zijn breder dan het scherm.

### Oorzaak
De hoofd-container (`div.space-y-6`) en de grid missen `overflow-hidden` en `min-w-0` constraints. Op mobiel stackt de `lg:grid-cols-3` grid correct, maar de child-elementen (Cards) groeien breder dan de viewport omdat er geen overflow-beperking is.

Specifiek:
- Lange productnamen pushen de kaart breder
- Lange e-mailadressen (bijv. bol.com relay-emails) breken niet af
- Totaalbedragen aan de rechterkant worden afgekapt

### Wijzigingen in `src/pages/admin/OrderDetail.tsx`

1. **Hoofd-wrapper** (regel 101): voeg `min-w-0 overflow-hidden` toe
2. **Grid container** (regel 127): voeg `min-w-0 overflow-hidden` toe  
3. **Beide grid-kolommen** (regel 129, 291): voeg `min-w-0 overflow-hidden` toe
4. **Lange e-mailadres** (regel 359): voeg `break-all` toe zodat lange adressen wrappen
5. **Productnaam in compact mode** (regel 151): verander `truncate` → `break-words line-clamp-2` zodat je de volledige naam ziet

Eén bestand, puur CSS-class toevoegingen. Geen functionele wijzigingen.


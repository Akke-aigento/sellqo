

# Order detail mobiel optimaliseren

## Probleem
Op mobiel (390px viewport) is de order-detailpagina afgekapt: de tabel is te breed (min-w-[500px]), bedragen worden afgesneden, en de layout past niet goed in het scherm.

## Aanpak

**Bestand:** `src/pages/admin/OrderDetail.tsx`

1. **Order items tabel → mobiele kaart-layout**: De `min-w-[500px]` tabel vervangen door een responsieve weergave. Op mobiel worden orderregels als compacte kaarten getoond (afbeelding + naam + aantal × prijs), op desktop blijft de tabel. Dit voorkomt horizontaal scrollen.

2. **Header compacter**: De badges (status, betaalstatus, marketplace) wrappen al, maar de "Retour aanmaken" knop kan op mobiel full-width onder de header komen in plaats van ernaast.

3. **Totalen sectie**: De `px-0 sm:px-6` op CardContent aanpassen zodat de padding op mobiel consistent is.

4. **Klant & Adressen kaart**: De adres-grid (`grid-cols-1 sm:grid-cols-2`) is al goed, geen wijziging nodig.

5. **Verzending & Tracking / Documenten kaarten**: Controleren dat knoppen niet overlappen op 390px — eventueel `flex-wrap` toevoegen.

### Mobiele orderregel-layout (vervangt tabel op small screens)
```text
┌─────────────────────────────┐
│ [img] Product naam          │
│       SKU: ABC-123          │
│       1 × € 59,95  = € 59,95│
├─────────────────────────────┤
│ [img] Product naam 2        │
│       2 × € 29,95  = € 59,90│
└─────────────────────────────┘
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `src/pages/admin/OrderDetail.tsx` | Wijzigen — responsieve orderregels, header layout, padding fixes |



## Order Detail Mobiel Layout Optimalisatie

### Probleem
Op de order detail pagina (390px breed) zijn er layout-problemen:
1. **Orderregels tabel** heeft `min-w-[500px]` waardoor prijzen worden afgesneden (zichtbaar: "€ 1" in plaats van volledige prijs)
2. **Tabel layout** past niet op mobiel — productnaam, aantal en prijzen staan te krap
3. **Totalen sectie** mist rechter-uitlijning padding op kleine schermen

### Oplossing

**Bestand: `src/pages/admin/OrderDetail.tsx`**

1. **Orderregels — mobiele card-layout**: Vervang de tabel op mobiel door een compacte kaartlijst (zoals het bestaande admin-mobile-card-list patroon):
   - Product image + naam + SKU op één regel
   - Daaronder: aantal × prijs = totaal — alles zichtbaar zonder horizontaal scrollen
   - Verwijder de `min-w-[500px]` wrapper op mobiel

2. **Totalen sectie**: Voeg `px-4 sm:px-0` toe zodat de subtotaal/BTW/totaal rijen op mobiel voldoende padding hebben

3. **Gebruik `useIsMobile()` hook** om conditioneel tabel (desktop) vs cards (mobiel) te renderen — consistent met het bestaande patroon in de rest van het admin panel

### Voorbeeld mobiele orderregel-kaart
```text
┌─────────────────────────────┐
│ [img] VanXcel 230V Wall...  │
│       SKU: #12002           │
│       1 × €12,95 = €12,95   │
└─────────────────────────────┘
```

Geen database-wijzigingen nodig.

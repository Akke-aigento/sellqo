

## Retouren Overzicht Uitbreiden — Van Raadplegen naar Beheren

### Probleem
De "Retouren" tab op de Bestellingen-pagina is puur een leeslijst. Geen acties, geen detail, geen statuswijziging. De Bol.com `BolReturnsTab` heeft wél: detail sheet, accepteren/afwijzen, notities, stats. Dat patroon moet overgenomen worden naar het centrale overzicht.

### Wat we bouwen

**1. Statistieken bovenaan** (zelfde patroon als BolReturnsTab)
- Totaal retouren, Open/in behandeling, Afgehandeld, Afgewezen
- 4 compacte stat-cards

**2. Filters**
- Bron: Alle / Webshop / Marketplace
- Status: Alle / Geregistreerd / Goedgekeurd / Afgewezen / Ontvangen
- Zoeken op bestelnummer of klantnaam

**3. Klikbare rijen → Detail Sheet**
- Zelfde Sheet-patroon als BolReturnsTab
- Toont: klantgegevens, reden, items lijst, refund info (bedrag, methode, status)
- Interne notities (bewerkbaar + opslaan)
- Link naar bestelling

**4. Status wijzigen in detail sheet**
- Dropdown of knoppen: Geregistreerd → Goedgekeurd / Afgewezen / Ontvangen
- Direct update via Supabase `.update()` op `returns` tabel
- Bij statuswijziging naar "Goedgekeurd": optioneel refund triggeren (als nog niet verwerkt)

**5. Refund status weergave + actie**
- Als refund_status = 'pending' of 'failed': knop "Terugbetaling verwerken" (roept `process-order-refund` aan)
- Als refund_status = 'processed': groene badge met methode

### Technische aanpak

| Bestand | Wijziging |
|---|---|
| `src/components/admin/ReturnsOverview.tsx` | Volledig uitbreiden: stats, filters, klikbare rijen, detail Sheet |
| `src/hooks/useReturns.ts` | `useUpdateReturnStatus` mutation toevoegen |

- Hergebruik patronen uit `BolReturnsTab` (Sheet, notities, status badges)
- Geen nieuwe database kolommen nodig — alles bestaat al
- Geen nieuwe edge functions — status update gaat via directe Supabase update

### Resultaat
De Retouren-tab wordt een volwaardig beheerscherm: filteren, detail bekijken, status aanpassen, notities toevoegen, en refund status monitoren — voor alle kanalen in één view.


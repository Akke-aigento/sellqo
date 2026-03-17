

## Fulfillment-pagina uitbreiden voor magazijnmedewerkers

### Probleem
De fulfillment-pagina is nu een kale lijst: orders zien, tracking toevoegen, klaar. Een fulfillment-medewerker heeft veel meer nodig om z'n werk te doen. Momenteel kan hij:
- Orders filteren op status
- Tracking toevoegen (carrier + nummer)
- Batch: markeren als verzonden/afgeleverd, pakbonnen downloaden, labels printen, CSV export

Wat ontbreekt voor een echte werkplek:

### Toe te voegen features

**1. Order detail slide-over (zonder navigatie naar /admin/orders)**
Nu is de "Details" knop verborgen voor warehouse users (`!isWarehouse`). Dat is het probleem: ze MOETEN orderdetails kunnen zien. Oplossing: een **slide-over/sheet** die opent vanuit de fulfillment-tabel met:
- Klantgegevens + volledig verzendadres
- Productlijst met afbeeldingen, SKU's en hoeveelheden (uit `order_items`)
- Notities van de order (voor bijzonderheden)
- Tracking info + bewerken
- Knoppen: pakbon bekijken/printen, verzendlabel bekijken/printen

**2. Individuele pakbon + verzendlabel actieknoppen per order**
Nu zit pakbon/label alleen in de bulk-acties. Per order moet je direct:
- Pakbon genereren en openen (PDF)
- Verzendlabel openen/printen (als die al bestaat via shipping_labels tabel)
- Dit in de detail slide-over EN als snelle actieknoppen in de tabel

**3. Notities zichtbaar + bewerkbaar**
Warehouse moet interne notities (`internal_notes`) en klantnotities (`notes`) van een order kunnen lezen. Ze moeten zelf een warehoue-notitie kunnen toevoegen (bijv. "Pallet beschadigd", "Klant bellen voor adres").

**4. Snelle status-toggles per rij**
In plaats van alleen bulk: een snelle knop om een individuele order als "verzonden" of "afgeleverd" te markeren direct vanuit de tabelrij.

**5. Statistieken header**
Bovenaan: aantal te verzenden, vandaag verzonden, wachtend op label. Geeft direct overzicht.

### Technische aanpak

| Wat | Bestand | Aanpassing |
|-----|---------|-----------|
| Order detail sheet | Nieuw: `FulfillmentOrderSheet.tsx` | Sheet met klant, items, adres, notities, label/pakbon acties |
| Individuele pakbon knop | In sheet + tabelrij | Hergebruik `generatePackingSlipPdf` |
| Verzendlabel knop | In sheet + tabelrij | Query `shipping_labels` per order, open `label_url` |
| Notities sectie | In sheet | Lees/schrijf `notes` en `internal_notes` op orders |
| Snelle status-knop | `Fulfillment.tsx` tabelrij | Inline knop "Markeer verzonden" per rij |
| Stats header | `Fulfillment.tsx` | Query counts per fulfillment_status |
| Details-knop voor warehouse | `Fulfillment.tsx` | Verwijder `!isWarehouse` check, open sheet i.p.v. navigatie |

De sheet fetcht volledige orderdata inclusief `order_items` en `shipping_labels`. Geen nieuwe database-tabellen nodig — alles leest bestaande data.


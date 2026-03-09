

## Pakbon verbeteringen

### Problemen

1. **Tekstterugloop productnamen**: `pdf-lib`'s `drawText` met `maxWidth` wrapt tekst NIET — het knipt gewoon af. Lange productnamen zoals "VanXcel kabel 50mm2 (rood) - Accu - Aansluiting..." worden afgekapt.

2. **Geen apart logo voor documenten**: De tenant heeft alleen `logo_url`. Als dit een donker logo is (voor donkere achtergrond), ziet het er slecht uit op de witte pakbon-achtergrond.

### Oplossing

#### 1. Tekst-wrapping in `packingSlipPdf.ts`

Een `wrapText()` hulpfunctie toevoegen die lange tekst opsplitst in meerdere regels op basis van de beschikbare breedte. De rijhoogte wordt dynamisch berekend per item zodat lange productnamen volledig zichtbaar zijn.

```text
Huidige situatie:
| 5430004790167 | VanXcel kabel 50mm2 (rood) - Accu - A... | 1 |

Na fix:
| 5430004790167 | VanXcel kabel 50mm2 (rood) - Accu -   | 1 |
|               | Aansluiting - Verlichting - Waterpomp |   |
|               | - Camper - Auto - Boot - 12v -        |   |
|               | lopende meter                         |   |
```

#### 2. Document-logo veld toevoegen

- **Database migratie**: Kolom `document_logo_url` toevoegen aan de `tenants` tabel (nullable, string). Dit logo wordt specifiek gebruikt voor pakbonnen, facturen en andere documenten met lichte achtergrond.
- **Admin UI**: In de bestaande winkelinstellingen een extra logo-upload veld toevoegen: "Document logo (voor pakbonnen & facturen)". Met een tooltip die uitlegt dat dit logo op witte achtergrond wordt getoond.
- **PDF generator**: `packingSlipPdf.ts` aanpassen om `document_logo_url` te gebruiken als het beschikbaar is, met fallback naar `logo_url`.

### Bestanden

- `src/utils/packingSlipPdf.ts` — wrapText functie + dynamische rijhoogte + document_logo_url ondersteuning
- `src/pages/admin/OrderDetail.tsx` — `document_logo_url` meegeven aan PDF generator
- `src/components/admin/OrderBulkActions.tsx` — idem
- `src/components/admin/FulfillmentBulkActions.tsx` — idem
- Admin settings component — document logo upload veld toevoegen
- Database migratie — `document_logo_url` kolom op `tenants`


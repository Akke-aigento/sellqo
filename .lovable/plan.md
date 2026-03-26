

## Analyse: Retourenlogica — Huidige Staat & Wat Ontbreekt

### Hoe Bol.com retouren nu binnenkomen
- De `sync-bol-returns` edge function haalt retouren op van de Bol.com API en slaat ze op in de `returns` tabel
- De `useAutoSync` hook triggert dit automatisch (elke 30 min)
- Retouren zijn **alleen zichtbaar** in de Bol.com marketplace detail pagina → tab "Retouren" (`BolReturnsTab`)
- Ze verschijnen **niet** in de bestellingenlijst en **niet** op de order detail pagina

### Wat ontbreekt (kritiek)

| Probleem | Impact |
|---|---|
| **Geen handmatige retour voor webshop-bestellingen** | Tenants kunnen alleen Bol.com retouren afhandelen, niet hun eigen webshop orders |
| **Geen automatische terugbetaling** | Bij accepteren van een retour wordt er geen Stripe refund geïnitieerd (terwijl `pos-refund-payment` dit al kan voor POS) |
| **Returns tabel vereist `marketplace_connection_id`** (NOT NULL) | Webshop-retouren kunnen er niet in worden opgeslagen |
| **Geen retour-sectie op OrderDetail pagina** | Merchant ziet niet of er een retour is voor een specifieke bestelling |
| **Geen gecentraliseerd retouroverzicht** | Retouren van alle kanalen (Bol, webshop, etc.) zijn niet op één plek te beheren |
| **`internal_notes` kolom ontbreekt** | De code schrijft `internal_notes` maar de `returns` tabel heeft die kolom niet |

### Plan

**1. Database migratie**
- `marketplace_connection_id` nullable maken (webshop retouren hebben geen marketplace)
- `internal_notes TEXT` kolom toevoegen
- `refund_amount NUMERIC(10,2)` toevoegen (terugbetaald bedrag)
- `refund_status VARCHAR` toevoegen (pending, processed, failed, manual)
- `refund_method VARCHAR` toevoegen (stripe, bank_transfer, manual)
- `stripe_refund_id TEXT` toevoegen
- `source VARCHAR DEFAULT 'marketplace'` toevoegen (marketplace / manual)

**2. Edge function: `process-order-refund`**
- Ontvangt: `orderId`, `items` (welke items + qty), `reason`, `refundAmount`
- Checkt of de order een `stripe_payment_intent_id` heeft
  - **Ja** → automatische Stripe refund via Connect (zelfde patroon als `pos-refund-payment`)
  - **Nee** (bankoverschrijving) → markeert als "handmatige terugbetaling nodig" met IBAN info
- Maakt een `returns` record aan
- Zet order `payment_status` naar `refunded` (of `partially_refunded` bij gedeeltelijke retour)
- Optioneel: past voorraad aan (restock)

**3. OrderDetail.tsx — Retour-sectie toevoegen**
- Nieuwe "Retour" knop in de Acties & Status card (alleen zichtbaar bij betaalde orders)
- Opent een `OrderRefundDialog` (vergelijkbaar met `POSRefundDialog`):
  - Item selectie met hoeveelheid
  - Reden (verplicht)
  - Berekend terugbetaalbedrag
  - Indicator: "Automatische Stripe terugbetaling" vs "Handmatige bankoverschrijving"
  - Optie: "Voorraad herstellen"
- Na verwerking: retour verschijnt in tijdlijn + status updates

**4. Gecentraliseerd retouroverzicht**
- Nieuwe tab "Retouren" op de Orders pagina (naast de bestellingenlijst)
- Toont alle retouren van alle kanalen (Bol.com + webshop + POS) in één tabel
- Filter op bron, status, datum
- Klikbaar naar order detail

**5. Bestaande Bol.com retour-flow uitbreiden**
- Bij "Accepteren" van een Bol.com retour: optioneel Stripe refund triggeren als de order via Stripe is betaald

### Bestanden

| Bestand | Wijziging |
|---|---|
| Nieuwe migratie | Kolommen toevoegen, nullable maken |
| `supabase/functions/process-order-refund/index.ts` | Nieuw: retour + refund logica |
| `src/components/admin/OrderRefundDialog.tsx` | Nieuw: retour-aanmaak dialog |
| `src/pages/admin/OrderDetail.tsx` | Retour-knop + retourstatus weergave |
| `src/pages/admin/Orders.tsx` | Tab "Retouren" toevoegen |
| `src/components/admin/ReturnsOverview.tsx` | Nieuw: gecentraliseerde retourlijst |
| `src/hooks/useReturns.ts` | Nieuw: query hook voor returns |

### Verwacht gedrag

| Scenario | Resultaat |
|---|---|
| Webshop order betaald via Stripe → retour | Automatische Stripe refund + retour record |
| Webshop order betaald via bankoverschrijving → retour | Retour record + melding "handmatig terugbetalen naar IBAN" |
| Bol.com retour geaccepteerd | Bestaand gedrag + optioneel Stripe refund |
| Alle retouren bekijken | Eén overzicht onder Orders → Retouren tab |


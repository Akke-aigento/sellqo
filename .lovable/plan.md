

## Retouren Module Bouwen

### Overzicht
Volledige "Retouren" module toevoegen aan het admin panel. De `returns` tabel bestaat al in de database met enum `return_status` (registered, in_transit, received, approved, rejected, exchanged, repaired). Er is een migratie nodig om ontbrekende kolommen/enum-waarden toe te voegen die aansluiten bij de gewenste workflow (o.a. `refunded` status).

### Database aanpassingen

**Migratie 1: Enum + kolommen uitbreiden**
- `return_status` enum uitbreiden met `refunded` waarde
- Controleren of `refund_status`, `refund_method`, `refund_amount`, `stripe_refund_id` kolommen bestaan (ze bestaan al volgens types.ts)

**Geen nieuwe tabel nodig** — `returns` tabel is al aanwezig met alle benodigde kolommen.

### Nieuwe bestanden

| Bestand | Doel |
|---|---|
| `src/pages/admin/Returns.tsx` | Retouroverzicht pagina met tabel, filters, zoekfunctie |
| `src/pages/admin/ReturnDetail.tsx` | Detail pagina voor individuele retour met statusflow + terugbetaling |
| `src/hooks/useReturns.ts` | Hook voor CRUD operaties op returns tabel |
| `src/components/admin/ReturnStatusBadge.tsx` | Status badges voor retourstatus + refund status |
| `src/components/admin/ReturnFilters.tsx` | Filters op status, bron, datumbereik, zoeken |
| `src/components/admin/CreateReturnDialog.tsx` | Dialog om retour aan te maken vanuit order detail |
| `supabase/functions/process-refund/index.ts` | Edge function die Stripe refund uitvoert of status-only update doet |
| `supabase/functions/create-return-label/index.ts` | Placeholder edge function voor toekomstige SendCloud integratie |

### Bestaande bestanden aanpassen

| Bestand | Wijziging |
|---|---|
| `src/components/admin/sidebar/sidebarConfig.ts` | "Retouren" toevoegen als child van Bestellingen |
| `src/App.tsx` | Routes `/admin/returns` en `/admin/returns/:id` toevoegen |
| `src/pages/admin/OrderDetail.tsx` | "Retour aanmaken" knop toevoegen |

### Functionaliteit per onderdeel

**1. Retouroverzicht (`Returns.tsx`)**
- Tabel: retour-ID, order-nummer, klant, status, bron, refund status, aanmaakdatum
- Filters: status, bron (manual/bolcom/amazon), zoeken op order-ID of klantnaam
- Klikbaar naar detail pagina
- Zelfde UI-patronen als Orders pagina (Card, Table, filters)

**2. Retour Detail (`ReturnDetail.tsx`)**
- Alle retour-info: order link, klant, producten, reden, notities
- Statusflow knoppen: Geregistreerd → In transit → Ontvangen → Goedgekeurd/Afgewezen → Terugbetaald
- Terugbetaling sectie:
  - Stripe order → "Terugbetalen via Stripe" knop → roept `process-refund` aan
  - Bol.com order → melding "Terugbetaling via Bol.com"
  - Amazon order → melding "Terugbetaling via Amazon"
- Retourlabel knop (alleen zichtbaar als verzendplatform gekoppeld is)
- Interne notities veld

**3. Retour aanmaken vanuit Order (`CreateReturnDialog.tsx`)**
- Product-selectie met aantallen uit de order items
- Reden selectie (defect, verkeerd product, niet naar wens, anders)
- Maakt `returns` record aan met `source: 'manual'`, gekoppeld aan order + klant

**4. Edge function `process-refund`**
- Input: return_id
- Checkt `refund_method`:
  - `stripe` → Stripe Refund API via Connect (met `stripe_payment_intent_id` van de order)
  - `bolcom` / `amazon` → alleen status update naar `refunded`
  - `manual` → status update
- Update `refund_status` en `stripe_refund_id` op de returns record

**5. Edge function `create-return-label`**
- Placeholder: retourneert melding dat SendCloud integratie nog niet beschikbaar is
- Structuur voorbereid voor toekomstige implementatie

### Sidebar navigatie
"Retouren" wordt toegevoegd als child item onder "Bestellingen" (naast Alle bestellingen, Fulfillment, Facturen, Offertes):
```
Bestellingen
  ├── Alle bestellingen
  ├── Fulfillment
  ├── Retouren        ← nieuw
  ├── Facturen
  └── Offertes
```


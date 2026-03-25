

## Retour Afhandeling: Review Workflow + Auto-Accept Toggle

### Wat we bouwen

**1. Retour detail/review paneel**
Klikbare rijen in de retourentabel. Bij klik opent een detail-dialog/sheet met:
- Klantgegevens + bestelling link
- Retour-reden (hoofdreden + detail van Bol.com)
- Per item: product, EAN, hoeveelheid, reden
- Interne notities veld (tenant kan aantekeningen maken)
- Actieknoppen: **Accepteren** / **Afwijzen**

**2. Accepteer/Afwijs flow**
- "Accepteren" → update status naar `approved` in DB + call naar Bol.com API (`PUT /returns/{returnId}`) met `handlingResult: RETURN_RECEIVED`
- "Afwijzen" → status `rejected` + Bol.com API met `handlingResult: RETURN_DOES_NOT_MEET_CONDITIONS`
- Na actie: toast bevestiging + tabel refresh

**3. Edge function: `handle-bol-return`**
Nieuwe edge function die de Bol.com Returns API aanroept om een retour te accepteren of af te wijzen. Accepteert `connectionId`, `returnId`, `action` (accept/reject) en optioneel `quantityReturned`.

**4. Auto-accept toggle in connection settings**
In de `marketplace_connections.settings` JSON een `autoAcceptReturns: boolean` veld. Toggle zichtbaar in de Retouren tab header. Wanneer aan: de `sync-bol-returns` function accepteert nieuwe retouren automatisch via de Bol.com API bij sync.

**5. Interne notities kolom**
Migratie: `ALTER TABLE returns ADD COLUMN internal_notes text`. Tenant kan per retour notities opslaan voor intern gebruik.

### Bestanden

| Bestand | Actie |
|---|---|
| SQL migratie | `internal_notes` kolom op `returns` |
| `supabase/functions/handle-bol-return/index.ts` | **Nieuw** — accept/reject via Bol.com API |
| `supabase/functions/sync-bol-returns/index.ts` | Auto-accept logica toevoegen wanneer setting aan staat |
| `src/components/admin/marketplace/BolReturnsTab.tsx` | Klikbare rijen, detail dialog, accept/reject knoppen, auto-accept toggle, notities |

### Flow

```text
Retour binnenkomt via sync
  → Status "Aangemeld" (oranje badge)
  → Tenant klikt op retour → detail dialog opent
  → Bekijkt reden, klant, items
  → Voegt eventueel notitie toe
  → Klikt "Accepteren" of "Afwijzen"
  → Edge function → Bol.com API
  → Status update in DB
  → Tabel refresht

OF: Auto-accept AAN
  → Sync haalt nieuwe retour op
  → Automatisch accepteren via Bol.com API
  → Status direct "Goedgekeurd"
```


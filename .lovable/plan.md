
# Vertaal Hub — intuïtievere bulk-flow + correcte kost-preview

## Probleem (jouw screenshot)

1. **"Geschatte kost: ~0 credits"** klopt niet. De bulk-dialog rekent met `pendingEntities.products.length`, een lijst die alleen entities met coverage < 100% bevat én bovendien pas vult wanneer `settings` geladen is (anders 0). Bij VanXcel toont stats "0% dekking" maar tegelijk "0 nog te vertalen" → de teller voor de kost valt op 0 terug terwijl er feitelijk 26 producten × 5 velden × 3 talen ≈ **390 credits** nodig zijn.
2. **Alles-of-niets**: de dialog vertaalt altijd álle producten naar álle doeltalen uit settings. Geen keuze voor welke items, welke talen, of enkel ontbrekende vs alles overschrijven.
3. **Geen selectie in de tabel** zelf — je kan per rij wel één-knops vertalen, maar niet bv. "deze 5 producten naar enkel FR".

---

## Gewenst gedrag

Eén intuïtieve bulk-flow met expliciete keuzes vóór "Start Vertaling":

- **Welke items?** Alle / Alleen onvolledige / Specifieke selectie (checkbox-selectie in de content-tabel).
- **Welke talen?** Multi-select chips (EN / DE / FR) — los van de globale settings.
- **Welke modus?** Alleen ontbrekende velden (default, goedkoop) / Alles overschrijven (duurder, behalve vergrendelde vertalingen).
- **Live kost-preview** die de échte formule gebruikt: `items × velden_per_type × geselecteerde_talen × cost_per_field`, met aftrek voor reeds bestaande vertalingen wanneer "alleen ontbrekende" actief is.
- **Disabled "Start" + duidelijke CTA "Credits bijkopen"** bij ontoereikend saldo (platform_admin blijft onbeperkt).

---

## Scope van wijzigingen (frontend only)

### `src/pages/admin/TranslationHub.tsx`
- Checkbox-kolom in de content-tabel + "selecteer alles" header-checkbox; selectie-state per `entity_type`.
- Vervang de huidige `AlertDialog` door een rijkere `Dialog` met drie secties:
  1. **Scope** — radio: `Alle (N) / Onvolledige (M) / Geselecteerde (K)`.
  2. **Doeltalen** — toggelbare badges (default = settings.target_languages, niet meer vastgepind).
  3. **Modus** — radio `missing` / `all` (mapt 1-op-1 op de edge function).
- Kost-preview gebruikt:
  - `items` = scope-keuze
  - `velden` = `FIELDS_PER_ENTITY[selectedEntityType]`
  - `talen` = geselecteerde talen (niet settings)
  - bij `missing`-modus: trek bestaande vertalingen af via een nieuw `missingByEntity` mapje uit `pendingEntities` (per entity: `missing` veld vermenigvuldigd met aandeel geselecteerde talen / alle talen — voldoende benadering).
- Bulk-knop toont kost inline (bv. "Bulk Vertalen · ~390 credits") als secundair signaal.

### `src/hooks/useTranslations.ts`
- `pendingEntities` ook entities met coverage 100 returnen (niet filteren), zodat scope `Alle` / `Onvolledige` allebei klopt; UI filtert zelf.
- `startBulkTranslation` payload uitbreiden met optionele `entityIds?: string[]` (door-piped naar edge function — die accepteert het al voor de single-entity flow; voor bulk negeren we het indien backend het niet kent en vallen we terug op `mode`).
- Kleine helper `estimateBulkCost({ items, fields, languages, mode, existingByEntity })` exporteren zodat UI en eventuele andere call-sites consistent rekenen.

### Niet in scope (apart batchje)
- Edge function `ai-translate-content` aanpassen om een `entityIds`-lijst te accepteren voor bulk (nu is dat all-or-mode-gebaseerd). Als jij wil dat "Geselecteerde" écht alleen die ids vertaalt, dan moet de edge function mee — laat me weten of we dat meteen meepakken.
- `.limit(50)` in de edge function (backlog).

---

## Open vragen

- **Selectie-vertaling**: oké om in deze batch de UI al te tonen, maar functioneel pas live na een mini-update aan de edge function? Of liever in één batch met de edge-function-fix erbij?
- **Default talen in dialog**: overnemen uit `settings.target_languages` (huidige gedrag) of altijd alle 3 vooraan aangevinkt?

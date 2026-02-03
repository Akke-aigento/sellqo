
Context & observatie (op basis van je screenshot)
- In “Validatie resultaten” zie je exact 5 klanten, 5 producten (1 ok + 4 errors) en 5 bestellingen (4 ok + 1 error). Dat patroon wijst er sterk op dat de import-flow nog steeds met de “preview sample” werkt (5 rijen), niet met alle rijen.
- In de code zie ik wel degelijk dat we `allData` opslaan in `FileUpload.tsx` en dat `PreviewValidation.tsx` probeert `file.allData || file.sampleData` te gebruiken.
- De echte boosdoener is waarschijnlijk “stale previewData”: de wizard bouwt `previewData` maar één keer per datatype op en herberekent het niet wanneer je een bestand opnieuw uploadt of mappings verandert. Daardoor blijft `previewData` hangen op de oude set (die historisch 5 rijen was), en de import gebruikt precies diezelfde `previewData`.

Waarom dit gebeurt (technisch, maar concreet)
- `PreviewValidation.tsx` heeft deze guard:
  - “alleen verwerken als `!previewData.has(dataType)`”.
- `ImportWizard.tsx` wist `previewData` nooit wanneer:
  - je een nieuw bestand uploadt voor hetzelfde datatype, of
  - je mapping aanpast.
- Gevolg:
  - `previewData` blijft bestaan (met bv. 5 records), dus `PreviewValidation` herberekent niet.
  - `handleStartImport()` importeert op basis van `previewData` → dus ook maar 5.

Doel
- Zorgen dat bij file upload of mapping change de preview/validatie opnieuw opgebouwd wordt vanuit `allData` (alle rijen), zodat de import daadwerkelijk alles verwerkt.

Plan (stappen)
1) Recompute-trigger toevoegen in ImportWizard (meest robuust, kleinste wijziging)
   - In `src/components/admin/import/ImportWizard.tsx`:
     - In `handleFileUpload(dataType, file)`:
       - Na het opslaan van `uploadedFiles`: verwijder `previewData` entry voor dat datatype.
       - Optioneel: verwijder ook `mappings` voor dat datatype als je wil forceren dat mapping opnieuw gekozen wordt bij nieuw bestand (hangt af van gewenste UX). Meestal: mapping behouden is ok, maar preview móet opnieuw.
     - In `handleMappingChange(dataType, mapping)`:
       - Na het opslaan van `mappings`: verwijder `previewData` entry voor dat datatype.
   - Resultaat: `PreviewValidation` ziet “geen previewData voor dat datatype” en bouwt opnieuw op, dit keer met `allData`.

2) PreviewValidation defensiever maken (extra zekerheid)
   - In `src/components/admin/import/PreviewValidation.tsx`:
     - Vervang “alleen als previewData nog niet bestaat” door een check die herberekent wanneer file/mapping verandert.
     - Praktische aanpak zonder zware hashing:
       - Bewaar per datatype een “signature” in een `useRef` (bijv. `${file.file.name}:${file.rowCount}:${mapping.length}`).
       - Herbereken alleen als die signature verandert.
     - Waarom dit nuttig is:
       - Zelfs als ergens vergeten wordt `previewData` te clearen, herstelt dit het gedrag automatisch.
       - Voorkomt onnodig herberekenen bij elke render.

3) UX/Debug verbeteringen (om meteen te kunnen verifiëren dat het niet meer “op 5” blijft)
   - In `PreviewValidation`:
     - Toon in de samenvatting ook “records verwerkt” (bv. `records.length`) naast `file.rowCount`.
     - Als `records.length` verdacht laag is (bv. 5 terwijl rowCount 100 is), toon een waarschuwing “Preview is niet up-to-date, herlaad of upload opnieuw” (zou na fix niet meer moeten gebeuren, maar helpt bij support).

4) Testplan (end-to-end)
   - Scenario A: Nieuwe import (Shopify)
     1. Ga naar /admin/import
     2. Upload Customers CSV met 100 rijen
     3. Ga naar Preview: validatie moet niet meer plafonneren op 5; je ziet bv. “Toont eerste 100 van 100 records…” en in samenvatting tellen de totalen door.
     4. Start import: progress “Batch 1 van X” verschijnt; eindresultaat success_count ~100 (afhankelijk van validatie).
   - Scenario B: Upload bestand opnieuw (zelfde datatype)
     1. Upload eerst een klein bestand
     2. Upload daarna een groot bestand voor hetzelfde datatype
     3. Preview moet nu direct herberekenen (niet blijven hangen op de vorige 5).
   - Scenario C: Mapping aanpassen
     1. In mapping step wijzig een veld (bv. price)
     2. Preview moet herberekenen (records count verandert, valid count verandert).

Risico’s / edge cases
- Performance: preview berekenen over duizenden rijen kan traag zijn. We beperken UI-weergave al tot 100, maar validatie/transform gebeurt nog voor alles. Met de “signature” aanpak herberekenen we alleen wanneer nodig.
- Selecties: herberekenen reset “selected” flags. Dat is ok bij file/mapping change (want de inhoud is veranderd), maar we vermijden herberekenen bij simpele tab switches.

Deliverables (bestanden die aangepast worden)
- `src/components/admin/import/ImportWizard.tsx`
  - Clear `previewData` per datatype bij file upload en mapping change.
- `src/components/admin/import/PreviewValidation.tsx`
  - Herberekenen op basis van signature i.p.v. enkel “als previewData ontbreekt”.
  - (Optioneel) Extra “records verwerkt” debug/UX info.

Na deze fix verwacht resultaat
- De validatie-resultaten zullen niet langer “max 5” zijn.
- De import zal batches verwerken over alle geselecteerde records en de aantallen (customers/products/orders) kloppen met je CSV’s (minus echte validatiefouten).

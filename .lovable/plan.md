
Doel: `supabase/functions/cloudflare-api-connect/index.ts` volledig herschrijven zodat de DNS-sync exact en veilig werkt volgens jouw 3-record contract.

1) Core flow herschrijven (exacte API-sequentie)
- Domein normaliseren naar apex (`cleanDomain`).
- Zone ophalen met: `GET /zones?name={cleanDomain}`.
- Éénmalig alle records ophalen met: `GET /zones/{zone_id}/dns_records`.
- Geen generieke conflict-loops meer; alleen gerichte selectors voor 3 records.

2) Record 1 — Root A (`{domain}`)
- Zoek exact: `type === "A"` en `name === cleanDomain`.
- Bestaat: `PATCH /dns_records/{id}` met `content=185.158.133.1`.
- Bestaat niet: `POST` nieuw A-record.
- Geen deletes voor root-record.

3) Record 2 — WWW A (`www.{domain}`)
- Zoek exact op `name === "www.{domain}"` (één kandidaat, geen bulk-ops).
- Als gevonden type `CNAME`: eerst `DELETE` op dat ID, daarna `POST` nieuw A-record.
- Als gevonden type `A`: `PATCH` op dat ID naar `185.158.133.1`.
- Als niet gevonden: `POST` nieuw A-record.
- Geen andere names of recordtypes aanraken.

4) Record 3 — `_sellqo` TXT (`_sellqo.{domain}`)
- Zoek exact: `type === "TXT"` en `name === "_sellqo.{domain}"`.
- Bestaat: `DELETE` op dat specifieke ID, daarna `POST` nieuw TXT met `sellqo-verify={token}`.
- Bestaat niet: `POST` nieuw TXT-record.
- Geen enkele TXT op root (`@`) lezen/schrijven/verwijderen.

5) Resultaatstructuur per record (betrouwbare commerciële feedback)
- Per record teruggeven: `success`, `action` (`patched`, `created`, `deleted_and_created`, `error`), `record_id` (oude/nieuwe), en `error` detail.
- Totaalresultaat: `success` alleen true als alle 3 records slagen.
- Bestaande tenant-update behouden (alleen na succesvolle 3/3 uitvoering).

6) Veiligheidsrails in code
- Alle `PATCH/DELETE` alleen met ID’s die uit de éénmalige GET komen en exact matchen op het bedoelde record.
- Geen wildcard deletes, geen type-conflict sweep, geen iteratie over “alle mogelijke conflicten”.
- Uitdrukkelijk beperken tot deze 3 record-operaties.

7) Validatie na implementatie
- Testcase A: bestaand `www` CNAME -> wordt verwijderd + A aangemaakt.
- Testcase B: bestaand fout `_sellqo` TXT -> specifiek TXT verwijderd + nieuw TXT aangemaakt.
- Testcase C: SPF/DMARC/Google/MS records blijven volledig onaangeroerd.
- Testcase D: response toont duidelijke status per record + totaalstatus.

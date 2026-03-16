
Diagnose (grondig nagekeken)

1) Polling draait nu wel  
- Logs tonen: `Polling 8 orders...` en `Polling complete. 8 orders updated.`  
- Dus de cron + functie lopen.

2) Waarom pakketstatus toch “niet goed” lijkt  
- In `supabase/functions/poll-tracking-status/index.ts` mapt `normalizeStatus()` **“Zending geleverd”** niet naar `delivered` (regex mist `geleverd`).  
- Gevolg: bpost events met “geleverd” landen fout als `in_transit`.  
- Dit zie je in DB: meerdere orders met bpost-event “geleverd” maar `tracking_status = in_transit`.

3) Waarom Fulfillment “alles te verzenden” toont  
- `src/pages/admin/Fulfillment.tsx` toont badge op basis van `fulfillment_status`, niet `status`.  
- In DB staat veel data inconsistent: `status='shipped'` maar `fulfillment_status='unfulfilled'` (grote bulk).  
- Daardoor toont Fulfillment “Te verzenden” terwijl Orders-pagina “Verzonden” toont.

4) Bron van inconsistentie  
- Meerdere write-paths zetten `status` zonder `fulfillment_status` (of gebruiken `fulfilled` i.p.v. `shipped`) in o.a.:  
  - `supabase/functions/create-bol-vvb-label/index.ts` (already-shipped branch)  
  - `supabase/functions/confirm-bol-shipment/index.ts` (already-shipped branch)  
  - `supabase/functions/import-bol-csv/index.ts` (insert shipped zonder fulfillment_status)  
  - `src/hooks/useOrders.ts` (status update zonder fulfillment sync)

Do I know what the issue is?  
Ja: het is nu vooral een **status-normalisatie bug + dataconsistentie bug tussen `status` en `fulfillment_status`**.

Implementatieplan

1) Fix statusmapping in polling (directe kernfix)
- Bestand: `supabase/functions/poll-tracking-status/index.ts`
- `normalizeStatus()` uitbreiden zodat o.a. `geleverd`, `geleverd in brievenbus`, `veilige plaats`, `DELIVERED*` altijd `delivered` worden.
- `NO_DATA_FOUND` expliciet als `not_found` behandelen.

2) Canonicalisatie op databaseniveau (structurele fix)
- SQL migratie toevoegen:
  - `BEFORE INSERT OR UPDATE` trigger op `orders` die `fulfillment_status` automatisch normaliseert op basis van `status`.
  - Regels:
    - `status='delivered'` => `fulfillment_status='delivered'`
    - `status='shipped'` + fulfillment in (`null`,`unfulfilled`,`pending`,`fulfilled`) => `fulfillment_status='shipped'`
    - alias `fulfilled` normaliseren naar `shipped`
- Zo blijft data consistent, ongeacht welke frontend/edge-function schrijft.

3) Backfill bestaande foutieve orders
- In dezelfde migratie een eenmalige update:
  - `status='shipped'` + `fulfillment_status in ('unfulfilled','pending',null,'fulfilled')` => `fulfillment_status='shipped'`
  - `status='delivered'` + `fulfillment_status!='delivered'` => `fulfillment_status='delivered'`
- Dit lost direct de huidige “alles te verzenden” in Fulfillment op.

4) Hardening van bekende write-paths (voorkomt regressie)
- Bijwerken:
  - `create-bol-vvb-label` already-shipped path: ook `fulfillment_status='shipped'`
  - `confirm-bol-shipment` already-shipped path: `status/fulfillment_status/shipped_at` consistent zetten
  - `import-bol-csv`: bij shipped insert ook `fulfillment_status='shipped'`
  - `useOrders.ts` statusmutatie: bij shipped/delivered ook fulfillment_status mee updaten
- Eventuele `fulfilled`-waarde overal vervangen door `shipped`.

5) Fulfillment UI defensief maken
- `Fulfillment.tsx` badge/render defensief laten omgaan met legacy waarde `fulfilled` als `shipped`.
- (Kleine UX-verduidelijking) tonen dat defaultfilter “Te verzenden” actief is, zodat dit minder verwarrend is.

Validatie na implementatie

- Edge logs: check dat “Zending geleverd” nu naar `delivered` mapped (geen `in_transit` meer voor die teksten).
- DB checks:
  - geen mismatch meer: `status='shipped'` + `fulfillment_status='unfulfilled'`
  - recente bpost-orders krijgen `tracking_status='delivered'` waar van toepassing
- UI checks:
  - Orders-pagina en Fulfillment-pagina tonen consistente status
  - Fulfillment “Te verzenden” bevat alleen echte unfulfilled/pending orders

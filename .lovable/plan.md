
## Herstelplan: Bol auto-accept moet weer leidend zijn (zoals vroeger)

### Wat ik nu bevestigd heb
- Laatste order `#1134 / C0002X7WJJ` staat op `sync_status = accept_skipped`.
- `autoAcceptOrder = true` en `vvbEnabled = true` op de Bol-connectie.
- Er is wel een VVB-record aangemaakt, maar `pending` zonder `external_id`/tracking.
- In de huidige flow wordt een **Bol 403 bij accept** intern als **HTTP 200** teruggegeven in `accept-bol-order`, waardoor upstream code dit als “ok” behandelt en toch labelflow start.

### Root cause (regressie)
1. `accept-bol-order` zet bij 403 `sync_status = accept_skipped` en returnt status 200.  
2. `sync-bol-orders` en `create-bol-vvb-label` gebruiken vooral `acceptRes.ok`; door status 200 lijkt accept “geslaagd”.  
3. Retry voor accept kijkt nu niet structureel naar alle mislukte accept-states, terwijl VVB-retry `accept_skipped` wel meeneemt.  
=> Resultaat: labelflow kan starten terwijl order niet bevestigd geaccepteerd is.

---

## Implementatieplan

### 1) `accept-bol-order` stricter maken
**Bestand:** `supabase/functions/accept-bol-order/index.ts`
- Bij echte accept-fout (incl. 403): geen “succes-achtige” 200 meer teruggeven.
- Status zetten op `accept_failed` (niet `accept_skipped`) zodat retry mogelijk blijft.
- Response altijd eenduidig maken (`success: false` + duidelijke foutreden) zodat callers niet kunnen misinterpreteren.

### 2) Accept-gate afdwingen vóór VVB in sync-flow
**Bestand:** `supabase/functions/sync-bol-orders/index.ts`
- Na call naar `accept-bol-order` niet enkel `acceptRes.ok` checken, maar response-body parsen en alleen doorgaan wanneer accept echt bevestigd is.
- VVB auto-creatie alleen starten na geslaagde accept.
- Retry-query voor missed accepts verbreden naar states die opnieuw geprobeerd moeten worden (o.a. bestaande `accept_skipped` records), zodat oude gevallen automatisch herstellen.

### 3) VVB-retry alleen op correcte accept-state
**Bestand:** `supabase/functions/sync-bol-orders/index.ts`
- VVB-retry niet langer laten lopen op `accept_skipped`.
- Alleen orders nemen die effectief accepted-ready zijn voor labelgeneratie.

### 4) Handmatige/losse VVB-call ook harden
**Bestand:** `supabase/functions/create-bol-vvb-label/index.ts`
- Bij interne auto-accept vóór label: body valideren op echte accept-success.
- Bij accept-fout flow stoppen (niet verder naar label-aanmaak).

### 5) Recovery van huidige foutgevallen
**Database update (migratie):**
- Bestaande Bol-orders met `sync_status='accept_skipped'` die nog open staan naar retrybare status zetten (`accept_failed` of `synced`), zodat scheduler ze opnieuw correct door accept-flow stuurt.
- Hiermee wordt order `#1134` automatisch meegenomen in herstel.

---

## Technisch detail (kort)
- Kernfix = **status-code + success-contract consistent maken** tussen functies.
- Accept wordt “single source of truth”; label is downstream en mag pas lopen na accept-success.
- Retry wordt op accept-fouten gericht; VVB-retry alleen op accepted-ready orders.
- Geen UI-wijzigingen nodig; gedrag blijft afhankelijk van user setting `autoAcceptOrder`.

---

## Validatie na implementatie
1. Nieuwe Bol-order binnenhalen met `autoAcceptOrder=true` + `vvbEnabled=true`.
2. Controleren:
   - eerst `sync_status` naar `accepted` (of accept-pending -> accepted),
   - daarna pas label met `external_id`/tracking.
3. Bestaande probleemorder (`#1134`) moet via retry alsnog door accept-flow gaan en daarna label correct afronden.
4. Scheduler-logs moeten geen “label gestart terwijl accept faalde” meer tonen.

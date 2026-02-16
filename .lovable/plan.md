
# Volledige Audit: Bol.com Integratie Flow

Na grondige inspectie van alle 5 edge functions en de UI-component heb ik **7 problemen** gevonden die het proces breken of inconsistent maken.

---

## Huidige Flow (en waar het misgaat)

```text
Nieuwe order op Bol.com
        |
        v
[sync-bol-orders] -----> Importeert order in database
        |
        |-- autoAcceptOrder? --> [accept-bol-order] --> Accepteert bij Bol.com
        |                               |
        |                               |-- vvbEnabled? --> [create-bol-vvb-label]
        |                                                        |
        |                                                        |--> Label PDF + tracking
        |                                                        |--> Status = "shipped"
        |
        v
[create-bol-vvb-label] -----> Zet status "shipped" maar belt
                               NIET confirm-bol-shipment!    <-- BUG 1
        |
        v
[confirm-bol-shipment] -----> Bevestigt bij Bol.com met tracking
                               (wordt NOOIT automatisch aangeroepen) <-- BUG 2
```

---

## Gevonden Problemen

### BUG 1: VVB Label zet order op "shipped" maar bevestigt NIET bij Bol.com (KRITIEK)

**Bestand:** `create-bol-vvb-label/index.ts` regels 405-416

De functie zet de orderstatus lokaal op "shipped", maar roept `confirm-bol-shipment` NIET aan. Bol.com weet dus niet dat het pakket verzonden is. Dit betekent dat Bol.com de order als "open" blijft zien, wat kan leiden tot boetes of annuleringen.

**Fix:** Na het ophalen van de tracking info, automatisch `confirm-bol-shipment` aanroepen met het trackingnummer en de carrier.

### BUG 2: Handmatig VVB label accepteert niet eerst (MEDIUM)

**Bestand:** `BolActionsCard.tsx` regels 100-126

Wanneer je handmatig een VVB label aanmaakt, wordt de order niet eerst geaccepteerd bij Bol.com. Bol.com vereist dat een order eerst geaccepteerd is voordat je een shipment kunt bevestigen. De automatische flow in `sync-bol-orders` doet dit wel (eerst accept, dan VVB), maar de handmatige flow slaat dit over.

**Fix:** In `create-bol-vvb-label` controleren of de order al geaccepteerd is. Zo niet, eerst `accept-bol-order` aanroepen.

### BUG 3: `confirm-bol-shipment` gebruikt oude token-methode (MEDIUM)

**Bestand:** `confirm-bol-shipment/index.ts` regel 28

De token-functie plaatst `grant_type` in de URL query string in plaats van in de body, en mist de `Content-Type: application/x-www-form-urlencoded` header. Dit is dezelfde bug die eerder in `create-bol-vvb-label` was gefixed maar hier nog aanwezig is.

**Fix:** Dezelfde gestandaardiseerde `getBolAccessToken` overnemen.

### BUG 4: `confirm-bol-shipment` en `sync-bol-inventory` missen uitgebreide CORS headers (LAAG)

**Bestanden:** `confirm-bol-shipment/index.ts` regel 6, `sync-bol-inventory/index.ts` regel 6

Deze functies missen de `x-supabase-client-platform` headers, waardoor ze een 404/406 kunnen geven wanneer ze vanuit de frontend worden aangeroepen.

**Fix:** CORS headers bijwerken naar de standaard set.

### BUG 5: Dubbele status-velden: `sync_status` vs `marketplace_sync_status` (MEDIUM)

Twee verschillende velden worden door elkaar gebruikt:
- `sync-bol-orders` schrijft naar `sync_status` (waarden: "synced", "accepted")
- `create-bol-vvb-label` schrijft naar `marketplace_sync_status` (waarde: "shipped")
- `confirm-bol-shipment` schrijft naar `marketplace_sync_status` (waarde: "shipped")
- `BolActionsCard.tsx` leest `sync_status` (regel 179)

De UI kijkt naar `sync_status`, maar het shipped-status wordt naar `marketplace_sync_status` geschreven. Dit betekent dat de UI nooit ziet dat een order "shipped" is na VVB label creatie.

**Fix:** Consistent `sync_status` gebruiken in alle functies.

### BUG 6: `create-bol-vvb-label` zet status altijd op "shipped" (LAAG)

**Bestand:** `create-bol-vvb-label/index.ts` regels 405-416

Zelfs als het label niet correct aangemaakt is (geen PDF, geen tracking), wordt de status op "shipped" gezet. Dit zou alleen moeten gebeuren als het label succesvol is.

**Fix:** Alleen status "shipped" zetten als er daadwerkelijk een `transporterLabelId` en `trackingNumber` zijn.

### BUG 7: Quantity mapping in delivery-options kan onjuist zijn (LAAG)

**Bestand:** `create-bol-vvb-label/index.ts` regel 174

De code koppelt quantity aan de index positie (`orderItems[idx]`), maar de `bolOrderItemIds` is al gefilterd (items zonder `marketplace_order_item_id` zijn verwijderd). Hierdoor kan de index niet meer overeenkomen met het originele `orderItems` array.

**Fix:** Quantity direct uit het gefilterde item halen in plaats van via index.

---

## Oplossingsplan

### Stap 1: `create-bol-vvb-label/index.ts`
- Auto-accept toevoegen als order nog niet geaccepteerd is
- Na succesvolle label + tracking: `confirm-bol-shipment` aanroepen
- Status alleen op "shipped" zetten als label + tracking succesvol
- `marketplace_sync_status` vervangen door `sync_status`
- Quantity mapping fixen (uit gefilterd item halen)

### Stap 2: `confirm-bol-shipment/index.ts`
- Token-functie standaardiseren (Content-Type + body)
- CORS headers uitbreiden

### Stap 3: `sync-bol-inventory/index.ts`
- CORS headers uitbreiden

### Stap 4: `sync-bol-orders/index.ts`
- CORS headers uitbreiden (mist ook de extended set)

### Verwachte flow na fix

```text
[Handmatig VVB Label aanmaken]
1. Check: is order al geaccepteerd? Zo niet -> accept-bol-order
2. Delivery-options ophalen
3. Shipping label aanmaken bij Bol.com
4. Process-status pollen (entityId extractie)
5. Label PDF downloaden en opslaan
6. Tracking nummer ophalen
7. confirm-bol-shipment aanroepen -> Bol.com weet nu van verzending
8. Status "shipped" + sync_status "shipped" zetten
9. Klaar: label downloadbaar, tracking ingevuld, Bol.com bevestigd

[Automatische flow via sync-bol-orders]
1. Order importeren
2. accept-bol-order aanroepen
3. create-bol-vvb-label aanroepen (die nu zelf confirm-bol-shipment aanroept)
4. Alles in een keer afgehandeld
```

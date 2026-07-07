## Analyse

**1) Auto-update van retour track & trace?**
Nu niet. Voor **orders** loopt de automatische update via `tracking-webhook` (carriers/externe systemen pushen op basis van `tracking_number` → order lookup) en `shipping-webhook`. Voor **retours** is het puur handmatig — de velden `label_tracking_number` / `label_carrier` / `label_url` worden alleen bijgewerkt door de invoer die we net toevoegden.

**2) Retour-tijdlijn samenvoegen met bestelling-tijdlijn?**
Ja, dat maakt logisch één geheel. De order-tijdlijn is nu een hardgecodeerde reeks (Geplaatst → In behandeling → Verzonden → Afgeleverd). Retours hebben hun eigen `return_status_history`. Samenvoegen op de order-detailpagina geeft de winkelier één chronologisch verhaal.

## Plan

### A. Auto-tracking voor retours (backend)

1. **`tracking-webhook` uitbreiden**: als er geen order gevonden wordt op `tracking_number`, zoek in `returns.label_tracking_number`. Bij match:
   - update de retour: `label_carrier`, `label_url` en (nieuw veld) `label_last_status`, `label_last_event_at`.
   - map carrier-status naar retour-status: `in_transit`/`shipped` → `shipped`, `delivered` → `received`.
   - log in `return_status_history` met `flow_type='logistics'` en `source='tracking-webhook'`.
2. **Migratie**: kolommen `label_last_status text`, `label_last_event_at timestamptz`, `label_tracking_events jsonb` op `returns` (GRANTs meelopen).
3. **UI-indicator** in de nieuwe Track & Trace-kaart: badge "Automatisch bijgewerkt" met laatste event + tijdstip zodra `label_last_event_at` gezet is.
4. **Handmatig blijft mogelijk**: manuele wijziging overschrijft de auto-status en logt "manueel overschreven".

### B. Geünificeerde tijdlijn op bestelling-detail

1. **Nieuwe component** `src/components/admin/OrderReturnTimeline.tsx` die events samenvoegt uit:
   - order-lifecycle (geplaatst, betaald, verzonden, afgeleverd, geannuleerd)
   - **alle** retouren van deze order + hun `return_status_history` (aangevraagd, goedgekeurd, label verstuurd, verzonden door klant, ontvangen, geïnspecteerd, refund geïnitieerd, refund voltooid)
2. Events krijgen een **badge** "Bestelling" of "Retour {RMA}" zodat de winkelier ziet waar iets bijhoort. RMA-nummer klikbaar → retour-detail.
3. Bestaande tijdlijn-kaart in `OrderDetail.tsx` vervangen door deze component. Op `ReturnDetail.tsx` blijft de retour-specifieke stap-timeline staan (dat is een operationele flow-view, geen chronologische log).
4. Query via bestaande `useReturns(orderId)` + `useReturnStatusHistory` per retour, batched.

### Volgorde van uitvoering
1. Backend: migratie + `tracking-webhook` uitbreiden + auto-log naar `return_status_history`.
2. UI: `OrderReturnTimeline` bouwen en inpluggen in OrderDetail.
3. UI: auto-status-indicator in Track & Trace-kaart van ReturnDetail.

### Wat NIET verandert
- Geen nieuwe carrier-integraties: dit gebruikt de bestaande push-webhook. Als je later actief bpost/DHL wil pollen doen we dat in een aparte iteratie.
- Retour-detail behoudt zijn eigen operationele step-timeline (Goedgekeurd → Label verstuurd → …); die is een workflow-widget, niet dezelfde functie als de chronologische log.

Wil je dat ik zo doorbouw, of alleen deel A (auto-tracking) of alleen deel B (samengevoegde tijdlijn)?
## Hard Stop: maximaal 1 actief Bol VVB label per order

### Waarom

Order #1137 heeft op dit moment **200 shipping_labels rijen** in de DB, #1136 heeft er 91, en #1120 heeft zelfs nu nog **3 actieve** labels. De vorige retry-storm fix heeft de retry-loop wel gestopt, maar de schade is gedaan en er bestaat geen structurele garantie dat dit niet weer kan gebeuren als er ergens een nieuwe bug binnensluipt. We bouwen 3 onafhankelijke verdedigingslagen.

### Layer 1 — DB partial unique index (de echte hard stop)

Nieuwe migratie `prevent_duplicate_bol_vvb_labels.sql`:

1. **Pre-cleanup zombies**: rijen met `provider='bol_vvb'`, `label_url IS NULL`, `status IN (pending,created)`, ouder dan 1u → status `error`. (Vorige cleanup pakte deze al, maar idempotent herhalen voor de zekerheid.)
2. **Dedup actieve rijen**: per `order_id` alleen de nieuwste actieve (= status NOT IN error/cancelled) houden, oudere actieven worden `error` met `error_message` aangevuld. Dit pakt #1120 (3 actieve) en eventuele andere achterblijvers.
3. **Partial unique index** `uniq_active_bol_vvb_label_per_order` op `(order_id) WHERE provider='bol_vvb' AND status NOT IN ('error','cancelled')`. Postgres weigert nu fysiek élke INSERT die een 2e actief label per order zou opleveren. Audit trail van failed pogingen blijft behouden.
4. **Helper-index** `idx_shipping_labels_order_provider_status` op `(order_id, provider, status)` voor de idempotency lookup in Layer 2.
5. COMMENT op de unique index met context.

### Layer 2 — Idempotency guard in `create-bol-vvb-label`

Net vóór het block dat naar Bol's delivery-options/create-label endpoints gaat (rond regel 446-450), twee aanpassingen:

**2a. `force_new` mode niet meer hard deleten** maar markeren als `status='error'` met `error_message='Replaced by force_new request'`. Reden: de nieuwe unique index staat geen 2e actief label toe, dus de oude moet eerst non-actief worden i.p.v. weggegooid. Audit trail blijft ook beter.

**2b. Idempotency lookup vóór nieuwe label-creatie**: query `shipping_labels` op `order_id + provider='bol_vvb' + status NOT IN (error,cancelled)`. Als er al een actief label bestaat → return **HTTP 409** met de bestaande label-info en een hint (`Pass retry: true … or force_new: true …`). Geen Bol API call, geen kosten. De bestaande retry-mode (regel ~270 e.v.) draait al vóór dit blok en blijft ongewijzigd.

### Layer 3 — Defensive monitoring in `sync-bol-orders`

In de LABEL-PDF-RETRY sectie (rond regel 730), vlak vóór de bestaande `incompleteLabelOrders` query, een lichte scan toevoegen: tel actieve labels per order. Als één order ≥2 actieve labels heeft → `console.error('[CRITICAL] Detected N order(s) with multiple active VVB labels — DB constraint may have been bypassed: ...')`. Met de unique index uit Layer 1 zou dit nooit mogen triggeren, maar service-role + raw SQL kunnen het in theorie wel omzeilen. Vroege waarschuwing in monitoring zonder dat de business-flow geraakt wordt.

### Deploy-volgorde

1. Code-patches Layer 2 + Layer 3 toepassen.
2. `supabase--deploy_edge_functions` voor `create-bol-vvb-label` en `sync-bol-orders`.
3. Migratie van Layer 1 uitvoeren (pre-cleanup + dedup + index).

Reden voor deze volgorde: als de constraint vóór de idempotency guard live gaat, kan een lopende sync-cyclus rauwe `unique_violation` errors uitspuwen tussen migratie en deploy. Andersom worden 2e-pogingen netjes met 409 afgevangen vóór de DB constraint überhaupt nodig is.

### Verificatie na deploy

```sql
-- Per order maximaal 1 actief label
SELECT o.order_number,
       COUNT(*) FILTER (WHERE sl.status NOT IN ('error','cancelled')) AS active_labels,
       COUNT(*) AS total_labels
FROM orders o
LEFT JOIN shipping_labels sl ON sl.order_id = o.id AND sl.provider = 'bol_vvb'
WHERE o.marketplace_source = 'bol_com'
GROUP BY o.order_number
HAVING COUNT(*) > 0
ORDER BY active_labels DESC, total_labels DESC
LIMIT 50;

-- Index moet bestaan
SELECT indexname FROM pg_indexes
WHERE tablename = 'shipping_labels'
  AND indexname = 'uniq_active_bol_vvb_label_per_order';
```

Verwachte uitkomst: `active_labels` is voor élke order 0 of 1; index-query geeft 1 rij.

### Niet aangeraakt

- Geen wijziging aan de happy-path label-creatie of bestaande retry-mode.
- Geen wijziging aan `confirm-bol-shipment` of andere edge functions.
- Geen wijziging aan de `shipping_labels_status_check` constraint zelf.
- Geen frontend wijzigingen.

### Wat dit NIET dekt (ter info, geen actie)

De ~€300 aan reeds verloren label-kosten bij Bol kun je niet via code terughalen — dat vraagt contact met Bol partner support voor een eventuele duplicate-refund op factuur C00042CX12 (#1137).

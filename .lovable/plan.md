## Bol.com VVB retry-storm fix — drie bugs

Bevestigd in code + DB: `shipping_labels_status_check` accepteert alleen `pending,created,printed,shipped,delivered,cancelled,error` (dus `'failed'` faalt silent), en er staan momenteel ~20+ `pending`-rijen voor één order (#1137) die eindeloos retryen omdat het Bol-item al verzonden is (404). Plan past exact de drie voorgestelde fixes toe en ruimt de bestaande zombies op.

---

### Fix 1 — `supabase/functions/sync-bol-orders/index.ts` (regels 694-744)

LABEL-PDF-RETRY block volledig vervangen:

- `metadata` toevoegen aan de `.select(...)` van `shipping_labels`.
- `MAX_LABEL_RETRIES = 5` constante invoeren.
- Per label `retry_count = Number(meta.retry_count ?? 0)` lezen.
- Circuit breaker: bij `retry_count >= 5` → update naar `status: 'error'` + `error_message: 'Exceeded 5 retry attempts'` en `continue`.
- In de fetch-body **`label_id: label.id` meesturen** (de daadwerkelijke fix die retry-mode triggert in `create-bol-vvb-label`).
- Bij elke mislukte retry (HTTP non-2xx óf throw) `metadata` updaten met `{ ...meta, retry_count: retryCount + 1, last_retry_at: <iso> }`.
- 1s sleep tussen labels behouden.

### Fix 2 — `supabase/functions/create-bol-vvb-label/index.ts`

**2a. Regel 279** — vervang ongeldige status:
```ts
status: "failed",
```
door:
```ts
status: "error",
error_message: "Label not found at Bol.com (404) - may have expired",
```
(Voldoet nu aan de CHECK constraint, dus de update slaagt en het label valt definitief uit de retry-set.)

**2b. Regels 65-92** — `getBolAccessToken` met retry-wrapper:
- Loop met `MAX_AUTH_ATTEMPTS = 4`.
- 4xx → direct throw (geen retry, credentials zijn fout).
- 5xx of network/timeout → retry met exponentiële backoff `1s → 2s → 4s → 8s` (cap).
- Behoud bestaande `console.log` over `clientId.substring(0, 8)`.
- Behoud return-shape (`access_token` string).

### Fix 3 — `supabase/functions/sync-bol-orders/index.ts` (regels 73-105)

`getBolAccessToken` met **dezelfde** retry-wrapper als Fix 2b, maar respecteer de bestaande gecachte-token check bovenaan (return early als `accessToken` + `tokenExpiry` nog geldig zijn). Alleen het netwerk-stuk (token request) wordt in de retry-loop geplaatst.

### Recovery — zombie-labels opruimen

Migration die de huidige stuck rijen direct sluit zodat de eerstvolgende cyclus al schoon is:

```sql
UPDATE public.shipping_labels
SET status = 'error',
    error_message = COALESCE(error_message, 'Cleared by retry-storm recovery (item already shipped or label expired)')
WHERE provider = 'bol_vvb'
  AND label_url IS NULL
  AND (status = 'pending' OR status = 'created')
  AND created_at < now() - interval '1 hour';
```

(Filter op >1u oud zodat verse, lopende labels niet worden geraakt.)

### Deploy + verificatie

1. Code-wijzigingen toepassen (Fix 1, 2a, 2b, 3).
2. Migration uitvoeren voor de cleanup.
3. `supabase--deploy_edge_functions` voor `sync-bol-orders` en `create-bol-vvb-label`.
4. `supabase--edge_function_logs` checken voor beide functions: geen 400-storm meer, en bij een transient 500 op `login.bol.com` zie je nu `Retrying token request in 1000ms...` i.p.v. een hard fail.
5. DB-spotcheck: `SELECT count(*) FROM shipping_labels WHERE provider='bol_vvb' AND status='pending' AND label_url IS NULL` moet 0 zijn (of alleen verse rijen <1u).

### Niet aanraken

- Geen andere edge functions.
- Geen frontend hooks of UI.
- Geen wijziging aan de CHECK constraint zelf (we conformeren ons aan het bestaande schema).
- Geen wijziging aan de happy-path label-creatie of `confirm-bol-shipment`.

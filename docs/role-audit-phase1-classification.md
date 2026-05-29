# Fase 1 — Classificatie van Quick-Win Cases

> Read-only analyse op basis van live `pg_policies` / `pg_tables` (geen migrations, geen code).
> Geen DB- of code-wijzigingen tot deze lijst is gereviewd en goedgekeurd.

## Telling (live DB)

De eerdere schatting van **13 `USING(true)` + 2 RLS-disabled** klopt niet exact. De live DB toont:

- **3 tabellen met RLS disabled** (was 2)
- **19 policies met `USING(true)` of `WITH CHECK(true)`** (was 13)

Totaal **22 cases** ter beoordeling.

## Legenda

- **(A) Legitiem anon** — bedoeld voor storefront/tracking/lookup; anon behouden, maar bounding toevoegen (tenant/session/published).
- **(B) Intern** — mag niet anon zijn; tenant-scoped of service_role-only.
- **(C) Twijfel** — context ontbreekt; motivatie waarom verdere review nodig is.

## RLS-disabled tabellen (3)

| # | Tabel | Huidige staat | Klasse | Voorgesteld patroon |
|---|---|---|---|---|
| 1 | `shopify_dates_staging` | RLS uit | **B** | RLS aan + alleen `service_role` GRANT; geen policies voor anon/authenticated (import-staging table). |
| 2 | `stock_snapshot_pre_reconcile_20260430` | RLS uit | **B** | RLS aan + service_role-only. Snapshot/backup; overwegen: archiveren / droppen na verificatie. |
| 3 | `stock_snapshot_pre_reconcile_final` | RLS uit | **B** | Idem. Archiveren of `service_role`-only met expliciete REVOKE op anon/authenticated. |

## `USING(true)` / `WITH CHECK(true)` policies (19)

| # | Tabel | Policy (cmd, roles) | Klasse | Motivatie | Voorgesteld patroon |
|---|---|---|---|---|---|
| 1 | `ai_chatbot_conversations` | `Anyone can insert conversations` (INSERT, public) | **A** | Storefront-chatbot moet anoniem een gesprek kunnen starten. | `WITH CHECK (tenant_id IN (SELECT id FROM tenants))` + verplichte `session_id`. |
| 2 | `ai_chatbot_conversations` | `Anyone can update conversations` (UPDATE, public) | **C** | Anon kan elke conversation overschrijven (hijacking risico). Onduidelijk of update vanaf client nodig is of via edge function moet. | Indien client-update nodig: bind aan `session_id` cookie/header; anders intrekken en alleen via edge function `service_role`. |
| 3 | `ai_usage_log` | `Service role can insert AI usage logs` (INSERT, service_role) | **B** | `service_role` bypasst RLS sowieso → policy is redundant maar onschadelijk. | Behouden voor expliciete documentatie; geen anon/authenticated policy toevoegen. |
| 4 | `campaign_link_clicks` | `Service role can insert link clicks` (INSERT, service_role) | **B** | Redundant (service_role bypass). Tracking via edge function. | Behouden; expliciet REVOKE op anon. |
| 5 | `channel_field_mappings` | `Authenticated users can view mappings` (SELECT, authenticated) | **B** | Elke ingelogde user van elke tenant ziet alle mappings → cross-tenant lek. | Vervangen door `USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())))`. |
| 6 | `customer_events` | `Anon can insert events` (INSERT, anon) | **A** | Storefront-tracking (page views, add-to-cart) is anoniem. | `WITH CHECK (tenant_id IN (SELECT id FROM tenants) AND event_type IN (<whitelist>))`. |
| 7 | `customer_message_attachments` | `Service can insert attachments` (INSERT, public) | **C** | `public` (niet `service_role`) → elke anon kan attachment row inserten. Onduidelijk of dit nodig is voor storefront inbox of alleen via edge function. | Indien edge-only: scope naar `service_role`. Indien client: bind aan `message_id` via subquery op messages waar `customer_id` matcht. |
| 8 | `platform_settings` | `Anyone can read platform settings` (SELECT, authenticated) | **C** | "Platform settings" kan publieke config of secrets bevatten. Kolom-inspectie nodig vóór beslissing. | Bij publieke config: behouden. Bij secrets: kolom-filter via view of expliciete kolom-grants. |
| 9 | `product_bundle_items` | `Anon can view product bundle items` (SELECT, anon) | **A** | Storefront moet bundle-samenstelling tonen. | `USING (bundle_id IN (SELECT id FROM product_bundles WHERE is_active AND tenant_id IN ...))` — bound aan actieve bundle. |
| 10 | `product_variant_options` | `Service role full access on product_variant_options` (ALL, public) | **B** | `roles=public` met `true/true` → elke anon kan varianten CRUDden. Kritiek catalog-risico. | Splitsen: `service_role` ALL behouden; anon enkel SELECT met tenant/published-binding; tenant_admin/staff via has_tenant_role. |
| 11 | `product_variants` | `Service role full access on product_variants` (ALL, service_role) | **B** | Redundant (service_role bypass). Verbergt het feit dat er geen role-aware policy voor authenticated bestaat. | Behouden; aparte `tenant_admin/staff` policies toevoegen in fase 2. |
| 12 | `returns` | `Service role full access returns` (ALL, service_role) | **B** | Redundant; `returns` heeft momenteel géén user-facing policy → admin UI werkt enkel via edge function. | Behouden; user-policies (tenant_admin/staff) komen in fase 2. |
| 13 | `storefront_cart_items` | `Service role full access on storefront_cart_items` (ALL, service_role) | **B** | Cart-mutaties lopen via storefront edge function. Redundant maar onschadelijk. | Behouden; geen anon-policy toevoegen. |
| 14 | `storefront_carts` | `Service role full access on storefront_carts` (ALL, service_role) | **B** | Idem als 13. | Idem. |
| 15 | `storefront_customers` | `Service role full access on storefront_customers` (ALL, service_role) | **B** | Idem; PII-tabel, mag nooit anon-readable worden. | Behouden; expliciet REVOKE op anon/authenticated bevestigen. |
| 16 | `storefront_favorites` | `Service role full access on storefront_favorites` (ALL, public) | **A** | Wishlist; anon moet kunnen toevoegen via session. `roles=public` met `true/true` is te ruim. | Splitsen: `service_role` ALL; anon INSERT/SELECT/DELETE met binding op `session_id` (header) of via edge function. |
| 17 | `tenant_transaction_usage` | `System can insert/update transaction usage` (ALL, public) | **B** | Billing-tabel. `public` + `true/true` = elke anon kan usage manipuleren → factuurfraude risico. **Hoogste prioriteit fix.** | Beperken tot `service_role` ALL; tenant_admin alleen SELECT op eigen tenant. |
| 18 | `user_label_preferences` | `Service role full access on user_label_preferences` (ALL, service_role) | **B** | Redundant. Per-user voorkeuren — heeft authenticated-policy nodig. | Behouden; aparte `USING (user_id = auth.uid())` policy voor authenticated toevoegen in fase 2. |
| 19 | `vat_regimes` | `Anyone can read vat_regimes` (SELECT, public) | **A** | Globale lookup-tabel (12 BTW-regimes), geen tenant-data. | Behouden zoals is; reference data. |

## Samenvatting per klasse

| Klasse | Aantal | Tabellen |
|---|---|---|
| **A** legitiem anon (bounding toevoegen) | 5 | `ai_chatbot_conversations` (INSERT), `customer_events`, `product_bundle_items`, `storefront_favorites`, `vat_regimes` |
| **B** intern (anon afsluiten / tenant-scoped) | 14 | RLS-disabled (3) + `ai_usage_log`, `campaign_link_clicks`, `channel_field_mappings`, `product_variant_options`, `product_variants`, `returns`, `storefront_cart_items`, `storefront_carts`, `storefront_customers`, `tenant_transaction_usage`, `user_label_preferences` |
| **C** twijfel (review nodig) | 3 | `ai_chatbot_conversations` (UPDATE), `customer_message_attachments`, `platform_settings` |

## Aanbevolen reviewvolgorde bij goedkeuring

1. **Hoogste risico eerst**: `tenant_transaction_usage` (#17), `product_variant_options` (#10), `channel_field_mappings` (#5).
2. **RLS-disabled tabellen**: cases #1–3 (snapshots + shopify staging).
3. **C-cases** beantwoorden vóór patch: #2, #7, #8.
4. **A-cases** met bounding: #1, #6, #9, #16 (en #19 ongewijzigd laten).
5. **B-redundante service_role policies**: cosmetisch; optioneel meenemen om verwarring weg te halen.

---

## Batch 1B — Anon-bounding clauses (ter review)

`tenants` heeft geen `active`-boolean of per-feature flags; de bruikbare proxy is
`subscription_status IN ('active','trial')` (live waardes: 6× active, 2× trial).
RLS dekt geen volume — rate-limiting hoort op de edge-function-laag (zie aanbevelingen onderaan).

### #1 `ai_chatbot_conversations` INSERT (anon)
```sql
DROP POLICY "Anyone can insert conversations" ON public.ai_chatbot_conversations;
CREATE POLICY "Anon can start conversations"
ON public.ai_chatbot_conversations FOR INSERT TO anon
WITH CHECK (
  tenant_id IN (SELECT id FROM public.tenants WHERE subscription_status IN ('active','trial'))
  AND session_id IS NOT NULL
  AND length(session_id) BETWEEN 8 AND 128
  AND message_count IS NULL              -- nieuwe conversatie start leeg
);
```
Bounding: tenant moet bestaand+actief zijn, `session_id` verplicht (kolom is NOT NULL maar wordt nu niet gevalideerd op formaat), geen pre-populated counters.

### #6 `customer_events` INSERT (anon)
```sql
DROP POLICY "Anon can insert events" ON public.customer_events;
CREATE POLICY "Anon can insert tracking events"
ON public.customer_events FOR INSERT TO anon
WITH CHECK (
  tenant_id IN (SELECT id FROM public.tenants WHERE subscription_status IN ('active','trial'))
  AND session_id IS NOT NULL
  AND event_type = ANY (ARRAY[
    'page_view','product_view','add_to_cart','remove_from_cart',
    'checkout_start','search','wishlist_add','email_open','email_click'
  ])
);
```
Whitelist gelijk aan `VALID_EVENT_TYPES` in `track-storefront-event/index.ts`.
**Open vraag:** alle huidige tracking-flows lopen via edge function (`track-storefront-event`) met `service_role`. Een directe anon-INSERT policy lijkt dood pad — overweeg deze policy te **DROPPEN zonder vervanging** en client-side tracking exclusief via edge function te forceren. Voorkeur vraagt jouw bevestiging.

### #7 `customer_message_attachments` INSERT (groen licht)
Gateway bevestigd in `handle-inbound-email` (regels 156/281/592). Geen client-side schrijvers.
```sql
DROP POLICY "Service can insert attachments" ON public.customer_message_attachments;
-- Geen vervanging: enkel service_role (bypasst RLS) mag inserten.
REVOKE INSERT ON public.customer_message_attachments FROM anon, authenticated;
```

### #9 `product_bundle_items` SELECT (anon)
```sql
DROP POLICY "Anon can view product bundle items" ON public.product_bundle_items;
CREATE POLICY "Anon can view active bundle items"
ON public.product_bundle_items FOR SELECT TO anon
USING (
  bundle_id IN (
    SELECT id FROM public.product_bundles
    WHERE is_active = true
      AND tenant_id IN (SELECT id FROM public.tenants WHERE subscription_status IN ('active','trial'))
  )
);
```
(Schema van `product_bundles` nog te verifiëren in Batch 1C — kolomnaam `is_active` aangenomen.)

### #10 `product_variant_options` (kritiek catalog-risico)
```sql
DROP POLICY "Service role full access on product_variant_options" ON public.product_variant_options;
-- service_role bypasst RLS, dus aparte policy niet nodig.
CREATE POLICY "Anon can view options of active variants"
ON public.product_variant_options FOR SELECT TO anon
USING (
  variant_id IN (
    SELECT v.id FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.is_active = true AND p.is_active = true AND p.hide_from_storefront = false
  )
);
CREATE POLICY "Tenant staff can manage variant options"
ON public.product_variant_options FOR ALL TO authenticated
USING (
  variant_id IN (
    SELECT v.id FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(),'tenant_admin') OR has_role(auth.uid(),'staff'))
) WITH CHECK (
  variant_id IN (
    SELECT v.id FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(),'tenant_admin') OR has_role(auth.uid(),'staff'))
);
```
(Te verifiëren in 1C of `product_variant_options` daadwerkelijk `variant_id`-kolom heeft.)

### #16 `storefront_favorites` (geen session_id, wel `customer_id`)
`storefront_favorites` heeft géén `session_id`-kolom — anon-binding via session is niet mogelijk zonder schema-uitbreiding. Twee opties:

**A. Forceer alle wishlist-mutaties via edge function (aanbeveling).**
```sql
DROP POLICY "Service role full access on storefront_favorites" ON public.storefront_favorites;
-- Geen anon policies. service_role bypasst RLS.
REVOKE ALL ON public.storefront_favorites FROM anon;
```

**B. Sta anon CRUD toe gekoppeld aan een geldige `storefront_customer_id` (vereist dat de client een geverifieerde customer-cookie meestuurt — kwetsbaar tenzij gekoppeld aan signed token).** Niet aanbevolen tenzij wishlist-edge-function ontbreekt.

Mijn voorkeur: **A**, mits er een `wishlist-toggle` edge function bestaat — anders Eerst die bouwen in fase 2.

### #17 (al in 1A) — `tenant_transaction_usage` REVOKE
Voor de paper-trail: na 1A blijft `service_role` ALL implicit (bypass). Geen anon/authenticated INSERT/UPDATE meer mogelijk.

### Rate-limiting (edge-function-laag)
RLS valideert structuur, niet volume. Aanbevolen toevoegingen vóór 1B live gaat:
- `track-storefront-event`: caps per `ip_hash + tenant_id` (bijv. 600 events/uur).
- Chatbot-conversations: per `ip_hash` 30 INSERTs/uur, per `session_id` 1 INSERT/min.
- `customer_message_attachments`: niet anon-bereikbaar na #7, dus n.v.t.

---

## Skip-lijst justificaties (paper-trail voor pentest-debrief)

Negen policies tonen `USING(true)` of `WITH CHECK(true)` in `pg_policies`, maar zijn niet end-user-bereikbaar omdat hun `TO`-clausule beperkt is tot `service_role` óf omdat het bewust publieke reference-data betreft. Geen fix nodig; documentatie zodat de policies bij audit niet als anomalie verschijnen.

| # | Tabel | Policy (cmd, TO) | Waarom geen end-user trigger | Noot |
|---|---|---|---|---|
| 3 | `ai_usage_log` | `Service role can insert AI usage logs` (INSERT, **service_role**) | `TO service_role` — geen JWT van een end-user matched ooit deze rol. Anon/authenticated INSERT loopt via aparte policy met `tenant_id`-check. | Redundant t.o.v. impliciete bypass; behouden voor documentatie-intent. |
| 4 | `campaign_link_clicks` | `Service role can insert link clicks` (INSERT, **service_role**) | Idem — alleen aanroepbaar door functies met service-key (email-click-handler edge function). | Idem. |
| 11 | `product_variants` | `Service role full access on product_variants` (ALL, **service_role**) | `TO service_role` — end-user paden lopen via tenant-staff/anon policies die wel `tenant_id`-binding hebben. | Cosmetisch; bypass is sowieso impliciet. |
| 12 | `returns` | `Service role full access returns` (ALL, **service_role**) | Idem. Tenant-policies (INSERT/UPDATE/SELECT) zijn correct gescoped op `get_user_tenant_ids()`. | Cosmetisch. |
| 13 | `storefront_cart_items` | `Service role full access on storefront_cart_items` (ALL, **service_role**) | `TO service_role`; storefront-mutaties lopen via storefront API edge function. End-user-SELECT gaat via `tenant_id`-policy. | Geen anon-policy nodig — alle cart-CRUD is edge-function-only. |
| 14 | `storefront_carts` | `Service role full access on storefront_carts` (ALL, **service_role**) | Idem als 13. | Idem. |
| 15 | `storefront_customers` | `Service role full access on storefront_customers` (ALL, **service_role**) | `TO service_role`; PII-tabel is bewust niet anon-bereikbaar. End-user SELECT enkel via platform_admin policy. | Cosmetisch + extra REVOKE-zekerheid aanbevolen in fase 2. |
| 18 | `user_label_preferences` | `Service role full access on user_label_preferences` (ALL, **service_role**) | `TO service_role`; per-user CRUD policies (`user_id = auth.uid()`) bestaan al voor authenticated. | Cosmetisch. |
| 19 | `vat_regimes` | `Anyone can read vat_regimes` (SELECT, **public**) | Bewust publieke reference-data: 12 BTW-regime-definities, geen tenant-scope, geen PII. Anon SELECT met `USING(true)` is hier de juiste pattern. | Behouden zoals is. |

Conclusie: 8/9 zijn cosmetische service_role-policies die de impliciete bypass dupliceren; 1/9 (`vat_regimes`) is intentioneel publiek. Geen van deze 9 vormt een aanvalsvector. Optioneel in fase 2 op te ruimen voor leesbaarheid van `pg_policies`.

---

## #8 `platform_settings` — schema + voorbeeldrow

| Kolom | Type | Nullable |
|---|---|---|
| `id` | text | NOT NULL (primary key, fungeert als settings-key) |
| `value` | jsonb | NOT NULL |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

**Live inhoud (1 row):**
```json
{
  "id": "bank_details",
  "value": {
    "beneficiary": "SellQo BV",
    "iban": "BE•• •••• •••• ••••",
    "bic": "GEBABEBB"
  }
}
```

**Observatie:** de enige bestaande key is `bank_details` — platform-IBAN voor inkomende klantbetalingen. Dit hoort **niet** publiek leesbaar te zijn (concurrenten/scrapers kunnen tenant→platform geldstroom in kaart brengen, en IBAN is GDPR-gevoelig voor SellQo BV). Huidige `SELECT TO authenticated USING(true)` lekt dit naar elke ingelogde tenant-user.

**Drie opties (jouw keuze):**

- **(a) `is_public` boolean kolom** — flexibel, één tabel. Nieuwe failure-mode: vergeten `is_public=false` te zetten = stille lek bij nieuwe key.
- **(b) Aparte `platform_settings_public` tabel/view** — striktere scheiding, geen "vergeten flag"-risico. Vereist code-aanpassing als ooit een key publiek moet.
- **(c) Platform-admin only, voorlopig** — strikst en simpelst nu er nul publieke keys zijn. Migreer naar (a) of (b) bij eerste publieke usecase.

Aanbeveling: **(c)** nu (laagste risico, geen schema-mutatie), **(b)** zodra een publieke key opduikt.

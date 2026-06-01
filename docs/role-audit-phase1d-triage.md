# Fase 1D — Triage van 13 misnamed "Service role" policies

**Doel:** bepalen welke van de 13 policies (gevonden via post-1C grep) écht write-capable + cross-tenant-exposed zijn (→ moet pre-pentest gefixt) en welke veilig kunnen wachten op Fase 2 cosmetische opschoning.

**Grep gebruikt** (op productie-DB uitgevoerd, 13 hits — match):
```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname ILIKE '%service%' OR policyname ILIKE '%system%'
    OR policyname ILIKE '%edge%' OR policyname ILIKE '%cron%'
    OR policyname ILIKE '%webhook%')
  AND NOT ('service_role' = ANY(roles));
```

## Belangrijk inzicht vooraf

Het Fase 1C-probleem (`product_variant_options`) was specifiek: een policy met `qual = true` (of `WITH CHECK = true`) onder `TO public`. Dat gaf anon écht ongebonden write-toegang.

Bij deze 13 hits is dat **niet** het geval: elke policy heeft óf een `qual` die expliciet de service_role JWT eist, óf een tenant-scoped clause via `auth.uid()` / `user_roles`. Onder `TO public` valt anon daar automatisch buiten (geen `auth.uid()`, dus subquery levert lege set). De policies zijn dus functioneel correct maar **cosmetisch fout** — verkeerde naam, verkeerde role-set, deels redundant (service_role bypasst RLS sowieso).

**Conclusie vooraf: geen enkele case is 🔴 KRITISCH.** Alle 13 zijn óf 🟡 (cleanup, low effort) óf 🟢 (Fase 2 cosmetiek). Geen Fase 1D-batch nodig vóór de pentest; de pentester zal hier hooguit "informational / code smell" findings van maken, geen kritieke.

---

## Triage-tabel

| # | Tabel | Policy | Cmd | Roles | tenant_id? | Back-up policy? | Effectieve toegang | Klasse |
|---|-------|--------|-----|-------|------------|-----------------|--------------------|--------|
| 1 | `ai_assistant_config` | "Service role can manage config" | ALL | `{public}` | nee (globale config) | n.v.t. (service_role bypasst RLS) | `qual: auth.jwt()->>'role'='service_role'` — anon/auth geblokkeerd. Redundant met service_role bypass. | 🟡 |
| 2 | `ai_knowledge_index` | "Service role can manage knowledge" | ALL | `{public}` | ja | ja (#3, #4 tenant-scoped) | `qual: service_role`-JWT — redundant. | 🟡 |
| 3 | `ai_knowledge_index` | "Tenant isolation for ai_knowledge_index" | ALL | `{public}` | ja | overlapt met #4 voor SELECT | tenant-scoped via `user_roles`; anon → lege set → geblokkeerd. Geen role-filter (élke tenant-member kan write). | 🟡 |
| 4 | `ai_knowledge_index` | "Tenant users can view knowledge" | SELECT | `{public}` | ja | n.v.t. (SELECT-only) | tenant-scoped; anon geblokkeerd. | 🟢 |
| 5 | `ai_reply_suggestions` | "Service role can manage all suggestions" | ALL | `{public}` | ? (te verifiëren) | — | `qual: service_role`-JWT — redundant. | 🟡 |
| 6 | `ai_user_behavior_log` | "Service role can manage behavior" | ALL | `{public}` | ? | — | `qual: service_role`-JWT — redundant. | 🟡 |
| 7 | `ai_user_learning_patterns` | "Service role can manage patterns" | ALL | `{public}` | ? | — | `qual: service_role`-JWT — redundant. | 🟡 |
| 8 | `oauth_states` | "Service role only" | ALL | `{public}` | n.v.t. | n.v.t. | `qual: false` — blokkeert élke client; alleen service_role bypass werkt. Correct gedrag, slechte naam-rol-combinatie. | 🟡 |
| 9 | `storefront_webhooks` | "Tenant admins can manage webhooks" | ALL | `{public}` | ja | n.v.t. (admin-write enige bedoelde write-path) | tenant-scoped + role-check (`platform_admin`/`tenant_admin`); anon geblokkeerd. Functioneel correct, role-set hoort `{authenticated}` te zijn. | 🟡 |
| 10 | `storefront_webhooks` | "Tenant members can view webhooks" | SELECT | `{public}` | ja | n.v.t. | tenant-scoped; anon geblokkeerd. | 🟢 |
| 11 | `tenant_addons` | "Service role can manage all addons" | ALL | `{public}` | ja | (te verifiëren of er admin-policy is) | `qual: service_role`-JWT — redundant. | 🟡 |
| 12 | `tracking_import_log` | "System can insert import logs" | INSERT | `{public}` | ja | — | `WITH CHECK: tenant_id IN get_user_tenant_ids(auth.uid())` — anon geblokkeerd (lege set), auth-users alleen eigen tenant. Functioneel correct. | 🟡 |
| 13 | `webhook_deliveries` | "System can insert deliveries" | INSERT | `{public}` | ja | — | `WITH CHECK: tenant_id IN admin/tenant_admin user_roles` — anon geblokkeerd, alleen admins. Functioneel correct. | 🟡 |

### Telling
- 🔴 KRITISCH (pre-pentest fix vereist): **0**
- 🟡 Cleanup (drop/rename, low effort): **11**
- 🟢 Fase 2 cosmetiek (SELECT-only, geen risico): **2**

---

## Voorstellen per categorie

### 🟢 (#4, #10) — Fase 2
Geen actie pre-pentest. In Fase 2 rename + verplaats naar `{authenticated}` role-set bij algemene policy-cleanup.

### 🟡 Cleanup-voorstellen (alleen ter referentie — NIET submitten zonder approval)

**Type A — redundante service_role-JWT policies (#1, #2, #5, #6, #7, #11):**
service_role bypasst RLS automatisch. Deze policies voegen niets toe en zijn alleen verwarrend.
```sql
DROP POLICY "Service role can manage config"          ON public.ai_assistant_config;
DROP POLICY "Service role can manage knowledge"       ON public.ai_knowledge_index;
DROP POLICY "Service role can manage all suggestions" ON public.ai_reply_suggestions;
DROP POLICY "Service role can manage behavior"        ON public.ai_user_behavior_log;
DROP POLICY "Service role can manage patterns"        ON public.ai_user_learning_patterns;
DROP POLICY "Service role can manage all addons"      ON public.tenant_addons;
```
⚠️ **Pre-flight check vereist** voor #5/#6/#7/#11: bevestigen dat er voor admin-UI nog een tenant-scoped write-policy bestaat. Zo niet: drop + drie-policy-template toevoegen i.p.v. enkel drop. Voor #1 (globale config) en #2 (heeft back-up #3): drop volstaat.

**Type B — `qual: false` placeholder (#8):**
```sql
DROP POLICY "Service role only" ON public.oauth_states;
```
`oauth_states` is een edge-function-only tabel (PKCE state); service_role-bypass dekt het. Drop volstaat — mits geverifieerd dat geen anon/auth-rol naar deze tabel schrijft.

**Type C — functioneel correct maar verkeerd genaamd/gerolled (#3, #9, #12, #13):**
Drop + recreate met `TO authenticated` en duidelijker naam (Postgres ondersteunt geen `ALTER POLICY ... RENAME`). Geen semantische wijziging. Voor #3 extra te overwegen: role-filter toevoegen zodat alleen `tenant_admin`/`staff` schrijven, niet élke tenant-member — aparte beleidskeuze, niet onder dit triage-mandaat.

---

## Aanbeveling

**Geen Fase 1D-batch vóór pentest.** De pentester zal deze 13 hooguit als *informational* aanmerken (misleidende policy-namen, redundante policies, `TO public` waar `TO authenticated` netter is). Géén exfiltratie- of cross-tenant-vector — `auth.jwt()`-clauses en tenant-scoped `user_roles`-subqueries blokkeren anon en cross-tenant writes effectief.

**Voorstel verdere planning:**
1. **Pre-pentest:** dit rapport vastleggen als bewust-genomen-risico (paper trail). Geen migraties.
2. **Post-pentest, Fase 2A (cosmetiek-batch):** drops voor Type A (#1, #2, #5, #6, #7, #11) na pre-flight admin-write-policy-check, plus #8.
3. **Post-pentest, Fase 2B (rename-batch):** rebuild #3, #9, #12, #13 met `{authenticated}` role-set en duidelijker naam. Tegelijk #3 herziene role-filter overwegen. #4 en #10 in dezelfde batch meenemen.

Geen 🔴, dus geen sub-batches binnen Fase 1D nodig — Fase 1D wordt overgeslagen, alles gaat naar Fase 2.

## Open vragen voor approval

1. Akkoord met de "geen 🔴, geen Fase 1D" conclusie? Of wil je dat ik #3 (élke tenant-member kan AI-knowledge schrijven, geen role-filter) als 🔴 herklassificeer op grond van *over*-permissive write binnen tenant?
2. Voor #5/#6/#7/#11: mag ik nu een read-only `pg_policies`-verificatie draaien om back-up admin-write-policies te bevestigen vóór Fase 2A-planning? (Geen migratie.)
3. Mag #8 (`oauth_states`) écht zonder vervangende policy? Bevestigen dat geen enkele code-path met anon/auth-rol naar `oauth_states` schrijft.

---

## Approval log (Fase 2A scope-lock)

**Datum:** 2026-06-01

- Pre-flight #5/#6/#7/#11 voltooid (zie [memory: AI Tables Read-Only UI](mem://architecture/ai-tables-read-only-ui-pattern)).
- #5 `ai_reply_suggestions`: volledige tenant-scoped CRUD-policies aanwezig → drop-only.
- #6 `ai_user_behavior_log` + #7 `ai_user_learning_patterns`: alleen SELECT-policies aanwezig. **Bewust ontwerp bevestigd**: writes exclusief via edge functions (service_role). UI mag deze tabellen niet direct muteren. Patroon vastgelegd in memory voor toekomstige AI-tabellen.
- #11 `tenant_addons`: edge-function-only model bevestigd. Stripe = source of truth, DB = derived state. Geen tenant_admin manage-policy nodig. Toekomstige handmatige platform_admin overrides via aparte audited edge function, niet via directe DB-write-policy.
- #8 `oauth_states`: grep schoon — alle 4 OAuth-edge-functies gebruiken `SUPABASE_SERVICE_ROLE_KEY`. Geen anon/auth code-path. Drop-only safe.

**Fase 2A definitieve DROP-batch (uit te voeren post-pentest):**
```sql
DROP POLICY "Service role can manage config"          ON public.ai_assistant_config;
DROP POLICY "Service role can manage knowledge"       ON public.ai_knowledge_index;
DROP POLICY "Service role can manage all suggestions" ON public.ai_reply_suggestions;
DROP POLICY "Service role can manage behavior"        ON public.ai_user_behavior_log;
DROP POLICY "Service role can manage patterns"        ON public.ai_user_learning_patterns;
DROP POLICY "Service role can manage all addons"      ON public.tenant_addons;
DROP POLICY "Service role only"                       ON public.oauth_states;
```

**Status:** Pre-pentest hardening scope-compleet. Geen verdere migraties tot pentest-debrief. Fase 2B-planning (rename-batch #3, #4, #9, #10, #12, #13) kan parallel doorlopen.

# MEDIA-3 + SOCIAL-SEC-1 — deploy

Branch `media-3-social-sec-1` (commits: zie de role-audit). Pas uitvoeren na Akke's go en NA de merge naar `main` (Lovable volgt main). Niets hiervan is al gedraaid of gedeployed.

## Overzicht

| Stap | Wat | Soort | Go nodig |
|---|---|---|---|
| 1 | `20261016210000_media_3_social_sec_1.sql` | schema (tabellen, RPC's, guard-trigger) | go op de batch |
| 2 | `20261016210100_social_sec_1_seed_pipeline.sql` | **data**: Loveke + VanXcel in de pijplijn | **aparte go** |
| 3 | edge functions (7) via de Lovable-agent, deploy-only | code | go op de batch |
| 4 | frontend publiceren (`deploy_project`) | code | go op de batch |
| 5 | `20261016210300_media_3_social_sec_1_doc_articles.sql` | data (helpartikels) | go op de batch, ná 4 |
| 6 | `20261016210200_social_sec_1_reset_reminders.sql` | **data**: reminded_at terug op NULL | **aparte go**, zie "Beslispunt herinneringen" |

**Volgorde 1 → 2 → 4 is hard.** Zodra stap 1 draait, weigert de guard-trigger de oude frontend-update voor "Opnieuw maken" (`status = 'regenerate_requested'` rechtstreeks). Tot stap 4 live is, faalt die knop dus met een foutmelding (geen datalek, geen dubbele kost). Zonder stap 2 weigert de nieuwe RPC elke aanvraag met `social_no_pipeline` en verbergt de nieuwe frontend de knoppen. Draai 1 en 2 dus vlak na elkaar, en publiceer de frontend meteen erna. Het venster tussen 1 en 4 is het enige moment waarop "Opnieuw maken" niet werkt.

De Claude-taken (weekcontent, "Social: opnieuw maken") draaien via de connector als `postgres` en worden door de guard niet geraakt (`current_user` niet in authenticated/anon). Er loopt nu een run op productie: draai stap 1 niet terwijl een taak in social_posts schrijft (check `pg_stat_activity` op `social_posts`).

## Limieten (verdedigbare waarden)

| Wat | Limiet | Waarom |
|---|---|---|
| Contentverzoek: beelden | 1–10 | een carrousel heeft max. 10 beelden |
| Contentverzoek: open | max 10 per winkel (`requested`/`processing`) | de pijplijn verwerkt per uur; meer open verzoeken = wachtrij die niemand overziet |
| Contentverzoek: nieuw | max 20 per winkel per 24 u | ruim boven een normale week (Loveke: ±9 posts/week), houdt misbruik en kosten begrensd |
| Gewenste datum | vandaag t/m +90 dagen | planning loopt per week; verder vooruit is niet plannen maar parkeren |
| Opnieuw maken | max 3 per post per 24 u, max 30 per winkel per 24 u | 3 pogingen is genoeg om bij te sturen; daarna is een gesprek nuttiger dan een vierde run |
| Opmerking | max 1000 tekens | prompt-inhoud begrensd |
| Kost | post/story 10, reel 25 credits | reel = video + muziekvoorstel, ±2,5× het werk. Vrijgestelde winkels (billing_exempt/internal): 0, wel gelogd (beslist `use_ai_credits`) |

Telling voor "opnieuw maken" via `ai_usage_log` (feature `social_regenerate`, `metadata.post_id`), voor verzoeken via `social_content_requests`. Gelijktijdige klikken per winkel worden geserialiseerd met `pg_advisory_xact_lock`.

## Stap 1 — schema-migratie

Nulmeting (aparte aanroep):

```sql
select (select count(*) from pg_trigger where tgrelid = 'public.social_posts'::regclass and not tgisinternal) triggers,
       to_regclass('public.social_content_pipeline_tenants') pipe, to_regclass('public.social_content_requests') req,
       (select count(*) from pg_proc where proname in ('request_social_content','request_social_regenerate','social_posts_guard')) fns,
       (select count(*) from pg_stat_activity where query ilike '%social_posts%' and state <> 'idle' and pid <> pg_backend_pid()) busy;
-- verwacht: triggers 1, pipe null, req null, fns 0, busy 0
```

Draaien via `query_database`: één aanroep met enkel de inhoud van het bestand.

Natrek:

```sql
select (select count(*) from pg_trigger where tgrelid = 'public.social_posts'::regclass and tgname = 'trg_social_posts_guard') guard,
       (select relrowsecurity from pg_class where oid = 'public.social_content_pipeline_tenants'::regclass) rls_pipe,
       (select relrowsecurity from pg_class where oid = 'public.social_content_requests'::regclass) rls_req,
       has_function_privilege('authenticated', 'public.request_social_content(uuid,uuid[],text,text,date,text)', 'execute') auth_content,
       has_function_privilege('authenticated', 'public.request_social_regenerate(uuid,text,text)', 'execute') auth_regen,
       has_function_privilege('anon', 'public.request_social_regenerate(uuid,text,text)', 'execute') anon_regen,
       has_table_privilege('authenticated', 'public.social_content_requests', 'insert') auth_ins_req,
       has_table_privilege('authenticated', 'public.social_content_pipeline_tenants', 'insert') auth_ins_pipe,
       (select prosecdef from pg_proc where proname = 'request_social_regenerate') definer;
-- verwacht: guard 1, rls t/t, auth_content t, auth_regen t, anon_regen f, auth_ins_req f, auth_ins_pipe f, definer t
```

Gedragsproef (zichzelf terugdraaiend, tenant-account, M3 uit sellqo-db-safety). Vervang `<marketing_user>` door een gebruiker met rol marketing bij Loveke en `<post>` door een Loveke-post op `pending_approval` met `source = 'content_task'`:

```sql
begin;
select set_config('request.jwt.claim.sub', '<marketing_user>', true);
set local role authenticated;
-- moet falen met social_guard_forbidden:
update public.social_posts set status = 'regenerate_requested' where id = '<post>';
rollback;
```

```sql
begin;
select set_config('request.jwt.claim.sub', '<marketing_user>', true);
set local role authenticated;
update public.social_posts set post_text = post_text where id = '<post>';   -- moet slagen (UPDATE 1)
rollback;
```

Lokaal al bewezen (PG 16, stubs met de live definities van has_tenant_role, get_user_tenant_ids en use_ai_credits): guard weigert regenerate_requested/source/regenerate_* voor authenticated, ook met zelf gezette GUC; goedkeuren/tekst wijzigen slaagt; postgres (connector) mag alles; RPC's geven no_access, no_pipeline, invalid_state, not_found, invalid_input, rate_limit (11e verzoek, 4e regenerate) en insufficient_credits; credits correct afgeboekt (reel 25) en 0 bij vrijstelling; authenticated kan niet in de nieuwe tabellen schrijven; anon kan de RPC niet uitvoeren; migratie 2× gedraaid zonder fout.

Rollback: zie de kop van het migratiebestand (trigger, 3 functies, 2 tabellen droppen).

## Stap 2 — seed pijplijn (APARTE GO)

`20261016210100_social_sec_1_seed_pipeline.sql` via `query_database`. Natrek:

```sql
select t.name, p.enabled from public.social_content_pipeline_tenants p join public.tenants t on t.id = p.tenant_id order by 1;
-- verwacht: Loveke t, VanXcel t
```

Rollback: `delete from public.social_content_pipeline_tenants where tenant_id in ('1671a91c-31fe-42ed-8a10-41f3117ceb50','54f6b480-280b-42e1-b843-d5beb2831acd');`

Let op: de Claude-taak "Social: opnieuw maken" verwerkt enkel Loveke. Krijgt VanXcel een `regenerate_requested` of een contentverzoek, dan blijft het liggen tot er een VanXcel-pijplijn is (de taak meldt dat aan Akke). Wil je dat niet, laat VanXcel dan nog weg uit de seed of zet `enabled = false`.

## Stap 3 — edge functions (Lovable-agent, deploy-only)

Bepaald met `git diff --stat main...media-3-social-sec-1 -- supabase/functions`. Geen `_shared/`-bestand gewijzigd, dus geen extra aanroepers.

| Functie | Wijziging | Vingerafdruk GET |
|---|---|---|
| `social-publish-due` | reminded_at terugzetten als de melding faalt | `{"ok":true,"version":"SOCIAL-SEC-1"}` (was EDGE-IMPORT-1) |
| `ads-campaign-analyze` | requireBillingState + 2 credits | SOCIAL-SEC-1 (had nog geen GET-stempel; nulmeting vastleggen) |
| `ai-learn-from-feedback` | requireRole + requireBillingState, userId uit sessie | SOCIAL-SEC-1 (was AI-CRED-3) |
| `generate-legal-pages` | authenticateRequest + requireRole(tenant_admin, staff) + billing + 5 credits | SOCIAL-SEC-1 (was 401 `{"error":"Unauthorized"}`, docs/cron-inventaris.md) |
| `ai-generate-seo-content` | requireRole + requireBillingState | SOCIAL-SEC-1 (was SCHEMA-FIX-1) |
| `ai-suggest-reply` | requireRole + requireBillingState | SOCIAL-SEC-1 (was SCHEMA-FIX-1) |
| `ai-campaign-suggestions` | requireBillingState | SOCIAL-SEC-1 (had nog geen GET-stempel; nulmeting vastleggen) |

Nulmeting en nameting zoals in `SEC-INVITE-1-deploy.md` (anon-key in de header, `net.http_get` op de 7 functies + een verzonnen naam als controle, daarna `net._http_response`). Pas bij 7 keer de nieuwe stempel is de deploy bewezen.

Prompt voor de agent:

```
DEPLOY-ONLY — SOCIAL-SEC-1. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat elk van deze zeven bestanden de tekst
  version: "SOCIAL-SEC-1"
bevat:
  supabase/functions/social-publish-due/index.ts
  supabase/functions/ads-campaign-analyze/index.ts
  supabase/functions/ai-learn-from-feedback/index.ts
  supabase/functions/generate-legal-pages/index.ts
  supabase/functions/ai-generate-seo-content/index.ts
  supabase/functions/ai-suggest-reply/index.ts
  supabase/functions/ai-campaign-suggestions/index.ts
en dat supabase/functions/generate-legal-pages/index.ts de regel
  const LEGAL_PAGES_CREDITS = 5;
bevat. Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze zeven edge functions, niets anders:
  social-publish-due, ads-campaign-analyze, ai-learn-from-feedback, generate-legal-pages,
  ai-generate-seo-content, ai-suggest-reply, ai-campaign-suggestions

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt een stap niet, meld dat en STOP — geen code- of configwijzigingen, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets.
supabase-js blijft vast op de huidige versies (2.57.2 / 2.90.1); faalt de deploy op "Module not found"
van esm.sh, meld dat letterlijk en STOP.
```

Functioneel na de deploy (Speeltuin, met een marketing- en een viewer-account): AI-antwoordsuggestie in de inbox (marketing: werkt; viewer: 403), SEO-tekst genereren (marketing werkt), juridische pagina's genereren (tenant_admin werkt, kost 5 credits; marketing krijgt 403). Vrijgestelde winkels (Loveke, VanXcel): gedrag ongewijzigd, `ai_usage_log` krijgt rijen met `exempt: true`.

## Stap 4 — frontend

`deploy_project` (publiceren). Bewijs: in Assets staat de tab **Merk**; bij Loveke staat op een beeld het megafoon-icoon; bij Speeltuin niet (geen pijplijn).

## Stap 5 — helpartikels

Snapshot (aparte aanroep):

```sql
create table if not exists snapshots.sellqo_20261016_doc_articles_m3 as
select * from public.doc_articles
where doc_level = 'tenant' and slug in ('social-planning-goedkeuren', 'productfotos-mediabibliotheek-fotostandaard');
```

Daarna het bestand draaien. Natrek:

```sql
select slug, md5(content) from public.doc_articles
where doc_level = 'tenant' and slug in ('social-planning-goedkeuren', 'productfotos-mediabibliotheek-fotostandaard');
-- verwacht: 42b6ea8f0f74fd744c592d9f8ed8898e resp. 8ac5138bcf896f2b7e311ef2e4a35af1
-- (vóór: 0692948d… resp. 971884df…; lokaal geverifieerd op PG 16)
```

Rollback: content terugzetten uit de snapshot.

## Stap 6 — herinneringen terugzetten (APARTE GO)

### Root cause

De 6 Loveke-launchstories (17–22 okt) hebben allemaal `reminded_at = 2026-10-15 18:34:45.151266+00`: één tijdstip tot op de microseconde, dus één SQL-statement (`now()`), niet `remindManual` (die schrijft `new Date().toISOString()`, milliseconden). Er bestaat geen enkele `social_manual_due`-melding (gemeten 16-10). De role-audit van SOCIAL-3 bevestigt het: "de 6 launchstories `manual_reason = sticker` en `reminded_at` gezet (die week heeft nog de Claude-dagreminders, anders dubbel)". `reminded_at` deed dus dienst als "niet herinneren"-vlag.

Die beslissing staat nog: de Claude-taken "Loveke IG: post 3…9" (17–23 okt, 15:45 UTC) melden elke dag de story van die dag. Er was dus geen bug in de venster-logica van `remindManual` (−30 / +65 min, gecontroleerd), wel twee echte zwaktes die nu gefixt zijn:

1. `remindManual` zette eerst `reminded_at` en sloeg bij een mislukte melding-insert alleen een log over → de herinnering was voorgoed weg. Nu: `reminded_at` terug op NULL, volgende run probeert opnieuw.
2. Een manual-post die naar een ander tijdstip verschoven werd, hield zijn `reminded_at` → geen herinnering voor het nieuwe moment. Nu zet de guard-trigger `reminded_at` op NULL zodra `scheduled_for` van een manual-post wijzigt (tenzij de schrijver `reminded_at` zelf meegeeft).

### Beslispunt herinneringen

Draai je stap 6, dan krijgt Akke voor de stories van 17–22 okt **zowel** de SellQo-melding (±1 u vooraf) **als** de Claude-dagtaak (15:45 UTC). Aanbeveling: draai stap 6 en zet de zes resterende Claude-taken "Loveke IG: post 3…8" uit, behalve post 9 (23 okt, highlights) die geen story-herinnering is. Of: laat stap 6 liggen tot na 22 okt; dan doet hij niets meer (alle zes liggen dan in het verleden).

Nulmeting:

```sql
select p.id, p.scheduled_for, p.reminded_at from public.social_posts p
where p.status = 'manual' and p.reminded_at is not null and p.scheduled_for > now()
  and not exists (select 1 from public.notifications n where n.type = 'social_manual_due' and n.data ->> 'social_post_id' = p.id::text);
-- 16-10: 5 rijen (Loveke 17/18/20/21/22 okt; de story van 19 okt is intussen al op NULL gezet)
```

Draaien, daarna dezelfde query: 0 rijen. Snapshot `snapshots.sellqo_20261016_social_reminded` bevat de oude waarden; rollback staat in de kop van het bestand.

## Na alles

- `git log origin/main -3`: geen onverwachte agent-commits.
- `gh run list --limit 1` tot CI groen.
- Changelog 2026.12l en nieuwsbrief-item: pas versturen na stap 4 en 5.

# SEC-DOMAIN-2 — deploy

Branch `sec-domain-2` (commit: zie de role-audit). Pas uitvoeren na Akke's go en NA de merge naar `main` (Lovable volgt main). Eerste wet: beide functies worden door custom frontends gebruikt. Akke gaf op 16-10 akkoord voor deze wijziging; de deploy zelf is een aparte go.

## Deploylijst (bepaald met grep, niet uit het hoofd)

| Functie | Waarom | Vingerafdruk (GET, neveneffectvrij) |
|---|---|---|
| `storefront-resolve` | `dns_verified = true` op de domeinopzoeking en op `all_domains`; GET-stempel | vóór: 400 `{"success":false,"error":"hostname parameter is required"}` → na: 200 `{"ok":true,"version":"SEC-DOMAIN-2"}` |
| `storefront-api` | `dns_verified = true` in `resolve_domain` (opzoeking + `all_domains`), `get_config` (`domain_mapping`, `languages`, `canonical_domain`), `get_seo` (hreflang/canonical) en `get_sitemap_data`; stempel opgehoogd | vóór: 200 `{"ok":true,"version":"EVENT-ORDER-1"}` → na: 200 `{"ok":true,"version":"SEC-DOMAIN-2"}` |

`_shared`: geen enkel `_shared`-bestand gewijzigd (`git diff --stat` raakt alleen de twee `index.ts`'s onder `supabase/functions`). Geen andere functies deployen. `storefront-customer-api` is ongewijzigd (filtert al op `dns_verified`). Geen migratie, geen frontend-publish.

## Nulmeting (gemeten op 16-10-2026, vóór de deploy)

Beide functies hebben `verify_jwt = false`: geen header nodig.

```sql
with b as (select 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/' u, '{"Content-Type":"application/json"}'::jsonb h)
select
 net.http_get(u||'storefront-api') a_api_get,
 net.http_get(u||'storefront-resolve') b_resolve_get,
 net.http_get(u||'storefront-resolve?hostname=vanxcel.com') c_resolve_get_vx,
 net.http_post(u||'storefront-resolve', '{"hostname":"vanxcel.com"}'::jsonb, headers:=h) d_resolve_post_vx,
 net.http_post(u||'storefront-api', '{"action":"resolve_domain","params":{"hostname":"vanxcel.com"}}'::jsonb, headers:=h) e_api_resolve_vx,
 net.http_get(u||'storefront-resolve?hostname=bestaat-niet-sd2.example') f_resolve_unknown,
 net.http_post(u||'storefront-api', '{"action":"resolve_domain","params":{"hostname":"bestaat-niet-sd2.example"}}'::jsonb, headers:=h) g_api_unknown,
 net.http_post(u||'storefront-api', '{"action":"get_config","tenant_id":"54f6b480-280b-42e1-b843-d5beb2831acd"}'::jsonb, headers:=h) h_api_config_vx,
 net.http_post(u||'storefront-api', '{"action":"get_sitemap_data","tenant_id":"54f6b480-280b-42e1-b843-d5beb2831acd"}'::jsonb, headers:=h) i_api_sitemap_vx,
 net.http_post(u||'storefront-api', '{"action":"resolve_domain","params":{"hostname":"demo-bakkerij.sellqo.shop"}}'::jsonb, headers:=h) j_api_sellqoshop
from b;
-- enkele seconden later, aparte aanroep:
select id, status_code, md5(content), length(content), content from net._http_response where id between <a> and <j> order by id;
```

Uitkomst nulmeting (ids 260960–260969):

| | Verzoek | Status | md5 | Lengte |
|---|---|---|---|---|
| a | GET storefront-api | 200 `{"ok":true,"version":"EVENT-ORDER-1"}` | `e423799ec53259a3fb36a09fa6049ea5` | 37 |
| b | GET storefront-resolve (zonder hostname) | 400 `hostname parameter is required` | `3a73f7e1df6dec2b6592af05d32e92fc` | 58 |
| c | GET storefront-resolve?hostname=vanxcel.com | 200 | `4d61df2a0e1034d9aae2ca1748b10d8b` | 684 |
| d | POST storefront-resolve `{hostname:vanxcel.com}` | 200 | `4d61df2a0e1034d9aae2ca1748b10d8b` | 684 |
| e | storefront-api `resolve_domain` vanxcel.com | 200 | `880a71d72cd02bece88f3b12dc385919` | 501 |
| f | GET storefront-resolve, onbekend domein | 404 `{"success":false,"error":"Domain not registered","resolved":false}` | `a905397f509337beb212932e647c8d37` | 66 |
| g | storefront-api `resolve_domain`, onbekend domein | 500 `{"success":false,"error":"Domain not found"}` | `053de4486c539a31ea04a15ae0833836` | 44 |
| h | storefront-api `get_config` VanXcel | 200 | `b5dc2c60c4102d09a1018cd3428ef0ab` | 1360 |
| i | storefront-api `get_sitemap_data` VanXcel | 200 | `b38bfd4062d24094986d28a2014bab4d` | 3562 |
| j | storefront-api `resolve_domain` demo-bakkerij.sellqo.shop | 200 | `b0a260755126dc74481301b60c1baeff` | 338 |

`all_domains` in c/d/e: `vanxcel.be` (canonical), `vanxcel.nl`, `vanxcel.com` (in die volgorde; de query heeft geen `order by`).
Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.

**Herhaal de nulmeting vlak vóór de deploy.** h en i bevatten winkeldata (`updated_at` van producten, instellingen): een wijziging bij VanXcel tussen 16-10 en de deploy verandert die md5 zonder dat de functie iets fout doet. c/d/e/f/g/j hangen alleen af van `tenant_domains`, `tenants` en `tenant_theme_settings`; check ook dat `tenant_domains` nog dezelfde 4 rijen heeft:

```sql
select domain, dns_verified, is_active, is_canonical from tenant_domains order by domain;
```

## Prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — SEC-DOMAIN-2. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat:
  a) supabase/functions/storefront-resolve/index.ts de regel
     const VERSION = 'SEC-DOMAIN-2';
     bevat, en twee keer de tekst .eq('dns_verified', true)
  b) supabase/functions/storefront-api/index.ts de tekst
     version: 'SEC-DOMAIN-2'
     bevat, en vijf keer de tekst .eq('dns_verified', true)
Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze twee edge functions, niets anders:
  - storefront-resolve
  - storefront-api

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets.
Beide importeren supabase-js vast op 2.57.2. Faalt de deploy toch op "Module not found"
van esm.sh, meld dat letterlijk en STOP — niets zelf repareren.
```

Geeft send_message na ~230 s een MCP-timeout: NIET opnieuw sturen. Eerst `git ls-remote origin main` (agent-commits? die mogen er niet zijn) en dan de vingerafdruk meten.

## Nameting (meteen na de deploy)

1. Zelfde tien verzoeken als de nulmeting. Verwacht:
   - a = 200 `{"ok":true,"version":"SEC-DOMAIN-2"}`; b = 200 `{"ok":true,"version":"SEC-DOMAIN-2"}`. Pas bij twee nieuwe stempels is de deploy bewezen; het "gedeployed"-rapport van de agent is geen bewijs.
   - c, d = 200, md5 `4d61df2a0e1034d9aae2ca1748b10d8b` (byte-identiek aan de nulmeting).
   - e = 200, md5 `880a71d72cd02bece88f3b12dc385919`.
   - f = 404, md5 `a905397f509337beb212932e647c8d37`; g = 500, md5 `053de4486c539a31ea04a15ae0833836` (onbekend domein: zelfde als vroeger).
   - h, i = 200 en md5 gelijk aan de (herhaalde) nulmeting; j = 200, md5 `b0a260755126dc74481301b60c1baeff`.
2. Wijkt c/d/e alleen af in de volgorde van `all_domains` (zelfde drie domeinen, zelfde lengte), dan is dat de ongeordende query, geen regressie: vergelijk dan de geparste JSON. Elk ander verschil = meteen terugrollen (vorige versie opnieuw deployen) en uitzoeken.
3. Rooktest R10: `get_products` voor VanXcel geeft nog 200 (één extra `net.http_post` met `{"action":"get_products","tenant_id":"54f6b480-280b-42e1-b843-d5beb2831acd","params":{"limit":1}}`).
4. `git log origin/main -3`: geen onverwachte agent-commits (alles buiten `src/integrations/` = stoppen en uitzoeken). CC pullt daarna.
5. `gh run list --limit 1` na de push tot CI groen staat (nieuwe stap "test storefront-resolve" en de uitgebreide rooktest zitten erin).

## Terugdraaien

Vorige versie van beide functies opnieuw deployen (`git show <vorige commit>:supabase/functions/<functie>/index.ts`), via dezelfde deploy-only-prompt met de stempels `EVENT-ORDER-1` (storefront-api) en zonder stempel (storefront-resolve). Geen data geraakt, dus niets anders terug te zetten.

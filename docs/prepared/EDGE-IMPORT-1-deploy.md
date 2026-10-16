# EDGE-IMPORT-1 — deploy

Branch `edge-import-1` (commit: zie de role-audit). Pas uitvoeren na Akke's go en NA de merge/push naar `main` (Lovable volgt main). Noteer na de push de hash van `main` als `<VERWACHT>`.

Volgorde: (0) CI groen op `<VERWACHT>` → (1) nulmeting → (2) deploy-only via de agent → (3) nameting → (4) diff-check op `main`.

## Deploylijst (bepaald met grep, niet uit het hoofd)

```
grep -rl "socialMedia.ts" supabase/functions   → social-publish-due/index.ts, social-post-publish/index.ts,
                                                  _shared/socialRunner.ts, _shared/socialMedia.test.ts
grep -rl "socialRunner" supabase/functions     → social-publish-due/index.ts, social-post-publish/index.ts,
                                                  _shared/socialRunner.ts, _shared/socialRunner.test.ts
```

| Functie | Waarom | Vingerafdruk (GET, neveneffectvrij) |
|---|---|---|
| `social-post-publish` | importeert `_shared/socialMedia.ts` (via `socialRunner.ts`); live draait sinds 16-10 08:26 de esm.sh-variant van de agent, niet main | vóór: geen stempel (GET loopt in `req.json()`, zie nulmeting) → na: 200 `{"ok":true,"version":"EDGE-IMPORT-1"}` |
| `social-publish-due` | idem | vóór: 405 `{"error":"Method not allowed"}` → na: 200 `{"ok":true,"version":"EDGE-IMPORT-1"}` |

**Niet** deployen: alle andere functies. `package.json`/`bun.lock` raken geen edge-code.

## Stap 0 — CI

`gh run list --limit 1` tot de run op `<VERWACHT>` klaar is en groen staat. Rood = niet deployen.

## Stap 1 — nulmeting (query_database, aparte aanroep)

Beide functies staan op `verify_jwt = false`; de anon-key mag mee voor de gateway.

```sql
with h as (select jsonb_build_object('Authorization','Bearer <ANON_KEY>','apikey','<ANON_KEY>') as hd)
select net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/social-post-publish', headers := hd) a,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/social-publish-due', headers := hd) b,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/bestaat-niet-ei1', headers := hd) c
from h;
-- enkele seconden later, aparte aanroep:
select id, status_code, content from net._http_response where id in (<a>,<b>,<c>) order by id;
```

Noteer de uitkomst in de role-audit. Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.

## Stap 2 — prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — EDGE-IMPORT-1. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie (alleen lezen). Controleer dat:
  a) supabase/functions/_shared/socialMedia.ts de regels
     import { decode as decodePng } from "npm:fast-png@6.3.0";
     import jpeg from "npm:jpeg-js@0.4.4";
     bevat (npm:, NIET esm.sh);
  b) package.json in devDependencies "fast-png": "6.3.0" en "jpeg-js": "0.4.4" bevat;
  c) node_modules/fast-png/package.json en node_modules/jpeg-js/package.json bestaan
     met version 6.3.0 en 0.4.4;
  d) supabase/functions/social-post-publish/index.ts en
     supabase/functions/social-publish-due/index.ts allebei de tekst
     EDGE-IMPORT-1
     bevatten.
Klopt één ervan niet: meld welke en STOP.

Stap 2 — draai vanaf de repo-root, alleen lezend:
     deno check supabase/functions/_shared/socialMedia.ts
  en meld de exitcode en de laatste regel letterlijk. Verwacht: exit 0.
  Is het niet exit 0: meld de foutmelding letterlijk en STOP.

Stap 3 — deploy precies deze twee edge functions, niets anders:
     social-post-publish, social-publish-due
  Meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets. Zet geen enkele import om naar esm.sh.
```

`send_message` kan na ~230 s een MCP-timeout geven terwijl de deploy doorloopt: dan NIET opnieuw sturen, maar `git ls-remote origin main` checken en naar stap 3 gaan.

## Stap 3 — nameting

Dezelfde query als stap 1. Bewezen pas als **beide** 200 `{"ok":true,"version":"EDGE-IMPORT-1"}` geven en de controle (`bestaat-niet-ei1`) 404 blijft. Het "gedeployd"-rapport van de agent is geen bewijs.

## Stap 4 — diff-check op main

```
git fetch origin
git log --oneline <VERWACHT>..origin/main     # moet leeg zijn
git diff <VERWACHT> origin/main               # moet leeg zijn
```

Niet leeg: de agent heeft toch iets gecommit. Lees de diff. Commits met enkel `src/integrations/supabase/*` zijn platformwerk; al de rest (zeker `_shared/socialMedia*.ts`) terugdraaien en in de role-audit melden. Daarna `gh run list --limit 1` tot groen.

## Terugdraaien

Geen DB-wijziging. Een redeploy van de vorige main-stand (`998b8f6`) van dezelfde twee functies zet de functies terug (zonder GET-stempel, zelfde `npm:`-imports). `package.json`/`bun.lock` terugzetten = de commit reverten.

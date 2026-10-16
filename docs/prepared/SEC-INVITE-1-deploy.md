# SEC-INVITE-1 — deploy

Branch `sec-invite-1` (zie de commit in de role-audit). Pas uitvoeren na Akke's go, en NA de merge naar `main` (Lovable volgt main).
Twee losse onderdelen, in deze volgorde: eerst de edge functions (deel A + check-domain-ssl), daarna de migratie (deel B). Ze hangen niet van elkaar af; de volgorde houdt elke stap apart meetbaar.

## Deploylijst (bepaald met grep, niet uit het hoofd)

| Functie | Waarom | Vingerafdruk (GET, neveneffectvrij) |
|---|---|---|
| `send-team-invitation` | rollen-allowlist (400), 403 voor niet-beheerders, GET-stempel | vóór: 401 `{"success":false,"error":"Invalid or expired token"}` → na: 200 `{"ok":true,"version":"SEC-INVITE-1"}` |
| `accept-team-invitation` | rollen-allowlist vóór de insert in `user_roles` (defense in depth), GET-stempel | vóór: 401 `{"error":"Ongeldige of verlopen sessie"}` → na: 200 `{"ok":true,"version":"SEC-INVITE-1"}` |
| `check-domain-ssl` | `ssl_active` alleen nog op een eigen, DNS-geverifieerde rij met hetzelfde domein; GET-stempel | vóór: 500 `{"error":"Unexpected end of JSON input"}` → na: 200 `{"ok":true,"version":"SEC-INVITE-1"}` |

`grep -rl "_shared/inviteRoles" supabase/functions` → `send-team-invitation/index.ts`, `accept-team-invitation/index.ts` (+ het testbestand). `_shared/inviteRoles.ts` is nieuw; geen bestaand `_shared`-bestand gewijzigd. Geen andere functies. `resend-team-invitation`, `create-invite-account`, `fetch-invitation`, `check-invite-email`, `revoke-team-invitation` en `verify-domain`: ongewijzigd, niet deployen.

Geen frontend-publish nodig (enkel een vitest-bestand in `src/test`).

## Nulmeting (gemeten op 16-10-2026, vóór de deploy)

`send-team-invitation` en `accept-team-invitation` hebben `verify_jwt` aan (default): zonder header antwoordt de gateway zelf. Stuur daarom de publieke anon-key mee (`VITE_SUPABASE_PUBLISHABLE_KEY` uit `.env`, staat ook in de webbundel). Met die key falen beide functies netjes op auth, zonder bijwerking.

```sql
with h as (select jsonb_build_object('Authorization','Bearer <ANON_KEY>','apikey','<ANON_KEY>') as hd)
select net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/send-team-invitation', headers := hd) a,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/accept-team-invitation', headers := hd) b,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/check-domain-ssl', headers := hd) c,
       net.http_get('https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/bestaat-niet-si1', headers := hd) d
from h;
-- enkele seconden later, aparte aanroep:
select id, status_code, content from net._http_response where id in (<a>,<b>,<c>,<d>) order by id;
```

Uitkomst nulmeting (ids 260947-260950): a = 401 `Invalid or expired token`, b = 401 `Ongeldige of verlopen sessie`, c = 500 `Unexpected end of JSON input`, d = 404 `NOT_FOUND` (controle).
Blijft het leeg: `select count(*) from net.http_request_queue;` en `select net.wake();`.

## Prompt voor de Lovable-agent (send_message, project 9932a7fe-43a1-42de-9c64-168968599600)

```
DEPLOY-ONLY — SEC-INVITE-1. Maak geen enkele code-, config-, migratie- of documentwijziging.

Stap 1 — controle van je werkkopie. Controleer dat:
  a) supabase/functions/send-team-invitation/index.ts de regel
     const VERSION = "SEC-INVITE-1";
     bevat én importeert uit "../_shared/inviteRoles.ts";
  b) supabase/functions/accept-team-invitation/index.ts de regel
     const VERSION = "SEC-INVITE-1";
     bevat én importeert uit "../_shared/inviteRoles.ts";
  c) supabase/functions/check-domain-ssl/index.ts de regel
     const VERSION = 'SEC-INVITE-1';
     bevat én de tekst "ssl_active niet gezet";
  d) supabase/functions/_shared/inviteRoles.ts bestaat en INVITE_ROLES en isInviteRole exporteert.
Klopt één ervan niet: meld welke en STOP.

Stap 2 — deploy exact deze drie edge functions, niets anders:
  - send-team-invitation
  - accept-team-invitation
  - check-domain-ssl

Stap 3 — meld per functie of de deploy gelukt is, met de foutmelding letterlijk als hij faalde.

Lukt stap X niet, meld dat en STOP — maak geen enkele code- of configwijziging, ook geen build- of testfixes.
Draai geen migraties. Roep de functies niet zelf aan. Commit niets.
Alle drie importeren supabase-js vast op 2.57.2. Faalt de deploy toch op "Module not found"
van esm.sh, meld dat letterlijk en STOP — niets zelf repareren.
```

Geeft send_message na ~230 s een MCP-timeout: NIET opnieuw sturen. Eerst `git ls-remote origin main` (agent-commits? die mogen er niet zijn) en dan de vingerafdruk meten.

## Nameting edge (na de deploy)

1. Zelfde vier `net.http_get` als de nulmeting. Verwacht: a, b en c = 200 `{"ok":true,"version":"SEC-INVITE-1"}`, d = 404 `NOT_FOUND`.
   Pas bij drie nieuwe stempels is de deploy bewezen; het "gedeployed"-rapport van de agent is geen bewijs.
2. `git log origin/main -3`: geen onverwachte agent-commits (alles buiten `src/integrations/` = stoppen en uitzoeken). CC pullt daarna.
3. Functioneel (bij de eerstvolgende sessie in de admin, Speeltuin): Instellingen → Team → iemand uitnodigen als Medewerker → mail komt aan, uitnodiging staat in de lijst. De uitnodiging intrekken. Geen andere functionele test nodig: een verboden rol kan de UI niet sturen.
4. `gh run list --limit 1` na de push tot CI groen staat (nieuwe deno test `inviteRoles.test.ts` zit in de CI-stap).

## Migratie (deel B) — `supabase/migrations/20261016160000_sec_invite_1.sql`

Via de connector (`query_database`), één aanroep met enkel de inhoud van het bestand. Daarna, in een APARTE aanroep, natrekken:

```sql
select (select count(*) from pg_trigger where tgname='tenant_domains_protect_flags') trig,
       (select count(*) from pg_proc where proname='tenant_domains_protect_flags') func,
       (select count(*) from ops.sec_invite_1_prev_domains) snapshot_rijen,
       (select string_agg(domain||':'||dns_verified||'/'||ssl_active, ', ' order by domain) from tenant_domains) vlaggen;
```
Verwacht: trig 1, func 1, snapshot 4 (stand 16-10), vlaggen ongewijzigd (`vanxcel.be/.com/.nl` true/true, zonadorata false/false).
Daarna de rollbacktest uit de role-audit opnieuw draaien (aparte aanroep, `begin; … rollback;`): VanXcel-admin insert met vlaggen → false/false, flag-update → 42501, taal/actief/hoofddomein → ok.
Terugdraaien: `drop trigger if exists tenant_domains_protect_flags on public.tenant_domains; drop function if exists public.tenant_domains_protect_flags();`

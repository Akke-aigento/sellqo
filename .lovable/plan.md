## Doel
Historische security-hardening rondes zichtbaar maken in de publieke changelog, zonder exploiteerbare details te lekken. Volgt de release-werkwijze-skill: security-entries generiek houden (geen tabelnamen, geen tijdlijn, geen aanvalspaden).

## Wat wordt er toegevoegd

Drie nieuwe `type: 'security'` entries in `src/pages/public/PublicChangelog.tsx`, bovenop de bestaande lijst, chronologisch tussen de andere entries geplaatst:

1. **`v2026.07-sec-b` — Documenten via tijdelijke, ondertekende links** (`jul_2026`)
   Bundelt SEC-BATCH-2b (facturen/creditnota's) en SEC-BATCH-2d (verzendlabels): facturen, creditnota's en verzendlabels worden nu opgehaald via kortdurende, ondertekende downloadlinks in plaats van publieke URLs.

2. **`v2026.07-sec-a` — Interne beheer-endpoints extra afgeschermd** (`jul_2026`)
   Dekt F05-2a: onderhoudsroutes voor credits, bijlage-reparatie en interne cleanup vereisen nu expliciete platform-admin authenticatie.

3. **`v2026.q2-sec` — Rol-bewuste toegangscontrole doorheen het platform** (`q2_2026`)
   Bundelt de grote Fase-2 RLS-aanscherping (batches 2A t/m 2F, apr–jun 2026): elke tabel valideert nu de rol van de gebruiker binnen de eigen tenant. Warehouse-, staff- en admin-rollen zien enkel wat bij hun rol hoort; cross-tenant-lekken zijn structureel uitgesloten.

Alle drie de entries worden generiek geformuleerd: geen tabelnamen, geen "welke bucket", geen link naar concrete kwetsbaarheden.

## i18n

Voor elke entry een `title` + `description` key in **alle vier de platformtalen** (NL/EN/FR/DE), onder de bestaande `public.changelog.entries.<id>` namespace. Ik lees eerst één van de bestaande locale-bestanden om de exacte key-structuur en pad te bevestigen vóór ik schrijf (skill-verplichting).

Nieuwe keys:
- `sec_signed_documents` (title + description)
- `sec_internal_endpoints` (title + description)
- `sec_role_aware_rls` (title + description)

Bestaande date-key `q2_2026` wordt toegevoegd indien nog niet aanwezig.

## Wat NIET verandert

- Geen versies verwijderen of hernummeren.
- Geen role-audit entry (die bestaan al voor elk van deze batches).
- Geen newsletter-item (skill: security-fixes gaan niet in de nieuwsbrief tenzij de tenant er actief iets van merkt — hier niet).
- Geen edge functions of DB-migraties.

## Bestanden

- `src/pages/public/PublicChangelog.tsx` — 3 entries toevoegen aan `changelogEntries`.
- `src/i18n/locales/nl/*.json` (+ `en`, `fr`, `de`) — de exact benodigde bestanden bepaal ik na één verificatie-read; naar analogie met eerdere entries zoals `help_assistant_links`.

## Verificatie

Na de edit: `rg` op de nieuwe key-namen in alle vier de locales om te bevestigen dat niets ontbreekt, en visueel checken op `/changelog` dat de drie nieuwe security-entries verschijnen onder het "Security"-filter.

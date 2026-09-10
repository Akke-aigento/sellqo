---
name: sellqo-connector-werkwijze
description: Werkwijze voor werk aan het sellqo-project via de Lovable-connector en agent-runs. Toepassen bij elke recon, prompt, deploy of
  verificatie. Bepaalt de recon→prompt→run→post-flight-lus, wat als bewijs
  telt, en vier valkuilen die deze werkwijze al eerder omzeild heeft.
---

# SellQo Connector-Werkwijze

**Scope: enkel het project `sellqo`. Andere projecten: negeer, tenzij
expliciet gevraagd.**

De werklus per batch: recon → prompt tonen → go van Akke → run →
post-flight → drie sporen (zie sellqo-release-werkwijze).

## De connector kan véél meer dan prompts sturen (self-resolve reflex)
Gebruik de connector vóór je iets aan Akke vraagt. Beschikbaar:
- **Recon:** `list_projects`, `list_files`, `read_file`, `get_diff`,
  `list_messages`, `get_message`.
- **Live SQL (read + write) op Supabase:** `query_database`.
- **Builds:** `send_message`, `create_project`.
- **Skill-onderhoud:** `list_workspace_skills`, `get_workspace_skill`,
  `create_workspace_skill`, `update_workspace_skill`.

**Project-ID's nooit vragen of uit geheugen gokken — altijd self-resolven**
via `list_projects` (workspace `8fa9AQcZxxoglV7BaRsZ` + `query`=tenantnaam,
fuzzy). Dat geeft de volledige UUID. De API eist de **volledige UUID**
(bv. `9932a7fe-43a1-42de-9c64-168968599600`); een 8-char prefix geeft
`404 project_not_found`. Nieuwe tenants verschijnen automatisch in
`list_projects` — geen onderhoud, geen hardcoded lijst nodig.

**Schema nooit uit geheugen aannemen** — natrekken via `query_database`
op `information_schema.columns` / `information_schema.tables` vóór elke
query of write (zie sellqo-db-safety).

## Recon-first (verplicht vóór elke prompt)
- Lees de echte code/data vóór je iets voorstelt: kolommen tegen
  `types.ts`, bestaande functies/RPC's, en de blast-radius (grep in `src/`
  én `supabase/functions/`).
- Neem geen aannames over in de prompt. De klassieke fout: aannemen dat
  een sync stock overschrijft terwijl hij outbound pusht — recon toont het
  verschil en voorkomt een overbodige batch.
- Verwerk de recon-uitkomst inline in de prompt ("recon al gedaan — niet
  opnieuw onderzoeken") met exacte namen en regelnummers.

## Wat telt als bewijs (post-flight)
- **Agent-"completed" is géén bewijs.** Een run kan half slagen of stil
  niets doen. Verifieer altijd zelf.
- **De database is de waarheid, niet de repo.** Lovable past migraties
  soms toe zonder git-bestand. Check tabellen/functies/policies via
  `query_database`, niet enkel via een clone.
- **get_diff toont de scope** van een run: welke bestanden echt geraakt
  zijn. Verse clone als kruiscontrole bij twijfel.
- **Verifieer de kern-invariant, niet enkel het bestaan.** Voor een
  grootboek: `sum(delta) = live waarde`, 0 mismatches. Voor een fix: draai
  het gerepareerde pad in een teruggedraaide transactie (BEGIN/ROLLBACK).

## Schrijfacties
- Alle writes (send_message, deploy, write-SQL, skills) enkel na expliciete
  "go" van Akke op een getoonde, concrete actie. Read-only is autonoom.
- Write-SQL: guard + idempotentie + `returning`/natrek in één script (zie
  sellqo-db-safety).

## Vier valkuilen
1. **Write-error ≠ mislukt.** Een tool-error op send_message betekent vaak
   dat de run tóch `accepted`/`running` is. Check via `list_messages` vóór
   je opnieuw stuurt — niet blind herhalen (dubbele runs, dubbele credits).
2. **Stille halve run.** Een documentatie-append kan "completed" melden
   terwijl er niets geschreven is. Verifieer met `read_file` op de commit;
   herkans indien nodig.
3. **Stale clone.** Een clone van vóór de deploy mist de laatste wijziging
   → lijkt "half geland". Trek een verse clone of lees via de connector.
4. **`.limit()` zonder `order by`** en andere stille recon-vervuilers:
   controleer dat je recon-query representatief is vóór je erop bouwt.

## Credits
Runs kosten credits (0.7–8 per batch gezien). Meerdere kleine batches >
één mega-batch: beter te verifiëren, beter te herstellen. Meld het saldo
bij grote runs.


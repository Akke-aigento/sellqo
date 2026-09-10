---
name: sellqo-db-safety
description: DB- en SQL-veiligheidsregels voor het sellqo-project. Altijd
  toepassen bij migraties, RLS-policies, views, storage-policies, backfills,
  cron-jobs, of elke SQL-write op de Supabase-database. Bevat de meta-regels
  (additief vóór destructief, blast-radius, rol-impersonatie) en twee
  bekende valkuilen die productie al eerder sloopten.
---

# SellQo DB-Safety

**Scope: enkel het project `sellqo`. Bij andere projecten in deze workspace:
negeer deze skill, tenzij expliciet gevraagd.**

## Meta-regels

### M1 — Additief vóór destructief
Nieuwe policy/grant/guard erbij → verifiëren → pas dán de oude weg. Nooit
`DROP` + `CREATE` van dezelfde functie in één stap zonder bewezen
equivalentie. Een `tenants`-policy droppen-en-herbouwen is genoeg om
Stripe-accounts als "ontkoppeld" te laten ogen.

### M2 — Blast-radius eerst
Vóór je iets dichtzet: `grep` in `src/` én `supabase/functions/` waar het
object gebruikt wordt. Zo bleek `message-attachments` een frontend-upload
te hebben en fetchte `export-q-bundle` de publieke factuur-URL — beide
zouden anders stil gebroken zijn.

### M3 — Rol-impersonatie-diff, vóór en na
```sql
BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM ...; ROLLBACK;
```
Meet als anon, als tenant-user én als platform_admin. Legitieme rijen
blijven, illegitieme verdwijnen. **Test met een tenant-account**, niet met
platform_admin — die passeert elke tenant-check en verbergt precies de
bugs die je zoekt.

### M4 — Bewijs boven verhaal
Als de hypothese mooi klinkt maar de test faalt: de hypothese is fout,
niet de test. Meet, niet raden.

### M5 — Verifieer paden tegen de werkelijkheid
Na een backfill: join tegen `storage.objects` en eis **0 paden zonder
bestand**. Na een policy-wijziging: tel rijen per rol. Een migratie die
"gelukt" zegt, bewijst niks over correctheid.

## Vaste regels

- Guards + idempotentie op elke UPDATE/INSERT; actie + natrek in één
  script. Een `paid`-status mag nooit overschreven worden door een laat
  `failed`-event.
- Nooit `.catch()` op Supabase query-builders — het zijn thenables zonder
  `.catch()`; dat throwt synchroon en breekt het omliggende blok.
- Cron-jobs altijd ín een migratie, nooit ad hoc.
- Kolom-audit tegen `types.ts` vóór elke SQL-write — kolomnamen komen uit
  de code, niet uit het geheugen.

## Bekende valkuilen — niet aankomen zonder plan

### De SECURITY DEFINER-val
`tenant_public_info` en `tenant_theme_public` staan **bewust** op
`security_invoker=false`. De onderliggende tabellen hebben géén
anon-policy. Wie die views "netjes" naar `security_invoker` flipt, zet
elke anonieme storefront op 0 rijen → alle publieke storefronts blanco.
**Nooit flippen zonder eerst het anon-leespad te regelen.**

### Service role bypast RLS
`rolbypassrls = true` — policies met de naam "Service role can ..." zijn
vrijwel altijd nep; de service-role heeft ze niet nodig. Staat zo'n
policy op rol `public` zonder `auth.role()`-check, dan geeft hij in
werkelijkheid **anon** die rechten. Zo waren factuur-PDF's ooit
wereld-wisbaar.

## Checklist per batch
- [ ] Recon: blast-radius bepaald (`grep` in src/ én functions/)
- [ ] Baseline gemeten (rol-impersonatie + counts)
- [ ] Additief vóór destructief
- [ ] Script + natrek + rollback vooraf geschreven
- [ ] Na uitvoering: natrek gedraaid, cijfers vergeleken met baseline
- [ ] Getest met een tenant-account, niet enkel platform_admin
- [ ] Groen vinkje verklaard: weet je wáárom het slaagt?


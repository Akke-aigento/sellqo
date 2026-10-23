# Livegang SellQo Kassa bij een horecazaak — draaiboek (LIVE-1)

Bron: ontwerp `claude/horeca-tafelkassa-ontwerp.md` §8–§9 (projectdoc). Dit draaiboek is de
checklist voor de eerste klant; vul de status in per klant.

## 0. Poort: mag SellQo zijn kassa zijn?

| Vraag | Antwoord klant | Gevolg |
|---|---|---|
| Maaltijden ter plaatse > €25.000/jaar (excl. btw)? | | ja = GKS-plichtig |
| FDM ("zwarte doos") bij de huidige kassa, of "GKS" op het kasticket? | | ja = GKS-plichtig |
| Boekhouder bevestigd? | | |

**GKS-plichtig → SellQo Kassa mag pas registrerende kassa zijn na certificatie (GKS 2.0).**
Tot dan: zaalplan, QR-bestellen, keuken en webshop wel; afrekenen blijft op de gecertificeerde
kassa. Niet GKS-plichtig → kassa in fiscale modus `off`.

## 1. Releasepoorten (allemaal groen vóór dag 1)

| Poort | Hoe | Status |
|---|---|---|
| Migraties live en nagetrokken | KASSA-0, PERSONEEL-1, ZAAL-H1, TAFEL-1, TAFEL-2, PRINT-1, LIVE-1 via de go; per migratie de tabel/functie natrekken met `query_database` | |
| Stresstest | `scripts/gks/stress/horeca-stress.mjs` (lokaal: 6 toestellen, 3 min, alle invarianten groen, p95 95 ms). Daarna 4 u tegen de testzaak met echte toestellen | lokaal groen |
| Crashtest | app hard sluiten midden in een ronde; vliegtuigmodus tijdens afrekenen; na herstart staat alles terug en is niets dubbel | |
| Deploytest | nieuwe versie uitrollen terwijl de kassa open staat: geen wit scherm (HORECA-0 foutvanger) | |
| Echte toestellen | iPad van de zaak + Android-gsm's, staand en liggend, 390 en 1280 px | |
| Printer + terminal | 20 bonnen achter elkaar; betaalterminal los van de kassa | |
| Review-agent op TAFEL-2 | 2 rondes | |

## 2. Voorbereiding (week vóór de livegang)

1. Tenant aanmaken met de horeca-module; pakket en prijs volgens het projectdoc `claude/sellqo-prijsstructuur.md`.
2. Kaart importeren: bestaande import (`/admin/import`, platform "CSV" met kolomtoewijzing) met de
   productexport uit Lightspeed. Daarna per product: btw-tarief (eten ter plaatse 12 %, dranken
   21 %, met de boekhouder bevestigen), kanaal "kassa", extra's.
3. Zaalplan: `docs/sql/live-1-zaalplan-eerste-horecaklant.sql` (startplan naar de Lightspeed-foto),
   daarna samen met de klant fijnregelen in Bestellen › Zaalplan.
4. Posten: Bestellen › Posten (Keuken als standaard, Bar), dranken-categorieën → Bar.
5. Kassa's: per toestel een kassa onder Kassa › Kassa's; fiscale modus `off` (niet GKS-plichtig).
6. Personeel: Kassa › Personeel, iedereen een pincode (INSZ enkel bij GKS).
7. Opleiding 15 min + spiekbriefje van 1 A4 (tafel openen, versturen, annuleren, apart afrekenen, afrekenen).

## 3. Dag 1

- Rustig moment (maandagnamiddag); Akke de eerste twee shifts ter plaatse.
- Lightspeed **niet** opzeggen tot 2 weken zonder incident.
- Noodprocedure aan de toog: bonnenblok + tafelnummer; achteraf intikken.
- Kassa › Kassa's toont per toestel "SellQo Kassa … gezien" en wat er nog op het toestel
  wacht (hartslag elke minuut). Een toestel dat langer dan 5 minuten stil is, kleurt oranje.

## 4. Na elke shift (eerste 2 weken)

- Rekeningen die openbleven, annuleringen, `fiscal_audit_log` (`signed_sale_rejected`,
  `signed_but_rejected`, `fiscal_store_failed`), `client_errors`, `kassa_devices` met
  wachtende acties.
- Verkopen van de dag: som `check_payments.total_cents` = som `pos_transactions.total` van de
  kassa-app-verkopen.
- Fiscale zaak: elk ondertekend N-event moet een betaling hebben (anders: getekend maar niet
  geboekt, zie `kassa_devices.pending_pays` en het auditspoor):

  ```sql
  select f.id, f.created_at, f.transaction_total_cents, f.cost_center_reference
  from fiscal_events f
  where f.tenant_id = '<tenant>' and f.mutation = 'signSale' and not f.is_training
    and not exists (select 1 from check_payments p where p.fiscal_event_id = f.id)
    and f.created_at < now() - interval '15 minutes';
  ```
- Rekeningen die "in betaling" bleven hangen (claim verlopen zonder betaling):
  `select id, paying_until from dining_checks where status = 'open' and paying_until is not null and paying_until < now();`

## 5. Terugval

Valt SellQo Kassa uit tijdens de shift: terug naar Lightspeed (blijft 2 weken naast). Open
rekeningen staan in SellQo; achteraf afrekenen of overtikken.

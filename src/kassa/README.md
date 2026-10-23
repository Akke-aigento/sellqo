# SellQo Kassa — afgebakende kassa-kern

**Wijzigen in `src/kassa/` = fiscale release.** SellQo Kassa wordt gecertificeerd als
geregistreerd kassasysteem (GKS 2.0, FOD Financiën). Elke wijziging aan wat de FOD
certificeert, moet als certificatie-update gemeld worden (POS Certificatie Handleiding
II.E, PROC 4). Daarom leeft alles wat fiscaal is in deze map, met een eigen versie
(`version.ts`, posSwVersion) en een eigen release-trein, los van de dagelijkse admin-,
webshop- en backoffice-releases.

Bron van waarheid voor de eisen: projectdoc `claude/gks-eisenmatrix.md` (eis-ID's zoals
`TX-07`, `PAY-03`). Elke regel die de code afdwingt, staat er met dat ID bij.

## Indeling

| Map / bestand | Wat |
|---|---|
| `fiscal/types.ts` | Het officiële GraphQL-schema POS↔FDM als TypeScript (POS v2.2 §2.3) |
| `fiscal/schema.ts` | Hetzelfde schema als data + validator (FDM-01). Ongeldig = gaat nooit de deur uit |
| `fiscal/money.ts` | Bedragen in centen, hoeveelheden/eenheidsprijzen in 1/10000. Nooit floats |
| `fiscal/vat.ts` | Btw zoals de FDM: per label op het eventtotaal, half up (145/145 bewezen) |
| `fiscal/rounding.ts` | Contant afronden op 5 cent (PAY-02..04) |
| `fiscal/identity.ts` | Identificatievelden, btw-/vestigingsnummer, INSZ, Brusselse tijd, bedrijfsdag |
| `fiscal/builders.ts` | Van kassagegevens naar exacte FDM-berichten (pure functies, regels afgedwongen) |
| `fiscal/documents.ts` | GraphQL-documenten (`footer` altijd geselecteerd) |
| `fiscal/gateway.ts` | `FiscalGateway` (simulator / HTTP) + `FiscalSender` (bewaren vóór verzenden, byte-identiek opnieuw, ID-11) |
| `fiscal/reports.ts` | X/Z-rapporten uit het fiscale logboek (RPT-*) |
| `fiscal/simulator/` | FDM-simulator (GEEN echte handtekeningen), QR-codering, mini-GraphQL |
| `fiscal/testSetup.ts` | Verplichte testopstelling van de FOD (FPS Finances Experience) |
| `fiscal/__tests__/uc/` | De ±190 officiële use cases als tests (fixtures uit `scripts/gks/extract-uc-fixtures.mjs`) |
| `app/` | Ingang van het tweede app-target `app.sellqo.kassa` (`npm run build:kassa` → `dist-kassa`) |

Capacitor-config van het kassa-target: `apps/kassa/capacitor.config.ts`. Native projecten
komen er pas in de app-batch.

## Testen

```bash
npx vitest run src/kassa                                   # kern + alle officiële use cases
GKS_WRITE_COVERAGE=1 npx vitest run src/kassa/fiscal/__tests__/uc   # werkt docs/gks/uc-coverage.md bij
PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run.sh     # migratie fiscal_events lokaal
npx tsx scripts/gks/fdm-simulator-server.ts --port 8780    # simulator op POST /graphql
```

De officiële voorbeeldantwoorden zijn deels geanonimiseerd (fdmId, handtekeningen): tests
vergelijken structuur en bedragen, nooit handtekeningen. Afwijkingen in de officiële data
zelf staan met reden in `fiscal/__tests__/uc/known.ts`.

## Regels voor wie hier iets wijzigt

1. Eerst de eis-ID opzoeken in de eisenmatrix; een nieuwe regel krijgt een ID.
2. `npx vitest run src/kassa` moet groen zijn; het dekkingsrapport opnieuw genereren.
3. `KASSA_SW_VERSION` ophogen en de wijziging in de fiscale changelog zetten (komt met CERT-1).
4. Nooit een event wijzigen of wissen: correcties zijn nieuwe events (EVT-13).
5. Nooit een ticket afsluiten of afdrukken zonder FDM-handtekening (FDM-04, PRT-09).

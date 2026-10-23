# SellQo Kassa — kastickets en afdrukken (PRINT-1)

**Wijzigen hier = fiscale release** (zie `src/kassa/README.md`). Pure TypeScript: geen React,
geen database, geen hardware. Van een ondertekend event (bericht + FDM-antwoord) naar een
abstract `TicketDoc`, en dat naar tekst, ESC/POS-bytes of HTML.

```
SignedEvent ──ticketModel.ts──▶ TicketDoc ──layout.ts──▶ regels ──┬─ text.ts   (32/42/48 kolommen)
 (bericht + SignResult)                                          ├─ escpos.ts (bytes, PC858, QR)
                                                                 └─ html.ts   (digitaal, QR als SVG + link)
TicketDoc ──queue.ts──▶ rij voor public.print_jobs (dedupe per event en printer)
```

## Welke eis waar

| Eis | Wat | Code | Test (`__tests__/print.test.ts`) |
|---|---|---|---|
| PRT-01 | N altijd afgedrukt, digitaal ticket beschikbaar | `buildKasticket` + `renderHtml` | "btw-kasticket", "HTML: QR als SVG" |
| PRT-02 | Art. 20 a–r, btw uit `vatCalc` van de FDM | `saleParts`, `vatBlocks`, `checkContext` | "bevat alle vermeldingen…", "btw en maatstaf komen uit vatCalc" |
| PRT-03 | QR uit `verificationUrl`, ECC M | `qr.ts`, `escposQr` | "ESC/POS: … QR model 2 ECC M", "PRT-03: QR met ECC M" |
| PRT-04 | "DIT IS GEEN GELDIG BTW-KASTICKET", PRO FORMA, VOORLOPIGE REKENING, TRAINING, KOPIE; geen shortSignature op P/T | `proFormaParts`, `buildTrainingTicket`, `refusesShortSignatureLeak` | "voorrekening (M123)", "training (M171)", "shortSignature is verboden op pro forma" |
| PRT-05 | Keuken-/barbon zonder bedragen | `buildKitchenTicket` | "nooit bedragen…" |
| PRT-06 | "btw-KASTICKET" enkel op het kasticket, normale letter (titel zonder dubbele breedte) | `saleParts` | "PRT-06" |
| PRT-07 | Consolideren / groeperen per departement op de afdruk | `consolidate`, `groupByDepartment` | "het voorbeeld uit pos_detail 8.2" |
| PRT-08 | NL/FR/DE/EN per vestiging | `i18n.ts`, `TicketContext.language` | "tickettaal" |
| PRT-09 | Geen ticket zonder FDM-controledata | `requireSigned` | "elke soort weigert zonder SignResult", "antwoord dat bij een ander bericht hoort" |
| EVT-12 | Kopie: inhoud origineel + KOPIE + gegevens copy-event, QR origineel; geen kopie van een kopie | `buildCopyTicket` | "EVT-12 kopie" |
| FDM-07 | `footer` uit het antwoord op het ticket | `controlBlocks` | "zonder shortSignature, footer of verificationUrl" |
| Refund | "REFUND" + referentie origineel | `isRefund`, `buildRefundTicket` | "Refund (M111)" |
| INSZ | Nooit het employeeId op een afdruk | `checkStaffLabel`, `staffDirectory` | "INSZ (pos_detail 6.4)", "gebruikersrapport: nooit het INSZ" |
| Simulator | Nep-handtekening blijft zichtbaar | `isSimulated`, banner in `compose` | "simulator blijft zichtbaar als test" |

## Gebruik

```ts
import { buildTicketFor, renderEscPos, renderText, buildPrintJob } from '@/kassa/print';
const doc = buildTicketFor({ name: 'signSale', isTraining: false, data, result }, {
  business: { legalName, tradeName, address: [straat, postcodeGemeente], vatNo, estNo },
  staff: { name: 'Elisa', number: 'kassier03' }, // nooit het INSZ
  language: 'NL',
  options: { consolidate: true },
});
renderText(doc, 42);            // tekst
renderEscPos(doc, 48);          // Uint8Array voor een ESC/POS-printer
buildPrintJob(doc, printer);    // rij voor print_jobs
```

Kopie: eerst `signCopy` laten ondertekenen met `fdmRef` = het origineel, dan
`buildCopyTicket(copyEvent, origineel, ctxVanHetOrigineel, wieDeKopieMaakte)`.

## Testen

```bash
npx vitest run src/kassa/print                                             # inhoud per eis
PRINT_PREVIEW_DIR=/tmp/tickets npx vitest run src/kassa/print/__tests__/preview.test.ts   # voorbeeldafdrukken wegschrijven
PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run_print.sh       # migratie printers/print_jobs
deno test --no-lock supabase/functions/_shared/cloudprnt.test.ts            # Star CloudPRNT-protocol
```

## Open punten (vóór certificatie)

1. **FR/DE-titels** staan niet in de aangeleverde FOD-bronnen; gekozen vertalingen in `i18n.ts`, na te kijken tegen officiële FR/DE-voorbeelden.
2. **QR-versie**: pos_detail §6.5 zegt 25×25 (versie 2) ECC M voor 38 tekens; dat past niet in byte-modus (max. 26 bytes). Wij gebruiken ECC M met de kleinste versie (3, 29×29). Vraag voor de FOD.
3. **Codepage**: ESC/POS met PC858 via `ESC t 19` (Epson-nummering). Op de echte printer testen; andere merken kunnen een ander nummer gebruiken.
4. **Kopie van een kasticket**: de FOD-voorbeeldkopie toont "btw-KASTICKET" + "KOPIE". Wij volgen dat (identiek aan het origineel), ook al zegt Q507 dat "btw-kasticket" enkel op het kasticket staat.
5. **Star CloudPRNT** krijgt enkel `text/plain` (geen QR): kastickets gaan niet naar een Star-printer tot er een StarPRNT-encoder is (op hardware te testen). Epson Server Direct Print (ePOS-XML) is nog niet gebouwd; `payload_escpos` is er klaar voor.
6. **Gebruikersrapport**: het voorbeeld in de certificatiehandleiding toont het INSZ; wij drukken het nooit af (naam/nummer uit de personeelslijst).

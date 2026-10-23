// PRINT-1 — inhoudstests per eis (PRT-01..09, EVT-12, FDM-07). Berichten uit de officiële
// use-case-fixtures, handtekeningen van de FdmSimulator (dus echte SignResult-vorm met vatCalc,
// shortSignature, verificationUrl en footer). Layout vergeleken met de FOD-voorbeeldtickets
// van 24-09-2026 op structuur en volgorde, niet pixel voor pixel.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURE_DIR, parseCalls, type UcFixture } from '../../fiscal/__tests__/uc/harness';
import { buildSale } from '../../fiscal/builders';
import { milli4 } from '../../fiscal/money';
import { FdmSimulator } from '../../fiscal/simulator/fdmSimulator';
import { TEST_BUSINESS, TEST_POS, testMeta } from '../../fiscal/testSetup';
import type { AnyFiscalInput, CopyInput, MutationName, SignResult } from '../../fiscal/types';
import {
  buildBestelbon, buildCopyTicket, buildKasticket, buildKitchenTicket, buildPrintJob, buildRefundTicket, buildReport,
  buildTicketFor, buildTrainingTicket, buildVoorrekening, decodeCp858, layout, PAPER_WIDTHS, PrintRefusedError,
  qrMatrix, renderEscPos, renderHtml, renderText, TICKET_STRINGS, type SignedEvent, type TicketContext, type TicketDoc,
} from '../index';

const INSZ = ['84022899837', '75061189702', '80113078968', '00000000097'];

const CTX: TicketContext = {
  business: {
    legalName: 'FPS Finances Experience BV',
    tradeName: TEST_BUSINESS.name,
    address: ['Boulevard Albert II 33', '1030 Brussel'],
    vatNo: TEST_BUSINESS.vatNo,
    estNo: TEST_BUSINESS.estNo,
  },
  staff: { name: 'Elisa', number: 'kassier03' },
  staffDirectory: { '84022899837': { name: 'Elisa', number: 'kassier03' }, '75061189702': { name: 'John', number: 'bar01' } },
};

function fixture(set: string, name: string): UcFixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, set, `${name}.json`), 'utf8'));
}

function call(set: string, name: string, step = 0, idx = 0) {
  const f = fixture(set, name);
  return parseCalls(f.steps[step])[idx];
}

let clock = Date.parse('2024-07-29T11:00:00Z');
function newSim() {
  return new FdmSimulator({ fdmId: 'SIM01000001', now: () => new Date((clock += 1000)) });
}

async function sign(sim: FdmSimulator, name: MutationName, data: AnyFiscalInput, isTraining = false): Promise<SignedEvent> {
  const r = await sim.sign(name, data, isTraining);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { name, isTraining, data, result: r.result };
}

async function signFixture(sim: FdmSimulator, set: string, name: string, step = 0, idx = 0): Promise<SignedEvent> {
  const c = call(set, name, step, idx);
  return sign(sim, c.name, c.data, c.isTraining);
}

/** Alles wat er op het ticket komt, in alle drie de weergaven en alle breedtes. */
function everyOutput(doc: TicketDoc): string[] {
  const out: string[] = [];
  for (const w of PAPER_WIDTHS) {
    out.push(renderText(doc, w, { qr: 'blocks' }));
    out.push(renderHtml(doc, w));
    out.push(decodeCp858(renderEscPos(doc, w)));
  }
  return out;
}

const compact = (s: string) => s.replace(/\s+/g, '');
const txt = (doc: TicketDoc, w: 32 | 42 | 48 = 48) => renderText(doc, w);

function inOrder(text: string, needles: string[]) {
  let at = -1;
  for (const n of needles) {
    const i = text.indexOf(n, at + 1);
    expect(i, `"${n}" na positie ${at}`).toBeGreaterThan(at);
    at = i;
  }
}

function expectRefused(fn: () => unknown, rule: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PrintRefusedError);
    expect((e as PrintRefusedError).rule).toBe(rule);
    return;
  }
  throw new Error(`verwacht geweigerd met ${rule}`);
}

describe('PRT-02/03/06 btw-kasticket (M110)', () => {
  it('bevat alle vermeldingen van MB art. 20 a–r in de volgorde van het FOD-voorbeeld', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const doc = buildKasticket(ev, CTX);
    const r = ev.result as SignResult;
    const t = txt(doc);
    expect(doc.kind).toBe('kasticket');
    // Volgorde zoals 20260924_btw_kasticket_example (a, c, d, i, h, f, j, e, g, e, k, l, p, m/n, o, q, b).
    inOrder(t, [
      'btw-KASTICKET', TEST_BUSINESS.name, 'Vestigingseenheid 2000000042', '29.07.2024', '13:00',
      'Gebruiker: Elisa (kassier03)', 'Terminal: TER-2-DIN', 'Ticketnr.: 001000', 'POS Serial: CPOS0031234567',
      'Input device:', '1631678d-7a85-4ac3-b296-bb4565e873fe', 'Kassasoftware v.: 1.8.3',
      'Dry Martini', 'Burger of the Chef', 'TOTAAL:', '€52,00', 'Betaalwijze:', 'CONTANT', '52,00',
      'BTW%', '21,00%', '19,83', '4,17', '24,00', '12,00%', '25,00', '3,00', '28,00',
      'FDM INFORMATIE', `fdmId: ${r.fdmRef.fdmId};`, `fdmDateTime: ${r.fdmRef.fdmDateTime};`,
      `Event: N; eventCounter: ${r.fdmRef.eventCounter};`, `totalCounter: ${r.fdmRef.totalCounter};`, 'shortSignature:',
      r.footer[0], r.verificationUrl as string, 'Juridische naam: FPS Finances Experience BV', 'Boulevard Albert II 33', 'BTW: BE0000000097',
    ]);
    expect(compact(t)).toContain(compact(`shortSignature: ${r.shortSignature};`));
    expect(t).not.toContain('DIT IS GEEN GELDIG');
    expect(t).not.toContain('PRO FORMA');
    // lijnen: aantal, omschrijving, lijnprijs, btw-code
    expect(t).toMatch(/^2\s+Dry Martini\s+24,00 A$/m);
    expect(t).toMatch(/^1\s+Burger of the Chef\s+28,00 B$/m);
    // PRT-03: de QR draagt exact de verificationUrl van de FDM
    expect(doc.blocks.filter((b) => b.t === 'qr')).toEqual([{ t: 'qr', data: r.verificationUrl }]);
  });

  it('PRT-02: btw en maatstaf komen uit vatCalc van de FDM, nooit herberekend', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const r = ev.result as SignResult;
    r.vatCalc = [{ label: 'A', rate: 21, taxableAmount: 11.11, vatAmount: 2.22, totalAmount: 24, outOfScope: false }];
    const t = txt(buildKasticket(ev, CTX));
    expect(t).toContain('11,11');
    expect(t).toContain('2,22');
    expect(t).not.toContain('19,83');
    r.vatCalc = null;
    expectRefused(() => buildKasticket(ev, CTX), 'PRT-02');
  });

  it('PRT-02/FDM-07: zonder shortSignature, footer of verificationUrl geen kasticket', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const r = ev.result as SignResult;
    expectRefused(() => buildKasticket({ ...ev, result: { ...r, shortSignature: null } }, CTX), 'PRT-02');
    expectRefused(() => buildKasticket({ ...ev, result: { ...r, verificationUrl: null } }, CTX), 'PRT-03');
    expectRefused(() => buildKasticket({ ...ev, result: { ...r, footer: undefined as unknown as string[] } }, CTX), 'FDM-07');
  });

  it('PRT-02: zaakgegevens moeten met het bericht overeenkomen', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    expectRefused(() => buildKasticket(ev, { ...CTX, business: { ...CTX.business, estNo: '2000000043' } }), 'PRT-02');
    expectRefused(() => buildKasticket(ev, { ...CTX, business: { ...CTX.business, vatNo: 'BE0123456749' } }), 'PRT-02');
  });

  it('PRT-06: "btw-KASTICKET" in normale letter, enkel op het kasticket', async () => {
    const sim = newSim();
    const n = buildKasticket(await signFixture(sim, 'basic', 'M110_signSale'), CTX);
    const title = n.blocks.find((b) => b.t === 'title' && b.text === 'btw-KASTICKET');
    expect(title).toBeTruthy();
    const others = [
      buildVoorrekening(await signFixture(sim, 'basic', 'M123_signPrebill'), CTX),
      buildBestelbon(await signFixture(sim, 'basic', 'M121_signOrder'), CTX),
      buildTrainingTicket(await signFixture(sim, 'basic', 'M171_signSale_Training'), CTX),
    ];
    for (const d of others) for (const o of everyOutput(d)) expect(o).not.toContain('btw-KASTICKET');
  });
});

describe('PRT-09: nooit een ticket zonder FDM-controledata', () => {
  it('elke soort weigert zonder SignResult', async () => {
    const sim = newSim();
    const sale = await signFixture(sim, 'basic', 'M110_signSale');
    const order = await signFixture(sim, 'basic', 'M121_signOrder');
    const prebill = await signFixture(sim, 'basic', 'M123_signPrebill');
    const training = await signFixture(sim, 'basic', 'M171_signSale_Training');
    const none = (e: SignedEvent): SignedEvent => ({ ...e, result: null });
    expectRefused(() => buildKasticket(none(sale), CTX), 'PRT-09');
    expectRefused(() => buildRefundTicket(none(sale), CTX), 'PRT-09');
    expectRefused(() => buildBestelbon(none(order), CTX), 'PRT-09');
    expectRefused(() => buildVoorrekening(none(prebill), CTX), 'PRT-09');
    expectRefused(() => buildTrainingTicket(none(training), CTX), 'PRT-09');
    expectRefused(() => buildKitchenTicket(none(order), CTX, { station: 'keuken' }), 'PRT-09');
    expectRefused(() => buildTicketFor(none(sale), CTX), 'PRT-09');
    expectRefused(() => buildCopyTicket(none(sale), sale, CTX), 'PRT-09');
  });

  it('weigert een antwoord dat bij een ander bericht hoort', async () => {
    const sim = newSim();
    const a = await signFixture(sim, 'basic', 'M110_signSale');
    const b = await signFixture(sim, 'basic', 'M171_signSale_Training');
    expectRefused(() => buildKasticket({ ...a, result: { ...(a.result as SignResult), posFiscalTicketNo: 999 } }, CTX), 'PRT-09');
    expectRefused(() => buildKasticket({ ...a, result: b.result }, CTX), 'PRT-09');
    expectRefused(() => buildKasticket({ ...a, result: { ...(a.result as SignResult), digitalSignature: '' } }, CTX), 'PRT-09');
  });
});

describe('Refund (M111)', () => {
  it('REFUND + referentie naar het oorspronkelijke kasticket', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M111_signSale_Refund');
    const doc = buildRefundTicket(ev, CTX);
    const t = txt(doc);
    expect(doc.kind).toBe('refund');
    inOrder(t, ['btw-KASTICKET', 'REFUND', 'Ticketnr.: 001001', 'Dry Martini', '-24,00', 'TOTAAL:', '-€52,00', '-19,83', 'shortSignature:',
      'Origineel FDM informatie:', 'fdmId: FOD01000001;', 'fdmDateTime: 2024-07-29T11:00:08.000Z;', 'Event: N; eventCounter: 15;', 'totalCounter: 59;']);
    expect(t).not.toContain('DIT IS GEEN GELDIG');
  });

  it('een gewone verkoop is geen refund', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    expectRefused(() => buildRefundTicket(ev, CTX), 'PRT-02');
    expect(txt(buildKasticket(ev, CTX))).not.toContain('REFUND');
  });
});

describe('PRT-04 pro forma, voorrekening en training', () => {
  it('voorrekening (M123): PRO FORMA TICKET + VOORLOPIGE REKENING, geen btw-uitsplitsing, geen shortSignature', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M123_signPrebill');
    const doc = buildVoorrekening(ev, CTX);
    const t = txt(doc);
    const r = ev.result as SignResult;
    inOrder(t, ['PRO FORMA TICKET', 'VOORLOPIGE REKENING', TEST_BUSINESS.name, 'Gebruiker:', 'Terminal: TER-1-BAR', 'Ticketnr.: 001005',
      'Tafel T1', 'Dry Martini', 'Tapas variation', '13,36', 'TOTAAL:', '€37,36', 'FDM INFORMATIE', `fdmId: ${r.fdmRef.fdmId};`,
      'fdmDateTime:', 'Event: P; eventCounter:', 'totalCounter:', r.footer[0], 'Juridische naam', 'DIT IS GEEN GELDIG BTW-KASTICKET']);
    expect(t).not.toContain('BTW%');
    expect(t).not.toContain('shortSignature');
    expect(doc.blocks.some((b) => b.t === 'qr')).toBe(false);
    // "PRO FORMA TICKET" bovenaan: eerste titel na de simulatorbanner
    expect(doc.blocks.filter((b) => b.t === 'title').map((b) => (b as { text: string }).text)).toEqual(['TEST: FDM-SIMULATOR', 'PRO FORMA TICKET', 'VOORLOPIGE REKENING']);
  });

  it('bestelbon (M121): PRO FORMA TICKET, geen VOORLOPIGE REKENING', async () => {
    const t = txt(buildBestelbon(await signFixture(newSim(), 'basic', 'M121_signOrder'), CTX));
    inOrder(t, ['PRO FORMA TICKET', 'Tafel T1', 'TOTAAL:', 'Event: P;', 'DIT IS GEEN GELDIG BTW-KASTICKET']);
    expect(t).not.toContain('VOORLOPIGE REKENING');
    expect(t).not.toContain('shortSignature');
  });

  it('PRT-04: shortSignature is verboden op pro forma, ook als een FDM er een zou meesturen', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M123_signPrebill');
    const forged = { ...ev, result: { ...(ev.result as SignResult), shortSignature: 'deadbeef'.repeat(5) } };
    const t = txt(buildVoorrekening(forged, CTX));
    expect(t).not.toContain('deadbeef');
  });

  it('training (M171): TRAINING TICKET, label T, geen btw, geen shortSignature, geen QR', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M171_signSale_Training');
    const forged = { ...ev, result: { ...(ev.result as SignResult), shortSignature: 'cafebabe'.repeat(5), verificationUrl: 'https://www.gs2.be/x' } };
    for (const e of [ev, forged]) {
      const doc = buildTrainingTicket(e, CTX);
      const t = txt(doc);
      inOrder(t, ['TRAINING TICKET', 'Perrier', 'TOTAAL:', '€33,00', 'Event: T;', 'DIT IS GEEN GELDIG BTW-KASTICKET']);
      expect(t).not.toContain('cafebabe');
      expect(t).not.toContain('shortSignature');
      expect(t).not.toContain('BTW%');
      expect(doc.blocks.some((b) => b.t === 'qr')).toBe(false);
    }
    // een trainingsverkoop is nooit een btw-kasticket
    expectRefused(() => buildKasticket(ev, CTX), 'PRT-04');
  });
});

describe('EVT-12 kopie (M160/M161)', () => {
  async function copyOf(sim: FdmSimulator, original: SignedEvent, fixtureName: string): Promise<SignedEvent> {
    const c = call('basic', fixtureName);
    const data = { ...(c.data as CopyInput), fdmRef: { ...(original.result as SignResult).fdmRef } };
    return sign(sim, 'signCopy', data);
  }

  it('kopie van een btw-kasticket: identiek + KOPIE + gegevens van het copy-event, QR van het origineel', async () => {
    const sim = newSim();
    const original = await signFixture(sim, 'basic', 'M110_signSale');
    const copy = await copyOf(sim, original, 'M160_signCopy_Sale');
    const doc = buildCopyTicket(copy, original, CTX, { name: 'John', number: 'bar01' });
    const t = txt(doc);
    const o = original.result as SignResult;
    const c = copy.result as SignResult;
    expect(doc.kind).toBe('kopie');
    inOrder(t, ['btw-KASTICKET', 'KOPIE TICKET', 'Ticketnr.: 001000', 'Dry Martini', 'BTW%', `Event: N; eventCounter: ${o.fdmRef.eventCounter};`, 'shortSignature:',
      o.verificationUrl as string, 'Juridische naam', 'Kopie uitgegeven op 29.07.2024 16:25', 'Ticketnr.: 001013', 'Gebruiker: John (bar01)',
      'FDM informatie kopie:', `fdmDateTime: ${c.fdmRef.fdmDateTime};`, `Event: C; eventCounter: ${c.fdmRef.eventCounter};`, `totalCounter: ${c.fdmRef.totalCounter};`]);
    expect(compact(t)).toContain(compact(`shortSignature: ${o.shortSignature};`));
    expect(doc.blocks.filter((b) => b.t === 'qr')).toEqual([{ t: 'qr', data: o.verificationUrl }]);
    // PRT-04: de kopie van een N draagt NIET "dit is geen geldig btw-kasticket"
    expect(t).not.toContain('DIT IS GEEN GELDIG');
  });

  it('kopie van een bestelbon (P): KOPIE TICKET + DIT IS GEEN GELDIG, geen shortSignature', async () => {
    const sim = newSim();
    const original = await signFixture(sim, 'basic', 'M121_signOrder');
    const copy = await copyOf(sim, original, 'M161_signCopy_Order');
    const t = txt(buildCopyTicket(copy, original, CTX));
    inOrder(t, ['PRO FORMA TICKET', 'KOPIE TICKET', 'Dry Martini', 'Event: P;', 'Kopie uitgegeven op', 'Event: C;', 'DIT IS GEEN GELDIG BTW-KASTICKET']);
    expect(t).not.toContain('shortSignature');
  });

  it('een kopie van een kopie is verboden', async () => {
    const sim = newSim();
    const original = await signFixture(sim, 'basic', 'M110_signSale');
    const copy = await copyOf(sim, original, 'M160_signCopy_Sale');
    const copy2 = await copyOf(sim, copy, 'M161_signCopy_Order');
    expectRefused(() => buildCopyTicket(copy2, copy, CTX), 'EVT-12');
  });

  it('een copy-event dat naar een ander event verwijst wordt geweigerd', async () => {
    const sim = newSim();
    const original = await signFixture(sim, 'basic', 'M110_signSale');
    const other = await signFixture(sim, 'basic', 'M121_signOrder');
    const copy = await copyOf(sim, original, 'M160_signCopy_Sale');
    expectRefused(() => buildCopyTicket(copy, other, CTX), 'EVT-12');
    expectRefused(() => buildCopyTicket(original, original, CTX), 'EVT-12');
  });
});

describe('PRT-05 keuken- en barbon', () => {
  it('nooit bedragen, wel aantal x artikel, tafel en DIT IS GEEN GELDIG BTW-KASTICKET', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M121_signOrder');
    const doc = buildKitchenTicket(ev, { ...CTX, staff: { name: 'John' } }, { station: 'bar', guests: 2 });
    expect(doc.kind).toBe('bar');
    for (const o of everyOutput(doc)) {
      expect(o).not.toMatch(/\d,\d\d/); // geen bedrag
      expect(o).not.toContain('€');
      expect(o).not.toContain('TOTAAL');
      expect(o).not.toContain('shortSignature');
    }
    const t = txt(doc);
    inOrder(t, ['BAR', 'Datum', '29.07.2024 13:57', 'Operator', 'John', 'Aantal gasten', '2', 'Tafel', 'T1', '2 x', 'Dry Martini', '4 x', 'Tapas variation', 'DIT IS GEEN GELDIG BTW-KASTICKET']);
  });

  it('filter per station (enkel de lijnen van de keuken)', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M121_signOrder');
    const t = txt(buildKitchenTicket(ev, CTX, { station: 'keuken', filter: (l) => l.mainProduct.departmentId === '28' }));
    expect(t).toContain('KEUKEN');
    expect(t).toContain('Tapas variation');
    expect(t).not.toContain('Dry Martini');
  });

  it('enkel na een ondertekende bestelling', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    expectRefused(() => buildKitchenTicket(ev, CTX, { station: 'keuken' }), 'PRT-05');
  });
});

describe('X/Z-rapporten (officiële rapportenset NL)', () => {
  async function reports() {
    const sim = newSim();
    const f = fixture('reports-nl', 'REPORTS_NL');
    const out: Record<string, SignedEvent> = {};
    for (const step of f.steps) {
      if (!/^Report\d_/.test(step.step)) continue;
      const c = parseCalls(step)[0];
      out[c.name] = await sign(sim, c.name, c.data, c.isTraining);
    }
    return out;
  }

  it('titels, identificatie, btw-overzicht uit het rapport, controledata, DIT IS GEEN GELDIG', async () => {
    const r = await reports();
    const tz = txt(buildReport(r.signReportTurnoverZ, CTX));
    inOrder(tz, ['Z OMZET', TEST_BUSINESS.name, 'BTW: BE0000000097', 'Vestigingseenheid 2000000042', 'Rapport nr', 'Boekingsdatum', 'POSID',
      'FDMID', 'Normale verkopen', 'BTW overzicht', '21,00%', 'Tot', 'Betalingen', 'Totaal betalingen', 'Afronding', 'FDM INFORMATIE', 'Event: R;',
      'DIT IS GEEN GELDIG BTW-KASTICKET']);
    expect(tz).not.toContain('shortSignature');
    expect(txt(buildReport(r.signReportTurnoverX, CTX))).toContain('X OMZET');
    expect(txt(buildReport(r.signReportUserX, CTX))).toContain('X GEBRUIKERS');
    const uz = txt(buildReport(r.signReportUserZ, CTX));
    inOrder(uz, ['Z GEBRUIKERS', 'John (bar01)', 'Omzet (incl. btw)', '44,18', 'Elisa (kassier03)', '15,04', 'DIT IS GEEN GELDIG']);
  });

  it('gebruikersrapport: nooit het INSZ, ook niet zonder personeelslijst', async () => {
    const r = await reports();
    for (const ctx of [CTX, { ...CTX, staffDirectory: undefined }]) {
      const doc = buildReport(r.signReportUserZ, ctx);
      for (const o of everyOutput(doc)) for (const id of INSZ) expect(o).not.toContain(id);
    }
    expect(txt(buildReport(r.signReportUserZ, { ...CTX, staffDirectory: undefined }))).toContain('Gebruiker 1');
  });
});

describe('INSZ (pos_detail 6.4)', () => {
  it('het employeeId staat in geen enkele afdruk, in geen enkele weergave', async () => {
    const sim = newSim();
    const sale = await signFixture(sim, 'basic', 'M110_signSale');
    const order = await signFixture(sim, 'basic', 'M121_signOrder');
    const docs = [
      buildKasticket(sale, CTX),
      buildRefundTicket(await signFixture(sim, 'basic', 'M111_signSale_Refund'), CTX),
      buildBestelbon(order, CTX),
      buildVoorrekening(await signFixture(sim, 'basic', 'M123_signPrebill'), CTX),
      buildTrainingTicket(await signFixture(sim, 'basic', 'M171_signSale_Training'), CTX),
      buildKitchenTicket(order, CTX, { station: 'keuken' }),
    ];
    for (const d of docs) for (const o of everyOutput(d)) for (const id of INSZ) expect(o).not.toContain(id);
  });

  it('weigert een gebruikerslabel dat het INSZ bevat', async () => {
    const sale = await signFixture(newSim(), 'basic', 'M110_signSale');
    expectRefused(() => buildKasticket(sale, { ...CTX, staff: { name: 'Elisa', number: '84022899837' } }), 'PRT-02');
    expectRefused(() => buildKasticket(sale, { ...CTX, staff: { name: '840228-998.37' } }), 'PRT-02');
  });
});

describe('PRT-07 consolidatie en groeperen', () => {
  const p = (id: string, name: string, dep: string, price: number, label: 'A' | 'B') => ({ productId: id, productName: name, departmentId: dep, departmentName: `Dep ${dep}`, price, label });
  const cola = p('1', 'Cola', '12', 250, 'A');
  const water = p('2', 'Water', '12', 300, 'A');
  const spaghetti = p('3', 'Spaghetti', '22', 1000, 'B');
  const line = (x: ReturnType<typeof p>, q: number) => ({
    kind: 'single' as const,
    main: { product: { productId: x.productId, productName: x.productName, departmentId: x.departmentId, departmentName: x.departmentName }, quantity: milli4(q), unitPrice: milli4(x.price / 100), negQuantityReason: q < 0 ? ('CORRECTION' as const) : null, vats: [{ label: x.label }] },
  });

  it('het voorbeeld uit pos_detail 8.2: 2 Water 6,00 A / 2 Spaghetti 20,00 B', async () => {
    const data = buildSale(TEST_POS, testMeta(), {
      lines: [line(cola, 1), line(water, 1), line(spaghetti, 2), line(cola, -1), line(water, 1)],
      payments: [{ id: '1', name: 'CONTANT', type: 'CASH', inputMethod: 'MANUAL', amount: 2600 }],
    });
    const ev = await sign(newSim(), 'signSale', data);
    const plain = txt(buildKasticket(ev, CTX));
    expect(plain).toContain('Cola');
    const t = txt(buildKasticket(ev, { ...CTX, options: { consolidate: true, groupByDepartment: true } }));
    expect(t).not.toContain('Cola');
    expect(t).toMatch(/^2\s+Water\s+6,00 A$/m);
    expect(t).toMatch(/^2\s+Spaghetti\s+20,00 B$/m);
    inOrder(t, ['Dep 12', 'Water', 'Dep 22', 'Spaghetti', '€26,00']);
  });
});

describe('PRT-08 tickettaal', () => {
  it('alle vier de talen hebben dezelfde sleutels', () => {
    const keys = (o: object) => JSON.stringify(Object.keys(o).sort());
    for (const l of ['FR', 'DE', 'EN'] as const) expect(keys(TICKET_STRINGS[l])).toBe(keys(TICKET_STRINGS.NL));
  });

  it('titels per taal (NL/EN uit de FOD-voorbeelden)', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    expect(txt(buildKasticket(ev, { ...CTX, language: 'EN' }))).toContain('VAT CASH REGISTER TICKET');
    expect(txt(buildKasticket(ev, { ...CTX, language: 'FR' }))).toContain('TICKET DE CAISSE TVA');
    expect(txt(buildKasticket(ev, { ...CTX, language: 'DE' }))).toContain('MWST-KASSENBON');
    const pb = await signFixture(newSim(), 'basic', 'M123_signPrebill');
    expect(txt(buildVoorrekening(pb, { ...CTX, language: 'EN' }))).toContain('THIS IS NOT A VALID VAT CASH REGISTER TICKET');
  });
});

describe('simulator blijft zichtbaar als test', () => {
  it('banner boven- en onderaan + footer van de simulator', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const doc = buildKasticket(ev, CTX);
    expect(doc.simulated).toBe(true);
    const t = txt(doc);
    expect(t.split('TEST: FDM-SIMULATOR').length - 1).toBe(2);
    expect(t).toContain('SELLQO FDM-SIMULATOR');
  });

  it('een echte FDM-footer geeft geen banner', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const doc = buildKasticket({ ...ev, result: { ...(ev.result as SignResult), footer: ['FOD FIN - GKS'] } }, CTX);
    expect(doc.simulated).toBe(false);
    expect(txt(doc)).not.toContain('SIMULATOR');
    expect(txt(doc)).toContain('FOD FIN - GKS');
  });
});

describe('weergaven', () => {
  it('geen enkele regel is breder dan het papier (32/42/48)', async () => {
    const sim = newSim();
    const docs = [
      buildKasticket(await signFixture(sim, 'basic', 'M110_signSale'), CTX),
      buildVoorrekening(await signFixture(sim, 'basic', 'M123_signPrebill'), { ...CTX, language: 'FR' }),
    ];
    for (const d of docs) for (const w of PAPER_WIDTHS) {
      for (const l of layout(d, w)) if (l.kind === 'text') expect(l.text.length, l.text).toBeLessThanOrEqual(w);
    }
  });

  it('ESC/POS: init, PC858, vet/dubbel, QR model 2 ECC M met de verificationUrl, snijden', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const url = (ev.result as SignResult).verificationUrl as string;
    const b = Array.from(renderEscPos(buildKasticket(ev, CTX), 42));
    const hex = b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
    expect(hex.startsWith('1b 40 1b 74 13')).toBe(true);
    expect(hex).toContain('1d 28 6b 04 00 31 41 32 00'); // model 2
    expect(hex).toContain('1d 28 6b 03 00 31 45 31'); // ECC M
    const store = [0x1d, 0x28, 0x6b, (url.length + 3) & 0xff, 0, 0x31, 0x50, 0x30, ...Array.from(url, (c) => c.charCodeAt(0))];
    expect(hex).toContain(store.map((x) => x.toString(16).padStart(2, '0')).join(' '));
    expect(hex).toContain('1d 28 6b 03 00 31 51 30'); // afdrukken
    expect(hex.endsWith('1d 56 42 00')).toBe(true);
    expect(hex).toContain('1d 21 01'); // dubbele hoogte voor de titel
    expect(b).toContain(0xd5); // € in PC858
  });

  it('PC858: Franse en Duitse tekens', () => {
    const d = decodeCp858(renderEscPos({ kind: 'keuken', language: 'FR', fdmRef: null, simulated: false, blocks: [{ t: 'text', text: 'Crème brûlée ÄÖÜß € “x”' }] }, 32, { cut: false, feedLines: 0 }));
    expect(d).toContain('Crème brûlée ÄÖÜß € "x"');
  });

  it('HTML: QR als SVG en de url als link', async () => {
    const ev = await signFixture(newSim(), 'basic', 'M110_signSale');
    const url = (ev.result as SignResult).verificationUrl as string;
    const h = renderHtml(buildKasticket(ev, { ...CTX, business: { ...CTX.business, tradeName: 'Café <North> & Co' } }));
    expect(h).toContain('<svg');
    expect(h).toContain(`href="${url}"`);
    expect(h).toContain('Café &lt;North&gt; &amp; Co');
  });

  it('PRT-03: QR met ECC M; een url van 38 tekens vraagt versie 3 (29x29), niet 2', () => {
    const m = qrMatrix('https://www.gs2.be/viXnmc1vvqGaMAS8MJV');
    expect(m.version).toBe(3);
    expect(m.size).toBe(29);
    expect(qrMatrix('https://gs2.be/viXnmc1vvqGaMAS8MJV').version).toBe(3);
  });
});

describe('printwachtrij (pure logica)', () => {
  it('kasticket: ESC/POS-printer ja, Star text/plain nee (PRT-03), keukenprinter nee', async () => {
    const sim = newSim();
    const doc = buildKasticket(await signFixture(sim, 'basic', 'M110_signSale'), CTX);
    const job = buildPrintJob(doc, { id: 'p1', kind: 'receipt', protocol: 'escpos_lan', widthChars: 48 });
    expect(job.payload_escpos && atob(job.payload_escpos).startsWith('\x1b@')).toBe(true);
    expect(job.dedupe_key).toBe(`SIM01000001:N${doc.fdmRef?.eventCounter}/${doc.fdmRef?.totalCounter}:kasticket:p1`);
    expectRefused(() => buildPrintJob(doc, { id: 'p2', kind: 'receipt', protocol: 'star_cloudprnt', widthChars: 42 }), 'PRT-03');
    expect(() => buildPrintJob(doc, { id: 'p3', kind: 'kitchen', protocol: 'escpos_lan', widthChars: 42 })).toThrow();
    const bar = buildKitchenTicket(await signFixture(sim, 'basic', 'M121_signOrder'), CTX, { station: 'bar' });
    const barJob = buildPrintJob(bar, { id: 'p2', kind: 'bar', protocol: 'star_cloudprnt', widthChars: 42 });
    expect(barJob.payload_escpos).toBeNull();
    expect(barJob.payload_text).toContain('Dry Martini');
    expect(() => buildPrintJob(bar, { id: 'p1', kind: 'receipt', protocol: 'escpos_lan', widthChars: 48 })).toThrow();
  });
});

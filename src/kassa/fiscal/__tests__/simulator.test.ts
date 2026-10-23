// KASSA-0 — simulator en gateway: idempotentie (ID-11), tellers (ID-04), fouten (FDM-06),
// buffer, training (EVT-11), en het nooit-afsluiten-zonder-handtekening-pad (FDM-04/05).
import { describe, expect, it } from 'vitest';
import { FdmSimulator, SIMULATOR_FOOTER } from '../simulator/fdmSimulator';
import { FiscalSender, MemoryPendingStore, SimulatorGateway, FiscalValidationError } from '../gateway';
import { buildSale, buildWorkInOut } from '../builders';
import { milli4 } from '../money';
import { mutationBody } from '../documents';
import { TEST_POS, testMeta } from '../testSetup';
import type { SaleInput } from '../types';

const martini = { product: { productId: '10006', productName: 'Dry Martini', departmentId: '10', departmentName: 'Aperitifs' }, quantity: milli4(2), unitPrice: milli4(12), vats: [{ label: 'A' as const }] };
const cash = (amount: number) => ({ id: '1', name: 'CONTANT', type: 'CASH' as const, inputMethod: 'MANUAL' as const, amount, drawer: { id: '1', name: 'Drawer 1' } });
const sale = (no: number, over: Partial<ReturnType<typeof testMeta>> = {}): SaleInput =>
  buildSale(TEST_POS, testMeta({ posFiscalTicketNo: no, posDateTime: `2024-07-29T13:00:${String(no % 60).padStart(2, '0')}.000+02:00`, ...over }), { lines: [{ kind: 'single', main: martini }], payments: [cash(2400)] });

describe('FDM-simulator', () => {
  it('ondertekent een verkoop: label N, btw, korte handtekening, QR, footer', async () => {
    const sim = new FdmSimulator({ fdmId: 'SIM01000001' });
    const r = await sim.sign('signSale', sale(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.fdmRef).toMatchObject({ fdmId: 'SIM01000001', eventLabel: 'N', eventCounter: 1, totalCounter: 1 });
    expect(r.result.vatCalc).toEqual([{ label: 'A', rate: 21, taxableAmount: 19.83, vatAmount: 4.17, totalAmount: 24, outOfScope: false }]);
    expect(r.result.shortSignature).toMatch(/^[0-9a-f]{40}$/);
    expect(r.result.verificationUrl).toMatch(/^https:\/\/gs2\.be\/[0-9A-Za-z]{19}$/);
    expect(r.result.footer).toEqual([SIMULATOR_FOOTER]);
    expect(r.result.fdmRef.fdmDateTime).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
  });

  it('ID-11: identiek bericht = zelfde antwoord, tellers niet verhoogd', async () => {
    const sim = new FdmSimulator();
    const a = await sim.sign('signSale', sale(7));
    const b = await sim.sign('signSale', sale(7));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.result).toEqual(a.result);
    expect(sim.counter('total')).toBe(1);
    expect(sim.journal).toHaveLength(1);
  });

  it('ID-11: zelfde sleutelvelden, andere inhoud = geweigerd', async () => {
    const sim = new FdmSimulator();
    await sim.sign('signSale', sale(7));
    const other = sale(7);
    other.employeeId = '75061189702';
    const r = await sim.sign('signSale', other);
    expect(r.ok).toBe(false);
    expect(sim.counter('total')).toBe(1);
  });

  it('ID-04: tellers per label en totaal, herstart na 999 999 999', async () => {
    const sim = new FdmSimulator({ counters: { N: 999_999_999, total: 999_999_998 } });
    const a = await sim.sign('signSale', sale(1));
    const b = await sim.sign('signSale', sale(2));
    const s = await sim.sign('signWorkIn', buildWorkInOut(TEST_POS, testMeta({ posFiscalTicketNo: 3 })));
    expect(a.ok && a.result.fdmRef).toMatchObject({ eventCounter: 1, totalCounter: 999_999_999 });
    expect(b.ok && b.result.fdmRef).toMatchObject({ eventCounter: 2, totalCounter: 1 });
    expect(s.ok && s.result.fdmRef).toMatchObject({ eventLabel: 'S', eventCounter: 1, totalCounter: 2 });
  });

  it('EVT-11: training = label T, geen btw, geen QR, geen korte handtekening', async () => {
    const sim = new FdmSimulator();
    const r = await sim.sign('signSale', sale(1), true);
    expect(r.ok && r.result.fdmRef.eventLabel).toBe('T');
    expect(r.ok && [r.result.vatCalc, r.result.shortSignature, r.result.verificationUrl]).toEqual([null, null, null]);
  });

  it('FDM-06: blijvende fouten en onbekende POS', async () => {
    const sim = new FdmSimulator({ posAllowList: ['CPOS0031234568'] });
    const unknown = await sim.sign('signSale', sale(1));
    expect(!unknown.ok && unknown.errors[0].extensions.code).toBe('UNKNOWN_POS');
    const sim2 = new FdmSimulator();
    for (const code of ['FDM_LOCKED', 'FDM_NOT_OPERATIONAL', 'BUFFER_FULL'] as const) {
      sim2.setFault(code);
      const r = await sim2.sign('signSale', sale(1));
      expect(!r.ok && r.errors[0].extensions).toMatchObject({ code, showPos: 'MANDATORY' });
    }
    sim2.setFault(null);
    expect((await sim2.sign('signSale', sale(1))).ok).toBe(true);
  });

  it('buffer: waarschuwing boven 70 %, vol = fout, upload maakt leeg', async () => {
    const sim = new FdmSimulator({ bufferSize: 4 });
    const results = [];
    for (let i = 1; i <= 4; i++) results.push(await sim.sign('signSale', sale(i)));
    expect(results[1].ok && results[1].result.warnings).toEqual([]);
    expect(results[2].ok && results[2].result.warnings?.[0].extensions.code).toBe('BUFFER_NEAR_FULL');
    const full = await sim.sign('signSale', sale(5));
    expect(!full.ok && full.errors[0].extensions.code).toBe('BUFFER_FULL');
    sim.flushBuffer();
    expect((await sim.sign('signSale', sale(5))).ok).toBe(true);
  });

  it('weigert een ongeldig bericht (schema) zonder tellers te raken', async () => {
    const sim = new FdmSimulator();
    const bad = { ...sale(1), language: 'XX' } as unknown as SaleInput;
    const r = await sim.sign('signSale', bad);
    expect(!r.ok && r.errors[0].extensions.code).toBe('INVALID_REQUEST');
    expect(sim.counter('total')).toBe(0);
  });

  it('GraphQL: projecteert op de gevraagde velden en kent aliassen', async () => {
    const sim = new FdmSimulator();
    const res = await sim.handleGraphQL({
      query: 'mutation X($d: SaleInput!) { a: signSale(data: $d) { __typename posFiscalTicketNo fdmRef { eventLabel } } }',
      variables: { d: sale(3) },
    });
    expect(res).toEqual({ data: { a: { __typename: 'SignResult', posFiscalTicketNo: 3, fdmRef: { eventLabel: 'N' } } } });
  });
});

describe('FiscalSender (ID-11, FDM-04, FDM-05)', () => {
  it('antwoord verloren → identiek opnieuw → zelfde handtekening, één keer geteld', async () => {
    const sim = new FdmSimulator();
    const gw = new SimulatorGateway(sim);
    const store = new MemoryPendingStore();
    const sender = new FiscalSender(gw, store, { sleep: async () => {} });
    gw.dropNextResponses = 1;
    const out = await sender.sign('signSale', sale(11));
    expect(out.kind).toBe('signed');
    expect(sim.counter('total')).toBe(1);
    expect(await store.list()).toEqual([]);
  });

  it('FDM onbereikbaar → bericht blijft bewaard, later identiek verstuurd', async () => {
    const sim = new FdmSimulator();
    const gw = new SimulatorGateway(sim);
    const store = new MemoryPendingStore();
    const sender = new FiscalSender(gw, store, { maxAttempts: 2, sleep: async () => {} });
    gw.failNextSends = 5;
    const out = await sender.sign('signSale', sale(12));
    expect(out.kind).toBe('unreachable');
    const pending = await store.list();
    expect(pending).toHaveLength(1);
    expect(pending[0].requestBody).toBe(JSON.stringify(mutationBody('signSale', sale(12))));
    gw.failNextSends = 0;
    const resumed = await sender.resumePending();
    expect(resumed[0].kind).toBe('signed');
    expect(await store.list()).toEqual([]);
    expect(sim.counter('total')).toBe(1);
  });

  it('weigering door de FDM = rejected, niets blijft hangen', async () => {
    const sim = new FdmSimulator();
    sim.setFault('FDM_LOCKED');
    const store = new MemoryPendingStore();
    const out = await new FiscalSender(new SimulatorGateway(sim), store, { sleep: async () => {} }).sign('signSale', sale(13));
    expect(out.kind).toBe('rejected');
    expect(await store.list()).toEqual([]);
  });

  it('ongeldig bericht gaat nooit de deur uit', async () => {
    const sim = new FdmSimulator();
    const bad = { ...sale(14), posId: 'kort' } as SaleInput;
    bad.transaction = { ...bad.transaction, transactionTotal: undefined as unknown as number };
    await expect(new FiscalSender(new SimulatorGateway(sim), new MemoryPendingStore()).sign('signSale', bad)).rejects.toBeInstanceOf(FiscalValidationError);
    expect(sim.counter('total')).toBe(0);
  });

  it('zelfde sleutel met andere inhoud in de wachtrij = programmeerfout', async () => {
    const sim = new FdmSimulator();
    const gw = new SimulatorGateway(sim);
    const store = new MemoryPendingStore();
    const sender = new FiscalSender(gw, store, { maxAttempts: 1, sleep: async () => {} });
    gw.failNextSends = 1;
    await sender.sign('signSale', sale(15));
    const other = sale(15);
    other.employeeId = '75061189702';
    await expect(sender.sign('signSale', other)).rejects.toThrow(/ID-11/);
  });
});

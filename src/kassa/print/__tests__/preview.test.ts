// PRINT-1 — schrijft voorbeeldafdrukken weg als PRINT_PREVIEW_DIR gezet is (handmatige controle
// tegen de FOD-voorbeeldtickets). Zonder die variabele doet deze test niets.
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { FIXTURE_DIR, parseCalls } from '../../fiscal/__tests__/uc/harness';
import { FdmSimulator } from '../../fiscal/simulator/fdmSimulator';
import { TEST_BUSINESS } from '../../fiscal/testSetup';
import type { CopyInput, SignResult } from '../../fiscal/types';
import { buildCopyTicket, buildKitchenTicket, buildTicketFor, renderHtml, renderText, type SignedEvent, type TicketContext } from '../index';

const DIR = process.env.PRINT_PREVIEW_DIR;

it.runIf(!!DIR)('voorbeeldafdrukken', async () => {
  const ctx: TicketContext = {
    business: { legalName: 'FPS Finances Experience BV', tradeName: TEST_BUSINESS.name, address: ['Boulevard Albert II 33', '1030 Brussel'], vatNo: TEST_BUSINESS.vatNo, estNo: TEST_BUSINESS.estNo },
    staff: { name: 'Elisa', number: 'kassier03' },
  };
  let t = Date.parse('2024-07-29T11:00:00Z');
  const sim = new FdmSimulator({ now: () => new Date((t += 1000)) });
  const load = (set: string, n: string) => parseCalls(JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, set, `${n}.json`), 'utf8')).steps.at(-1))[0];
  const sign = async (set: string, n: string, over?: (d: unknown) => unknown): Promise<SignedEvent> => {
    const c = load(set, n);
    const data = (over ? over(c.data) : c.data) as typeof c.data;
    const r = await sim.sign(c.name, data, c.isTraining);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return { name: c.name, isTraining: c.isTraining, data, result: r.result };
  };
  fs.mkdirSync(DIR as string, { recursive: true });
  const out: Record<string, string> = {};
  const m110 = await sign('basic', 'M110_signSale');
  const m121 = await sign('basic', 'M121_signOrder');
  out.kasticket = renderText(buildTicketFor(m110, ctx), 42);
  out.refund = renderText(buildTicketFor(await sign('basic', 'M111_signSale_Refund'), ctx), 42);
  out.voorrekening = renderText(buildTicketFor(await sign('basic', 'M123_signPrebill'), ctx), 42);
  out.bestelbon = renderText(buildTicketFor(m121, ctx), 32);
  out.training = renderText(buildTicketFor(await sign('basic', 'M171_signSale_Training'), ctx), 42);
  const copy = await sign('basic', 'M160_signCopy_Sale', (d) => ({ ...(d as CopyInput), fdmRef: (m110.result as SignResult).fdmRef }));
  out.kopie = renderText(buildCopyTicket(copy, m110, ctx), 42);
  out.bar = renderText(buildKitchenTicket(m121, ctx, { station: 'bar', guests: 2 }), 42);
  out.kasticket_fr_48 = renderText(buildTicketFor(m110, { ...ctx, language: 'FR' }), 48, { qr: 'blocks' });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(DIR as string, `${k}.txt`), v);
  fs.writeFileSync(path.join(DIR as string, 'kasticket.html'), renderHtml(buildTicketFor(m110, ctx), 42));
});

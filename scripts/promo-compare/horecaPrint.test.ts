/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// PRINT-2 — de ECHTE horeca-print-handler tegen een nep-databank: enkel met het interne geheim,
// een bon gaat naar de printer van zijn post (zonder bedrag, dedupe per bon), niets zonder printer,
// nooit een betaalbewijs bij een geregistreerde kassa, testafdruk enkel met een sessie.
// Opmaak: supabase/functions/_shared/horecaPrint.test.ts.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/horecaPrint.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = '3d8cf072-6bec-41dd-b01b-fef166ac9742';
const ST = '5e5e0000-0000-4000-8000-0000000000aa';
const ST2 = '5e5e0000-0000-4000-8000-0000000000bb';
const PR = '9a9a0000-0000-4000-8000-000000000001';
const TK = '7c7c0000-0000-4000-8000-000000000001';
const TK2 = '7c7c0000-0000-4000-8000-000000000002';
const PAY = '8d8d0000-0000-4000-8000-000000000001';
// PRINT-2b: een zaak zonder posten, met een printer voor "bonnen zonder post".
const T2 = '4e4e0000-0000-4000-8000-000000000002';
const PR2 = '9a9a0000-0000-4000-8000-000000000002';
const TK3 = '7c7c0000-0000-4000-8000-000000000003';

const db = new FakeDb({
  internal_config: [{ key: 'internal_webhook_secret', value: 'geheim' }],
  tenants: [{ id: T, name: 'Belgaleiro' }, { id: T2, name: 'Frituur' }],
  printers: [
    { id: PR, tenant_id: T, name: 'Keuken', protocol: 'star_cloudprnt', width_chars: 42, lang: 'nl', is_active: true },
    { id: PR2, tenant_id: T2, name: 'Toog', protocol: 'star_cloudprnt', width_chars: 48, lang: 'nl', is_active: true },
  ],
  prep_stations: [
    { id: ST, tenant_id: T, name: 'Keuken', kind: 'kitchen', printer_id: PR, is_default: true, is_active: true },
    { id: ST2, tenant_id: T, name: 'Bar', kind: 'bar', printer_id: null, is_default: false, is_active: true },
  ],
  kitchen_tickets: [
    { id: TK, tenant_id: T, source: 'table', service_type: 'eat_in', table_label: 'B7', customer_label: 'B7', station_id: ST, created_at: '2026-10-28T19:00:00Z',
      items: [{ name: 'Croque', quantity: 2, note: 'zonder ui', addons: [{ name: 'Extra kaas' }] }], total: 25 },
    { id: TK2, tenant_id: T, source: 'table', service_type: 'eat_in', table_label: 'B7', customer_label: 'B7', station_id: ST2, created_at: '2026-10-28T19:00:00Z',
      items: [{ name: 'Pils', quantity: 1 }], total: 3 },
    { id: TK3, tenant_id: T2, source: 'pos', service_type: 'pickup', customer_label: 'Jan', station_id: null, created_at: '2026-10-28T19:00:00Z',
      items: [{ name: 'Grote friet', quantity: 1 }], total: 4 },
  ],
  horeca_pay_settings: [{ tenant_id: T, receipt_print: true, receipt_printer_id: PR }, { tenant_id: T2, ticket_printer_id: PR2 }],
});

let receipt: any = null;
(db as any).rpc = (fn: string) => Promise.resolve({ data: fn === 'horeca_receipt_data' ? receipt : null, error: null });

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/horeca-print/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const post = async (body: unknown, secret: string | null = 'geheim') => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Internal-Secret'] = secret;
  const r = await handler(new Request('https://f/horeca-print', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json() };
};
const jobs = () => db.writes.filter((w) => w.table === 'print_jobs' && w.insert).map((w) => w.insert);

Deno.test('GET geeft de versiestempel, zonder data', async () => {
  const j = await (await handler(new Request('https://f/horeca-print'))).json();
  assert(j.ok === true && j.version === 'PRINT-2b', JSON.stringify(j));
});

Deno.test('zonder of met fout geheim → 401, geen printopdracht', async () => {
  const before = jobs().length;
  assert((await post({ kind: 'ticket', id: TK }, null)).status === 401, 'geen geheim');
  assert((await post({ kind: 'ticket', id: TK }, 'fout')).status === 401, 'fout geheim');
  assert(jobs().length === before, 'er mocht geen job komen');
});

Deno.test('ongeldige invoer → 400', async () => {
  assert((await post({ kind: 'ticket', id: 'x' })).status === 400, 'id');
  assert((await post({ kind: 'iets', id: TK })).status === 400, 'kind');
});

Deno.test('bon → printer van zijn post, zonder bedrag, met dedupe per bon', async () => {
  const r = await post({ kind: 'ticket', id: TK });
  assert(r.status === 200 && r.json.queued === true, JSON.stringify(r.json));
  const j = jobs().at(-1);
  assert(j.printer_id === PR && j.tenant_id === T && j.kind === 'keuken' && j.dedupe_key === `ticket:${TK}`, JSON.stringify(j));
  assert(j.payload_text.includes('2 x Croque') && j.payload_text.includes('+ Extra kaas') && j.payload_text.includes('Tafel B7'), j.payload_text);
  assert(!/EUR/.test(j.payload_text), 'bedrag op een keukenbon');
});

Deno.test('post zonder printer → overgeslagen', async () => {
  const before = jobs().length;
  const r = await post({ kind: 'ticket', id: TK2 });
  assert(r.status === 200 && r.json.skipped === 'no_printer', JSON.stringify(r.json));
  assert(jobs().length === before, 'er mocht geen job komen');
});

Deno.test('betaalbewijs: wel buiten GKS, nooit bij een geregistreerde kassa', async () => {
  receipt = { tenant_id: T, store_name: 'Belgaleiro', address: [], vat_number: null, tenant_lang: 'nl', origin: 'kassa', online_kind: null, table: 'B7',
    when: '2026-10-28T20:00:00Z', receipt_no: 'K-1', lines: [{ quantity: 1, name: 'Pils', total_cents: 300 }], paid_cents: 300, tip_cents: 0, rounding_cents: 0,
    tenders: [{ method: 'cash', amount_cents: 300 }], rest_open: false, fiscal: true, status: 'paid', stripe_session_id: null };
  const before = jobs().length;
  const r1 = await post({ kind: 'receipt', id: PAY });
  assert(r1.json.skipped === 'fiscal' && jobs().length === before, JSON.stringify(r1.json));
  receipt = { ...receipt, fiscal: false };
  const r2 = await post({ kind: 'receipt', id: PAY });
  assert(r2.json.queued === true, JSON.stringify(r2.json));
  const j = jobs().at(-1);
  assert(j.kind === 'betaalbewijs' && j.dedupe_key === `receipt:${PAY}` && j.payload_text.includes('DIT IS GEEN GELDIG BTW-KASTICKET'), JSON.stringify(j));
});

Deno.test('testafdruk zonder sessie → 401, ook met het interne geheim', async () => {
  const r = await post({ kind: 'test', printer_id: PR });
  assert(r.status === 401, JSON.stringify(r));
});

Deno.test('zaak zonder posten: bon gaat naar de printer voor bonnen zonder post (PRINT-2b)', async () => {
  const r = await post({ kind: 'ticket', id: TK3 });
  assert(r.status === 200 && r.json.queued === true, JSON.stringify(r.json));
  const j = jobs().at(-1);
  assert(j.printer_id === PR2 && j.tenant_id === T2 && j.kind === 'keuken' && j.payload_text.includes('1 x Grote friet'), JSON.stringify(j));
});

Deno.test('bon van een post zonder printer gaat nooit naar de printer voor bonnen zonder post', async () => {
  const db2 = (globalThis as any).__fakeDb;
  db2.tables.horeca_pay_settings[0].ticket_printer_id = PR;
  const before = jobs().length;
  const r = await post({ kind: 'ticket', id: TK2 });
  assert(r.json.skipped === 'no_printer' && jobs().length === before, JSON.stringify(r.json));
  db2.tables.horeca_pay_settings[0].ticket_printer_id = undefined;
});

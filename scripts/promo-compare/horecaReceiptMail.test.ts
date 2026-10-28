/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// PRINT-2 — de ECHTE horeca-receipt-mail-handler: kassa enkel met een sessie (en vóór er iets over de
// betaling opgezocht wordt), online enkel met het interne geheim, nooit bij een geregistreerde kassa,
// online niets zonder de instelling.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/horecaReceiptMail.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = '3d8cf072-6bec-41dd-b01b-fef166ac9742';
const PAY = '8d8d0000-0000-4000-8000-000000000001';
const db = new FakeDb({
  internal_config: [{ key: 'internal_webhook_secret', value: 'geheim' }],
  horeca_pay_settings: [{ tenant_id: T, mail_online: false, mail_button: true }],
});
let receipt: any = null;
const rpcCalls: string[] = [];
(db as any).rpc = (fn: string) => { rpcCalls.push(fn); return Promise.resolve({ data: fn === 'horeca_receipt_data' ? receipt : null, error: null }); };

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/horeca-receipt-mail/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const post = async (body: unknown, headers: Record<string, string> = {}) => {
  const r = await handler(new Request('https://f/horeca-receipt-mail', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json() };
};
const base = { tenant_id: T, store_name: 'Zaak', address: [], vat_number: null, tenant_lang: 'nl', origin: 'online', online_kind: 'full', table: 'B1',
  when: '2026-10-28T20:00:00Z', receipt_no: null, lines: [], paid_cents: 500, tip_cents: 0, rounding_cents: 0, tenders: [], rest_open: false,
  fiscal: false, status: 'paid', stripe_session_id: 'cs_test' };

Deno.test('GET geeft de versiestempel', async () => {
  const j = await (await handler(new Request('https://f/horeca-receipt-mail'))).json();
  assert(j.version === 'PRINT-2', JSON.stringify(j));
});

Deno.test('ongeldige invoer → 400', async () => {
  assert((await post({ source: 'x', payment_id: PAY })).status === 400, 'source');
  assert((await post({ source: 'kassa', payment_id: 'x' })).status === 400, 'id');
});

Deno.test('kassa zonder sessie → 401, en de betaling wordt niet eens opgezocht', async () => {
  rpcCalls.length = 0;
  const r = await post({ source: 'kassa', payment_id: PAY, email: 'gast@voorbeeld.be' });
  assert(r.status === 401, JSON.stringify(r));
  assert(rpcCalls.length === 0, 'betaling opgezocht zonder sessie');
});

Deno.test('online zonder of met fout geheim → 401', async () => {
  receipt = base;
  assert((await post({ source: 'online', payment_id: PAY })).status === 401, 'geen geheim');
  assert((await post({ source: 'online', payment_id: PAY }, { 'X-Internal-Secret': 'fout' })).status === 401, 'fout geheim');
});

Deno.test('online: instelling uit → niets; geregistreerde kassa → niets', async () => {
  receipt = base;
  const r1 = await post({ source: 'online', payment_id: PAY }, { 'X-Internal-Secret': 'geheim' });
  assert(r1.json.skipped === 'off', JSON.stringify(r1.json));
  receipt = { ...base, fiscal: true };
  const r2 = await post({ source: 'online', payment_id: PAY }, { 'X-Internal-Secret': 'geheim' });
  assert(r2.json.skipped === 'fiscal', JSON.stringify(r2.json));
  assert(!db.writes.some((w) => w.table === 'horeca_receipt_mails'), 'er mocht niets gelogd worden');
});

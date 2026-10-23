// PRINT-1 — tests voor de CloudPRNT-protocollogica.
// Run: deno test --no-lock supabase/functions/_shared/cloudprnt.test.ts
import { extractToken, handleCloudPrnt, isSuccessCode, sha256Hex, type CloudPrntStore, type CpJob, type CpPrinter } from './cloudprnt.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
}

const TOKEN = 'geheim-printer-token-0123456789';
const JOB1 = '11111111-1111-4111-8111-111111111111';
const JOB2 = '22222222-2222-4222-8222-222222222222';

async function setup() {
  const printer: CpPrinter = { id: 'p1', tenant_id: 't1', protocol: 'star_cloudprnt', is_active: true };
  const hash = await sha256Hex(TOKEN);
  const jobs: (CpJob & { attempts: number; error: string | null })[] = [
    { id: JOB1, printer_id: 'p1', status: 'queued', payload_text: '      BAR\n2 x  Dry Martini\n', payload_escpos: null, attempts: 0, error: null },
    { id: JOB2, printer_id: 'p1', status: 'queued', payload_text: 'tweede', payload_escpos: null, attempts: 0, error: null },
  ];
  const touched: unknown[] = [];
  const store: CloudPrntStore = {
    printerByTokenHash: async (h) => (h === hash ? printer : null),
    touchPrinter: async (_id, info) => { touched.push(info); },
    nextJob: async (pid) => jobs.find((j) => j.printer_id === pid && (j.status === 'queued' || j.status === 'printing')) ?? null,
    jobById: async (pid, id) => jobs.find((j) => j.printer_id === pid && j.id === id) ?? null,
    markPrinting: async (j) => { const x = jobs.find((y) => y.id === j.id)!; if (x.status !== 'queued') throw new Error('guard'); x.status = 'printing'; x.attempts++; j.status = 'printing'; },
    markDone: async (j, ok, err) => { const x = jobs.find((y) => y.id === j.id)!; if (x.status !== 'printing') throw new Error('guard'); x.status = ok ? 'printed' : 'failed'; x.error = err; },
  };
  return { printer, jobs, touched, store };
}

const BASE = 'https://x.supabase.co/functions/v1/cloudprnt';
const basic = (pw: string) => ({ authorization: `Basic ${btoa(`star:${pw}`)}` });

Deno.test('health: versiestempel zonder token en zonder neveneffect', async () => {
  const { store, touched } = await setup();
  const r = await handleCloudPrnt(new Request(`${BASE}?health`), store);
  eq(r.status, 200);
  eq(await r.json(), { version: 'PRINT-1' });
  eq(touched.length, 0);
});

Deno.test('zonder of met fout token: 401 met Basic-uitdaging', async () => {
  const { store } = await setup();
  const a = await handleCloudPrnt(new Request(BASE, { method: 'POST', body: '{}' }), store);
  eq(a.status, 401);
  eq(a.headers.get('www-authenticate')?.startsWith('Basic'), true);
  const b = await handleCloudPrnt(new Request(BASE, { method: 'POST', body: '{}', headers: basic('fout-token-xxxxxxxxxxxx') }), store);
  eq(b.status, 401);
});

Deno.test('token via Basic, Bearer of ?key=', () => {
  eq(extractToken(new Request(BASE, { headers: basic(TOKEN) })), TOKEN);
  eq(extractToken(new Request(BASE, { headers: { authorization: `Bearer ${TOKEN}` } })), TOKEN);
  eq(extractToken(new Request(`${BASE}?key=${TOKEN}`)), TOKEN);
  eq(extractToken(new Request(`${BASE}?key=kort`)), null);
});

Deno.test('volledige cyclus: POST -> GET text/plain -> DELETE 200 OK -> volgende job', async () => {
  const { store, jobs, touched } = await setup();
  const poll = await handleCloudPrnt(new Request(BASE, { method: 'POST', headers: basic(TOKEN), body: JSON.stringify({ statusCode: '200%20OK', printerMAC: '00:11:62:aa:bb:cc', printingInProgress: false }) }), store);
  eq(await poll.json(), { jobReady: true, mediaTypes: ['text/plain'], jobToken: JOB1 });
  eq(touched, [{ mac: '00:11:62:aa:bb:cc', status: '200 OK' }]);

  const get = await handleCloudPrnt(new Request(`${BASE}?mac=00:11:62:aa:bb:cc&type=text/plain&token=${JOB1}`, { headers: basic(TOKEN) }), store);
  eq(get.status, 200);
  eq(get.headers.get('content-type'), 'text/plain; charset=utf-8');
  eq(await get.text(), jobs[0].payload_text);
  eq(jobs[0].status, 'printing');
  eq(jobs[0].attempts, 1);

  // Een tweede GET van dezelfde job (netwerkfout) levert dezelfde data, zonder extra poging.
  const again = await handleCloudPrnt(new Request(`${BASE}?type=text/plain&token=${JOB1}`, { headers: basic(TOKEN) }), store);
  eq(again.status, 200);
  eq(jobs[0].attempts, 1);

  const del = await handleCloudPrnt(new Request(`${BASE}?mac=x&code=200%20OK&token=${JOB1}`, { method: 'DELETE', headers: basic(TOKEN) }), store);
  eq(del.status, 200);
  eq(jobs[0].status, 'printed');

  // Een herhaalde DELETE (retry=2) verandert niets meer.
  const del2 = await handleCloudPrnt(new Request(`${BASE}?code=200%20OK&token=${JOB1}&retry=2`, { method: 'DELETE', headers: basic(TOKEN) }), store);
  eq(del2.status, 200);
  eq(jobs[0].status, 'printed');

  const poll2 = await handleCloudPrnt(new Request(BASE, { method: 'POST', headers: basic(TOKEN), body: JSON.stringify({ statusCode: '200 OK' }) }), store);
  eq((await poll2.json()).jobToken, JOB2);
});

Deno.test('foutcode bij bevestiging: job failed met de code, GET-variant met delete', async () => {
  const { store, jobs } = await setup();
  await handleCloudPrnt(new Request(`${BASE}?type=text/plain&token=${JOB1}`, { headers: basic(TOKEN) }), store);
  const r = await handleCloudPrnt(new Request(`${BASE}?delete&code=511%20Media%20Decoding%20Error&token=${JOB1}`, { headers: basic(TOKEN) }), store);
  eq(r.status, 200);
  eq(jobs[0].status, 'failed');
  eq(jobs[0].error, '511 Media Decoding Error');
});

Deno.test('GET: onbekend mediatype 415, onbekende job 404, andere methode 405', async () => {
  const { store } = await setup();
  eq((await handleCloudPrnt(new Request(`${BASE}?type=image/png&token=${JOB1}`, { headers: basic(TOKEN) }), store)).status, 415);
  eq((await handleCloudPrnt(new Request(`${BASE}?type=text/plain&token=33333333-3333-4333-8333-333333333333`, { headers: basic(TOKEN) }), store)).status, 404);
  eq((await handleCloudPrnt(new Request(`${BASE}?type=text/plain&token=geen-uuid`, { headers: basic(TOKEN) }), store)).status, 404);
  eq((await handleCloudPrnt(new Request(BASE, { method: 'PUT', headers: basic(TOKEN) }), store)).status, 405);
});

Deno.test('bevestiging zonder token geldt voor de job die aan het printen is', async () => {
  const { store, jobs } = await setup();
  await handleCloudPrnt(new Request(`${BASE}?type=text/plain`, { headers: basic(TOKEN) }), store);
  eq(jobs[0].status, 'printing');
  await handleCloudPrnt(new Request(`${BASE}?code=200%20OK`, { method: 'DELETE', headers: basic(TOKEN) }), store);
  eq(jobs[0].status, 'printed');
  eq(jobs[1].status, 'queued');
});

Deno.test('uitgezette printer of ander protocol: 401', async () => {
  const { store, printer } = await setup();
  printer.is_active = false;
  eq((await handleCloudPrnt(new Request(BASE, { method: 'POST', headers: basic(TOKEN), body: '{}' }), store)).status, 401);
  printer.is_active = true;
  printer.protocol = 'escpos_lan';
  eq((await handleCloudPrnt(new Request(BASE, { method: 'POST', headers: basic(TOKEN), body: '{}' }), store)).status, 401);
});

Deno.test('isSuccessCode', () => {
  eq(['200 OK', '200%20OK', 'OK', '211%20Something'].map(isSuccessCode), [true, true, true, true]);
  eq(['520', '511 Media Decoding Error', '', null].map((c) => isSuccessCode(c as string | null)), [false, false, false, false]);
});

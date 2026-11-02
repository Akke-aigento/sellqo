/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// KASSA-ACCOUNT-1 — de ECHTE handlers van kassa-device-pair en kassa-device-revoke, plus de toestel-toegang in
// horeca-receipt-mail en send-order-ready (via _shared/kassaDeviceAuth.ts), op de StatefulDb.
// De rate limit, eenmaligheid en verloop van de koppelcode zelf zitten in SQL (kassa_pair_claim) en worden
// getest in scripts/gks/sql/test_kassa_account.sql; hier nagebootst met dezelfde regels.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/kassaDevicePair.test.ts
import { StatefulDb } from './statefulDb.ts';

const T = '22222222-2222-2222-2222-222222222222';
const OTHER = '11111111-1111-1111-1111-111111111111';
const TERM = '5e000000-0000-0000-0000-0000000000b1';
const DEV = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
const OWNER = 'aaaaaaaa-0000-0000-0000-000000000002';
const STAFF_OTHER = 'aaaaaaaa-0000-0000-0000-000000000009';

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };

const db = new StatefulDb({
  user_roles: [
    { user_id: OWNER, role: 'tenant_admin', tenant_id: T },
    { user_id: STAFF_OTHER, role: 'staff', tenant_id: OTHER },
  ],
  kassa_device_accounts: [],
  device_tokens: [],
  internal_config: [],
  horeca_pay_settings: [{ tenant_id: T, mail_button: false }],
  orders: [{ id: 'o1', tenant_id: T, order_number: 'B-1', service_type: 'pickup' }],
  kitchen_tickets: [],
});

// Koppelcodes zoals kassa_pair_claim: 6 cijfers of 64 hex (token), eenmalig, 5 fouten per IP; boven 300 fouten
// platformbreed worden de open 6-cijfercodes ongeldig (token blijft), nooit iemand geweigerd; een al actief
// gekoppeld toestel-ID = device_already_paired zonder de code te verbruiken.
const codes: { id: string; secret: string; token: string; used: boolean; tenant_id: string; terminal_id: string; codeDead?: boolean }[] = [];
const fails: Record<string, number> = {};
let totalFails = 0;
let claims = 0;
const ipSeen: string[] = [];
db.rpcs.kassa_pair_claim = ({ p_secret, p_ip, p_device_uuid }) => {
  claims += 1;
  ipSeen.push(p_ip);
  if ((fails[p_ip] ?? 0) >= 5) return { data: { ok: false, reason: 'rate_limited' }, error: null };
  const c = codes.find((x) => !x.used && ((x.secret === p_secret && !x.codeDead) || x.token === p_secret));
  if (!c) {
    fails[p_ip] = (fails[p_ip] ?? 0) + 1; totalFails += 1;
    if (totalFails >= 300) for (const x of codes) if (!x.used) x.codeDead = true;
    return { data: { ok: false, reason: 'invalid' }, error: null };
  }
  if (db.tables.kassa_device_accounts.some((a) => a.device_uuid === p_device_uuid && !a.revoked_at)) return { data: { ok: false, reason: 'device_already_paired' }, error: null };
  c.used = true;
  return { data: { ok: true, code_id: c.id, tenant_id: c.tenant_id, terminal_id: c.terminal_id, terminal_name: 'Toog', name: 'Toog iPad' }, error: null };
};
let completeFails = false;
let completeRace = false;
db.rpcs.kassa_pair_complete = ({ p_code_id, p_user_id, p_device_uuid, p_name }, d) => {
  if (completeFails) return { data: null, error: { message: 'koppelcode niet (meer) geldig' } };
  if (completeRace) return { data: null, error: { code: 'KA409', message: 'device_already_paired' } };
  const c = codes.find((x) => x.id === p_code_id)!;
  d.tables.kassa_device_accounts.push({ user_id: p_user_id, tenant_id: c.tenant_id, terminal_id: c.terminal_id, device_uuid: p_device_uuid, name: p_name ?? 'Toog iPad', revoked_at: null });
  return { data: { ok: true }, error: null };
};
const released: string[] = [];
db.rpcs.kassa_pair_release = ({ p_code_id }) => { released.push(p_code_id); const c = codes.find((x) => x.id === p_code_id); if (c) c.used = false; return { data: null, error: null }; };
db.rpcs.horeca_receipt_data = () => ({ data: { tenant_id: T, fiscal: false, status: 'paid' }, error: null });

// Auth: tokens → users; admin-API logt wat er gebeurt.
const tokens: Record<string, { id: string; email: string }> = { 'tok-owner': { id: OWNER, email: 'els@b.test' }, 'tok-staff-other': { id: STAFF_OTHER, email: 's@a.test' } };
const created: any[] = [];
const deleted: string[] = [];
const banned: { id: string; ban: string }[] = [];
let createFails = false;
(db as any).auth = {
  getUser: (t: string) => Promise.resolve(tokens[t] ? { data: { user: tokens[t] }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } }),
  admin: {
    createUser: (p: any) => {
      if (createFails) return Promise.resolve({ data: { user: null }, error: { message: 'boom' } });
      const user = { id: crypto.randomUUID(), email: p.email };
      created.push({ ...p, id: user.id });
      return Promise.resolve({ data: { user }, error: null });
    },
    deleteUser: (id: string) => { deleted.push(id); return Promise.resolve({ data: null, error: null }); },
    updateUserById: (id: string, p: any) => { banned.push({ id, ban: p.ban_duration }); return Promise.resolve({ data: null, error: null }); },
  },
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
type H = (r: Request) => Promise<Response>;
await import('../../supabase/functions/kassa-device-pair/index.ts');
const pair = (globalThis as any).__serveHandler as H;
await import('../../supabase/functions/kassa-device-revoke/index.ts');
const revoke = (globalThis as any).__serveHandler as H;
await import('../../supabase/functions/horeca-receipt-mail/index.ts');
const receipt = (globalThis as any).__serveHandler as H;
await import('../../supabase/functions/send-order-ready/index.ts');
const orderReady = (globalThis as any).__serveHandler as H;

const call = async (h: H, body: unknown, headers: Record<string, string> = {}) => {
  const r = await h(new Request('https://f/x', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json() };
};
const newCode = (secret: string, tenant = T) => {
  const id = crypto.randomUUID();
  const token = /^[0-9a-f]{64}$/.test(secret) ? secret : crypto.randomUUID().replace(/-/g, '').repeat(2);
  codes.push({ id, secret, token, used: false, tenant_id: tenant, terminal_id: TERM });
  return id;
};

Deno.test('GET geeft de versiestempel (alle vier de functies)', async () => {
  for (const h of [pair, revoke, receipt, orderReady]) {
    const j = await (await h(new Request('https://f/x'))).json();
    assert(j.version === 'KASSA-ACCOUNT-1', JSON.stringify(j));
  }
});

Deno.test('koppelen: ongeldige invoer = 400 zonder iets op te zoeken', async () => {
  const n = claims;
  assert((await call(pair, { code: '12345', device_uuid: DEV })).status === 400, 'code te kort');
  assert((await call(pair, { code: '123456', device_uuid: 'geen-uuid' })).status === 400, 'device_uuid');
  assert((await call(pair, { code: '123456' })).status === 400, 'geen device_uuid');
  assert(claims === n && created.length === 0, 'er mocht niets gebeuren');
});

Deno.test('koppelen met een geldige code: toestel-user zonder mailbox, eenmalig wachtwoord, koppelrij', async () => {
  newCode('482913');
  const r = await call(pair, { code: '482 913', device_uuid: DEV.toUpperCase(), device_name: '' }, { 'cf-connecting-ip': '10.0.0.2' });
  assert(r.status === 200 && r.json.ok, JSON.stringify(r));
  assert(/^kassa-[0-9a-f-]{36}@toestel\.sellqo\.app$/.test(r.json.email), r.json.email);
  assert(typeof r.json.password === 'string' && r.json.password.length >= 40, 'wachtwoord te kort');
  assert(r.json.tenant_id === T && r.json.terminal_id === TERM, 'zaak/kassa');
  const u = created.at(-1);
  assert(u.email_confirm === true && u.app_metadata.kind === 'kassa' && u.app_metadata.tenant_id === T, JSON.stringify(u));
  assert(!('role' in u) && !JSON.stringify(u).includes('tenant_admin'), 'toestel mag geen rol krijgen');
  const row = db.tables.kassa_device_accounts.find((x) => x.user_id === u.id);
  assert(row && row.device_uuid === DEV && row.tenant_id === T, JSON.stringify(row));
  assert(!db.tables.user_roles.some((x) => x.user_id === u.id), 'geen user_roles-rij');
  // Wachtwoord nergens in de databank.
  assert(!JSON.stringify(db.tables).includes(r.json.password), 'wachtwoord bewaard');
});

Deno.test('dezelfde code nog eens = 404; QR-token werkt ook', async () => {
  assert((await call(pair, { code: '482913', device_uuid: DEV }, { 'cf-connecting-ip': '10.0.0.3' })).status === 404, 'eenmalig');
  const token = 'ab'.repeat(32);
  newCode(token);
  const r = await call(pair, { code: token.toUpperCase(), device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002' }, { 'cf-connecting-ip': '10.0.0.3' });
  assert(r.status === 200, JSON.stringify(r));
});

Deno.test('review 1 (2): toestel-ID al actief gekoppeld = 409, geen overname, code blijft geldig; na ontkoppelen lukt het', async () => {
  const before = db.tables.kassa_device_accounts.find((x) => x.device_uuid === DEV && !x.revoked_at)!;
  newCode('100200');
  const n = created.length;
  const r = await call(pair, { code: '100200', device_uuid: DEV }, { 'cf-connecting-ip': '10.0.0.4' });
  assert(r.status === 409 && r.json.error === 'device_already_paired', JSON.stringify(r));
  assert(created.length === n, 'er mocht geen user aangemaakt worden');
  assert(!before.revoked_at && !banned.some((b) => b.id === before.user_id), 'bestaande koppeling mocht niet geraakt worden');
  assert(!codes.find((c) => c.secret === '100200')!.used, 'code mocht niet verbruikt worden');
  before.revoked_at = new Date().toISOString(); // beheer ontkoppelt
  const ok = await call(pair, { code: '100200', device_uuid: DEV }, { 'cf-connecting-ip': '10.0.0.4' });
  assert(ok.status === 200, JSON.stringify(ok));
});

Deno.test('review 1 (2): race — koppelrij weigert met KA409 → 409, user weer weg, code vrij', async () => {
  const id = newCode('100300');
  completeRace = true;
  const r = await call(pair, { code: '100300', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1' }, { 'cf-connecting-ip': '10.0.0.7' });
  completeRace = false;
  assert(r.status === 409 && r.json.error === 'device_already_paired', JSON.stringify(r));
  assert(deleted.includes(created.at(-1).id) && released.includes(id), 'opruimen');
});

Deno.test('review 1 (3): veel fouten over veel IPs: niemand geweigerd (geen 429), open 6-cijfercodes ongeldig, QR-token werkt', async () => {
  newCode('555666');
  const token = codes.at(-1)!.token;
  for (let i = 0; totalFails < 300; i++) await call(pair, { code: String(200000 + i), device_uuid: DEV }, { 'cf-connecting-ip': `172.16.${Math.floor(i / 4)}.${i % 4}` });
  const r = await call(pair, { code: '555666', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000d1' }, { 'cf-connecting-ip': '192.168.9.9' });
  assert(r.status === 404, `juiste code van een vers IP: ongeldig gemaakt, niet geweigerd (${JSON.stringify(r)})`);
  const q = await call(pair, { code: token, device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000d1' }, { 'cf-connecting-ip': '192.168.9.9' });
  assert(q.status === 200, JSON.stringify(q));
});

Deno.test('review 1 (4): client-IP = cf-connecting-ip, dan x-real-ip, dan het LAATSTE x-forwarded-for', async () => {
  newCode('900100'); newCode('900200'); newCode('900300');
  ipSeen.length = 0;
  await call(pair, { code: '900100', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1' }, { 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' });
  await call(pair, { code: '900200', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e2' }, { 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' });
  await call(pair, { code: '900300', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e3' }, { 'x-forwarded-for': 'vervalst, 6.6.6.6, 4.4.4.4' });
  assert(JSON.stringify(ipSeen) === JSON.stringify(['1.1.1.1', '2.2.2.2', '4.4.4.4']), JSON.stringify(ipSeen));
});

Deno.test('raden: na 5 fouten van hetzelfde IP = 429, ook met de juiste code (ook een vervalst eerste x-forwarded-for helpt niet)', async () => {
  newCode('777777');
  for (let i = 0; i < 5; i++) assert((await call(pair, { code: String(100000 + i), device_uuid: DEV }, { 'x-forwarded-for': `9.9.9.${i}, 10.0.0.1` })).status === 404, `fout ${i}`);
  const r = await call(pair, { code: '777777', device_uuid: DEV }, { 'x-forwarded-for': '6.6.6.6, 10.0.0.1' });
  assert(r.status === 429 && r.json.error === 'rate_limited', JSON.stringify(r));
  assert(!codes.find((c) => c.secret === '777777')!.used, 'rate limit mocht de code niet verbruiken');
});

Deno.test('aanmaken user mislukt: code komt vrij, geen koppelrij; koppelrij mislukt: user weer weg', async () => {
  const id1 = newCode('300300');
  createFails = true;
  const n = db.tables.kassa_device_accounts.length;
  const r1 = await call(pair, { code: '300300', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000f1' }, { 'cf-connecting-ip': '10.0.0.5' });
  createFails = false;
  assert(r1.status === 500 && released.includes(id1) && db.tables.kassa_device_accounts.length === n, JSON.stringify(r1));
  assert(!JSON.stringify(r1.json).includes('boom'), 'geen interne fouttekst naar het toestel');
  const id2 = newCode('400400');
  completeFails = true;
  const r2 = await call(pair, { code: '400400', device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000f2' }, { 'cf-connecting-ip': '10.0.0.5' });
  completeFails = false;
  assert(r2.status === 500 && released.includes(id2) && deleted.includes(created.at(-1).id), JSON.stringify(r2));
});

Deno.test('ontkoppelen: zonder sessie 401, ander winkel 403, eigenaar ok (intrekken + tokens weg + ban), idempotent', async () => {
  const dev = db.tables.kassa_device_accounts.find((x) => x.device_uuid === DEV && !x.revoked_at)!;
  db.tables.device_tokens.push({ id: 'dt1', user_id: dev.user_id, token: 'push' });
  assert((await call(revoke, { user_id: dev.user_id })).status === 401, 'zonder sessie');
  assert((await call(revoke, { user_id: dev.user_id }, { Authorization: 'Bearer tok-staff-other' })).status === 403, 'andere winkel');
  assert((await call(revoke, { user_id: 'x' }, { Authorization: 'Bearer tok-owner' })).status === 400, 'ongeldig id');
  assert((await call(revoke, { user_id: crypto.randomUUID() }, { Authorization: 'Bearer tok-owner' })).status === 404, 'onbekend toestel');
  // Een toestel mag zichzelf (of een ander toestel) niet via deze functie ontkoppelen: het heeft geen tenant_admin.
  tokens['tok-dev'] = { id: dev.user_id, email: 'kassa@toestel.sellqo.app' };
  assert((await call(revoke, { user_id: dev.user_id }, { Authorization: 'Bearer tok-dev' })).status === 403, 'toestel als beheerder');
  const r = await call(revoke, { user_id: dev.user_id }, { Authorization: 'Bearer tok-owner' });
  assert(r.status === 200 && r.json.revoked && r.json.banned, JSON.stringify(r));
  assert(dev.revoked_at && dev.revoked_by === OWNER, 'revoked_at/by');
  assert(!db.tables.device_tokens.some((x) => x.user_id === dev.user_id), 'pushtokens');
  assert(banned.some((b) => b.id === dev.user_id), 'ban');
  const again = await call(revoke, { user_id: dev.user_id }, { Authorization: 'Bearer tok-owner' });
  assert(again.status === 200, JSON.stringify(again));
});

Deno.test('kassaDeviceAuth: een gekoppeld toestel mag "Mail bon" en "klant melden" voor zijn eigen zaak, niet voor een andere', async () => {
  const id = crypto.randomUUID();
  db.tables.kassa_device_accounts.push({ user_id: id, tenant_id: T, terminal_id: TERM, device_uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa', revoked_at: null });
  tokens['tok-dev2'] = { id, email: 'kassa2@toestel.sellqo.app' };
  const pay = '8d8d0000-0000-4000-8000-000000000001';
  // Mail bon: voorbij de toegang, dan de instelling (uit) = 409.
  const m = await call(receipt, { source: 'kassa', payment_id: pay, email: 'gast@x.be' }, { Authorization: 'Bearer tok-dev2' });
  assert(m.status === 409 && m.json.error === 'mail_button_off', JSON.stringify(m));
  // Klant melden: voorbij de toegang, geen keukenbon = overgeslagen.
  const o = await call(orderReady, { order_id: 'o1' }, { Authorization: 'Bearer tok-dev2' });
  assert(o.status === 200 && o.json.skipped === true, JSON.stringify(o));
  // Andere zaak: 403.
  db.tables.orders.push({ id: 'o2', tenant_id: OTHER, service_type: 'pickup' });
  assert((await call(orderReady, { order_id: 'o2' }, { Authorization: 'Bearer tok-dev2' })).status === 403, 'andere zaak');
  // Ingetrokken: 403, ook met een nog geldig token.
  db.tables.kassa_device_accounts.find((x) => x.user_id === id)!.revoked_at = new Date().toISOString();
  assert((await call(orderReady, { order_id: 'o1' }, { Authorization: 'Bearer tok-dev2' })).status === 403, 'ingetrokken (order-ready)');
  assert((await call(receipt, { source: 'kassa', payment_id: pay, email: 'gast@x.be' }, { Authorization: 'Bearer tok-dev2' })).status === 403, 'ingetrokken (mail bon)');
  // Een lid van een andere winkel: 403 zoals voorheen; de eigenaar: voorbij de toegang.
  assert((await call(orderReady, { order_id: 'o1' }, { Authorization: 'Bearer tok-staff-other' })).status === 403, 'ander lid');
  const own = await call(orderReady, { order_id: 'o1' }, { Authorization: 'Bearer tok-owner' });
  assert(own.status === 200, JSON.stringify(own));
});

/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// MELDING-1 — de ECHTE horeca-device-push-handler tegen een nep-databank: enkel met het interne
// geheim, invoercontrole, niets doen zonder toestellen, en nooit crashen als web push of FCM
// niet geconfigureerd is. Teksten en tags: supabase/functions/_shared/horecaPush.test.ts.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/horecaDevicePush.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = '3d8cf072-6bec-41dd-b01b-fef166ac9742';
const S = '5e5e0000-0000-4000-8000-0000000000aa';
const db = new FakeDb({ internal_config: [{ key: 'internal_webhook_secret', value: 'geheim' }] });

let targets: any[] = [];
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fn, args });
  if (fn === 'horeca_notify_targets') return Promise.resolve({ data: targets, error: null });
  return Promise.resolve({ data: null, error: null });
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
await import('../../supabase/functions/horeca-device-push/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const post = async (body: unknown, secret: string | null = 'geheim') => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Internal-Secret'] = secret;
  const r = await handler(new Request('https://f/horeca-device-push', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json() };
};

Deno.test('GET geeft de versiestempel, zonder data', async () => {
  const r = await handler(new Request('https://f/horeca-device-push'));
  const j = await r.json();
  assert(j.ok === true && j.version === 'MELDING-1b', JSON.stringify(j));
});

Deno.test('zonder of met fout geheim → 401, geen databankvraag naar ontvangers', async () => {
  rpcCalls.length = 0;
  assert((await post({ tenant_id: T, event: 'qr_request' }, null)).status === 401, 'geen geheim');
  assert((await post({ tenant_id: T, event: 'qr_request' }, 'fout')).status === 401, 'fout geheim');
  assert(rpcCalls.length === 0, 'ontvangers mochten niet opgevraagd worden');
});

Deno.test('onbekend event of ongeldige winkel → 400', async () => {
  assert((await post({ tenant_id: T, event: 'iets' })).status === 400, 'event');
  assert((await post({ tenant_id: 'x', event: 'qr_request' })).status === 400, 'tenant');
});

Deno.test('geen toestellen → overgeslagen; post wordt doorgegeven, ongeldige post genegeerd', async () => {
  rpcCalls.length = 0;
  targets = [];
  const r = await post({ tenant_id: T, event: 'ticket_new', station_id: S, ctx: { station: 'Keuken', count: 2 } });
  assert(r.status === 200 && r.json.skipped === true, JSON.stringify(r.json));
  assert(rpcCalls[0]?.fn === 'horeca_notify_targets' && rpcCalls[0].args.p_station_id === S && rpcCalls[0].args.p_event === 'ticket_new', JSON.stringify(rpcCalls));
  rpcCalls.length = 0;
  await post({ tenant_id: T, event: 'ticket_new', station_id: 'geen-uuid' });
  assert(rpcCalls[0]?.args.p_station_id === null, JSON.stringify(rpcCalls));
});

Deno.test('web push zonder sleutel en FCM zonder configuratie: tellen als mislukt, geen crash; dubbele tokens één keer', async () => {
  targets = [
    { install_id: 'kassa-1234', lang: 'nl', token: 'https://push.example/a', platform: 'web', p256dh: null, auth: null },
    { install_id: 'kassa-1234', lang: 'nl', token: 'https://push.example/a', platform: 'web', p256dh: null, auth: null },
    { install_id: 'gsm-12345', lang: 'fr', token: 'fcm-token-1', platform: 'android', p256dh: null, auth: null },
  ];
  const r = await post({ tenant_id: T, event: 'paid_online', ctx: { table: 'S1', amount_cents: 1250 } });
  assert(r.status === 200, JSON.stringify(r.json));
  assert(r.json.web_failed === 1 && r.json.web_sent === 0 && r.json.failed === 1 && r.json.sent === 0, JSON.stringify(r.json));
});

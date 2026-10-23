#!/usr/bin/env node
// LIVE-1 — stresstest van de tafelkassa tegen een lokale PostgreSQL (ontwerp §8, poort 1).
//
// Simuleert D toestellen die tegelijk op T tafels werken, zoals de kassa-app het doet:
// commando's gebundeld per ~300 ms in één horeca_apply-aanroep, rondes versturen, annuleren,
// korting, apart afrekenen en afrekenen (horeca_pay). Een deel van de aanroepen wordt
// bewust twee keer verstuurd (antwoord "verloren") om de idempotentie te bewijzen.
//
// Daarna controleert het script de invarianten met SQL:
//   - elke geaccepteerde add_line staat er precies één keer (0 verloren, 0 dubbel);
//   - elke betaalde rekening: betaling = som van de lijnen = pos_transaction.total;
//   - geen lijn met een negatief open aantal, één keukenbon per ronde en post;
//   - voorraad: per product afgeboekt = verkocht aantal op betaalde rekeningen.
// en meet de responstijd van horeca_apply (p50/p95/p99).
//
// Gebruik (PG16 op socket /tmp:54329):
//   DB=sellqo_stress SETUP_ONLY=1 PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/gks/sql/run.sh
//   PGHOST=/tmp PGPORT=54329 PGUSER=postgres node scripts/gks/stress/horeca-stress.mjs --db sellqo_stress --devices 3 --tables 25 --seconds 60
// Exit 1 bij een geschonden invariant.
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const DB = arg('db', 'sellqo_stress');
const DEVICES = Number(arg('devices', 3));
const TABLES = Number(arg('tables', 25));
const SECONDS = Number(arg('seconds', 30));
const DUP_RATE = Number(arg('dup', 0.05));

const sql = postgres({ host: process.env.PGHOST || '/tmp', port: Number(process.env.PGPORT || 54329), user: process.env.PGUSER || 'postgres', database: DB, max: DEVICES + 2, onnotice: () => {} });

const TENANT = '51000000-0000-0000-0000-000000000001';
const USER = '51000000-0000-0000-0000-0000000000aa';
const STAFF = '51000000-0000-0000-0000-0000000000bb';
const TERMINAL = '51000000-0000-0000-0000-0000000000cc';
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (xs) => xs[rnd(xs.length)];

async function setup() {
  await sql.begin(async (tx) => {
    await tx`insert into public.tenants (id, name, business_modules) values (${TENANT}, 'Stress', '{horeca}') on conflict do nothing`;
    await tx`insert into public.user_roles (user_id, role, tenant_id) values (${USER}, 'staff', ${TENANT})`;
    await tx`insert into public.pos_cashiers (id, tenant_id, display_name, pin_hash) values (${STAFF}, ${TENANT}, 'Stress', 'x') on conflict do nothing`;
    await tx`insert into public.pos_terminals (id, tenant_id, name, settings) values (${TERMINAL}, ${TENANT}, 'Toog', '{}') on conflict do nothing`;
    const v21 = randomUUID(); const v12 = randomUUID();
    await tx`insert into public.vat_rates (id, tenant_id, rate, is_default) values (${v21}, ${TENANT}, 21, true), (${v12}, ${TENANT}, 12, false)`;
    const cats = [randomUUID(), randomUUID()];
    await tx`insert into public.categories (id, tenant_id, name) values (${cats[0]}, ${TENANT}, 'Dranken'), (${cats[1]}, ${TENANT}, 'Keuken')`;
    for (let i = 0; i < 20; i++) {
      await tx`insert into public.products (id, tenant_id, name, price, category_id, vat_rate_id, track_inventory)
        values (${randomUUID()}, ${TENANT}, ${'Product ' + i}, ${(2 + rnd(2800) / 100).toFixed(2)}, ${cats[i % 2]}, ${i % 2 ? v12 : v21}, true)`;
    }
    for (let i = 1; i <= TABLES; i++) await tx`insert into public.dining_tables (id, tenant_id, label) values (${randomUUID()}, ${TENANT}, ${'T' + i})`;
    await tx`insert into public.prep_stations (tenant_id, name, kind, is_default) values (${TENANT}, 'Keuken', 'kitchen', true)`;
  });
  const products = (await sql`select id from public.products where tenant_id = ${TENANT}`).map((r) => r.id);
  const tables = (await sql`select id from public.dining_tables where tenant_id = ${TENANT}`).map((r) => r.id);
  return { products, tables };
}

/** Eén aanroep als ingelogde medewerker, zoals PostgREST het doet. */
async function asStaff(fn) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${USER}, true), set_config('role', 'authenticated', true)`;
    return fn(tx);
  });
}

const latencies = [];
const stats = { calls: 0, dupCalls: 0, commands: 0, rejected: 0, pays: 0, payRejected: 0, rejections: {} };
const acceptedAdds = new Set();

async function apply(device, cmds) {
  const t0 = performance.now();
  const res = await asStaff((tx) => tx`select public.horeca_apply(${TENANT}, ${device}, ${sql.json(cmds)}) as r`);
  latencies.push(performance.now() - t0);
  stats.calls += 1;
  stats.commands += cmds.length;
  const r = res[0].r;
  for (const x of r.results) {
    if (!x.ok) { stats.rejected += 1; stats.rejections[x.error] = (stats.rejections[x.error] ?? 0) + 1; }
  }
  // Antwoord "verloren": zelfde batch opnieuw. Mag niets dubbel doen.
  if (Math.random() < DUP_RATE) {
    stats.dupCalls += 1;
    await asStaff((tx) => tx`select public.horeca_apply(${TENANT}, ${device}, ${sql.json(cmds)}) as r`);
  }
  return r.results;
}

async function snapshot() {
  const r = await asStaff((tx) => tx`select public.horeca_snapshot(${TENANT}) as s`);
  return r[0].s.checks;
}

async function device(name, ctx, until) {
  while (Date.now() < until) {
    const checks = await snapshot();
    const byTable = new Map(checks.filter((c) => c.table_id && !c.split_of).map((c) => [c.table_id, c]));
    const table = pick(ctx.tables);
    let c = byTable.get(table);
    const cmds = [];
    if (!c) {
      const id = randomUUID();
      cmds.push({ id: randomUUID(), kind: 'open_check', check_id: id, table_id: table, staff_id: STAFF });
      c = { id, lines: [], table_id: table };
    }
    const action = rnd(10);
    if (action < 5 || !c.lines.length) {
      // 1-4 tikken op producten, gebundeld zoals de wachtrij doet
      for (let i = 0, k = 1 + rnd(4); i < k; i++) {
        const lineId = randomUUID();
        cmds.push({ id: randomUUID(), kind: 'add_line', check_id: c.id, line_id: lineId, product_id: pick(ctx.products), qty: 1 + rnd(3), staff_id: STAFF });
      }
    } else if (action < 7) {
      if (c.lines.some((l) => l.state === 'draft')) cmds.push({ id: randomUUID(), kind: 'send_round', check_id: c.id, round_id: randomUUID(), staff_id: STAFF });
    } else if (action < 8) {
      const l = c.lines.find((x) => x.state === 'sent' && x.open_qty > 0);
      if (l) cmds.push({ id: randomUUID(), kind: 'void_line', check_id: c.id, line_id: l.id, new_line_id: randomUUID(), qty: 1, reason: 'mistake', staff_id: STAFF });
    } else if (action < 9) {
      const l = c.lines.find((x) => x.state === 'sent' && x.open_qty > 0);
      if (l) cmds.push({ id: randomUUID(), kind: 'move_lines', split: true, check_id: c.id, to_check_id: randomUUID(), staff_id: STAFF,
        moves: [{ line_id: l.id, qty: 1, from_line_id: randomUUID(), to_line_id: randomUUID() }] });
    }
    if (cmds.length) {
      const results = await apply(name, cmds);
      for (const x of results) {
        const cmd = cmds.find((k) => k.id === x.id);
        if (x.ok && cmd?.kind === 'add_line') acceptedAdds.add(cmd.line_id);
      }
    }
    // Af en toe een rekening afrekenen (alles verstuurd, contant of kaart).
    if (rnd(6) === 0) {
      const all = await snapshot();
      const payable = all.filter((x) => x.lines.some((l) => l.state === 'sent') && !x.lines.some((l) => l.state === 'draft'));
      const p = payable.length ? pick(payable) : null;
      if (p) {
        const sent = p.lines.filter((l) => l.state === 'sent');
        const total = sent.reduce((s, l) => s + l.qty * (l.unit_price_cents + l.addons.reduce((a, x) => a + x.price_cents, 0)) + l.price_changes.reduce((a, x) => a + x.amount_cents, 0), 0);
        if (total > 0) {
          const cash = rnd(2) === 0;
          const r5 = (c5) => (Math.abs(c5) < 5 ? c5 : (c5 % 5 <= 2 ? c5 - (c5 % 5) : c5 - (c5 % 5) + 5));
          const payload = { id: randomUUID(), check_id: p.id, terminal_id: TERMINAL, staff_id: STAFF, expected_total_cents: total,
            line_ids: sent.map((l) => l.id), tenders: [{ method: cash ? 'cash' : 'card', amount_cents: total }], rounding_cents: cash ? r5(total) - total : 0 };
          try {
            // Zoals de app: eerst de claim, dan (tekenen en) boeken.
            await asStaff((tx) => tx`select public.horeca_pay_begin(${TENANT}, ${name}, ${sql.json({ check_id: p.id, payment_id: payload.id, line_ids: payload.line_ids, expected_total_cents: total })})`);
            await asStaff((tx) => tx`select public.horeca_pay(${TENANT}, ${name}, ${sql.json(payload)})`);
            stats.pays += 1;
            if (Math.random() < DUP_RATE) await asStaff((tx) => tx`select public.horeca_pay(${TENANT}, ${name}, ${sql.json(payload)})`);
          } catch (e) {
            stats.payRejected += 1;
            stats.rejections['pay: ' + e.message] = (stats.rejections['pay: ' + e.message] ?? 0) + 1;
          }
        }
      }
    }
    await new Promise((r) => setTimeout(r, 50 + rnd(250)));
  }
}

function pct(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
}

async function invariants() {
  const fails = [];
  const check = async (label, rows) => { if (rows.length) fails.push(`${label}: ${JSON.stringify(rows.slice(0, 3))}`); };
  // 1. Elke geaccepteerde add_line precies één keer (lijn-id is het commando).
  const ids = [...acceptedAdds];
  const found = ids.length ? await sql`select id from public.check_lines where id = any(${ids})` : [];
  if (found.length !== ids.length) fails.push(`verloren lijnen: ${ids.length - found.length}`);
  await check('dubbele commando-toepassing', await sql`select id, count(*) from public.horeca_commands group by id having count(*) > 1`);
  // 2. Betaalde rekeningen: betaling = som lijnen = transactie.
  await check('betaling ≠ lijnen', await sql`
    select p.check_id, p.total_cents, (select sum(public.horeca_line_total(l)) from public.check_lines l where l.check_id = p.check_id and l.state = 'sent') as lines
    from public.check_payments p where p.tenant_id = ${TENANT}
      and p.total_cents <> (select coalesce(sum(public.horeca_line_total(l)), 0) from public.check_lines l where l.check_id = p.check_id and l.state = 'sent')`);
  await check('transactie ≠ betaling', await sql`
    select p.id from public.check_payments p join public.pos_transactions t on t.id = p.pos_transaction_id
    where p.tenant_id = ${TENANT} and round(t.total * 100) <> p.total_cents`);
  await check('betaalde rekening niet gesloten', await sql`select p.check_id from public.check_payments p join public.dining_checks c on c.id = p.check_id where c.status <> 'closed'`);
  await check('twee betalingen op één rekening', await sql`select check_id from public.check_payments group by check_id having count(*) > 1`);
  // 3. Lijnen: nooit negatief open; één keukenbon per ronde en post.
  await check('negatief open aantal', await sql`select id from public.check_lines where qty > 0 and state = 'sent' and public.horeca_open_qty(id) < 0`);
  await check('dubbele keukenbon', await sql`select round_id, station_id from public.kitchen_tickets where round_id is not null group by round_id, station_id having count(*) > 1`);
  await check('betaalde rekening nog geclaimd', await sql`select id from public.dining_checks where status = 'closed' and paying_until is not null`);
  await check('twee open hoofdrekeningen op één tafel', await sql`select table_id from public.dining_checks where status = 'open' and table_id is not null and split_of is null group by table_id having count(*) > 1`);
  // 4. Voorraad: per product afgeboekt = verkocht op betaalde rekeningen.
  await check('voorraad ≠ verkoop', await sql`
    with sold as (select l.product_id, sum(l.qty) q from public.check_lines l join public.check_payments p on p.check_id = l.check_id where l.state = 'sent' group by l.product_id having sum(l.qty) > 0),
         booked as (select product_id, sum(qty) q from public.test_stock_log group by product_id)
    select s.product_id, s.q, b.q from sold s full join booked b on b.product_id = s.product_id where coalesce(s.q, 0) <> coalesce(b.q, 0)`);
  return fails;
}

const ctx = await setup();
const until = Date.now() + SECONDS * 1000;
console.log(`stresstest: ${DEVICES} toestellen, ${TABLES} tafels, ${SECONDS} s, ${Math.round(DUP_RATE * 100)} % herhaalde aanroepen`);
await Promise.all(Array.from({ length: DEVICES }, (_, i) => device(`dev-${i + 1}`, ctx, until)));
const fails = await invariants();
const [counts] = await sql`select (select count(*) from public.check_lines) lines, (select count(*) from public.dining_checks) checks,
  (select count(*) from public.check_payments) payments, (select count(*) from public.kitchen_tickets where round_id is not null) tickets`;
console.log(JSON.stringify({ ...stats, acceptedAdds: acceptedAdds.size, ...counts,
  latency_ms: { p50: +pct(latencies, 50).toFixed(1), p95: +pct(latencies, 95).toFixed(1), p99: +pct(latencies, 99).toFixed(1), max: +Math.max(...latencies).toFixed(1) } }, null, 2));
await sql.end();
if (fails.length) { console.error('INVARIANTEN GESCHONDEN:\n' + fails.join('\n')); process.exit(1); }
console.log('alle invarianten gehouden');

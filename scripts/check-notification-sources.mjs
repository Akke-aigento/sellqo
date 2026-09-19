#!/usr/bin/env node
// NOTIF-SOURCES-1 — guard op de vorm van meldingsbronnen.
//
// Drie bronnen faalden maandenlang stil: stripe-connect-webhook riep
// send_notification met `p_data` (de parameter heet `p_metadata`), de twee
// AI-functies stuurden `tenantId`/`actionUrl` naar create-notification (die leest
// snake_case), en vijf bronnen gebruikten een categorie die niet in de enum staat
// (`inventory`, `returns`, `shipping`, `billing`). De fout bleef telkens in de
// functielogs. Dit script vangt die klasse in CI.
//
// Heuristiek, geen parser (stijl check-customer-messages-writes):
//   - .rpc('send_notification', { … })       → sleutels ⊆ SEND_NOTIFICATION_PARAMS
//   - functions.invoke('create-notification', { body: { … } }) en
//     fetch(`…/create-notification`, { body: JSON.stringify({ … }) })
//                                             → sleutels ⊆ CREATE_NOTIFICATION_KEYS
//                                               (dus ook geen camelCase)
//   - letterlijke `category` daarin, en in .from('notifications').insert(…)
//                                             → ∈ NOTIFICATION_CATEGORIES
//
// NOTIF-TYPES-1: elk verstuurd type moet als `categorie/type` in NOTIFICATION_CONFIG
// (src/types/notification.ts) staan — anders is het niet instelbaar en valt het terug
// op onduidelijke defaults. Gecontroleerd in code (letterlijk, ternary, template via
// DYNAMIC_TYPES, variabelen via VARIABLE_TYPE_SOURCES) én in de DB-functies: de laatste
// definitie per functie uit supabase/migrations, daarna docs/sql.
//
// Nieuwe parameter, sleutel, categorie of type? Werk de lijsten hieronder bij, samen met
// de DB. Draait in CI en lokaal met `npm run check:notifications`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Live signatuur (19-09-2026): send_notification(p_tenant_id uuid, p_category text,
// p_type text, p_title text, p_message text, p_priority text, p_action_url text,
// p_metadata jsonb).
export const SEND_NOTIFICATION_PARAMS = [
  'p_tenant_id', 'p_category', 'p_type', 'p_title', 'p_message', 'p_priority', 'p_action_url', 'p_metadata',
];

// Wat create-notification uit de body leest (interface NotificationRequest).
export const CREATE_NOTIFICATION_KEYS = [
  'tenant_id', 'category', 'type', 'title', 'message', 'data', 'priority', 'action_url',
  'user_id', 'notification_id', 'skip_in_app',
];

// enum notification_category, live 19-09-2026.
export const NOTIFICATION_CATEGORIES = [
  'orders', 'invoices', 'payments', 'customers', 'products', 'quotes', 'subscriptions',
  'marketing', 'team', 'system', 'ai_coach', 'messages', 'integrations',
];

// Template-types in code → alle waarden die ze kunnen aannemen.
export const DYNAMIC_TYPES = {
  // poll-tracking-status: newStatus ∈ STATUS_LABELS met een notify_on_*-vlag
  'tracking_${newStatus}': ['tracking_in_transit', 'tracking_out_for_delivery', 'tracking_delivered', 'tracking_exception'],
  // meta-messaging-webhook: platform ∈ facebook | instagram
  '${platform}_inbound': ['facebook_inbound', 'instagram_inbound'],
};

// Bronnen die het type in een variabele doorgeven; hun mogelijke waarden, met categorie.
export const VARIABLE_TYPE_SOURCES = {
  // Bulk-insert uit een array (n.type) en een type-variabele per factuurfase.
  'supabase/functions/check-scheduled-notifications/index.ts': [
    'invoices/invoice_overdue', 'invoices/invoice_overdue_7days', 'invoices/invoice_overdue_30days',
    'subscriptions/subscription_expiring', 'quotes/quote_expiring_soon', 'system/ai_credits_low',
  ],
  // Insert van een vooraf opgebouwde array.
  'src/components/admin/TenantBulkActions.tsx': ['system/admin_announcement'],
  'supabase/functions/_shared/payoutNotification.ts': [
    'payments/payout_available', 'payments/payout_completed', 'payments/payout_canceled', 'payments/stripe_account_issue',
  ],
};

const ROOTS = ['supabase/functions', 'src'];
const SKIP = new Set(['src/integrations/supabase/types.ts']);
const EXT = /\.(ts|tsx|js|jsx|mjs)$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(p);
    } else if (EXT.test(entry.name)) {
      yield p;
    }
  }
}

/** Index van het sluitende haakje bij `openIdx` (strings/templates overgeslagen), of -1. */
function closeOf(src, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Inhoud van het object-literal dat op `openIdx` (een `{`) begint. */
function objectBody(src, openIdx) {
  const end = closeOf(src, openIdx);
  return end === -1 ? null : src.slice(openIdx + 1, end);
}

/** Sleutels op het bovenste niveau van een object-body, incl. shorthand (`tenantId,`). */
export function topLevelKeys(body) {
  return topLevelEntries(body).map((e) => e.key);
}

/** Top-level `{ key, value }`-paren (value = bronexpressie, shorthand → de naam). */
export function topLevelEntries(body) {
  const keys = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  const entries = [];
  for (let i = 0; i <= body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if ((c === ',' && depth === 0) || i === body.length) {
      entries.push(body.slice(start, i));
      start = i + 1;
    }
  }
  for (const raw of entries) {
    const entry = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!entry || entry.startsWith('...')) continue;
    const kv = /^['"]?([A-Za-z_$][\w$]*)['"]?\s*:/.exec(entry);
    if (kv) { keys.push({ key: kv[1], value: entry.slice(kv[0].length).trim() }); continue; }
    const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(entry);
    if (shorthand) keys.push({ key: shorthand[1], value: shorthand[1] });
  }
  return keys;
}

/**
 * Mogelijke waarden van een `type`-expressie: letterlijk → [x]; ternary → alle
 * letterlijke takken; template → DYNAMIC_TYPES; variabele → null (niet te toetsen).
 */
export function typeValues(expr) {
  const e = expr.replace(/!$/, '').trim();
  const lit = /^(['"])([^'"]+)\1$/.exec(e);
  if (lit) return [lit[2]];
  const tpl = /^`([^`]*)`$/.exec(e);
  if (tpl) return tpl[1].includes('${') ? (DYNAMIC_TYPES[tpl[1]] ?? [`<dynamisch ${tpl[1]}>`]) : [tpl[1]];
  if (e.includes('?')) return [...e.matchAll(/[?:]\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  return null;
}

/** De geregistreerde `categorie/type`-paren uit NOTIFICATION_CONFIG. */
export function registeredTypes(configSrc) {
  const out = new Set();
  const cfg = configSrc.slice(configSrc.indexOf('NOTIFICATION_CONFIG'));
  let cat = null;
  for (const line of cfg.split('\n')) {
    const c = /^\s*category:\s*'([a-z_]+)',/.exec(line);
    if (c) cat = c[1];
    const t = /\{\s*type:\s*'([a-z0-9_]+)'/.exec(line);
    if (t && cat) out.add(`${cat}/${t[1]}`);
  }
  return out;
}

function checkPair(out, where, category, type, registered) {
  if (!registered || !type) return;
  if (category) {
    if (!registered.has(`${category}/${type}`)) out.push(`${where}  type "${category}/${type}" staat niet in NOTIFICATION_CONFIG`);
  } else if (![...registered].some((p) => p.endsWith(`/${type}`))) {
    out.push(`${where}  type "${type}" staat niet in NOTIFICATION_CONFIG`);
  }
}

function checkEntries(out, where, entries, registered) {
  const cat = entries.find((e) => e.key === 'category' || e.key === 'p_category');
  const typ = entries.find((e) => e.key === 'type' || e.key === 'p_type');
  if (!typ) return;
  const catLit = cat ? /^(['"`])([a-z_]+)\1$/.exec(cat.value.replace(/\s+as\s+const$/, '')) : null;
  const values = typeValues(typ.value);
  if (!values) return;
  for (const v of values) checkPair(out, where, catLit ? catLit[2] : null, v, registered);
}

function categoryValues(body) {
  return [...body.matchAll(/\bcategory\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Alle overtredingen in één bestand. Exporteerbaar voor vitest. */
export function scanSource(src, rel = '<bron>', registered = null) {
  const out = [];

  // 1. .rpc('send_notification', { … })
  for (const m of src.matchAll(/\.rpc\(\s*['"`]send_notification['"`]\s*,\s*\{/g)) {
    const body = objectBody(src, m.index + m[0].length - 1);
    if (body === null) continue;
    const line = lineOf(src, m.index);
    for (const key of topLevelKeys(body)) {
      if (!SEND_NOTIFICATION_PARAMS.includes(key)) {
        out.push(`${rel}:${line}  send_notification: onbekende parameter "${key}" (signatuur: ${SEND_NOTIFICATION_PARAMS.join(', ')})`);
      }
    }
    for (const v of [...body.matchAll(/\bp_category\s*:\s*['"`]([^'"`]+)['"`]/g)].map((x) => x[1])) {
      if (!NOTIFICATION_CATEGORIES.includes(v)) out.push(`${rel}:${line}  send_notification: categorie "${v}" bestaat niet in de enum`);
    }
    checkEntries(out, `${rel}:${line}  send_notification:`, topLevelEntries(body), registered);
  }

  // 2. Bodies naar create-notification.
  const bodies = [];
  for (const m of src.matchAll(/functions\.invoke\(\s*['"`]create-notification['"`]\s*,\s*\{/g)) {
    const opts = objectBody(src, m.index + m[0].length - 1);
    if (opts === null) continue;
    const b = /\bbody\s*:\s*\{/.exec(opts);
    if (!b) continue; // body is een variabele of aanroep: niet te toetsen
    const optsStart = m.index + m[0].length;
    bodies.push({ at: m.index, body: objectBody(src, optsStart + b.index + b[0].length - 1) });
  }
  for (const m of src.matchAll(/fetch\([^)]*create-notification[^)]*?,\s*\{/g)) {
    const opts = objectBody(src, m.index + m[0].length - 1);
    if (opts === null) continue;
    const b = /\bbody\s*:\s*JSON\.stringify\(\s*\{/.exec(opts);
    if (!b) continue;
    const optsStart = m.index + m[0].length;
    bodies.push({ at: m.index, body: objectBody(src, optsStart + b.index + b[0].length - 1) });
  }
  for (const { at, body } of bodies) {
    if (body === null) continue;
    const line = lineOf(src, at);
    for (const key of topLevelKeys(body)) {
      if (!CREATE_NOTIFICATION_KEYS.includes(key)) {
        const hint = /[a-z][A-Z]/.test(key) ? ' — camelCase; create-notification leest snake_case' : '';
        out.push(`${rel}:${line}  create-notification: onbekende sleutel "${key}"${hint}`);
      }
    }
    for (const v of categoryValues(body)) {
      if (!NOTIFICATION_CATEGORIES.includes(v)) out.push(`${rel}:${line}  create-notification: categorie "${v}" bestaat niet in de enum`);
    }
    checkEntries(out, `${rel}:${line}  create-notification:`, topLevelEntries(body), registered);
  }

  // 3. Directe inserts in notifications.
  for (const m of src.matchAll(/\.from\(\s*['"`]notifications['"`]\s*\)\s*\.insert\(/g)) {
    const end = closeOf(src, m.index + m[0].length - 1);
    if (end === -1) continue;
    const arg = src.slice(m.index + m[0].length, end);
    const line = lineOf(src, m.index);
    for (const v of categoryValues(arg)) {
      if (!NOTIFICATION_CATEGORIES.includes(v)) out.push(`${rel}:${line}  notifications.insert: categorie "${v}" bestaat niet in de enum`);
    }
    // Eén object of een array van objecten.
    const trimmed = arg.trim();
    const objects = [];
    if (trimmed.startsWith('{')) objects.push(objectBody(trimmed, 0));
    else if (trimmed.startsWith('[')) {
      for (let i = 1; i < trimmed.length; i++) {
        if (trimmed[i] === '{') { const end = closeOf(trimmed, i); objects.push(trimmed.slice(i + 1, end)); i = end; }
      }
    }
    for (const body of objects) {
      if (body) checkEntries(out, `${rel}:${line}  notifications.insert:`, topLevelEntries(body), registered);
    }
  }

  return out;
}

/**
 * Types uit de DB-functies: per functienaam de laatste `CREATE OR REPLACE FUNCTION`
 * (migraties op bestandsnaam, daarna docs/sql). Patronen: send_notification(x, 'cat',
 * 'type', …) en `v_type := 'type'` met de categorie van de send_notification-aanroep
 * die v_type doorgeeft.
 */
export function sqlTypePairs(sqlFiles) {
  const defs = new Map();
  for (const { rel, src } of sqlFiles) {
    for (const m of src.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_]+)\s*\(/gi)) {
      // De body loopt van het openende dollar-tag ($$ of $function$) tot hetzelfde tag.
      const rest = src.slice(m.index);
      const open = /\bAS\s+(\$[a-z_]*\$)/i.exec(rest);
      if (!open) continue;
      const from = open.index + open[0].length;
      const to = rest.indexOf(open[1], from);
      defs.set(m[1], { rel, body: rest.slice(from, to === -1 ? undefined : to) });
    }
  }
  const pairs = [];
  for (const [name, { rel, body }] of defs) {
    if (name === 'send_notification') continue;
    const vtypeCats = new Set();
    for (const c of body.matchAll(/send_notification\(\s*[^,]+,\s*'([a-z_]+)'\s*,\s*([^,]+),/g)) {
      const typeArg = c[2].trim();
      const lit = /^'([a-z0-9_]+)'$/.exec(typeArg);
      if (lit) pairs.push({ where: `${rel} (${name})`, category: c[1], type: lit[1] });
      else if (typeArg === 'v_type') vtypeCats.add(c[1]);
    }
    const cat = vtypeCats.size === 1 ? [...vtypeCats][0] : null;
    for (const t of body.matchAll(/v_type\s*:=\s*'([a-z0-9_]+)'/g)) {
      pairs.push({ where: `${rel} (${name})`, category: cat, type: t[1] });
    }
  }
  return pairs;
}

function sqlFiles() {
  const list = [];
  for (const dir of ['supabase/migrations', 'docs/sql']) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      list.push({ rel: `${dir}/${f}`, src: fs.readFileSync(path.join(dir, f), 'utf8') });
    }
  }
  return list;
}

function main() {
  const violations = [];
  const registered = registeredTypes(fs.readFileSync('src/types/notification.ts', 'utf8'));
  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const rel = file.split(path.sep).join('/');
      // Tests bevatten bewust foute voorbeelden (fixtures).
      if (SKIP.has(rel) || /\.test\.[jt]sx?$/.test(rel)) continue;
      violations.push(...scanSource(fs.readFileSync(file, 'utf8'), rel, registered));
    }
  }
  for (const [rel, pairs] of Object.entries(VARIABLE_TYPE_SOURCES)) {
    for (const pair of pairs) {
      if (!registered.has(pair)) violations.push(`${rel}  type "${pair}" (VARIABLE_TYPE_SOURCES) staat niet in NOTIFICATION_CONFIG`);
    }
  }
  for (const { where, category, type } of sqlTypePairs(sqlFiles())) {
    checkPair(violations, where, category, type, registered);
  }
  if (violations.length > 0) {
    console.error(`\x1b[31m\x1b[1mcheck-notification-sources\x1b[0m — ${violations.length} probleem/problemen:\n`);
    for (const v of violations) console.error(`  ${v}`);
    console.error('\nZie scripts/check-notification-sources.mjs en docs/role-audit.md (NOTIF-SOURCES-1, NOTIF-TYPES-1).');
    process.exit(1);
  }
  console.log('check-notification-sources: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();

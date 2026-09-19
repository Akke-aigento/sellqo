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
// Nieuwe parameter, sleutel of categorie? Werk de lijsten hieronder bij, samen met
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
    if (kv) { keys.push(kv[1]); continue; }
    const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(entry);
    if (shorthand) keys.push(shorthand[1]);
  }
  return keys;
}

function categoryValues(body) {
  return [...body.matchAll(/\bcategory\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Alle overtredingen in één bestand. Exporteerbaar voor vitest. */
export function scanSource(src, rel = '<bron>') {
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
  }

  return out;
}

function main() {
  const violations = [];
  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const rel = file.split(path.sep).join('/');
      // Tests bevatten bewust foute voorbeelden (fixtures).
      if (SKIP.has(rel) || /\.test\.[jt]sx?$/.test(rel)) continue;
      violations.push(...scanSource(fs.readFileSync(file, 'utf8'), rel));
    }
  }
  if (violations.length > 0) {
    console.error(`\x1b[31m\x1b[1mcheck-notification-sources\x1b[0m — ${violations.length} probleem/problemen:\n`);
    for (const v of violations) console.error(`  ${v}`);
    console.error('\nZie scripts/check-notification-sources.mjs en docs/role-audit.md (NOTIF-SOURCES-1).');
    process.exit(1);
  }
  console.log('check-notification-sources: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();

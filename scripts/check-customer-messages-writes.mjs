#!/usr/bin/env node
// MSG-STATUS-FIX — guard op schrijfacties naar tabellen met hernoemde kolommen.
//
// Migratie 20260130103145 hernoemde customer_messages.status naar delivery_status,
// zonder de writers aan te passen. Zeven maanden faalde daardoor elke inbound
// e-mail, elk contactformulier en elk WhatsApp/Meta-bericht bij de insert — stil,
// want de fout bleef in de functielogs. Dit script vangt die klasse bug in CI.
//
// Heuristiek, geen parser: bij elke .from('<tabel>') het argument van de
// eerstvolgende .insert( / .update( / .upsert( uitlezen (haakjes-balans). Is dat
// argument een identifier, dan het object-literal met die naam in hetzelfde
// bestand. Daarin: verboden sleutels, en letterlijke waarden buiten wat de
// CHECK-constraint toelaat.
//
// Nieuwe rename? Voeg een regel toe aan RULES. Draait in CI en lokaal met
// `npm run check:messages`.

import fs from 'node:fs';
import path from 'node:path';

const RULES = {
  customer_messages: {
    // hernoemd naar delivery_status in 20260130103145
    forbiddenKeys: ['status'],
    // customer_messages_status_check
    allowedValues: { delivery_status: ['draft', 'sending', 'sent', 'delivered', 'opened', 'failed'] },
  },
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

/** Tekst tussen de haakjes die op `openIdx` openen (strings/templates overgeslagen). */
function balanced(src, openIdx) {
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
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

/** Het object-literal dat aan `name` toegekend wordt, of null. */
function objectLiteralFor(src, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=]*=\\s*\\{`, 'g');
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index + m[0].length - 1);
  return balanced(src, open);
}

/** Sleutels op het bovenste niveau van een object-literal-body (heuristiek: elke `sleutel:`). */
function keyHits(body, key) {
  const re = new RegExp(`(^|[\\s,{(])['"]?${key}['"]?\\s*:`, 'g');
  return [...body.matchAll(re)].length;
}

const violations = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const rel = file.split(path.sep).join('/');
    if (SKIP.has(rel)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const [table, rule] of Object.entries(RULES)) {
      const fromRe = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g');
      for (const m of src.matchAll(fromRe)) {
        const rest = src.slice(m.index + m[0].length);
        const next = /\.(insert|update|upsert|select|delete)\s*\(/.exec(rest);
        if (!next || !['insert', 'update', 'upsert'].includes(next[1])) continue;
        const open = m.index + m[0].length + next.index + next[0].length - 1;
        let arg = balanced(src, open);
        if (arg === null) continue;
        const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(arg);
        if (ident) arg = objectLiteralFor(src, ident[1]) ?? '';
        const line = src.slice(0, m.index).split('\n').length;
        for (const key of rule.forbiddenKeys) {
          if (keyHits(arg, key) > 0) violations.push(`${rel}:${line}  ${table}.${next[1]}() met sleutel "${key}"`);
        }
        for (const [col, allowed] of Object.entries(rule.allowedValues)) {
          const valRe = new RegExp(`\\b${col}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
          for (const v of arg.matchAll(valRe)) {
            if (!allowed.includes(v[1])) violations.push(`${rel}:${line}  ${table}.${col} = '${v[1]}' (toegestaan: ${allowed.join(', ')})`);
          }
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\x1b[31m\x1b[1mcheck-customer-messages-writes\x1b[0m — ${violations.length} probleem/problemen:\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nZie RULES in scripts/check-customer-messages-writes.mjs en docs/role-audit.md (MSG-STATUS-FIX).');
  process.exit(1);
}
console.log('\x1b[32m\x1b[1mcheck-customer-messages-writes\x1b[0m — schrijfacties volgen het schema.');

/**
 * Codemod: hardcoded `date-fns/locale` → de gedeelde useDateFnsLocale-hook.
 *
 * `import { nl } from 'date-fns/locale'` + `{ locale: nl }` maakt de datumopmaak
 * permanent Nederlands, ook als de UI Frans of Oekraïens draait. Deze pass
 * vervangt dat door `const dateLocale = useDateFnsLocale();` per componentbody.
 *
 * Overgeslagen en gerapporteerd: bestanden waar de locale buiten een herkende
 * componentbody wordt gebruikt (een hook mag daar niet staan) en bestanden die
 * meer dan alleen `nl` importeren — die hebben al een eigen mapping.
 *
 * Gebruik: node scripts/i18n-datefns-locale.mjs <pad...> [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { c, collectTsx, relFromRoot } from './i18n-lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('Gebruik: node scripts/i18n-datefns-locale.mjs <pad...> [--dry]');
  process.exit(1);
}

function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function componentBodies(src) {
  const out = [];
  const span = (body) => {
    let depth = 0;
    for (let i = body; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return [body, i]; }
    }
    return null;
  };
  for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const body = src.indexOf('{', close);
    const s = body === -1 ? null : span(body);
    if (s) out.push(s);
  }
  for (const m of src.matchAll(/^(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)(?::[^=\n]+)?\s*=\s*(?:async\s+)?\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const arrow = src.indexOf('=>', close);
    if (arrow === -1) continue;
    const after = src.slice(arrow + 2).match(/^\s*/)[0].length;
    if (src[arrow + 2 + after] !== '{') continue;
    const s = span(arrow + 2 + after);
    if (s) out.push(s);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

const IMPORT_RE = /^import \{ nl \} from 'date-fns\/locale';\n/m;
// Twee vormen: `{ locale: nl }` als optie-object en `locale={nl}` als JSX-prop.
const USE_RE = /\blocale:\s*nl\b|\blocale=\{nl\}/g;

const summary = { files: 0, changed: 0, skipped: [] };
const seen = new Set();

for (const target of targets) {
  for (const abs of collectTsx(target)) {
    if (seen.has(abs)) continue;
    seen.add(abs);
    summary.files++;
    let src = readFileSync(abs, 'utf8');
    const rel = relFromRoot(abs);
    if (!/from 'date-fns\/locale'/.test(src)) continue;
    if (!IMPORT_RE.test(src)) { summary.skipped.push(`${rel}: importeert meer dan alleen \`nl\` — eigen mapping, handmatig`); continue; }

    const uses = [...src.matchAll(USE_RE)];
    if (uses.length === 0) { summary.skipped.push(`${rel}: importeert \`nl\` maar gebruikt hem niet als locale — handmatig`); continue; }

    const bodies = componentBodies(src);
    const outside = uses.filter((m) => !bodies.some(([a, b]) => m.index >= a && m.index <= b));
    if (outside.length) { summary.skipped.push(`${rel}: ${outside.length}× buiten een componentbody — een hook mag daar niet, handmatig`); continue; }

    // Welke bodies hebben de hook nodig? (binnenste eerst, van achter naar voor)
    const needsHook = bodies.filter(([a, b]) => uses.some((m) => m.index >= a && m.index <= b));
    src = src.replace(USE_RE, (m) => (m.startsWith('locale=') ? 'locale={dateLocale}' : 'locale: dateLocale'));
    src = src.replace(IMPORT_RE, '');
    // import toevoegen na de laatste import-regel
    const lastImport = [...src.matchAll(/^import .*?;$/gms)].pop();
    const line = `import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';`;
    src = lastImport
      ? `${src.slice(0, lastImport.index + lastImport[0].length)}\n${line}${src.slice(lastImport.index + lastImport[0].length)}`
      : `${line}\n${src}`;

    // offsets zijn verschoven → bodies opnieuw bepalen en van achter naar voor invoegen
    const fresh = componentBodies(src).filter(([a, b]) => {
      const body = src.slice(a, b);
      return body.includes('dateLocale') && !/const dateLocale = useDateFnsLocale\(\);/.test(body);
    });
    // alleen de buitenste component per nesting: filter bodies die een andere bevatten die ook dateLocale gebruikt
    const chosen = fresh.filter(([a, b]) => !fresh.some(([x, y]) => x > a && y < b));
    for (const [a] of chosen.slice().reverse()) {
      const indent = src.slice(a + 1).match(/^\n(\s*)/)?.[1] ?? '  ';
      src = `${src.slice(0, a + 1)}\n${indent}const dateLocale = useDateFnsLocale();${src.slice(a + 1)}`;
    }

    if (!dry) writeFileSync(abs, src, 'utf8');
    summary.changed++;
    console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(${uses.length}× locale, ${chosen.length} hook(s))${c.reset}`);
  }
}

console.log(`\n${c.bold}i18n-datefns-locale${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);
if (summary.skipped.length) {
  console.log(`\n${c.yellow}TODO — niet automatisch omgezet:${c.reset}`);
  for (const s of summary.skipped) console.log(`  · ${s}`);
}

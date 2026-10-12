#!/usr/bin/env node
/**
 * APP-CLEAN-2 — poortwachter op knoppen die niets doen.
 *
 * Run: `node scripts/check-dead-buttons.mjs`
 *      `node scripts/check-dead-buttons.mjs --update`   (baseline herschrijven)
 *      `node scripts/check-dead-buttons.mjs --list`     (alle vondsten tonen)
 *
 * Aanleiding: op 12 oktober 2026 vond een sweep 30 zichtbare knoppen en
 * menu-items zonder werking (18 alleen al op de bol-detailpagina), plus een
 * kassaknop die een nep-kaartbetaling registreerde. Ze waren onzichtbaar tot een
 * winkelier erop klikte. In de app (Capacitor) zitten ze in dezelfde code.
 *
 * Heuristiek, geen parser. Een `<Button …>` of `<DropdownMenuItem …>` telt als
 * "dood" als de openingstag géén van deze heeft: onClick, onSelect, asChild,
 * type="submit", href, to=, form=, disabled — én hij niet direct binnen een
 * `…Trigger asChild>` staat (DialogTrigger, SheetTrigger, PopoverTrigger, …), direct
 * binnen een `<Link>`/`<a>`, of als waarde van een `trigger={…}`-prop — dan geeft
 * de omhulling hem zijn klik. Voorbeelden in commentaar tellen niet.
 * Een `onClick={() => {}}` telt altijd als dood.
 *
 * Baseline per bestand in `.dead-buttons-baseline.json` (hoort in git). CI faalt
 * zodra een bestand méér vondsten heeft dan zijn baseline, of een nieuw bestand
 * er vondsten heeft. Zakt een aantal, dan meldt het script dat; verlaag dan met
 * `--update`. Een vals alarm (bv. een Button in een <form> die bewust submit
 * via de standaard-type) los je op door `type="submit"` expliciet te zetten.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, '.dead-buttons-baseline.json');
const SCAN_DIRS = ['src/pages', 'src/components'];
const SKIP_DIRS = ['src/components/ui'];
const TAGS = ['Button', 'DropdownMenuItem'];
const LIVE_PROPS = /\b(onClick|onSelect|href|to|form)\s*=|\b(asChild|disabled)\b(?!\s*=\s*\{\s*false\s*\})|\btype\s*=\s*["']submit["']|\{\s*\.\.\./;
const EMPTY_HANDLER = /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/;

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };
const args = new Set(process.argv.slice(2));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (SKIP_DIRS.some((s) => rel === s || rel.startsWith(s + '/'))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') && !full.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

/** Leest een JSX-openingstag vanaf `start` (op '<') tot de sluitende '>' buiten {…} en strings. */
function readOpeningTag(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

export function findDeadButtons(src) {
  const found = [];
  const re = new RegExp(`<(${TAGS.join('|')})(?=[\\s>/])`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const tag = readOpeningTag(src, m.index);
    const before = src.slice(Math.max(0, m.index - 200), m.index);
    const insideTrigger = /Trigger\b[^<>]*\basChild\b[^<>]*>\s*(\{[^{}]*\|\|\s*\(\s*)?$/.test(before);
    // Binnen <Link …> of <a …>: de link geeft de klik.
    const insideLink = /<(Link|a)\b[^<>]*>\s*$/.test(before);
    // Als waarde van een trigger-/action-prop (trigger={<Button>…}): de ontvanger geeft de klik.
    const asTriggerProp = /\b(trigger|action|children)\s*=\s*\{\s*$/.test(before);
    // Voorbeeldcode in commentaar.
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const inComment = /^\s*(\*|\/\/)/.test(src.slice(lineStart, m.index));
    if (inComment) continue;
    const dead = EMPTY_HANDLER.test(tag) || (!LIVE_PROPS.test(tag) && !insideTrigger && !insideLink && !asTriggerProp);
    if (dead) {
      const line = src.slice(0, m.index).split('\n').length;
      found.push({ line, tag: m[1] });
    }
  }
  return found;
}

function scan() {
  const result = {};
  for (const d of SCAN_DIRS) {
    for (const file of walk(join(ROOT, d))) {
      const hits = findDeadButtons(readFileSync(file, 'utf8'));
      if (hits.length) result[relative(ROOT, file)] = hits;
    }
  }
  return result;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const found = scan();
  const counts = Object.fromEntries(Object.entries(found).map(([f, h]) => [f, h.length]).sort());
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (args.has('--list')) {
    for (const [f, hits] of Object.entries(found)) for (const h of hits) console.log(`${f}:${h.line}  <${h.tag}>`);
  }

  if (args.has('--update') || !existsSync(BASELINE)) {
    writeFileSync(BASELINE, JSON.stringify({ total, files: counts }, null, 2) + '\n');
    console.log(`${c.green}Baseline geschreven:${c.reset} ${total} vondsten in ${Object.keys(counts).length} bestanden.`);
    process.exit(0);
  }

  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const worse = [];
  const better = [];
  for (const [f, n] of Object.entries(counts)) {
    const b = base.files[f] ?? 0;
    if (n > b) worse.push({ f, n, b });
    else if (n < b) better.push({ f, n, b });
  }
  for (const f of Object.keys(base.files)) if (!(f in counts)) better.push({ f, n: 0, b: base.files[f] });

  if (worse.length) {
    console.log(`${c.red}${c.bold}Nieuwe knop(pen) zonder werking:${c.reset}`);
    for (const { f, n, b } of worse) {
      console.log(`  ${f}: ${b} → ${n}`);
      for (const h of found[f]) console.log(`${c.dim}    ${f}:${h.line}  <${h.tag}>${c.reset}`);
    }
    console.log(`\nGeef de knop een onClick/asChild/href/type="submit", of haal hem weg. Zie scripts/check-dead-buttons.mjs.`);
    process.exit(1);
  }
  if (better.length) {
    console.log(`${c.yellow}Minder dode knoppen dan de baseline${c.reset} (${base.total} → ${total}). Verlaag met --update.`);
  }
  console.log(`${c.green}Geen nieuwe knoppen zonder werking.${c.reset} (${total} bekend, baseline ${base.total})`);
}

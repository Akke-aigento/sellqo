/**
 * Aanvullende codemod: UI-tekst in object-literals.
 *
 * `i18n-extract.mjs` pakt `title|description|message: "..."` (toastRe) en
 * `label="..."` als JSX-prop, maar niet `label: 'Bekijken'` in een gewone
 * object-literal — een patroon dat in deze repo veel voorkomt in tab-, kolom-
 * en menudefinities.
 *
 * Vervangt alleen binnen een herkende componentbody, zodat `t` gegarandeerd in
 * scope komt na `i18n-extract.mjs --repair`. Voorkomens op moduleniveau worden
 * NIET aangeraakt maar gerapporteerd: die vragen het key-in-de-array-patroon
 * (waarde wordt een i18n-key, `t()` op de rendersite) en dus handwerk.
 *
 * Gebruik: node scripts/i18n-extract-objprops.mjs <pad...> [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  c, collectTsx, isUiText, namespaceForFile, slugify,
  readLocale, writeLocale, flattenTree, setKey, getKey, relFromRoot, buildSourceMask,
} from './i18n-lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('Gebruik: node scripts/i18n-extract-objprops.mjs <pad...> [--dry]');
  process.exit(1);
}

const PROPS = ['label', 'name', 'text', 'placeholder', 'tooltip', 'heading', 'subtitle', 'hint', 'emptyText', 'buttonText'];
// Let op de escapes: 'Productpagina\'s' is één string, geen twee. Zonder de
// tak `(?:[^'\\\n]|\\.)*` knipt de match midden in de waarde en breekt het bestand.
const propRe = new RegExp(`\\b(${PROPS.join('|')})(\\s*:\\s*)(?:"((?:[^"\\\\\\n]|\\\\.)*)"|'((?:[^'\\\\\\n]|\\\\.)*)')`, 'g');
const unescape = (v) =>
  v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
   .replace(/\\n/g, '\n')
   .replace(/\\t/g, '\t')
   .replace(/\\(['"\\])/g, '$1');

const nl = readLocale('nl');
const valueToKeys = new Map();
for (const [key, value] of [...flattenTree(nl)].sort(([a], [b]) =>
  (a.startsWith('common.') ? 0 : 1) - (b.startsWith('common.') ? 0 : 1))) {
  if (typeof value !== 'string') continue;
  if (!valueToKeys.has(value)) valueToKeys.set(value, []);
  valueToKeys.get(value).push(key);
}
const reusableIn = (key, rootNs) => key.startsWith('common.') || key.startsWith(`${rootNs}.`);

function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Spans [start, end] van elke componentbody, via accolade-matching. */
function componentSpans(src) {
  const bodies = [];
  const push = (body) => {
    let depth = 0;
    for (let i = body; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { bodies.push([body, i]); return; } }
    }
  };
  for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const body = src.indexOf('{', close);
    if (body !== -1) push(body);
  }
  for (const m of src.matchAll(/^(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)(?::[^=\n]+)?\s*=\s*(?:async\s+)?\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const arrow = src.indexOf('=>', close);
    if (arrow === -1) continue;
    const after = src.slice(arrow + 2).match(/^\s*/)[0].length;
    if (src[arrow + 2 + after] !== '{') continue;
    push(arrow + 2 + after);
  }
  return bodies;
}


const summary = { files: 0, changed: 0, keys: 0, reused: 0, skipped: [] };

for (const target of targets) {
  for (const abs of collectTsx(target)) {
    summary.files++;
    let src = readFileSync(abs, 'utf8');
    const rel = relFromRoot(abs);
    const mask = buildSourceMask(src);
    const spans = componentSpans(src);
    const inComponent = (i) => spans.some(([a, b]) => i >= a && i <= b);
    const ns = namespaceForFile(abs);
    const rootNs = ns.split('.')[0];
    const usedSlugs = new Set();

    const keyFor = (text) => {
      const existing = (valueToKeys.get(text) ?? []).find((k) => reusableIn(k, rootNs));
      if (existing) { summary.reused++; return existing; }
      const slug = slugify(text);
      let key = `${ns}.${slug}`;
      let guard = 1;
      while (usedSlugs.has(key) || (getKey(nl, key) !== undefined && getKey(nl, key) !== text)) {
        key = `${ns}.${slug}_${++guard}`;
      }
      usedSlugs.add(key);
      setKey(nl, key, text);
      if (!valueToKeys.has(text)) valueToKeys.set(text, []);
      valueToKeys.get(text).push(key);
      summary.keys++;
      return key;
    };

    const edits = [];
    let outside = 0;
    for (const m of src.matchAll(propRe)) {
      const value = unescape(m[3] ?? m[4]);
      if (!isUiText(value)) continue;
      if (mask[m.index]) continue;
      if (!inComponent(m.index)) { outside++; continue; }
      edits.push({ start: m.index, end: m.index + m[0].length, prop: m[1], sep: m[2], value });
    }
    if (outside) summary.skipped.push(`${rel}: ${outside} op moduleniveau — handmatig (key-in-array-patroon)`);
    if (edits.length === 0) continue;

    for (const e of edits.reverse()) {
      src = src.slice(0, e.start) + `${e.prop}${e.sep}t('${keyFor(e.value)}')` + src.slice(e.end);
    }
    if (!dry) writeFileSync(abs, src, 'utf8');
    summary.changed++;
    console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(${edits.length} strings)${c.reset}`);
  }
}

if (!dry) writeLocale('nl', nl);
console.log(`\n${c.bold}i18n-extract-objprops${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast, ` +
  `${summary.keys} nieuwe NL-keys, ${summary.reused} hergebruikt${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);
if (summary.skipped.length) {
  console.log(`\n${c.yellow}TODO — niet automatisch omgezet:${c.reset}`);
  for (const s of summary.skipped) console.log(`  · ${s}`);
}
console.log(`\nVolgende stap: ${c.cyan}node scripts/i18n-extract.mjs <pad> --repair${c.reset}`);

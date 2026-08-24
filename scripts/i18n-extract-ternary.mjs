/**
 * Aanvullende codemod: UI-tekst in een ternary.
 *
 *     {row.status === 'x' ? 'Negatief' : 'Keyword'}
 *     <Badge>{active ? 'Actief' : 'Inactief'}</Badge>
 *
 * De hoofdcodemod ziet alleen `>tekst<` en `prop="tekst"`, dus deze twee
 * takken blijven Nederlands in elke taal.
 *
 * Bewust streng, want een ternary levert net zo goed een enum-waarde, een
 * classNamen of een API-parameter op:
 *   - BEIDE takken moeten door isUiText() komen (dat weert lowercase tokens,
 *     Tailwind-klassen, routes en CONSTANT_CASE al);
 *   - de ternary moet binnen een herkende componentbody staan;
 *   - comments en template literals worden overgeslagen.
 *
 * Gebruik: node scripts/i18n-extract-ternary.mjs <pad...> [--dry]
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
  console.error('Gebruik: node scripts/i18n-extract-ternary.mjs <pad...> [--dry]');
  process.exit(1);
}

const STR = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`;
const ternaryRe = new RegExp(String.raw`\?\s*${STR}\s*:\s*${STR}`, 'g');
// Tweede regel voor geketende ternary's: `a ? 'X' : b ? 'Y' : 'Z'` wordt van
// binnen naar buiten omgezet, dus na de eerste ronde staat er `? 'X' : t(...)`.
// Dat de andere tak al een t()-aanroep is, bewijst dat deze tak UI-tekst is.
const chainedRe = new RegExp(String.raw`\?\s*${STR}\s*:\s*(?=[^\n;{}]*\?\s*t\()`, 'g');
const unescape = (v) => v.replace(/\\(['"\\])/g, '$1');

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

function componentSpans(src) {
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
  return out;
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
    for (const m of src.matchAll(ternaryRe)) {
      if (mask[m.index]) continue;
      const a = unescape(m[1] ?? m[2] ?? '');
      const b = unescape(m[3] ?? m[4] ?? '');
      if (!isUiText(a) || !isUiText(b)) continue;
      if (!inComponent(m.index)) { outside++; continue; }
      edits.push({ start: m.index, end: m.index + m[0].length, a, b });
    }
    for (const m of src.matchAll(chainedRe)) {
      if (mask[m.index]) continue;
      const a = unescape(m[1] ?? m[2] ?? '');
      if (!isUiText(a)) continue;
      if (!inComponent(m.index)) { outside++; continue; }
      if (edits.some((e) => m.index < e.end && e.start < m.index + m[0].length)) continue;
      edits.push({ start: m.index, end: m.index + m[0].length, a, chained: true });
    }
    if (outside) summary.skipped.push(`${rel}: ${outside}× op moduleniveau — handmatig`);
    if (edits.length === 0) continue;

    edits.sort((x, y) => x.start - y.start);
    for (const e of edits.reverse()) {
      const rep = e.chained
        ? `? t('${keyFor(e.a)}') : `
        : `? t('${keyFor(e.a)}') : t('${keyFor(e.b)}')`;
      src = src.slice(0, e.start) + rep + src.slice(e.end);
    }
    if (!dry) writeFileSync(abs, src, 'utf8');
    summary.changed++;
    console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(${edits.length} ternary's)${c.reset}`);
  }
}

if (!dry) writeLocale('nl', nl);
console.log(`\n${c.bold}i18n-extract-ternary${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast, ` +
  `${summary.keys} nieuwe NL-keys, ${summary.reused} hergebruikt${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);
if (summary.skipped.length) {
  console.log(`\n${c.yellow}TODO — niet automatisch omgezet:${c.reset}`);
  for (const s of summary.skipped) console.log(`  · ${s}`);
}
console.log(`\nVolgende stap: ${c.cyan}node scripts/i18n-extract.mjs <pad> --repair${c.reset}`);

#!/usr/bin/env node
/**
 * i18n-codemod: hardcoded UI-tekst in .tsx omzetten naar t()-keys.
 *
 *   node scripts/i18n-extract.mjs src/components/storefront
 *   node scripts/i18n-extract.mjs src/pages/admin/Quotes.tsx --dry
 *
 * Wat het doet, per bestand:
 *   1. herkent JSX-tekstnodes, tekstprops en toast-teksten (zie i18n-lib.mjs);
 *   2. leidt een keypad af uit de bestandslocatie (admin.quotes.opslaan);
 *   3. hergebruikt een bestaande key als exact dezelfde NL-tekst al bestaat;
 *   4. zet useTranslation + `const { t } = useTranslation()` erin waar nodig;
 *   5. schrijft de Nederlandse waarden in src/i18n/locales/nl.json.
 *
 * Wat het NIET doet: gokken. Onduidelijke gevallen (tekst in template literals,
 * componenten zonder herkenbare body, strings buiten een component) blijven staan
 * en komen als TODO in de samenvatting. Vertalen doet scripts/i18n-translate.mjs.
 *
 * Idempotent: al omgezette tekst matcht niet meer, bestaande keys worden nooit
 * overschreven.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  c, collectTsx, isUiText, TEXT_PROPS, namespaceForFile, slugify,
  readLocale, writeLocale, flattenTree, setKey, getKey, relFromRoot,
} from './i18n-lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--'));

if (targets.length === 0) {
  console.error('Gebruik: node scripts/i18n-extract.mjs <pad> [--dry]');
  process.exit(1);
}

const nl = readLocale('nl');
const flatNl = flattenTree(nl);
/** NL-waarde → bestaande key, voor hergebruik (common.* eerst). */
const valueToKey = new Map();
for (const [key, value] of [...flatNl].sort((a, b) => (a[0].startsWith('common.') ? -1 : b[0].startsWith('common.') ? 1 : 0))) {
  if (typeof value === 'string' && !valueToKey.has(value)) valueToKey.set(value, key);
}

/** Masker: comment- en template-literal-regio's overslaan. */
function buildMask(src) {
  const mask = new Uint8Array(src.length);
  let i = 0;
  let state = 'code';
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') { state = 'line'; mask[i] = 1; }
      else if (ch === '/' && next === '*') { state = 'block'; mask[i] = 1; }
      else if (ch === '`') { state = 'tpl'; mask[i] = 1; }
    } else {
      mask[i] = 1;
      if (state === 'line' && ch === '\n') state = 'code';
      else if (state === 'block' && src[i - 1] === '*' && ch === '/') state = 'code';
      else if (state === 'tpl' && ch === '`' && src[i - 1] !== '\\') state = 'code';
    }
    i++;
  }
  return mask;
}

/** Index van het `)` dat hoort bij het `(` op `open`. */
function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Componentgrenzen: naam + offset van de openende accolade van de FUNCTIEBODY.
 * Let op: bij `function X({ a, b }: Props)` mag de accolade van de destructurering
 * niet als body gelden — daarom eerst de parameterlijst overslaan.
 */
function findComponents(src) {
  const out = [];

  // function-declaraties
  for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const body = src.indexOf('{', close);
    if (body === -1) continue;
    out.push({ name: m[1], start: m.index, body });
  }

  // arrow-componenten met blok-body
  for (const m of src.matchAll(/^(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)(?::[^=\n]+)?\s*=\s*(?:async\s+)?\(/gm)) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(src, open);
    if (close === -1) continue;
    const arrow = src.indexOf('=>', close);
    if (arrow === -1) continue;
    const after = src.slice(arrow + 2).match(/^\s*/)[0].length;
    if (src[arrow + 2 + after] !== '{') continue; // implicit return → laten staan
    out.push({ name: m[1], start: m.index, body: arrow + 2 + after });
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Zet `const { t } = useTranslation();` in elke component-body die t() gebruikt. */
function ensureHooks(src) {
  const comps = findComponents(src);
  for (let i = comps.length - 1; i >= 0; i--) {
    const comp = comps[i];
    const end = comps[i + 1]?.start ?? src.length;
    const body = src.slice(comp.body, end);
    if (!/\bt\(\s*['"]/.test(body)) continue;
    if (/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useTranslation\(/.test(body)) continue;
    const indent = src.slice(comp.body + 1).match(/^\n(\s*)/)?.[1] ?? '  ';
    src = `${src.slice(0, comp.body + 1)}\n${indent}const { t } = useTranslation();${src.slice(comp.body + 1)}`;
  }
  return src;
}

/** Import van useTranslation toevoegen als die ontbreekt. */
function ensureImport(src) {
  if (/import\s*\{[^}]*\buseTranslation\b[^}]*\}\s*from\s*['"]react-i18next['"]/.test(src)) return src;
  if (/from ['"]react-i18next['"]/.test(src)) {
    return src.replace(/import \{([^}]*)\} from (['"])react-i18next\2/, (all, inner, q) =>
      `import {${inner.trimEnd()}, useTranslation } from ${q}react-i18next${q}`
    );
  }
  const lastImport = [...src.matchAll(/^import .*?;$/gms)].pop();
  const line = `import { useTranslation } from 'react-i18next';`;
  return lastImport
    ? `${src.slice(0, lastImport.index + lastImport[0].length)}\n${line}${src.slice(lastImport.index + lastImport[0].length)}`
    : `${line}\n${src}`;
}

/** Herstelt hooks die per ongeluk in een parameterlijst zijn geland. */
function stripMisplacedHooks(src) {
  return src.replace(/\n[ \t]*const \{ t \} = useTranslation\(\);(?=[ \t]*[^\n])/g, '');
}

const propRe = new RegExp(`\\b(${TEXT_PROPS.join('|')})=(?:"([^"\\n]*)"|'([^'\\n]*)')`, 'g');
const jsxTextRe = />(\s*)([^<>{}\n][^<>{}]*?)(\s*)</g;
const toastRe = /\b(title|description|message)(\s*:\s*)(?:"([^"\n]*)"|'([^'\n]*)')/g;

const summary = { files: 0, changed: 0, keys: 0, reused: 0, todo: [] };
const filesSeen = new Set();

for (const target of targets) {
  for (const abs of collectTsx(target)) {
    if (filesSeen.has(abs)) continue;
    filesSeen.add(abs);
    summary.files++;

    let src = readFileSync(abs, 'utf8');
    const rel = relFromRoot(abs);
    const repair = process.argv.includes('--repair');
    if (repair) {
      const before = src;
      src = ensureImport(ensureHooks(stripMisplacedHooks(src)));
      if (src !== before) {
        if (!dry) writeFileSync(abs, src, 'utf8');
        console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(hooks hersteld)${c.reset}`);
        summary.changed++;
      }
      continue;
    }
    const ns = namespaceForFile(abs);
    const mask = buildMask(src);
    const components = findComponents(src);

    /** @type {{start:number,end:number,replacement:string,text:string,key:string}[]} */
    const edits = [];
    const usedSlugs = new Map();
    let todoCount = 0;

    const keyFor = (text) => {
      const existing = valueToKey.get(text);
      if (existing) { summary.reused++; return existing; }
      let slug = slugify(text);
      const n = (usedSlugs.get(slug) ?? 0) + 1;
      usedSlugs.set(slug, n);
      if (n > 1) slug = `${slug}_${n}`;
      let key = `${ns}.${slug}`;
      let guard = 1;
      while (getKey(nl, key) !== undefined && getKey(nl, key) !== text) key = `${ns}.${slug}_${++guard}`;
      return key;
    };

    const push = (start, end, text, build) => {
      if (mask[start]) { todoCount++; return; }
      const key = keyFor(text);
      edits.push({ start, end, text, key, replacement: build(key) });
    };

    for (const m of src.matchAll(jsxTextRe)) {
      const text = m[2].trim();
      if (!isUiText(text)) continue;
      const start = m.index;
      push(start, start + m[0].length, text, (key) => `>${m[1]}{t('${key}')}${m[3]}<`);
    }
    for (const m of src.matchAll(propRe)) {
      const text = (m[2] ?? m[3]).trim();
      if (!isUiText(text)) continue;
      push(m.index, m.index + m[0].length, text, (key) => `${m[1]}={t('${key}')}`);
    }
    for (const m of src.matchAll(toastRe)) {
      const text = (m[3] ?? m[4]).trim();
      if (!isUiText(text)) continue;
      push(m.index, m.index + m[0].length, text, (key) => `${m[1]}${m[2]}t('${key}')`);
    }

    if (edits.length === 0) {
      if (todoCount > 0) summary.todo.push(`${rel}: ${todoCount} string(s) in template literal of comment — handmatig`);
      continue;
    }

    // Elke edit moet binnen een herkende component vallen, anders raken we het bestand niet aan.
    const owner = (offset) => {
      let found = null;
      for (const comp of components) if (comp.body < offset) found = comp; else break;
      return found;
    };
    const owners = new Set();
    let unowned = 0;
    for (const e of edits) {
      const o = owner(e.start);
      if (!o) unowned++;
      else owners.add(o);
    }
    if (unowned > 0) {
      summary.todo.push(`${rel}: ${unowned} string(s) buiten een herkende component — handmatig`);
      continue;
    }

    // 1. Tekstvervangingen van achter naar voor.
    for (const e of [...edits].sort((a, b) => b.start - a.start)) {
      src = src.slice(0, e.start) + e.replacement + src.slice(e.end);
    }

    // 2 + 3. Hook per component die t() gebruikt, plus de import.
    src = ensureImport(ensureHooks(src));

    // 4. NL-keys wegschrijven.
    let added = 0;
    for (const e of edits) {
      if (setKey(nl, e.key, e.text)) { added++; valueToKey.set(e.text, e.key); }
    }
    summary.keys += added;
    summary.changed++;
    if (todoCount > 0) summary.todo.push(`${rel}: ${todoCount} string(s) in template literal of comment — handmatig`);

    if (!dry) writeFileSync(abs, src, 'utf8');
    console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(${edits.length} strings, ${added} nieuwe keys)${c.reset}`);
  }
}

if (!dry) writeLocale('nl', nl);

console.log(
  `\n${c.bold}i18n-extract${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast, ` +
    `${summary.keys} nieuwe NL-keys, ${summary.reused} keys hergebruikt${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`
);
if (summary.todo.length) {
  console.log(`\n${c.yellow}TODO — niet automatisch omgezet:${c.reset}`);
  for (const line of summary.todo) console.log(`  · ${line}`);
}
console.log(`\nVolgende stap: ${c.cyan}npm run i18n:translate${c.reset}\n`);
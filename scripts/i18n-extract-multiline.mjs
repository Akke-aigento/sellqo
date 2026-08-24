/**
 * Aanvullende codemod: JSX-tekst die op een EIGEN regel staat.
 *
 * `i18n-extract.mjs` matcht alleen `>tekst<` binnen één regel. Veel JSX staat
 * echter zo:
 *
 *     <CardTitle>
 *       A/B Testing
 *     </CardTitle>
 *
 * Die tekst blijft daardoor hardcoded. Deze pass pakt precies dat geval en
 * niets anders — de voorwaarden zijn expres streng:
 *
 *   - het blok bestaat uit regels zonder < > { } (dus geen markup of expressie);
 *   - de vorige niet-lege regel eindigt op `>` (openende tag);
 *   - de volgende niet-lege regel begint met `<` (sluitende tag);
 *   - de tekst overleeft isUiText() uit i18n-lib.
 *
 * Comments en template literals worden gemaskeerd en overgeslagen.
 * Hooks/imports worden NIET geplaatst — draai daarna:
 *     node scripts/i18n-extract.mjs <pad> --repair
 *
 * Gebruik: node scripts/i18n-extract-multiline.mjs <pad...> [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  c, collectTsx, isUiText, namespaceForFile, slugify,
  readLocale, writeLocale, flattenTree, setKey, getKey, relFromRoot,
} from './i18n-lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('Gebruik: node scripts/i18n-extract-multiline.mjs <pad...> [--dry]');
  process.exit(1);
}

const nl = readLocale('nl');

// Hergebruik met dezelfde grens als i18n-extract: common.* + eigen root-namespace.
const valueToKeys = new Map();
for (const [key, value] of [...flattenTree(nl)].sort(([a], [b]) =>
  (a.startsWith('common.') ? 0 : 1) - (b.startsWith('common.') ? 0 : 1))) {
  if (typeof value !== 'string') continue;
  if (!valueToKeys.has(value)) valueToKeys.set(value, []);
  valueToKeys.get(value).push(key);
}
const reusableIn = (key, rootNs) => key.startsWith('common.') || key.startsWith(`${rootNs}.`);

/** Regelnummers die in een comment of template literal vallen. */
function maskedLines(src) {
  const masked = new Set();
  let line = 1, i = 0;
  let mode = null; // 'line' | 'block' | 'tpl'
  while (i < src.length) {
    const ch = src[i], next = src[i + 1];
    if (ch === '\n') { line++; if (mode === 'line') mode = null; i++; continue; }
    if (mode === null) {
      if (ch === '/' && next === '/') { mode = 'line'; i += 2; continue; }
      if (ch === '/' && next === '*') { mode = 'block'; i += 2; continue; }
      if (ch === '`') { mode = 'tpl'; i++; continue; }
    } else {
      if (mode === 'block' && ch === '*' && next === '/') { mode = null; i += 2; continue; }
      if (mode === 'tpl' && ch === '`' && src[i - 1] !== '\\') { mode = null; i++; continue; }
      masked.add(line);
    }
    i++;
  }
  return masked;
}

const summary = { files: 0, changed: 0, keys: 0, reused: 0 };

for (const target of targets) {
  for (const abs of collectTsx(target)) {
    summary.files++;
    const src = readFileSync(abs, 'utf8');
    const lines = src.split('\n');
    const masked = maskedLines(src);
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

    // Een regel met alleen JSX-tekst bevat geen markup, geen expressie en geen
    // code. Zonder deze tweede zeef glipt een ternary-tak als
    // `) : items.length === 0 ? (` erdoor: die bevat ook geen < > { }.
    const CODE = /^\)|\($|[=;]|&&|\|\||\breturn\b|\bcase\b|\bconst\b|\blet\b|\bvar\b|\btypeof\b|\bawait\b|\bnull\b|\bundefined\b/;
    const isTextLine = (s) => {
      const t = s.trim();
      return t.length > 0 && !/[<>{}]/.test(t) && !CODE.test(t);
    };
    const prevNonEmpty = (i) => { for (let j = i - 1; j >= 0; j--) if (lines[j].trim()) return lines[j].trim(); return ''; };
    const nextNonEmpty = (i) => { for (let j = i; j < lines.length; j++) if (lines[j].trim()) return lines[j].trim(); return ''; };

    let changed = false;
    let i = 0;
    const out = [];
    while (i < lines.length) {
      if (!isTextLine(lines[i]) || masked.has(i + 1)) { out.push(lines[i]); i++; continue; }
      let end = i;
      while (end + 1 < lines.length && isTextLine(lines[end + 1]) && !masked.has(end + 2)) end++;
      const before = prevNonEmpty(i);
      const after = nextNonEmpty(end + 1);
      const text = lines.slice(i, end + 1).map((l) => l.trim()).join(' ');
      if (before.endsWith('>') && !before.endsWith('=>') && after.startsWith('<') && isUiText(text)) {
        const indent = lines[i].match(/^\s*/)[0];
        out.push(`${indent}{t('${keyFor(text)}')}`);
        changed = true;
        i = end + 1;
        continue;
      }
      for (let j = i; j <= end; j++) out.push(lines[j]);
      i = end + 1;
    }

    if (changed) {
      if (!dry) writeFileSync(abs, out.join('\n'), 'utf8');
      summary.changed++;
      console.log(`${c.green}✓${c.reset} ${relFromRoot(abs)}`);
    }
  }
}

if (!dry) writeLocale('nl', nl);
console.log(`\n${c.bold}i18n-extract-multiline${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast, ` +
  `${summary.keys} nieuwe NL-keys, ${summary.reused} hergebruikt${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);
console.log(`\nVolgende stap: ${c.cyan}node scripts/i18n-extract.mjs <pad> --repair${c.reset}`);

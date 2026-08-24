/**
 * Aanvullende codemod: validatieboodschappen in zod-schema's.
 *
 *     z.string().min(1, 'Naam is verplicht')
 *
 * Die tekst verschijnt onder het formulierveld, dus het is UI-tekst. Schema's
 * staan echter vrijwel altijd op moduleniveau, waar geen t() bestaat. Daarom
 * komt de KEY in de message te staan; FormMessage (src/components/ui/form.tsx)
 * herkent een key-achtige string en vertaalt hem bij het renderen.
 *
 * Alleen zod-validators worden aangeraakt, en alleen als de waarde door
 * isUiText() komt.
 *
 * Gebruik: node scripts/i18n-extract-validation.mjs <pad...> [--dry]
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
  console.error('Gebruik: node scripts/i18n-extract-validation.mjs <pad...> [--dry]');
  process.exit(1);
}

const VALIDATORS = ['min', 'max', 'email', 'url', 'uuid', 'regex', 'length', 'nonempty', 'refine', 'gte', 'lte', 'positive', 'int'];
const STR = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`;
const msgRe = new RegExp(String.raw`\.(${VALIDATORS.join('|')})\(([^()'"]*?,\s*)${STR}\)`, 'g');
const bareRe = new RegExp(String.raw`\.(email|url|uuid|nonempty|positive|int)\(\s*${STR}\s*\)`, 'g');
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

const summary = { files: 0, changed: 0, keys: 0, reused: 0 };

for (const target of targets) {
  for (const abs of collectTsx(target)) {
    summary.files++;
    let src = readFileSync(abs, 'utf8');
    const rel = relFromRoot(abs);
    if (!/\bz\.(object|string|number|array|enum|coerce)\b/.test(src)) continue;
    const mask = buildSourceMask(src);
    const ns = namespaceForFile(abs);
    const rootNs = ns.split('.')[0];
    const usedSlugs = new Set();

    const keyFor = (text) => {
      const existing = (valueToKeys.get(text) ?? []).find((k) => reusableIn(k, rootNs));
      if (existing) { summary.reused++; return existing; }
      const slug = slugify(text);
      let key = `${ns}.validation.${slug}`;
      let guard = 1;
      while (usedSlugs.has(key) || (getKey(nl, key) !== undefined && getKey(nl, key) !== text)) {
        key = `${ns}.validation.${slug}_${++guard}`;
      }
      usedSlugs.add(key);
      setKey(nl, key, text);
      if (!valueToKeys.has(text)) valueToKeys.set(text, []);
      valueToKeys.get(text).push(key);
      summary.keys++;
      return key;
    };

    const edits = [];
    for (const re of [msgRe, bareRe]) {
      for (const m of src.matchAll(re)) {
        if (mask[m.index]) continue;
        const groups = m.slice(1).filter((g) => g !== undefined);
        const value = unescape(groups[groups.length - 1]);
        if (!isUiText(value)) continue;
        const q = m[0].lastIndexOf(value);
        const start = m.index + q - 1;                 // openende quote
        edits.push({ start, end: start + value.length + 2, value });
      }
    }
    if (edits.length === 0) continue;
    edits.sort((a, b) => a.start - b.start);
    for (const e of edits.reverse()) {
      src = src.slice(0, e.start) + `'${keyFor(e.value)}'` + src.slice(e.end);
    }
    if (!dry) writeFileSync(abs, src, 'utf8');
    summary.changed++;
    console.log(`${c.green}✓${c.reset} ${rel} ${c.dim}(${edits.length} meldingen)${c.reset}`);
  }
}

if (!dry) writeLocale('nl', nl);
console.log(`\n${c.bold}i18n-extract-validation${c.reset} — ${summary.changed}/${summary.files} bestanden aangepast, ` +
  `${summary.keys} nieuwe NL-keys, ${summary.reused} hergebruikt${dry ? ` ${c.yellow}(dry-run)${c.reset}` : ''}`);

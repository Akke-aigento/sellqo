/**
 * Gedeelde helpers voor de i18n-scripts (scan / extract / translate / check).
 *
 * Eén plek voor: locale-IO, key-paden, string-classificatie en de negeerlijst.
 * De talenlijst wordt UIT src/i18n/languages.ts gelezen — nooit hardcoded, zoals
 * de skill sellqo-i18n-verplicht voorschrijft.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales');

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/** Talen uit de bron van waarheid: src/i18n/languages.ts. */
export function readLangCodes() {
  const src = readFileSync(join(ROOT, 'src', 'i18n', 'languages.ts'), 'utf8');
  const block = src.slice(src.indexOf('SUPPORTED_LANGUAGES'), src.indexOf('] as const'));
  const codes = [...block.matchAll(/code:\s*'([a-z]{2})'/g)].map((m) => m[1]);
  if (codes.length === 0) throw new Error('Geen taalcodes gevonden in src/i18n/languages.ts');
  return codes;
}

export const DEFAULT_LANG = 'nl';

export function localeFile(code) {
  return join(LOCALES_DIR, `${code}.json`);
}

export function readLocale(code) {
  return JSON.parse(readFileSync(localeFile(code), 'utf8'));
}

/** Schrijft met 2-spaties-indent en trailing newline, zoals de bestaande bestanden. */
export function writeLocale(code, data) {
  writeFileSync(localeFile(code), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Plat een boom naar dot-notation keys → waarde. Arrays gelden als blad. */
export function flattenTree(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenTree(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

export function getKey(tree, dotted) {
  return dotted.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), tree);
}

/** Zet een key op zijn dot-pad. Bestaande waarden worden NIET overschreven. */
export function setKey(tree, dotted, value) {
  const parts = dotted.split('.');
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null || Array.isArray(node[part])) {
      if (node[part] !== undefined) return false; // conflict: blad waar een tak moet komen
      node[part] = {};
    }
    node = node[part];
  }
  const leaf = parts[parts.length - 1];
  if (node[leaf] !== undefined) return false;
  node[leaf] = value;
  return true;
}

/** Sorteert objectsleutels recursief zodat diffs leesbaar blijven. */
export function sortTree(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
  const out = {};
  for (const key of Object.keys(node).sort()) out[key] = sortTree(node[key]);
  return out;
}

// --- bestanden ---------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'ui']);

/** Alle .tsx-bestanden onder een pad (bestand of map). `ui/` (shadcn) valt af. */
export function collectTsx(target) {
  const abs = resolve(ROOT, target);
  const st = statSync(abs);
  if (st.isFile()) return abs.endsWith('.tsx') ? [abs] : [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectTsx(join(abs, entry.name)));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(join(abs, entry.name));
    }
  }
  return out.sort();
}

/**
 * Keynamespace uit de bestandslocatie.
 *   src/pages/admin/Quotes.tsx              → admin.quotes
 *   src/components/storefront/CartDrawer.tsx → storefront.cartDrawer
 */
export function namespaceForFile(absPath) {
  const rel = relative(join(ROOT, 'src'), absPath).split(sep);
  const file = rel.pop().replace(/\.tsx$/, '');
  const parts = rel.filter((p) => !['pages', 'components'].includes(p));
  const camel = (s) =>
    s
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1)))
      .join('');
  return [...parts.map(camel), camel(file)].filter(Boolean).join('.');
}

/** Slug voor een keynaam uit een Nederlandse UI-string. */
export function slugify(text) {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .filter(Boolean)
    .slice(0, 6)
    .join('_');
  return base || 'text';
}

// --- classificatie van kandidaat-strings -------------------------------------

/** Merken en eigennamen: blijven letterlijk (zie skill). */
export const BRANDS = [
  'SellQo', 'Stripe', 'Bol.com', 'bol.com', 'Amazon', 'Shopify', 'WooCommerce', 'Odoo',
  'Peppol', 'PayPal', 'Mollie', 'Klarna', 'Bancontact', 'iDEAL', 'SEPA', 'Printful',
  'Meta', 'Facebook', 'Instagram', 'WhatsApp', 'TikTok', 'Google', 'LinkedIn', 'Pinterest',
  'YouTube', 'bpost', 'PostNL', 'DHL', 'DPD', 'GLS', 'UPS', 'Exact Online', 'Octopus',
  'Cloudflare', 'Supabase', 'Resend', 'Twilio', 'Capacitor', 'QR', 'PDF', 'CSV', 'API',
  'BTW', 'IBAN', 'EAN', 'SKU', 'RMA', 'POS', 'AI', 'VIES', 'GDPR', 'AVG', 'URL', 'HTML',
];

const BRAND_ONLY = new RegExp(`^(?:${BRANDS.map((b) => b.replace(/[.]/g, '\\.')).join('|')})[\\s:·|/-]*$`, 'i');

/**
 * Is dit menselijk-leesbare UI-tekst die vertaald moet worden?
 * Conservatief: bij twijfel `false` — liever een string laten staan dan code slopen.
 */
export function isUiText(raw) {
  const text = raw.trim();
  if (text.length < 3) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(text)) return false;          // moet letters bevatten
  if (BRAND_ONLY.test(text)) return false;                  // puur een merknaam
  if (/^[a-z0-9_.:\/-]+$/.test(text)) return false;         // identifier / route / key
  if (/^[A-Z0-9_]+$/.test(text)) return false;              // CONSTANT_CASE
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false;        // kleurcode
  if (/^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/)/.test(text)) return false;
  if (/^\d+(?:[.,]\d+)?\s*(?:%|px|rem|em|ms|s|kg|g|cm|mm)?$/.test(text)) return false;
  if (/[{}<>]/.test(text)) return false;                    // expressie of markup
  if (/^[A-Za-z]+(?:-[a-z0-9]+)+$/.test(text)) return false; // kebab-case token
  if (/\b(?:flex|grid|text-|bg-|border-|rounded|p-\d|m-\d|w-full|h-\d)\b/.test(text)) return false; // tailwind
  return true;
}

/** Props waarvan de waarde UI-tekst is. */
export const TEXT_PROPS = [
  'placeholder', 'title', 'label', 'aria-label', 'alt', 'description', 'emptyMessage',
  'emptyText', 'tooltip', 'confirmText', 'cancelText', 'submitLabel', 'heading', 'subtitle',
];

/**
 * Offsets die NIET als broncode tellen: comments en template literals.
 *
 * String-literals worden expliciet meegevolgd, want anders opent `'image/*'`
 * een blok-comment dat nooit sluit — en dan lijkt de rest van het bestand
 * commentaar en slaat de codemod alle strings erna stil over. Dat gebeurde
 * echt (ProductPhotoLibraryCard: 106 van de 150 regels onterecht gemaskeerd).
 *
 * Strings zelf worden niet gemaskeerd: hun inhoud is juist wat de object-prop-
 * codemod moet kunnen zien.
 */
export function buildSourceMask(src) {
  const mask = new Uint8Array(src.length);
  let state = 'code';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    const escaped = state !== 'code' && src[i - 1] === '\\' && src[i - 2] !== '\\';
    switch (state) {
      case 'code':
        if (ch === '/' && next === '/') { state = 'line'; mask[i] = 1; }
        else if (ch === '/' && next === '*') { state = 'block'; mask[i] = 1; }
        else if (ch === '`') { state = 'tpl'; mask[i] = 1; }
        else if (ch === "'") state = 'sq';
        else if (ch === '"') state = 'dq';
        break;
      case 'line':
        mask[i] = 1;
        if (ch === '\n') state = 'code';
        break;
      case 'block':
        mask[i] = 1;
        if (ch === '/' && src[i - 1] === '*') state = 'code';
        break;
      case 'tpl':
        mask[i] = 1;
        if (ch === '`' && !escaped) state = 'code';
        break;
      case 'sq':
        if (ch === '\n') state = 'code';           // onafgesloten string: niet doorslepen
        else if (ch === "'" && !escaped) state = 'code';
        break;
      case 'dq':
        if (ch === '\n') state = 'code';
        else if (ch === '"' && !escaped) state = 'code';
        break;
    }
  }
  return mask;
}

/** Regelnummers (1-based) die volledig in een comment of template literal vallen. */
export function maskedLineNumbers(src) {
  const mask = buildSourceMask(src);
  const out = new Set();
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') { line++; continue; }
    if (mask[i]) out.add(line);
  }
  return out;
}

/**
 * Offsets die BINNEN een string-literal vallen (de quotes zelf niet meegeteld).
 *
 * Nodig omdat een prop-patroon net zo goed in een gewone string kan staan:
 *   document.querySelector('[title="SellQo Assistent"]')
 * Zonder deze zeef vervangt de codemod dat `title="..."` en breekt de selector.
 */
export function buildStringMask(src) {
  const mask = new Uint8Array(src.length);
  let state = 'code';
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    const escaped = state !== 'code' && src[i - 1] === '\\' && src[i - 2] !== '\\';
    if (state === 'code') {
      if (ch === '/' && next === '/') state = 'line';
      else if (ch === '/' && next === '*') state = 'block';
      else if (ch === "'") { state = 'sq'; start = i + 1; }
      else if (ch === '"') { state = 'dq'; start = i + 1; }
      else if (ch === '`') { state = 'tpl'; start = i + 1; }
    } else if (state === 'line') {
      if (ch === '\n') state = 'code';
    } else if (state === 'block') {
      if (ch === '/' && src[i - 1] === '*') state = 'code';
    } else {
      const closer = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
      const ended = (ch === closer && !escaped) || (state !== 'tpl' && ch === '\n');
      if (ended) { mask.fill(1, start, i); state = 'code'; }
    }
  }
  return mask;
}

export function relFromRoot(abs) {
  return relative(ROOT, abs);
}
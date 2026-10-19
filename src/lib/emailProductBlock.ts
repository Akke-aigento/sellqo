/**
 * MAIL-2c — productblok in marketingmails.
 *
 * Het blok is statische, mailveilige HTML (tabellen, inline stijlen) met een kopie van zijn
 * gegevens in `data-sellqo-products` (JSON). De editor (TipTap) leest enkel dat attribuut en bouwt
 * de HTML zelf opnieuw op met `productBlockSpec`, dus wat er in de opgeslagen HTML staat, kan geen
 * vreemde opmaak of scripts in de editor brengen.
 *
 * De prijs is de prijs op het moment van invoegen (tekst in het blok). Geen doorstreepte
 * "van"-prijs. Zonder publieke productlink (storefrontUrls.productUrlFor → null) geen knop en geen
 * link: nooit een dode link.
 */

export const PRODUCT_BLOCK_ATTR = 'data-sellqo-products';
export const PRODUCT_BLOCK_MAX = 4;

export type ProductBlockLayout = 'grid' | 'list';

export interface ProductBlockItem {
  name: string;
  /** Opgemaakte prijs op het moment van invoegen, bv. "€ 24,95". */
  price: string;
  /** https-afbeelding of null */
  image: string | null;
  /** publieke productlink (https) of null = geen knop */
  url: string | null;
}

export interface ProductBlockData {
  v: 1;
  layout: ProductBlockLayout;
  /** Tekst op de knop, in de taal van de mail. */
  button: string;
  /** Knopkleur (#rrggbb). */
  color: string;
  items: ProductBlockItem[];
}

const HTTPS = /^https:\/\/[^\s"'<>]+$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#111111';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const httpsOrNull = (v: unknown) => {
  const s = str(v, 2000);
  return HTTPS.test(s) ? s : null;
};

/** Valideert en normaliseert blokgegevens (uit het attribuut of uit de dialoog). Ongeldig → null. */
export function normalizeProductBlock(input: unknown): ProductBlockData | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const items = (Array.isArray(o.items) ? o.items : [])
    .slice(0, PRODUCT_BLOCK_MAX)
    .map((raw) => {
      const i = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      return { name: str(i.name, 200), price: str(i.price, 40), image: httpsOrNull(i.image), url: httpsOrNull(i.url) };
    })
    .filter((i) => i.name);
  if (!items.length) return null;
  const color = str(o.color, 7);
  return {
    v: 1,
    layout: o.layout === 'list' ? 'list' : 'grid',
    button: str(o.button, 40),
    color: HEX.test(color) ? color : DEFAULT_COLOR,
    items,
  };
}

export function parseProductBlockAttr(raw: string | null | undefined): ProductBlockData | null {
  if (!raw) return null;
  try {
    return normalizeProductBlock(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Zwart of wit, afhankelijk van wat het best leesbaar is op de knopkleur. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
}

/** ProseMirror-achtige DOM-spec: [tag, attrs, ...kinderen] of tekst. */
export type BlockSpec = string | [string, Record<string, string>, ...BlockSpec[]];

const FONT = 'font-family:inherit;';

function button(item: ProductBlockItem, data: ProductBlockData): BlockSpec[] {
  if (!item.url || !data.button) return [];
  return [[
    'a',
    {
      href: item.url,
      style: `display:inline-block;padding:10px 18px;border-radius:6px;background:${data.color};color:${textOn(data.color)};text-decoration:none;font-weight:600;font-size:14px;${FONT}`,
    },
    data.button,
  ]];
}

function image(item: ProductBlockItem, width: number): BlockSpec[] {
  if (!item.image) return [];
  const img: BlockSpec = ['img', {
    src: item.image,
    alt: item.name,
    width: String(width),
    style: `display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:6px;`,
  }];
  return [item.url ? ['a', { href: item.url }, img] : img];
}

function texts(item: ProductBlockItem, align: string): BlockSpec[] {
  const out: BlockSpec[] = [
    ['p', { style: `margin:10px 0 4px;font-size:15px;font-weight:600;line-height:1.3;text-align:${align};` }, item.name],
  ];
  if (item.price) out.push(['p', { style: `margin:0 0 10px;font-size:15px;line-height:1.3;text-align:${align};` }, item.price]);
  return out;
}

function gridCell(item: ProductBlockItem, data: ProductBlockData, cols: number): BlockSpec {
  const pct = Math.floor(100 / cols);
  const imgWidth = cols === 1 ? 280 : cols === 2 ? 260 : 170;
  return ['td', { width: `${pct}%`, valign: 'top', align: 'center', style: 'padding:8px;' },
    ...image(item, imgWidth), ...texts(item, 'center'), ...button(item, data)];
}

/** Volledige spec van het blok (buitenste div met de gegevens als JSON). */
export function productBlockSpec(data: ProductBlockData): BlockSpec {
  const rows: BlockSpec[] = [];
  if (data.layout === 'list') {
    for (const item of data.items) {
      rows.push(['tr', {},
        ['td', { width: '140', valign: 'top', style: 'padding:8px 12px 8px 0;' }, ...image(item, 140)],
        ['td', { valign: 'middle', style: 'padding:8px 0;' }, ...texts(item, 'left'), ...button(item, data)],
      ]);
    }
  } else {
    const cols = data.items.length === 3 ? 3 : Math.min(2, data.items.length);
    for (let i = 0; i < data.items.length; i += cols) {
      rows.push(['tr', {}, ...data.items.slice(i, i + cols).map((it) => gridCell(it, data, cols))]);
    }
  }
  return ['div', { [PRODUCT_BLOCK_ATTR]: JSON.stringify(data), style: 'margin:16px 0;' },
    ['table', { role: 'presentation', width: '100%', cellpadding: '0', cellspacing: '0', border: '0', style: 'border-collapse:collapse;width:100%;' },
      ['tbody', {}, ...rows]]];
}

const VOID = new Set(['img', 'br']);
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Spec → HTML-string (tekst en attributen ge-escaped). */
export function specToHtml(spec: BlockSpec): string {
  if (typeof spec === 'string') return esc(spec);
  const [tag, attrs, ...children] = spec;
  const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  if (VOID.has(tag)) return `<${tag}${a}>`;
  return `<${tag}${a}>${children.map(specToHtml).join('')}</${tag}>`;
}

export function renderProductBlockHtml(data: ProductBlockData): string {
  return specToHtml(productBlockSpec(data));
}

/** Haalt productblokken weg (voor de "complexe HTML"-check: een productblok is geen eigen HTML). */
export function stripProductBlocks(html: string): string {
  if (!html.includes(PRODUCT_BLOCK_ATTR) || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll(`[${PRODUCT_BLOCK_ATTR}]`).forEach((el) => el.remove());
  return doc.body.innerHTML;
}

/** Prijs zoals hij in de mail komt, in de taal van de mail. */
export function formatBlockPrice(amount: number | null | undefined, currency: string, lang: string): string {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return '';
  const locale = ({ nl: 'nl-BE', fr: 'fr-BE', de: 'de-BE', en: 'en-GB', uk: 'uk-UA' } as Record<string, string>)[lang] || 'nl-BE';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(Number(amount));
  } catch {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(amount));
  }
}

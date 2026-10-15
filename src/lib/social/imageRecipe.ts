// SOCIAL-4 — "Tekst in beeld aanpassen": een beeldrecept opnieuw tekenen in de browser.
//
// Een recept is één zelfstandig HTML-document (gemaakt door de contentpijplijn, bv. Loveke
// marketing/instagram/recipe.mjs) met de tekstvakken gemarkeerd als
//   data-slot="titel" data-label="Titel" data-max="22" [data-multiline="true"]
// Lettertypes en beelden staan als absolute URL's die CORS toelaten.
//
// Tekenen gebeurt zonder bibliotheek: het document gaat (met lettertypes en beelden als
// data-URL's) in een SVG <foreignObject>, dat als beeld op een canvas komt en als JPEG
// wordt bewaard. Zo tekent de eigen renderer van de browser exact dezelfde CSS als de
// pijplijn (Chromium/Playwright), zonder iets na te bouwen.
//
// Veiligheid: het recept komt uit de database. Het wordt nooit als script uitgevoerd:
// DOMParser voert niets uit, een SVG-als-beeld ook niet, en het voorbeeld draait in een
// iframe met sandbox="" (geen scripts). Toch strippen we <script>, on…-attributen en
// javascript:-URL's, zodat een gemanipuleerd recept ook elders niets kan.

export interface ImageRecipe {
  version: number;
  width: number;
  height: number;
  html: string;
}

export interface RecipeSlot {
  key: string;
  label: string;
  max: number | null;
  multiline: boolean;
  value: string;
}

/** Leest een recept uit de database en controleert de vorm. Ongeldig → null. */
export function parseRecipe(value: unknown): ImageRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.html !== 'string' || typeof r.width !== 'number' || typeof r.height !== 'number') return null;
  if (r.width < 100 || r.height < 100 || r.width > 2160 || r.height > 3840) return null;
  return { version: Number(r.version ?? 1), width: r.width, height: r.height, html: r.html };
}

/** Verwijdert alles wat iets zou kunnen uitvoeren. */
export function sanitizeRecipeHtml(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, base, meta[http-equiv]').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'src' || name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc;
}

export function readSlots(html: string): RecipeSlot[] {
  const doc = sanitizeRecipeHtml(html);
  return [...doc.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => {
    const max = Number(el.dataset.max);
    const multiline = el.dataset.multiline === 'true';
    return {
      key: el.dataset.slot ?? '',
      label: el.dataset.label || el.dataset.slot || '',
      max: Number.isFinite(max) && max > 0 ? max : null,
      multiline,
      value: multiline ? textWithBreaks(el) : (el.textContent ?? ''),
    };
  });
}

function textWithBreaks(el: HTMLElement): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeName === 'BR') out += '\n';
    else out += n.textContent ?? '';
  });
  return out;
}

/** Zet nieuwe teksten in de tekstvakken. Onbekende sleutels worden genegeerd. */
export function applySlots(html: string, values: Record<string, string>): string {
  const doc = sanitizeRecipeHtml(html);
  doc.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
    const key = el.dataset.slot ?? '';
    if (!(key in values)) return;
    const max = Number(el.dataset.max);
    let text = values[key];
    if (Number.isFinite(max) && max > 0) text = text.slice(0, max);
    el.textContent = '';
    if (el.dataset.multiline === 'true') {
      text.split('\n').forEach((line, i) => {
        if (i > 0) el.appendChild(doc.createElement('br'));
        el.appendChild(doc.createTextNode(line));
      });
    } else {
      el.textContent = text.replace(/\s*\n\s*/g, ' ');
    }
  });
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

const dataUrlCache = new Map<string, Promise<string>>();

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  let p = dataUrlCache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })();
    dataUrlCache.set(url, p);
    p.catch(() => dataUrlCache.delete(url));
  }
  return p;
}

async function inlineCssUrls(css: string): Promise<string> {
  const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))];
  const map = new Map<string, string>();
  await Promise.all(urls.map(async (u) => map.set(u, await toDataUrl(u))));
  return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (_m, u) => `url("${map.get(u) ?? u}")`);
}

/** Bouwt de SVG met het volledige document, alle externe bestanden als data-URL. */
export async function recipeToSvg(html: string, width: number, height: number): Promise<string> {
  const doc = sanitizeRecipeHtml(html);
  const styles = [...doc.querySelectorAll('style')];
  for (const style of styles) style.textContent = await inlineCssUrls(style.textContent ?? '');
  await Promise.all([...doc.querySelectorAll<HTMLElement>('[style*="url("]')].map(async (el) => {
    el.setAttribute('style', await inlineCssUrls(el.getAttribute('style') ?? ''));
  }));
  await Promise.all([...doc.querySelectorAll('img')].map(async (img) => {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', await toDataUrl(src));
  }));
  doc.querySelectorAll('meta, title').forEach((el) => el.remove());
  const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<foreignObject x="0" y="0" width="${width}" height="${height}">${xhtml}</foreignObject></svg>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Het beeld kon niet getekend worden.'));
    img.src = src;
  });
}

/** Tekent het recept en geeft een JPEG terug. */
export async function rasterizeRecipe(html: string, width: number, height: number, quality = 0.92): Promise<Blob> {
  const svg = await recipeToSvg(html, width, height);
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas niet beschikbaar.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  // Safari tekent lettertypes in een SVG-beeld soms pas bij de tweede keer: even wachten
  // en dan (opnieuw) tekenen kost niets in andere browsers.
  ctx.drawImage(img, 0, 0, width, height);
  await new Promise((r) => setTimeout(r, 120));
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG maken mislukt.'))), 'image/jpeg', quality);
  });
}

/** Indexen van de beelden van een post die een geldig recept hebben. */
export function editableImageIndexes(post: { image_recipes: unknown[] | null; image_urls: string[] | null }): number[] {
  const recipes = post.image_recipes ?? [];
  const count = (post.image_urls ?? []).length;
  const out: number[] = [];
  for (let i = 0; i < Math.min(count, recipes.length); i++) {
    if (parseRecipe(recipes[i]) && readSlotsSafe(recipes[i]).length > 0) out.push(i);
  }
  return out;
}

function readSlotsSafe(value: unknown) {
  const r = parseRecipe(value);
  if (!r) return [];
  try {
    return readSlots(r.html);
  } catch {
    return [];
  }
}

// MENUKAART-PRINT-1 — de papieren menukaart: selectie, imposition (paginavolgorde per vel) en
// lay-out (niets loopt over de rand, geen kop alleen onderaan, geen gesplitst gerecht).
// Voorbeeld-PDF's wegschrijven: MENU_PDF_OUT=/map (en MENU_PDF_COVER/MENU_PDF_LOGO voor beelden).
import { describe, expect, it } from 'vitest';
import { Duplex, PDFDocument, PrintScaling } from 'pdf-lib';
import {
  bookletPrintOrder, bookletSheets, buildMenuSections, parseMenuPrintSettings, plainDescription, totalPages,
  type MenuSection, type MenuSourceCategory, type MenuSourceProduct,
} from '@/lib/menuPrint';
import { chooseLayout, embedFonts, formatMenuPrice, generateMenuCardPdf, geoFor, colWidth, layoutMenu, type MenuCardInput, type PdfImageBytes } from './menuCardPdf';

const ALLERGEN_NL = ['Gluten', 'Schaaldieren', 'Eieren', 'Vis', 'Pinda’s', 'Soja', 'Melk', 'Noten', 'Selder', 'Mosterd', 'Sesamzaad', 'Sulfieten', 'Lupine', 'Weekdieren'];
const labels = {
  coverTitle: 'Menu', continued: 'vervolg', allergensTitle: 'Allergenen', allergenNames: ALLERGEN_NL,
  dietary: { vegetarian: { short: 'V', label: 'Vegetarisch' }, vegan: { short: 'VG', label: 'Veganistisch' }, spicy: { short: 'P', label: 'Pikant' } },
  hoursTitle: 'Openingsuren', qrCaption: 'Scan voor de online kaart', priceNote: 'Prijzen in euro, inclusief btw.',
};

// Realistische testkaart: 8 categorieën, 60 gerechten, lange namen, allergenen en dieetlabels.
const CATS = ['Voorgerechten', 'Soepen', 'Salades', 'Pasta & risotto', 'Hoofdgerechten vlees', 'Vis & zeevruchten', 'Desserts', 'Warme dranken'];
const DISHES = [
  'Carpaccio van rund met rucola, parmezaan en truffelmayonaise', 'Kroketten van Noordzeegarnalen', 'Burrata met tomaat en basilicum', 'Vitello tonnato', 'Gamba’s in look', 'Scampi diabolique',
  'Tomatensoep met balletjes', 'Pompoensoep', 'Vissoep op Oostendse wijze met rouille en croutons',
  'Caesarsalade met kip', 'Salade met geitenkaas, honing en walnoten', 'Salade niçoise', 'Poké bowl met zalm',
  'Spaghetti bolognese', 'Penne arrabbiata', 'Tagliatelle met scampi en look', 'Risotto met eekhoorntjesbrood en oude Brugge', 'Lasagne van de chef', 'Linguine vongole', 'Gnocchi met salieboter',
  'Steak met frietjes en bearnaise', 'Stoofvlees op grootmoeders wijze met frietjes', 'Vol-au-vent met frietjes', 'Konijn met pruimen', 'Spareribs', 'Entrecote Black Angus 300 g met groenten van het seizoen en kruidenboter', 'Kipfilet met champignonroomsaus', 'Varkenshaasje met mosterdsaus',
  'Tongrolletjes met garnalensaus', 'Zalmfilet met dillesaus', 'Mosselen natuur', 'Mosselen look', 'Kabeljauw met mosterdsaus en puree', 'Zeetong meunière', 'Gegrilde scampi',
  'Dame blanche', 'Crème brûlée', 'Tiramisu', 'Moelleux van chocolade met vanille-ijs', 'Sabayon', 'Coupe Brésilienne', 'Pannenkoeken met suiker', 'Café glacé', 'Kaasplank met vijgenconfituur',
  'Koffie', 'Espresso', 'Cappuccino', 'Latte macchiato', 'Thee', 'Verse muntthee', 'Warme chocolademelk met slagroom', 'Irish coffee', 'Italian coffee', 'French coffee', 'Chai latte', 'Koffie verkeerd', 'Dubbele espresso', 'Ristretto', 'Flat white', 'Gemberthee',
];
const PER_CAT = [6, 3, 4, 7, 8, 7, 9, 16];
const ALL = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];

function fixture(): { categories: MenuSourceCategory[]; products: MenuSourceProduct[] } {
  const categories = CATS.map((name, i) => ({ id: `c${i}`, name, sort_order: i, is_active: true, hide_from_storefront: false }));
  const products: MenuSourceProduct[] = [];
  let k = 0;
  PER_CAT.forEach((n, ci) => {
    for (let j = 0; j < n; j++, k++) {
      products.push({
        id: `p${k}`, name: DISHES[k], price: 3.2 + ((k * 7.35) % 31), category_id: `c${ci}`, is_active: true, hide_from_storefront: false,
        channels: ['online', 'table', 'menu', 'pos'], menu_position: j,
        short_description: k % 3 === 0 ? 'Huisgemaakt met verse producten van lokale boeren, geserveerd met brood en kruidenboter.' : k % 3 === 1 ? '<p>Klassieker van het huis</p>' : null,
        allergens: ALL.filter((_, a) => (k + a) % 5 === 0).slice(0, 4),
        dietary: k % 7 === 0 ? ['vegetarian'] : k % 11 === 0 ? ['vegan', 'spicy'] : [],
      });
    }
  });
  return { categories, products };
}

function input(template: MenuCardInput['template'], sections: MenuSection[], extra: Partial<MenuCardInput> = {}): MenuCardInput {
  return {
    template, storeName: 'Brasserie De Gouden Lepel', subtitle: 'Keuken van het huis sinds 1998', accent: '#8a3b2e', sections,
    showDescriptions: true, showAllergens: true, labels,
    back: {
      lines: ['Bondgenotenlaan 12', '3000 Leuven', '016 12 34 56', 'gouden-lepel.sellqo.shop'],
      hours: [{ days: 'ma – do', value: '11:30–14:00, 17:30–22:00' }, { days: 'vr – za', value: '11:30–23:00' }, { days: 'zo', value: 'gesloten' }],
      qrUrl: 'https://gouden-lepel.sellqo.shop/menu', qrText: 'gouden-lepel.sellqo.shop/menu',
    },
    ...extra,
  };
}

async function readImage(env: string | undefined): Promise<PdfImageBytes | null> {
  if (!env) return null;
  const fs = await import('node:fs');
  const bytes = new Uint8Array(fs.readFileSync(env));
  return { bytes, kind: bytes[0] === 0x89 ? 'png' : 'jpg' };
}

async function save(name: string, bytes: Uint8Array) {
  if (!process.env.MENU_PDF_OUT) return;
  const fs = await import('node:fs');
  fs.writeFileSync(`${process.env.MENU_PDF_OUT}/${name}.pdf`, bytes);
}

describe('buildMenuSections — zelfde selectie als het QR-menu', () => {
  it('volgorde van categorieën en producten, verborgen weg, uitverkocht/dagschotel blijven', () => {
    const cats: MenuSourceCategory[] = [
      { id: 'b', name: 'Dranken', sort_order: 2, is_active: true },
      { id: 'a', name: 'Eten', sort_order: 1, is_active: true },
      { id: 'h', name: 'Verborgen', sort_order: 0, is_active: false },
      { id: 'w', name: 'Enkel webshop', sort_order: 3, is_active: true, hide_from_storefront: true },
    ];
    const base = { is_active: true, hide_from_storefront: false, channels: ['menu', 'table', 'online'], menu_position: null as number | null, price: 2 };
    const prods: MenuSourceProduct[] = [
      { ...base, id: '1', name: 'Zoet', category_id: 'a', menu_position: 2 },
      { ...base, id: '2', name: 'Aardappel', category_id: 'a', menu_position: 1 },
      { ...base, id: '3', name: 'Cola', category_id: 'b' },
      { ...base, id: '4', name: 'Uit', category_id: 'b', is_active: false },
      { ...base, id: '5', name: 'Online enkel', category_id: 'b', channels: ['online'] },
      { ...base, id: '6', name: 'Verstopt', category_id: 'h' },
      { ...base, id: '7', name: 'Web', category_id: 'w' },
      { ...base, id: '8', name: 'Niet in webshop', category_id: 'b', hide_from_storefront: true },
      { ...base, id: '9', name: 'Los', category_id: null, channels: ['table'] },
      // Uitverkocht vandaag of dagschotel: geen kolommen die hier meetellen, dus gewoon op de kaart.
      { ...base, id: '10', name: 'Bier', category_id: 'b', allergens: ['gluten', 'sulphites'] },
    ];
    const s = buildMenuSections(cats, prods, 'Overige');
    expect(s.map((x) => x.title)).toEqual(['Eten', 'Dranken', 'Overige']);
    expect(s[0].items.map((i) => i.name)).toEqual(['Aardappel', 'Zoet']);
    expect(s[1].items.map((i) => i.name)).toEqual(['Bier', 'Cola']);
    expect(s[1].items[0].allergens).toEqual([1, 12]);
    expect(s[2].items.map((i) => i.name)).toEqual(['Los']);
  });
  it('omschrijving: HTML eruit, lange tekst ingekort op een woord', () => {
    expect(plainDescription('<p>Met <strong>verse</strong> kruiden&nbsp;&amp; look</p>')).toBe('Met verse kruiden & look');
    const long = plainDescription('woord '.repeat(80), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith('…')).toBe(true);
  });
  it('instellingen: onbekende of kapotte waarden vallen terug op de standaard', () => {
    expect(parseMenuPrintSettings(null).template).toBe('booklet_a5');
    const p = parseMenuPrintSettings({ template: 'a4', options: { allergens: false, subtitle: 'x'.repeat(200) }, cover_image_url: 'javascript:alert(1)' });
    expect(p.template).toBe('a4');
    expect(p.options.allergens).toBe(false);
    expect(p.options.descriptions).toBe(true);
    expect(p.options.subtitle.length).toBe(60);
    expect(p.coverImageUrl).toBeNull();
    expect(parseMenuPrintSettings({ template: 'zever' }).template).toBe('booklet_a5');
  });
});

describe('imposition', () => {
  it('8 pagina\'s: 2 vellen, juiste volgorde voor en achter', () => {
    expect(bookletSheets(8)).toEqual([
      { front: { left: 8, right: 1 }, back: { left: 2, right: 7 } },
      { front: { left: 6, right: 3 }, back: { left: 4, right: 5 } },
    ]);
    expect(bookletPrintOrder(8)).toEqual([[8, 1], [2, 7], [6, 3], [4, 5]]);
  });
  it('elke pagina precies één keer, en elk vel gevouwen leest 1..n', () => {
    for (const n of [4, 8, 12, 16, 24, 40]) {
      const order = bookletPrintOrder(n).flat();
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      // Op elke zijde tellen de twee pagina's op tot n+1 (kenmerk van een gevouwen katern).
      for (const [l, r] of bookletPrintOrder(n)) expect(l + r).toBe(n + 1);
      // Vel s: voorkant rechts = 2s+1 (rechterpagina), achterkant links = 2s+2: oneven rechts, even links.
      bookletSheets(n).forEach((s, i) => { expect(s.front.right).toBe(2 * i + 1); expect(s.back.left).toBe(2 * i + 2); });
    }
  });
  it('weigert een aantal dat geen veelvoud van 4 is', () => {
    expect(() => bookletSheets(6)).toThrow();
  });
  it('opvullen: boekje tot veelvoud van 4, A4 tot even', () => {
    expect(totalPages('booklet_a5', 1)).toBe(4);
    expect(totalPages('booklet_a5', 3)).toBe(8);
    expect(totalPages('photo_cover', 6)).toBe(8);
    expect(totalPages('a4', 1)).toBe(4);
    expect(totalPages('a4', 2)).toBe(4);
    expect(totalPages('a4', 3)).toBe(6);
  });
});

describe('lay-out', () => {
  const { categories, products } = fixture();
  const sections = buildMenuSections(categories, products, 'Overige');
  it('de testkaart heeft 8 categorieën en 60 gerechten', () => {
    expect(sections.length).toBe(8);
    expect(sections.reduce((n, s) => n + s.items.length, 0)).toBe(60);
  });
  for (const template of ['booklet_a5', 'a4'] as const) {
    it(`${template}: niets over de rand, geen kop alleen onderaan, elk gerecht precies één keer`, async () => {
      const doc = await PDFDocument.create();
      const f = await embedFonts(doc);
      const g = geoFor(template);
      const o = { showDescriptions: true, showAllergens: true, labels };
      for (const scale of [1, 0.82]) {
        const pages = layoutMenu(sections, f, g, scale, o);
        const names: string[] = [];
        for (const p of pages) {
          const cols = new Map<number, typeof p.blocks>();
          p.blocks.forEach((b) => cols.set(b.col, [...(cols.get(b.col) ?? []), b]));
          for (const blocks of cols.values()) {
            blocks.forEach((b, i) => {
              expect(b.top).toBeLessThanOrEqual(g.h - g.top + 0.01);
              expect(b.top - b.block.height).toBeGreaterThanOrEqual(g.bottom - 0.01);
              if (b.block.kind === 'heading') expect(blocks[i + 1]?.block.kind).toBe('item');
              if (b.block.kind === 'item') {
                names.push(b.block.item.name);
                // Tekstregels passen in de kolom (naam + stippellijn + prijs).
                const z = 10.5 * scale * (template === 'a4' ? 1.08 : 1);
                for (const line of b.block.nameLines) expect(f.bold.widthOfTextAtSize(line, z)).toBeLessThan(colWidth(g));
              }
            });
          }
        }
        expect(names.length).toBe(60);
        expect(new Set(names).size).toBe(60);
      }
    });
  }
  it('lange kaart: kiest een kleinere letter als dat een vel scheelt, anders normaal', async () => {
    const doc = await PDFDocument.create();
    const f = await embedFonts(doc);
    const o = { showDescriptions: true, showAllergens: true, labels };
    const small = chooseLayout(sections.slice(0, 2), f, 'booklet_a5', o);
    expect(small.scale).toBe(1);
    const big = chooseLayout(sections, f, 'booklet_a5', o);
    expect(big.total % 4).toBe(0);
    expect(big.scale).toBeGreaterThanOrEqual(0.82);
  });
});

describe('prijzen', () => {
  it('in de taal van de kaart, zonder euroteken; ≤ 0 = geen prijs', () => {
    expect(formatMenuPrice(12.5, 'nl-BE')).toBe('12,50');
    expect(formatMenuPrice(1234.5, 'fr-BE')).toBe('1\u00a0234,50');
    expect(formatMenuPrice(12.5, 'en')).toBe('12.50');
    expect(formatMenuPrice(0)).toBe('');
    expect(formatMenuPrice(-1)).toBe('');
    expect(formatMenuPrice(Number.NaN)).toBe('');
  });
});

async function prefs(bytes: Uint8Array) {
  const vp = (await PDFDocument.load(bytes)).catalog.getViewerPreferences();
  return { duplex: vp?.getDuplex(), scaling: vp?.getPrintScaling() };
}

describe('afdrukvoorkeuren in de PDF', () => {
  const s: MenuSection[] = [{ title: 'Dranken', items: [{ name: 'Koffie', price: 3, description: '', allergens: [], dietary: [] }, { name: 'Water van het huis', price: 0, description: '', allergens: [], dietary: [] }] }];
  it('boekje en fotokaft: korte kant, ware grootte', async () => {
    for (const tpl of ['booklet_a5', 'photo_cover'] as const) {
      expect(await prefs((await generateMenuCardPdf(input(tpl, s))).bytes)).toEqual({ duplex: Duplex.DuplexFlipShortEdge, scaling: PrintScaling.None });
    }
  });
  it('A4: lange kant, ware grootte', async () => {
    expect(await prefs((await generateMenuCardPdf(input('a4', s))).bytes)).toEqual({ duplex: Duplex.DuplexFlipLongEdge, scaling: PrintScaling.None });
  });
  it('losse pagina\'s: enkel ware grootte', async () => {
    const p = await prefs((await generateMenuCardPdf(input('booklet_a5', s, { impose: false }))).bytes);
    expect(p.scaling).toBe(PrintScaling.None);
    expect(p.duplex).toBeUndefined();
  });
  it('gerecht zonder prijs: geen prijs in de lay-out', async () => {
    const doc = await PDFDocument.create();
    const f = await embedFonts(doc);
    const pages = layoutMenu(s, f, geoFor('booklet_a5'), 1, { showDescriptions: true, showAllergens: true, labels });
    const items = pages[0].blocks.filter((b) => b.block.kind === 'item').map((b) => (b.block.kind === 'item' ? b.block.price : null));
    expect(items).toEqual(['3,00', '']);
  });
});

describe('generateMenuCardPdf', () => {
  const { categories, products } = fixture();
  const sections = buildMenuSections(categories, products, 'Overige');

  it('boekje A5: A4-liggende vellen, pagina\'s = 4 × vellen', async () => {
    const logo = await readImage(process.env.MENU_PDF_LOGO);
    const r = await generateMenuCardPdf(input('booklet_a5', sections, { logo }));
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(r.sheets * 2);
    expect(r.pages).toBe(r.sheets * 4);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
    await save('1-boekje-a5', r.bytes);
    await save('1-boekje-a5-losse-paginas', (await generateMenuCardPdf(input('booklet_a5', sections, { logo, impose: false }))).bytes);
  });
  it('A4 staand: even aantal A4-pagina\'s, kaft en achterkant', async () => {
    const logo = await readImage(process.env.MENU_PDF_LOGO);
    const r = await generateMenuCardPdf(input('a4', sections, { subtitle: '', logo }));
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(r.pages);
    expect(r.pages % 2).toBe(0);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    await save('2-a4-staand', r.bytes);
  });
  it('fotokaft: zonder geldige foto een gewone kaft plus een waarschuwing (geen fout)', async () => {
    const r = await generateMenuCardPdf(input('photo_cover', sections, { cover: { bytes: new Uint8Array([1, 2, 3]), kind: 'jpg' } }));
    expect(r.warnings).toContain('cover');
    expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(r.sheets * 2);
  });
  it('fotokaft met foto', async () => {
    const cover = await readImage(process.env.MENU_PDF_COVER);
    const logo = await readImage(process.env.MENU_PDF_LOGO);
    const r = await generateMenuCardPdf(input('photo_cover', sections, { cover, logo }));
    if (cover) expect(r.warnings).not.toContain('cover');
    await save('3-fotokaft', r.bytes);
  });
  it('kleine kaart zonder omschrijving, allergenen, info of QR; tekens buiten WinAnsi crashen niet', async () => {
    const small: MenuSection[] = [{ title: 'Напої 🍺', items: [{ name: 'Пиво — Stella', price: 3, description: '', allergens: [1], dietary: [] }] }];
    const r = await generateMenuCardPdf({ ...input('booklet_a5', small), showDescriptions: false, showAllergens: false, back: { lines: [], hours: [], qrUrl: null } });
    expect(r.pages).toBe(4);
    expect(r.sheets).toBe(1);
  });
});

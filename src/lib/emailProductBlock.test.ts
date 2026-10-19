// MAIL-2c — productblok: validatie, HTML en de rondgang door de editor.
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ProductBlock } from '@/components/admin/marketing/ProductBlockExtension';
import { isComplexHtml } from '@/lib/emailContent';
import {
  formatBlockPrice,
  normalizeProductBlock,
  parseProductBlockAttr,
  renderProductBlockHtml,
  type ProductBlockData,
} from './emailProductBlock';

const block: ProductBlockData = {
  v: 1,
  layout: 'grid',
  button: 'Bekijk',
  color: '#0f766e',
  items: [
    { name: 'Trui <b>rood</b>', price: '€ 49,95', image: 'https://cdn.x/a.jpg', url: 'https://loveke.be/shop/trui' },
    { name: 'Sok', price: '€ 9,95', image: null, url: null },
  ],
};

describe('normalizeProductBlock', () => {
  it('max 4, enkel https, kleur en layout gecontroleerd', () => {
    const n = normalizeProductBlock({
      layout: 'weird',
      color: 'red',
      button: 'x',
      items: [
        { name: 'A', price: '1', image: 'javascript:alert(1)', url: 'http://x.be' },
        { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: '' },
      ],
    })!;
    expect(n.layout).toBe('grid');
    expect(n.color).toBe('#111111');
    expect(n.items).toHaveLength(4);
    expect(n.items[0]).toEqual({ name: 'A', price: '1', image: null, url: null });
    expect(normalizeProductBlock({ items: [] })).toBeNull();
    expect(parseProductBlockAttr('{kapot')).toBeNull();
  });
});

describe('renderProductBlockHtml', () => {
  it('escapet namen, knop enkel met link, geen doorstreepte prijs', () => {
    const html = renderProductBlockHtml(block);
    expect(html).toContain('Trui &lt;b&gt;rood&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html.match(/>Bekijk</g)).toHaveLength(1);
    expect(html).toContain('href="https://loveke.be/shop/trui"');
    expect(html).not.toMatch(/line-through|<s>|<del>/);
    expect(html).toContain('data-sellqo-products="');
  });

  it('zonder links: geen enkele <a>', () => {
    const html = renderProductBlockHtml({ ...block, items: block.items.map((i) => ({ ...i, url: null })) });
    expect(html).not.toContain('<a ');
  });
});

describe('editor', () => {
  const mk = (content: string) => new Editor({ extensions: [StarterKit, ProductBlock], content });

  it('blok blijft behouden bij opslaan en opnieuw openen', () => {
    const e1 = mk('<p>Hoi</p>');
    e1.commands.insertProductBlock(block);
    const html = e1.getHTML();
    expect(html).toContain('data-sellqo-products');
    expect(html).toContain('<table');
    const e2 = mk(html);
    const json = e2.getJSON();
    const node = json.content?.find((n) => n.type === 'sellqoProducts');
    expect(node?.attrs?.data).toEqual(normalizeProductBlock(block));
    e1.destroy(); e2.destroy();
  });

  it('vreemde HTML in het blok wordt niet overgenomen', () => {
    const data = JSON.stringify(block).replace(/"/g, '&quot;');
    const e = mk(`<div data-sellqo-products="${data}"><img src=x onerror="alert(1)"><script>alert(2)</script></div>`);
    const html = e.getHTML();
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).toContain('loveke.be/shop/trui');
    e.destroy();
  });

  it('kapotte gegevens: blok valt weg', () => {
    const e = mk('<div data-sellqo-products="{nope}"><p>x</p></div><p>na</p>');
    expect(e.getHTML()).not.toContain('data-sellqo-products');
    e.destroy();
  });
});

describe('isComplexHtml', () => {
  it('een productblok alleen maakt de mail niet complex', () => {
    expect(isComplexHtml(`<p>Hoi</p>${renderProductBlockHtml(block)}`)).toBe(false);
    expect(isComplexHtml('<table><tr><td>x</td></tr></table>')).toBe(true);
  });
});

describe('formatBlockPrice', () => {
  it('in de taal van de mail', () => {
    expect(formatBlockPrice(24.95, 'EUR', 'nl')).toMatch(/24,95/);
    expect(formatBlockPrice(24.95, 'EUR', 'en')).toMatch(/24\.95/);
    expect(formatBlockPrice(null, 'EUR', 'nl')).toBe('');
  });
});

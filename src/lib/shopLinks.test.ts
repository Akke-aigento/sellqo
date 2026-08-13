import { describe, it, expect } from 'vitest';
import { resolveShopLink } from './shopLinks';

const BASE = '/shop/demo-bakkerij';

describe('resolveShopLink', () => {
  describe('leeg', () => {
    it('geeft leeg terug bij een lege string', () => {
      expect(resolveShopLink('', BASE)).toEqual({ href: '', isExternal: false });
    });

    it('geeft leeg terug bij null en undefined', () => {
      expect(resolveShopLink(null, BASE)).toEqual({ href: '', isExternal: false });
      expect(resolveShopLink(undefined, BASE)).toEqual({ href: '', isExternal: false });
    });

    it('behandelt whitespace als leeg', () => {
      expect(resolveShopLink('   ', BASE)).toEqual({ href: '', isExternal: false });
    });
  });

  describe('externe doelen', () => {
    it('laat http en https ongemoeid en markeert ze als extern', () => {
      expect(resolveShopLink('https://voorbeeld.nl', BASE)).toEqual({
        href: 'https://voorbeeld.nl',
        isExternal: true,
      });
      expect(resolveShopLink('http://voorbeeld.nl/pad', BASE)).toEqual({
        href: 'http://voorbeeld.nl/pad',
        isExternal: true,
      });
    });

    it('behandelt mailto en tel als extern', () => {
      expect(resolveShopLink('mailto:info@voorbeeld.nl', BASE)).toEqual({
        href: 'mailto:info@voorbeeld.nl',
        isExternal: true,
      });
      expect(resolveShopLink('tel:+3212345678', BASE)).toEqual({
        href: 'tel:+3212345678',
        isExternal: true,
      });
    });

    it('behandelt protocol-relatieve URLs als extern', () => {
      expect(resolveShopLink('//cdn.voorbeeld.nl/x', BASE)).toEqual({
        href: '//cdn.voorbeeld.nl/x',
        isExternal: true,
      });
    });

    it('prefixt een externe URL nooit met het winkelpad', () => {
      // Dit was de tweede bug: react-router 6 maakt van een absolute URL
      // anders /shop/<slug>/https://voorbeeld.nl
      const { href } = resolveShopLink('https://voorbeeld.nl', BASE);
      expect(href.startsWith(BASE)).toBe(false);
    });
  });

  describe('onveilige schemes', () => {
    it('gooit javascript:, data: en vbscript: weg', () => {
      expect(resolveShopLink('javascript:alert(1)', BASE)).toEqual({
        href: '',
        isExternal: false,
      });
      expect(resolveShopLink('data:text/html,<script>', BASE)).toEqual({
        href: '',
        isExternal: false,
      });
      expect(resolveShopLink('vbscript:msgbox', BASE)).toEqual({
        href: '',
        isExternal: false,
      });
    });

    it('trapt niet in hoofdletters of spaties ervoor', () => {
      expect(resolveShopLink('  JavaScript:alert(1)', BASE).href).toBe('');
    });
  });

  describe('al opgeloste paden (idempotent)', () => {
    it('laat een pad dat al met basePath begint ongemoeid', () => {
      expect(resolveShopLink(`${BASE}/products`, BASE)).toEqual({
        href: `${BASE}/products`,
        isExternal: false,
      });
    });

    it('laat het winkelpad zelf ongemoeid', () => {
      expect(resolveShopLink(BASE, BASE)).toEqual({ href: BASE, isExternal: false });
    });

    it('is idempotent: twee keer toepassen verandert niets', () => {
      const once = resolveShopLink('/products', BASE);
      const twice = resolveShopLink(once.href, BASE);
      expect(twice.href).toBe(once.href);
    });

    it('prefixt niet dubbel bij een basePath die een prefix is van een andere slug', () => {
      // /shop/demo is een string-prefix van /shop/demo-bakkerij; zonder
      // grenscontrole zou dit ten onrechte als "al opgelost" gelden.
      expect(resolveShopLink('/shop/demo-bakkerij/products', '/shop/demo')).toEqual({
        href: '/shop/demo/shop/demo-bakkerij/products',
        isExternal: false,
      });
    });

    it('herkent basePath gevolgd door een query of fragment', () => {
      expect(resolveShopLink(`${BASE}?q=brood`, BASE).href).toBe(`${BASE}?q=brood`);
      expect(resolveShopLink(`${BASE}#top`, BASE).href).toBe(`${BASE}#top`);
    });
  });

  describe('root-relatieve paden', () => {
    it('prefixt de waarden die de sectie-editor aanbiedt', () => {
      expect(resolveShopLink('/products', BASE).href).toBe(`${BASE}/products`);
      expect(resolveShopLink('/cart', BASE).href).toBe(`${BASE}/cart`);
    });

    it('behoudt de querystring', () => {
      expect(resolveShopLink('/products?category=brood', BASE).href).toBe(
        `${BASE}/products?category=brood`
      );
    });

    it('lost / op naar het winkelpad zelf, zonder trailing slash', () => {
      expect(resolveShopLink('/', BASE).href).toBe(BASE);
    });

    it('prefixt ook een pad zonder leidende slash', () => {
      expect(resolveShopLink('products', BASE).href).toBe(`${BASE}/products`);
    });

    it('markeert een opgelost pad nooit als extern', () => {
      expect(resolveShopLink('/products', BASE).isExternal).toBe(false);
    });
  });

  describe('fragmenten en query-only', () => {
    it('laat een fragment ongemoeid', () => {
      // EditableHeroSection gebruikt '#' als fallback-waarde.
      expect(resolveShopLink('#', BASE)).toEqual({ href: '#', isExternal: false });
      expect(resolveShopLink('#contact', BASE)).toEqual({
        href: '#contact',
        isExternal: false,
      });
    });

    it('laat een query-only link ongemoeid', () => {
      expect(resolveShopLink('?filter=nieuw', BASE)).toEqual({
        href: '?filter=nieuw',
        isExternal: false,
      });
    });
  });

  describe('basePath-varianten', () => {
    it('negeert een trailing slash op basePath', () => {
      expect(resolveShopLink('/products', `${BASE}/`).href).toBe(`${BASE}/products`);
      expect(resolveShopLink('/products', `${BASE}///`).href).toBe(`${BASE}/products`);
    });

    it('herkent een al opgelost pad ook bij een trailing slash op basePath', () => {
      expect(resolveShopLink(`${BASE}/products`, `${BASE}/`).href).toBe(
        `${BASE}/products`
      );
    });

    it('laat de link ongemoeid bij een lege basePath', () => {
      expect(resolveShopLink('/products', '')).toEqual({
        href: '/products',
        isExternal: false,
      });
      expect(resolveShopLink('/products', '   ')).toEqual({
        href: '/products',
        isExternal: false,
      });
    });

    it('blijft externe links ook bij een lege basePath extern markeren', () => {
      expect(resolveShopLink('https://voorbeeld.nl', '')).toEqual({
        href: 'https://voorbeeld.nl',
        isExternal: true,
      });
    });
  });

  describe('de seed-conventies uit WEBSHOP-3', () => {
    it('laat de absolute seed-waarde werken zonder migratie', () => {
      // useTemplateSeed schreef /shop/<slug>/products via de {{shop}}-placeholder.
      expect(resolveShopLink(`${BASE}/products`, BASE).href).toBe(`${BASE}/products`);
    });

    it('lost de relatieve conventie op naar hetzelfde resultaat', () => {
      expect(resolveShopLink('/products', BASE).href).toBe(`${BASE}/products`);
    });

    it('geeft voor beide conventies hetzelfde doel', () => {
      expect(resolveShopLink('/products', BASE).href).toBe(
        resolveShopLink(`${BASE}/products`, BASE).href
      );
    });
  });
});

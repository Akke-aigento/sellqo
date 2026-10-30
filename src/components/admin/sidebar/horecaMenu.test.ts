// TRACKS-2 — het menu per zaaktype. Vastgelegd zodat een nieuwe tag nooit stil een spoor verandert:
// een horecazaak ziet geen webshop-, marketing- of eventonderdelen, en een webshop ziet geen horecaonderdelen.
import { describe, expect, it } from 'vitest';
import { bottomNavUrl } from './bottomNav';
import { visibleNavIds } from './sidebarConfig';

const KERN = ['dashboard', 'settings', 'help', 'billing'];

describe('menu per spoor', () => {
  it('horeca zonder webshop: kassa, zaal, kaart, bestellingen, beheer; geen webshop, marketing of events', () => {
    const ids = visibleNavIds(['horeca']);
    for (const id of [...KERN, 'pos', 'ordering', 'kitchen', 'orders', 'horeca-menu', 'purchasing', 'payments', 'reports']) expect(ids).toContain(id);
    for (const id of ['products', 'storefront', 'inbox', 'promotions', 'campaigns', 'media', 'seo', 'social-planner', 'ads', 'shipping', 'integrations', 'translations', 'customers', 'event-dashboard', 'promo-codes', 'reports-analytics']) expect(ids).not.toContain(id);
    expect(ids).toContain('horeca-menu');
  });

  it('webshop: alles van de webshop blijft zichtbaar, horeca-onderdelen niet', () => {
    const ids = visibleNavIds(['webshop']);
    for (const id of [...KERN, 'storefront', 'inbox', 'products', 'orders-fulfillment', 'promotions', 'customers', 'shipping', 'payments', 'reports-analytics']) expect(ids).toContain(id);
    for (const id of ['ordering', 'kitchen', 'event-dashboard']) expect(ids).not.toContain(id);
  });

  it('events: ticketing en marketing, geen webshopbouwer en geen horeca', () => {
    const ids = visibleNavIds(['events']);
    for (const id of ['event-dashboard', 'customers', 'inbox', 'campaigns', 'payments']) expect(ids).toContain(id);
    for (const id of ['storefront', 'ordering', 'kitchen', 'pos', 'products', 'shipping']) expect(ids).not.toContain(id);
  });

  it('combinatie horeca + webshop: beide delen, elk item één keer', () => {
    const ids = visibleNavIds(['horeca', 'webshop']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['pos', 'ordering', 'storefront', 'products', 'promotions']) expect(ids).toContain(id);
  });

  it('horeca zonder webshop: de Kassa opent /kassa, niet het kassabeheer', () => {
    const c = { horeca: true, webshop: false, events: false };
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, c)).toBe('/kassa');
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, { ...c, webshop: true })).toBe('/admin/pos');
  });
});

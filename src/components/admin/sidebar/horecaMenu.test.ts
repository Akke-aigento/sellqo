// TRACKS-2/3 — het menu per zaaktype. Vastgelegd zodat een nieuwe tag nooit stil een spoor verandert.
// Zijbalk = wat de zaak dagelijks nodig heeft; de rest blijft bereikbaar via Instellingen › Meer onderdelen.
import { describe, expect, it } from 'vitest';
import type { Track } from '@/lib/tracks';
import { bottomNavUrl } from './bottomNav';
import { moreNavItems, visibleNavIds } from './sidebarConfig';

const KERN = ['dashboard', 'settings', 'help', 'billing'];
const more = (tracks: Track[]) => moreNavItems((t) => tracks.includes(t)).map((i) => i.id);

describe('menu per spoor', () => {
  it('horeca: Vandaag, Kassa, Zaal, Kaart, Bestellingen, Betalingen, Rapporten — niets meer', () => {
    const ids = visibleNavIds(['horeca']);
    expect(ids).toEqual(['dashboard', 'orders', 'orders-all', 'pos', 'ordering', 'horeca-menu', 'payments', 'reports', 'reports-overview', 'billing', 'settings', 'help']);
  });

  it('horeca: Keuken, Inkoop, Facturen en Voorraad blijven bereikbaar via Meer onderdelen', () => {
    expect(more(['horeca'])).toEqual(expect.arrayContaining(['kitchen', 'purchasing', 'orders-invoices', 'reports-stock']));
  });

  it('events: evenementen, inbox, bestellingen, kortingen, e-mail, betalingen, rapporten — de rest via Meer onderdelen', () => {
    const ids = visibleNavIds(['events']);
    for (const id of [...KERN, 'event-dashboard', 'ticket-checkin', 'inbox', 'orders', 'promotions', 'campaigns', 'payments', 'reports']) expect(ids).toContain(id);
    for (const id of ['customers', 'social-planner', 'media', 'seo', 'translations', 'integrations', 'reports-analytics', 'storefront', 'pos', 'ordering']) expect(ids).not.toContain(id);
    expect(more(['events'])).toEqual(expect.arrayContaining(['customers', 'social-planner', 'media', 'seo', 'translations', 'integrations', 'reports-analytics']));
  });

  it('webshop: zelfde zijbalk als voorheen, niets onder Meer onderdelen', () => {
    const ids = visibleNavIds(['webshop']);
    for (const id of [...KERN, 'storefront', 'inbox', 'products', 'orders-fulfillment', 'orders-invoices', 'promotions', 'customers', 'shipping', 'payments', 'social-planner', 'media', 'seo', 'translations', 'purchasing', 'reports-analytics', 'reports-stock', 'integrations']) expect(ids).toContain(id);
    for (const id of ['ordering', 'kitchen', 'event-dashboard']) expect(ids).not.toContain(id);
    expect(more(['webshop'])).toEqual([]);
  });

  it('combinatie horeca + webshop: beide delen, elk item één keer', () => {
    const ids = visibleNavIds(['horeca', 'webshop']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['pos', 'ordering', 'storefront', 'products', 'promotions', 'purchasing']) expect(ids).toContain(id);
  });

  it('horeca zonder webshop: de Kassa opent /kassa, niet het kassabeheer', () => {
    const c = { horeca: true, webshop: false, events: false };
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, c)).toBe('/kassa');
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, { ...c, webshop: true })).toBe('/admin/pos');
  });
});

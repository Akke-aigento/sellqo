// TRACKS-2/3 — het menu per zaaktype. Vastgelegd zodat een nieuwe tag nooit stil een spoor verandert.
// Zijbalk = wat de zaak dagelijks nodig heeft; de rest blijft bereikbaar via Instellingen › Meer onderdelen.
import { describe, expect, it } from 'vitest';
import type { Track } from '@/lib/tracks';
import { bottomNavUrl, sidebarLabelKey } from './bottomNav';
import { inSidebar, moreNavItems, sidebarGroups, sidebarLayout, visibleNavIds } from './sidebarConfig';

const KERN = ['dashboard', 'settings', 'help', 'billing'];
const more = (tracks: Track[]) => moreNavItems((t) => tracks.includes(t)).map((i) => i.id);

describe('menu per spoor', () => {
  // HORECA-ZIJBALK-1 (Akke, 1 nov): Vandaag, Kassa-app, Zaal, Keuken, Bestellingen, Kaart, Betalingen,
  // Rapporten, Inkoop, Instellingen, Help — in die volgorde.
  it('horeca: de afgesproken lijst, in die volgorde — niets meer', () => {
    const ids = visibleNavIds(['horeca']);
    expect(ids).toEqual(['dashboard', 'pos', 'ordering', 'kitchen', 'orders', 'orders-all', 'horeca-menu', 'payments', 'reports', 'reports-overview', 'purchasing', 'settings', 'help']);
  });

  it('horeca: de korte lijst laat geen zichtbaar item vallen (zelfde set als de gewone groepen)', () => {
    const has = (t: Track) => t === 'horeca';
    const flat = sidebarGroups.flatMap((g) => g.items).filter((i) => inSidebar(i, has)).map((i) => i.id).sort();
    const layout = sidebarLayout(has).flatMap((g) => g.items).filter((i) => inSidebar(i, has)).map((i) => i.id).sort();
    expect(layout).toEqual(flat);
  });

  it('horeca: SellQo-plan, Facturen en Voorraad blijven bereikbaar via Meer onderdelen', () => {
    expect(more(['horeca'])).toEqual(expect.arrayContaining(['billing', 'orders-invoices', 'reports-stock']));
    expect(more(['horeca'])).not.toContain('kitchen');
    expect(more(['horeca'])).not.toContain('purchasing');
  });

  it('labels: Vandaag bij horeca, Kassa-app zonder webshop', () => {
    const only = { horeca: true, webshop: false, events: false };
    expect(sidebarLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, only)).toBe('navigation.bottom.today');
    expect(sidebarLabelKey({ id: 'pos', titleKey: 'navigation.items.pos' }, only)).toBe('navigation.items.pos_app');
    expect(sidebarLabelKey({ id: 'pos', titleKey: 'navigation.items.pos' }, { ...only, webshop: true })).toBe('navigation.items.pos');
    expect(sidebarLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, { horeca: false, webshop: true, events: false })).toBe('navigation.dashboard');
  });

  it('combinatie: horeca-items samen in een groep Horeca na Dagelijks', () => {
    const groups = sidebarLayout((t) => t === 'horeca' || t === 'webshop');
    expect(groups.map((g) => g.id)).toEqual(['daily', 'horeca', 'sales', 'marketing', 'management', 'system']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['pos', 'ordering', 'kitchen', 'horeca-menu']);
    expect(sidebarLayout((t) => t === 'webshop')).toBe(sidebarGroups);
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
    for (const id of ['pos', 'ordering', 'kitchen', 'horeca-menu', 'storefront', 'products', 'promotions', 'purchasing', 'billing']) expect(ids).toContain(id);
  });

  it('horeca zonder webshop: de Kassa opent /kassa, niet het kassabeheer', () => {
    const c = { horeca: true, webshop: false, events: false };
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, c)).toBe('/kassa');
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, { ...c, webshop: true })).toBe('/admin/pos');
  });
});

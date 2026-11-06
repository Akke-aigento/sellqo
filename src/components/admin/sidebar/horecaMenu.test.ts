// TRACKS-2/3 — het menu per zaaktype. Vastgelegd zodat een nieuwe tag nooit stil een spoor verandert.
// Zijbalk = wat de zaak dagelijks nodig heeft; de rest blijft bereikbaar via Instellingen › Meer onderdelen.
import { describe, expect, it } from 'vitest';
import type { Track } from '@/lib/tracks';
import { bottomNavUrl, sidebarLabelKey } from './bottomNav';
import { findNavItems, findTrackRule, inSidebar, moreNavItems, sidebarGroups, sidebarLayout, visibleNavIds } from './sidebarConfig';
import { onlineOrdersOn, showOrdersInHorecaSidebar } from '@/lib/horeca/onlineOrders';

const KERN = ['dashboard', 'settings', 'help', 'billing'];
const more = (tracks: Track[]) => moreNavItems((t) => tracks.includes(t)).map((i) => i.id);

describe('menu per spoor', () => {
  // HORECA-ZIJBALK-1 (Akke, 1 nov): Vandaag, Kassa-app, Zaal, Keuken, Bestellingen, Kaart, Betalingen,
  // Rapporten, Inkoop, Instellingen, Help — in die volgorde.
  // WEBSITE-HORECA-1 (Akke, 4 nov): "Website" ('storefront') erbij, na de Kaart.
  // HORECA-INSTELLINGEN-1 (Akke, 4 nov): Reservaties in Dagelijks, Personeel na de Kaart, Betalingen als
  // "Transacties" onder Rapporten, Instellingen heet "Mijn zaak".
  it('horeca: de afgesproken lijst, in die volgorde — niets meer', () => {
    const ids = visibleNavIds(['horeca']);
    expect(ids).toEqual(['dashboard', 'pos', 'ordering', 'kitchen', 'orders', 'orders-all', 'reservations', 'horeca-menu', 'staff', 'storefront', 'reports', 'reports-overview', 'payments', 'purchasing', 'settings', 'help']);
    const groups = sidebarLayout((t) => t === 'horeca');
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ['dashboard', 'pos', 'ordering', 'kitchen', 'orders', 'reservations'],
      ['horeca-menu', 'staff', 'storefront', 'reports', 'purchasing'],
      ['settings', 'help'],
    ]);
  });

  it('horeca: de korte lijst laat geen zichtbaar item vallen (Betalingen staat als kind onder Rapporten)', () => {
    const has = (t: Track) => t === 'horeca';
    const flat = sidebarGroups.flatMap((g) => g.items).filter((i) => inSidebar(i, has)).map((i) => i.id).sort();
    const layout = sidebarLayout(has).flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])])).filter((i) => inSidebar(i, has)).map((i) => i.id);
    for (const id of flat) expect(layout).toContain(id);
  });

  it('horeca-only-items (Reservaties, Personeel) staan in geen andere zijbalk, maar hun pagina is horeca', () => {
    for (const tracks of [['webshop'], ['events'], ['horeca', 'webshop'], ['horeca', 'events']] as Track[][]) {
      const ids = visibleNavIds(tracks);
      expect(ids).not.toContain('reservations');
      expect(ids).not.toContain('staff');
    }
    expect(findTrackRule('/admin/personeel')?.tracks).toEqual(['horeca']);
    expect(findTrackRule('/admin/reservaties')?.tracks).toEqual(['horeca']);
    expect(findNavItems(['reservations', 'staff']).every((i) => i.horecaOnly)).toBe(true);
    expect(more(['horeca'])).not.toContain('payments');
  });

  it('labels horeca-only: Mijn zaak en Transacties; elders ongewijzigd', () => {
    const only = { horeca: true, webshop: false, events: false };
    expect(sidebarLabelKey({ id: 'settings', titleKey: 'navigation.settings' }, only)).toBe('navigation.items.my_business');
    expect(sidebarLabelKey({ id: 'payments', titleKey: 'navigation.items.payments' }, only)).toBe('navigation.items.transactions');
    for (const c of [{ ...only, webshop: true }, { ...only, events: true }, { horeca: false, webshop: true, events: false }]) {
      expect(sidebarLabelKey({ id: 'settings', titleKey: 'navigation.settings' }, c)).toBe('navigation.settings');
      expect(sidebarLabelKey({ id: 'payments', titleKey: 'navigation.items.payments' }, c)).toBe('navigation.items.payments');
    }
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
    // WEBSITE-HORECA-1: Website zonder webshop, Webshop met.
    expect(sidebarLabelKey({ id: 'storefront', titleKey: 'navigation.items.storefront' }, only)).toBe('navigation.items.website');
    expect(sidebarLabelKey({ id: 'storefront', titleKey: 'navigation.items.storefront' }, { ...only, webshop: true })).toBe('navigation.items.storefront');
    expect(sidebarLabelKey({ id: 'storefront', titleKey: 'navigation.items.storefront' }, { horeca: false, webshop: false, events: true })).toBe('navigation.items.storefront');
  });

  it('horeca: Website staat in de zijbalk, niet onder Meer onderdelen; events ziet hem niet', () => {
    expect(visibleNavIds(['horeca'])).toContain('storefront');
    expect(more(['horeca'])).not.toContain('storefront');
    expect(visibleNavIds(['events'])).not.toContain('storefront');
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
  // ZIJBALK-BESTELLINGEN-1 (Akke, 6 nov): Bestellingen in de horeca-only-zijbalk enkel met online afhalen/leveren
  // (of als er al bestellingen zijn). Tafel-QR gaat naar de tafelrekening, niet naar orders.
  it('horeca-only zonder online bestellen: geen Bestellingen in Dagelijks; de rest ongewijzigd', () => {
    const only = (t: Track) => t === 'horeca';
    const ids = (hideOrders?: boolean) => sidebarLayout(only, hideOrders === undefined ? undefined : { hideOrders }).map((g) => g.items.map((i) => i.id));
    expect(ids(true)).toEqual([
      ['dashboard', 'pos', 'ordering', 'kitchen', 'reservations'],
      ['horeca-menu', 'staff', 'storefront', 'reports', 'purchasing'],
      ['settings', 'help'],
    ]);
    expect(ids(false)[0]).toContain('orders');
    expect(ids()[0]).toContain('orders');
    // De route blijft gewoon een menu-item (TrackGate, actieve markering): enkel de zijbalk laat hem weg.
    expect(findTrackRule('/admin/orders')?.item.id).toBe('orders');
  });

  it('gemengde zaken en webshop: Bestellingen altijd, ook met hideOrders', () => {
    for (const tracks of [['horeca', 'webshop'], ['horeca', 'events'], ['webshop'], ['events']] as Track[][]) {
      const groups = sidebarLayout((t) => tracks.includes(t), { hideOrders: true });
      expect(groups.flatMap((g) => g.items.map((i) => i.id)), tracks.join('+')).toContain('orders');
    }
  });

  it('online bestellen: zelfde regels als ordering_state.online van de storefront-api', () => {
    const base = { customFrontend: false, shopLive: true, shopOrdering: true, methods: ['pickup'] };
    expect(onlineOrdersOn(base)).toBe(true);
    expect(onlineOrdersOn({ ...base, methods: ['local_delivery'] })).toBe(true);
    expect(onlineOrdersOn({ ...base, methods: [] })).toBe(false);
    expect(onlineOrdersOn({ ...base, shopLive: false })).toBe(false);
    expect(onlineOrdersOn({ ...base, shopOrdering: false })).toBe(false);
    // Geen tenant_theme_settings-rij: geen beperking (zoals de storefront-api); eigen frontend negeert de schakelaars.
    expect(onlineOrdersOn({ ...base, shopLive: null, shopOrdering: null })).toBe(true);
    expect(onlineOrdersOn({ ...base, customFrontend: true, shopLive: false, shopOrdering: false })).toBe(true);
  });

  it('bestaande bestellingen houden Bestellingen in beeld, ook als online bestellen uit staat', () => {
    const off = { shopLive: true, shopOrdering: false, methods: ['pickup'] };
    expect(showOrdersInHorecaSidebar({ ...off, hasOrders: false })).toBe(false);
    expect(showOrdersInHorecaSidebar({ ...off, hasOrders: true })).toBe(true);
    expect(showOrdersInHorecaSidebar({ shopLive: true, shopOrdering: true, methods: ['pickup'], hasOrders: false })).toBe(true);
  });
});

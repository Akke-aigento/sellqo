// ONDERBALK-1 — regels van de gsm-onderbalk.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOTTOM_NAV_MAX, bottomNavLabelKey, bottomNavUrl, defaultBottomNavIds, resolveBottomNavIds } from './bottomNav';
import { navParentOf } from './sidebarConfig';

const horecaOnly = { horeca: true, webshop: false, events: false };
const mixed = { horeca: true, webshop: true, events: false };
const shop = { horeca: false, webshop: true, events: false };
const all = () => true;

describe('onderbalk', () => {
  it('standaard per spoor', () => {
    expect(defaultBottomNavIds(horecaOnly)).toEqual(['dashboard', 'pos', 'kitchen', 'horeca-menu']);
    expect(defaultBottomNavIds(mixed)).toEqual(['dashboard', 'orders', 'kitchen', 'horeca-menu']);
    expect(defaultBottomNavIds(shop)).toEqual(['dashboard', 'orders', 'products', 'inbox']);
  });

  it('eigen keuze: volgorde blijft, dubbels en niet-toegelaten items vallen weg, hoogstens 5', () => {
    expect(resolveBottomNavIds(['kitchen', 'pos', 'kitchen', 'x'], (id) => id !== 'x', horecaOnly)).toEqual(['kitchen', 'pos']);
    expect(resolveBottomNavIds(['a', 'b', 'c', 'd', 'e', 'f'], all, shop)).toHaveLength(BOTTOM_NAV_MAX);
  });

  it('te weinig over (rechten of pakket veranderd) of niets gekozen: de standaard, zonder verboden items', () => {
    expect(resolveBottomNavIds(['kitchen'], all, horecaOnly)).toEqual(defaultBottomNavIds(horecaOnly));
    expect(resolveBottomNavIds(null, (id) => id !== 'pos', horecaOnly)).toEqual(['dashboard', 'kitchen', 'horeca-menu']);
  });

  it('kassa opent de kassa-app enkel bij horeca zonder webshop; korte labels', () => {
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, horecaOnly)).toBe('/kassa');
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, mixed)).toBe('/admin/pos');
    expect(bottomNavLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, horecaOnly)).toBe('navigation.bottom.today');
    expect(bottomNavLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, shop)).toBe('navigation.dashboard');
    expect(bottomNavLabelKey({ id: 'pos', titleKey: 'navigation.items.pos' }, shop)).toBe('navigation.bottom.kassa');
    // HORECA-ZIJBALK-1: 'ordering' is de Zaal, 'horeca-menu' de Kaart.
    expect(bottomNavLabelKey({ id: 'ordering', titleKey: 'navigation.items.floor' }, horecaOnly)).toBe('navigation.bottom.floor');
    expect(bottomNavLabelKey({ id: 'horeca-menu', titleKey: 'admin.orderingHub.tab_menu' }, horecaOnly)).toBe('navigation.bottom.menu');
  });

  // HORECA-INSTELLINGEN-1: zelfde namen als de zijbalk; de standaardbalk blijft Vandaag · Kassa · Keuken · Kaart.
  it('horeca-only: Mijn zaak en Transacties; standaard ongewijzigd', () => {
    expect(bottomNavLabelKey({ id: 'settings', titleKey: 'navigation.settings' }, horecaOnly)).toBe('navigation.items.my_business');
    expect(bottomNavLabelKey({ id: 'payments', titleKey: 'navigation.items.payments' }, horecaOnly)).toBe('navigation.items.transactions');
    expect(bottomNavLabelKey({ id: 'settings', titleKey: 'navigation.settings' }, mixed)).toBe('navigation.settings');
    expect(defaultBottomNavIds(horecaOnly)).toEqual(['dashboard', 'pos', 'kitchen', 'horeca-menu']);
  });
  // ZIJBALK-BESTELLINGEN-1: de horeca-only-standaard had al geen Bestellingen (Vandaag · Kassa · Keuken · Kaart),
  // dus de zijbalkregel verandert de balk niet; gemengde zaken houden Bestellingen.
  it('Bestellingen: niet in de horeca-only-standaard, wel bij gemengd en webshop', () => {
    expect(defaultBottomNavIds(horecaOnly)).not.toContain('orders');
    expect(defaultBottomNavIds(mixed)).toContain('orders');
    expect(defaultBottomNavIds({ horeca: true, webshop: false, events: true })).toContain('orders');
    expect(defaultBottomNavIds(shop)).toContain('orders');
  });
});

// FIXES-0711 — een kind erft de grenzen van zijn parent, ook in de onderbalk; de zijbalk-personalisatie is weg.
describe('FIXES-0711 — onderbalk = zelfde grenzen als de zijbalk', () => {
  it('navParentOf: kind → parent, eerste niveau → null', () => {
    expect(navParentOf('categories')?.id).toBe('products');
    expect(navParentOf('ads-bolcom')?.id).toBe('ads');
    expect(navParentOf('products')).toBeNull();
    expect(navParentOf('bestaat-niet')).toBeNull();
  });

  it('isItemBlocked kijkt ook naar de parent; geen persoonlijke zijbalk-voorkeuren meer', () => {
    const src = readFileSync('src/components/admin/sidebar/useNavItemVisibility.ts', 'utf8');
    expect(src).toContain('navParentOf(item.id)');
    expect(src).not.toContain('isItemHidden');
    expect(existsSync('src/components/admin/SidebarCustomizeDialog.tsx')).toBe(false);
    expect(readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8')).not.toContain('sidebar.customize');
  });
});

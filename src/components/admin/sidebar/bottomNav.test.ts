// ONDERBALK-1 — regels van de gsm-onderbalk.
import { describe, expect, it } from 'vitest';
import { BOTTOM_NAV_MAX, bottomNavLabelKey, bottomNavUrl, defaultBottomNavIds, resolveBottomNavIds } from './bottomNav';

const horecaOnly = { horeca: true, webshop: false, events: false };
const mixed = { horeca: true, webshop: true, events: false };
const shop = { horeca: false, webshop: true, events: false };
const all = () => true;

describe('onderbalk', () => {
  it('standaard per spoor', () => {
    expect(defaultBottomNavIds(horecaOnly)).toEqual(['dashboard', 'pos', 'kitchen', 'ordering']);
    expect(defaultBottomNavIds(mixed)).toEqual(['dashboard', 'orders', 'kitchen', 'ordering']);
    expect(defaultBottomNavIds(shop)).toEqual(['dashboard', 'orders', 'products', 'inbox']);
  });

  it('eigen keuze: volgorde blijft, dubbels en niet-toegelaten items vallen weg, hoogstens 5', () => {
    expect(resolveBottomNavIds(['kitchen', 'pos', 'kitchen', 'x'], (id) => id !== 'x', horecaOnly)).toEqual(['kitchen', 'pos']);
    expect(resolveBottomNavIds(['a', 'b', 'c', 'd', 'e', 'f'], all, shop)).toHaveLength(BOTTOM_NAV_MAX);
  });

  it('te weinig over (rechten of pakket veranderd) of niets gekozen: de standaard, zonder verboden items', () => {
    expect(resolveBottomNavIds(['kitchen'], all, horecaOnly)).toEqual(defaultBottomNavIds(horecaOnly));
    expect(resolveBottomNavIds(null, (id) => id !== 'pos', horecaOnly)).toEqual(['dashboard', 'kitchen', 'ordering']);
  });

  it('kassa opent de kassa-app enkel bij horeca zonder webshop; korte labels', () => {
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, horecaOnly)).toBe('/kassa');
    expect(bottomNavUrl({ id: 'pos', url: '/admin/pos' }, mixed)).toBe('/admin/pos');
    expect(bottomNavLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, horecaOnly)).toBe('navigation.bottom.today');
    expect(bottomNavLabelKey({ id: 'dashboard', titleKey: 'navigation.dashboard' }, shop)).toBe('navigation.dashboard');
    expect(bottomNavLabelKey({ id: 'pos', titleKey: 'navigation.items.pos' }, shop)).toBe('navigation.bottom.kassa');
  });
});

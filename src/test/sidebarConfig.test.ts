import { describe, expect, it } from 'vitest';
import {
  sidebarGroups,
  platformGroup,
  MARKETING_ALLOWED_ITEMS,
  WAREHOUSE_ALLOWED_ITEMS,
  getAllMenuItems,
  type NavItem,
} from '@/components/admin/sidebar/sidebarConfig';

// SIDEBAR-CLEAN-1 — bewaakt dat de zijbalk niet opnieuw dichtslibt met dubbels.
const groups = [...sidebarGroups, platformGroup];
const all: NavItem[] = groups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));

describe('sidebarConfig', () => {
  it('heeft unieke ids', () => {
    const ids = all.map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('herhaalt de parent-URL in een kind alleen als landingskind', () => {
    for (const g of groups) {
      for (const item of g.items) {
        for (const child of item.children ?? []) {
          if (child.url === item.url) expect(child.landing, `${child.id} dupliceert ${item.id}`).toBe(true);
        }
      }
    }
  });

  it('heeft geen parent met alleen een landingskind', () => {
    for (const g of groups) {
      for (const item of g.items) {
        if (!item.children) continue;
        expect(item.children.some((c) => !c.landing), `${item.id} heeft geen echt submenu`).toBe(true);
      }
    }
  });

  it('heeft hooguit één item per URL buiten landingskinderen', () => {
    const byUrl = new Map<string, string[]>();
    for (const g of groups) {
      for (const item of g.items) {
        const entries = [item, ...(item.children ?? []).filter((c) => !c.landing)];
        for (const e of entries) byUrl.set(e.url, [...(byUrl.get(e.url) ?? []), e.id]);
      }
    }
    const dupes = [...byUrl].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it('kent alle ids uit de rol-whitelists', () => {
    const ids = new Set(all.map((i) => i.id));
    for (const id of [...MARKETING_ALLOWED_ITEMS, ...WAREHOUSE_ALLOWED_ITEMS]) expect(ids.has(id), id).toBe(true);
  });

  it('behoudt de ids waarnaar tenant_feature_overrides.hidden_pages live verwijst', () => {
    const ids = new Set(all.map((i) => i.id));
    for (const id of ['purchasing', 'integrations', 'storefront']) expect(ids.has(id), id).toBe(true);
  });

  it('toont geen landingskinderen in het personaliseer-menu', () => {
    const listed = new Set(getAllMenuItems().map((i) => i.id));
    for (const item of all.filter((i) => i.landing)) expect(listed.has(item.id)).toBe(false);
  });
});

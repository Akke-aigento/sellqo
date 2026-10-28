import { describe, expect, it } from 'vitest';
import { tenantTracks, tracksAllow, type Track } from '@/lib/tracks';
import { findTrackRule, sidebarGroups } from '@/components/admin/sidebar/sidebarConfig';

// TRACKS-1 — sporen: plan + add-ons + ontgrendeld, en één regelset voor menu en pagina's.
describe('tenantTracks', () => {
  it('valt terug op webshop zonder plan', () => {
    expect(tenantTracks({})).toEqual(['webshop']);
  });
  it('neemt het spoor van het plan', () => {
    expect(tenantTracks({ planTrack: 'events' })).toEqual(['events']);
  });
  it('telt add-ons en ontgrendelde modules mee, zonder onzin', () => {
    expect(tenantTracks({ planTrack: 'horeca', addons: ['webshop', 'x'], granted: ['events', null] })).toEqual(['webshop', 'horeca', 'events']);
  });
});

describe('tracksAllow', () => {
  const only = (t: Track) => (x: Track) => x === t;
  it('kern-items (geen sporen) mag iedereen zien', () => {
    expect(tracksAllow(undefined, only('events'))).toBe(true);
  });
  it('een item mag als één van zijn sporen aan staat', () => {
    expect(tracksAllow(['webshop', 'horeca'], only('horeca'))).toBe(true);
    expect(tracksAllow(['webshop', 'horeca'], only('events'))).toBe(false);
  });
});

describe('findTrackRule', () => {
  const tracksFor = (p: string) => findTrackRule(p)?.tracks ?? null;
  it('bewaakt horeca- en eventpagina’s, ook diepere routes', () => {
    expect(tracksFor('/admin/keuken')).toEqual(['horeca']);
    expect(tracksFor('/admin/events/venues')).toEqual(['events']);
    expect(tracksFor('/admin/events/abc-123')).toEqual(['events']);
  });
  it('laat kernpagina’s vrij', () => {
    expect(tracksFor('/admin')).toEqual([]);
    expect(tracksFor('/admin/orders/123')).toEqual([]);
    expect(tracksFor('/admin/payments')).toEqual([]);
  });
  it('bewaakt webshoponderdelen onder kern-parents', () => {
    expect(tracksFor('/admin/returns')).toEqual(['webshop']);
    expect(tracksFor('/admin/promotions/bundles')).toEqual(['webshop']);
    expect(tracksFor('/admin/shipping')).toEqual(['webshop']);
  });
  it('laat kinderen het spoor van de parent erven', () => {
    expect(tracksFor('/admin/categories')).toEqual(['webshop', 'horeca']);
  });
  it('bewaakt Producten alleen op de lijst (eventwinkels bewerken combitickets/munten)', () => {
    expect(tracksFor('/admin/products')).toEqual(['webshop', 'horeca']);
    expect(tracksFor('/admin/products/abc/edit')).toEqual([]);
  });
  it('raakt platformroutes niet', () => {
    expect(findTrackRule('/admin/platform/blog')).toBeNull();
  });
  it('gebruikt alleen geldige sporen in de config', () => {
    const valid = new Set(['webshop', 'horeca', 'events']);
    for (const g of sidebarGroups) for (const i of g.items) for (const x of [i, ...(i.children ?? [])]) {
      for (const t of x.tracks ?? []) expect(valid.has(t), `${x.id}:${t}`).toBe(true);
    }
  });
});

// WERKPLEK-1 — een horecawinkel zonder add-ons ziet een korte, afgebakende zijbalk.
describe('werkplek per spoor', () => {
  const tracksFor = (p: string) => findTrackRule(p)?.tracks ?? null;
  const visibleTop = (has: (t: Track) => boolean) =>
    sidebarGroups.flatMap((g) => g.items).filter((i) => tracksAllow(i.tracks, has)).map((i) => i.id);

  it('horeca-only: geen webshop-, marketing- of klantenpagina’s', () => {
    expect(visibleTop((t) => t === 'horeca')).toEqual([
      'dashboard', 'orders', 'products', 'pos', 'ordering', 'kitchen', 'storefront', 'payments',
      'purchasing', 'reports', 'billing', 'settings', 'help',
    ]);
  });
  it('marketing, klanten en kortingen komen terug met een webshop- of eventspoor', () => {
    for (const t of ['webshop', 'events'] as const) {
      const ids = visibleTop((x) => x === t);
      for (const id of ['inbox', 'customers', 'promotions', 'campaigns', 'media', 'translations', 'integrations']) {
        expect(ids, `${t}:${id}`).toContain(id);
      }
    }
  });
  it('bewaakt de pagina’s die horeca-only niet ziet', () => {
    expect(tracksFor('/admin/customers/abc')).toEqual(['webshop', 'events']);
    expect(tracksFor('/admin/messages')).toEqual(['webshop', 'events']);
    expect(tracksFor('/admin/marketing/media')).toEqual(['webshop', 'events']);
    expect(tracksFor('/admin/connect')).toEqual(['webshop', 'events']);
  });
});

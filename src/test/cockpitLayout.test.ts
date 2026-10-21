import { describe, expect, it } from 'vitest';
import { availableCards, COCKPIT_LAYOUT_TYPE, moveCard, resolveLayout } from '@/components/admin/cockpit/cockpitLayout';
import { mergeFeed, type FeedItem } from '@/hooks/useCockpitFeed';
import { rankTopProducts } from '@/hooks/useCockpitSignals';

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe('DASH-2b cockpitkaarten per spoor', () => {
  it('webshop: geen event-, keuken- of horecakaarten', () => {
    const got = ids(availableCards(['webshop']));
    expect(got).not.toContain('event');
    expect(got).not.toContain('kitchen');
    expect(got).not.toContain('rush');
    expect(got).toContain('today');
  });

  it('events-winkel krijgt de eventhero (met de scanknop) bovenaan', () => {
    expect(ids(availableCards(['events']))[0]).toBe('event');
  });

  it('horeca krijgt keuken, drukte, menu en leveringen', () => {
    const got = ids(availableCards(['horeca']));
    for (const id of ['kitchen', 'rush', 'menu', 'deliveries']) expect(got).toContain(id);
  });
});

describe('DASH-2b persoonlijke volgorde', () => {
  it('negeert rijen van het oude dashboard', () => {
    const l = resolveLayout(['webshop'], { layout_type: 'default', widget_order: ['badges', 'top'], hidden_widgets: ['today'] });
    expect(ids(l.order)[0]).toBe('today');
    expect(l.hidden.size).toBe(0);
  });

  it('volgt de bewaarde volgorde en verbergt', () => {
    const l = resolveLayout(['webshop'], {
      layout_type: COCKPIT_LAYOUT_TYPE,
      widget_order: ['feed', 'today', 'goal', 'todo', 'channels', 'top'],
      hidden_widgets: ['channels'],
    });
    expect(ids(l.order).slice(0, 2)).toEqual(['feed', 'today']);
    expect(l.hidden.has('channels')).toBe(true);
  });

  it('een kaart die er later bijkomt, staat op zijn standaardplek', () => {
    // Bewaard als webshopwinkel; daarna events-add-on erbij.
    const l = resolveLayout(['webshop', 'events'], {
      layout_type: COCKPIT_LAYOUT_TYPE,
      widget_order: ['today', 'goal', 'todo', 'channels', 'feed', 'top'],
      hidden_widgets: [],
    });
    expect(ids(l.order)[0]).toBe('event');
  });

  it('op en neer schuiven, niet voorbij de rand', () => {
    expect(moveCard(['a', 'b', 'c'] as never, 'b' as never, -1)).toEqual(['b', 'a', 'c']);
    expect(moveCard(['a', 'b'] as never, 'a' as never, -1)).toEqual(['a', 'b']);
  });
});

describe('DASH-2b live-feed en toppers', () => {
  const item = (id: string, at: string): FeedItem => ({
    id, kind: 'order', at, name: null, amount: null, channel: null, ref: null, rating: null, href: null,
  });

  it('nieuwste eerst, afgekapt', () => {
    const got = mergeFeed([[item('a', '2026-10-21T08:00:00Z')], [item('b', '2026-10-21T09:00:00Z'), item('c', '2026-10-20T09:00:00Z')]], 2);
    expect(got.map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('toppers tellen orders en kassa samen, geannuleerde en onbetaalde orders niet', () => {
    const got = rankTopProducts(
      [
        { status: 'processing', payment_status: 'paid', order_items: [{ product_id: 'p1', product_name: 'Margherita', product_image: null, quantity: 2, total_price: 20 }] },
        { status: 'cancelled', payment_status: 'paid', order_items: [{ product_id: 'p2', product_name: 'Diavola', product_image: null, quantity: 9, total_price: 90 }] },
        { status: 'pending', payment_status: 'pending', order_items: [{ product_id: 'p2', product_name: 'Diavola', product_image: null, quantity: 9, total_price: 90 }] },
      ],
      [{ items: [{ product_id: 'p1', name: 'Margherita', quantity: 1, total: 10, image_url: 'x.jpg' }, { product_id: 'p3', name: 'Cola', quantity: 1, total: 3 }] }],
    );
    expect(got.map((g) => [g.productId, g.quantity])).toEqual([['p1', 3], ['p3', 1]]);
    expect(got[0].revenue).toBe(30);
    expect(got[0].image).toBe('x.jpg');
  });
});

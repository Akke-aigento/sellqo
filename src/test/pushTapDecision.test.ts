import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
const { decidePushTap, pushTapTarget } = await import('@/native/pushTaps');

// NOTIF-DEEPLINK-1: bij een koude start kwam het tap-event binnen vóór de
// winkels geladen waren → "onbekende winkel" → dashboard. Nu wacht de app.

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDER = '11111111-1111-4111-8111-111111111111';
const target = { path: `/admin/orders/${ORDER}`, tenantId: B };

describe('decidePushTap', () => {
  it('koude start: winkels laden nog → wachten (niet het dashboard)', () => {
    expect(decidePushTap(target, { tenantsLoading: true, currentTenantId: null, tenantIds: [] })).toEqual({ kind: 'wait' });
  });
  it('koude start, daarna geladen en al de juiste winkel → navigeren', () => {
    expect(decidePushTap(target, { tenantsLoading: false, currentTenantId: B, tenantIds: [A, B] }))
      .toEqual({ kind: 'navigate', path: target.path });
  });
  it('andere winkel met toegang → wisselen, met de bestemming', () => {
    expect(decidePushTap(target, { tenantsLoading: false, currentTenantId: A, tenantIds: [A, B] }))
      .toEqual({ kind: 'switch', tenantId: B, path: target.path });
  });
  it('winkel zonder toegang → no-access (nooit het dashboard)', () => {
    expect(decidePushTap(target, { tenantsLoading: false, currentTenantId: A, tenantIds: [A] })).toEqual({ kind: 'no-access' });
  });
  it('geen tenant in de melding → gewoon navigeren', () => {
    expect(decidePushTap({ path: '/admin/orders', tenantId: null }, { tenantsLoading: false, currentTenantId: A, tenantIds: [A] }))
      .toEqual({ kind: 'navigate', path: '/admin/orders' });
  });
});

describe('pushTapTarget — payload naar bestemming', () => {
  it('oude payload met een dood pad → de bestaande pagina', () => {
    expect(pushTapTarget({ tenant_id: A, category: 'quotes', type: 'quote_new', action_url: `/admin/quotes/${ORDER}` }))
      .toEqual({ tenantId: A, path: `/admin/orders/quotes/${ORDER}` });
  });
  it('onbekend pad of type → de lijst van die categorie', () => {
    expect(pushTapTarget({ tenant_id: A, category: 'products', type: 'stock_low', action_url: '' }))
      .toEqual({ tenantId: A, path: '/admin/products' });
  });
  it('volledige URL wordt nooit gevolgd', () => {
    expect(pushTapTarget({ tenant_id: A, category: 'orders', type: 'order_new', action_url: 'https://evil.example/x' })?.path)
      .toBe('/admin/orders');
  });
  it('lege data → null', () => {
    expect(pushTapTarget({})).toBeNull();
    expect(pushTapTarget(null)).toBeNull();
  });
});

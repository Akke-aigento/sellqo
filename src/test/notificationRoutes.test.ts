import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NOTIFICATION_CONFIG } from '@/types/notification';
import {
  CATEGORY_LIST_ROUTES,
  canonicalAdminPath,
  notificationRoute,
} from '../../supabase/functions/_shared/notificationRoutes';

// NOTIF-DEEPLINK-1: een melding leidt naar het item, anders naar de lijst van
// die soort — nooit naar het dashboard en nooit naar een pad dat de router niet
// kent (dat gaf de kale 404 buiten de admin).

const ID = '8bb116fa-6ea8-4279-adf3-9a055695c3ba';

// De admin-routes uit App.tsx: <Route path="…"> binnen /admin. De redirects
// (LegacyAdminRedirect) tellen niet: een doel moet een échte pagina zijn.
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const adminPaths = appSource
  .split('\n')
  .filter((line) => !line.includes('<LegacyAdminRedirect'))
  .flatMap((line) => [...line.matchAll(/<Route path="([^"/][^"]*)"/g)].map((m) => `/admin/${m[1]}`));

it('de routeparser vindt de admin-routes en sluit de redirects uit', () => {
  expect(adminPaths).toContain('/admin/orders/:id');
  expect(adminPaths).toContain('/admin/orders/quotes/:id');
  expect(adminPaths).not.toContain('/admin/quotes/:id');
});

function routeExists(url: string): boolean {
  const path = url.split('?')[0];
  const segs = path.split('/').filter(Boolean);
  return adminPaths.some((pattern) => {
    const p = pattern.split('/').filter(Boolean);
    return p.length === segs.length && p.every((s, i) => s.startsWith(':') || s === segs[i]);
  });
}

describe('notificationRoute — elk type in NOTIFICATION_CONFIG', () => {
  const all = NOTIFICATION_CONFIG.flatMap((c) => c.types.map((t) => ({ category: c.category, type: t.type })));

  it.each(all)('$category/$type zonder data → bestaande lijstroute, niet het dashboard', ({ category, type }) => {
    const route = notificationRoute({ category, type, data: {}, action_url: null });
    expect(route).not.toBe('/admin');
    expect(routeExists(route)).toBe(true);
  });

  it('elke categorie-lijst bestaat in de router', () => {
    for (const route of Object.values(CATEGORY_LIST_ROUTES)) expect(routeExists(route), route).toBe(true);
  });
});

describe('notificationRoute — het item zelf', () => {
  it.each([
    ['orders', 'order_new', { order_id: ID }, `/admin/orders/${ID}`],
    ['payments', 'order_refunded', { order_id: ID }, `/admin/orders/${ID}`],
    ['invoices', 'invoice_sent', { invoice_id: ID }, `/admin/orders/invoices?invoice=${ID}`],
    ['products', 'stock_out', { product_id: ID }, `/admin/products/${ID}/edit`],
    ['quotes', 'quote_new', { quote_id: ID }, `/admin/orders/quotes/${ID}`],
    ['customers', 'customer_new', { customer_id: ID }, `/admin/customers/${ID}`],
    ['marketing', 'campaign_sent', { campaign_id: ID }, `/admin/marketing/campaigns/${ID}`],
    ['messages', 'email_inbound', { message_id: ID }, `/admin/messages?conversation=${ID}`],
  ])('%s/%s → %s', (category, type, data, expected) => {
    const route = notificationRoute({ category, type, data, action_url: '/admin/iets-ouds' });
    expect(route).toBe(expected);
    expect(routeExists(route)).toBe(true);
  });

  it('een id die geen uuid is, telt niet', () => {
    expect(notificationRoute({ category: 'orders', type: 'order_new', data: { order_id: 'x' } })).toBe('/admin/orders');
  });

  it('ai_credits_low (systeem) → facturatie', () => {
    expect(notificationRoute({ category: 'system', type: 'ai_credits_low', action_url: '/admin/settings?tab=billing' })).toBe('/admin/billing');
  });
});

describe('canonicalAdminPath — oude patronen uit de 42 bronnen', () => {
  it.each([
    [`/admin/invoices?invoice=${ID}`, `/admin/orders/invoices?invoice=${ID}`],
    [`/admin/invoices/${ID}`, `/admin/orders/invoices?invoice=${ID}`],
    ['/admin/invoices', '/admin/orders/invoices'],
    [`/admin/quotes/${ID}`, `/admin/orders/quotes/${ID}`],
    ['/admin/subscriptions', '/admin/orders/subscriptions'],
    [`/admin/products?id=${ID}`, `/admin/products/${ID}/edit`],
    [`/admin/products/${ID}`, `/admin/products/${ID}/edit`],
    ['/admin/products/new', '/admin/products/new'],
    [`/admin/products/${ID}/edit`, `/admin/products/${ID}/edit`],
    ['/admin/settings?tab=team', '/admin/settings?section=team'],
    ['/admin/settings?tab=billing', '/admin/billing'],
    ['/admin/settings/billing', '/admin/billing'],
    ['/admin/settings/notifications', '/admin/settings?section=shop-notifications'],
    ['/admin/settings?section=team', '/admin/settings?section=team'],
    ['/admin/payouts', '/admin/payments'],
    ['/admin/ai-center', '/admin/marketing/ai-center'],
    [`/admin/orders/${ID}`, `/admin/orders/${ID}`],
  ])('%s → %s', (input, expected) => {
    expect(canonicalAdminPath(input)).toBe(expected);
    expect(routeExists(expected)).toBe(true);
  });

  it.each(['https://evil.example/admin', '//evil.example/admin/orders', 'javascript:alert(1)', '', null])(
    'geen intern admin-pad → null (%s)',
    (input) => expect(canonicalAdminPath(input as string | null)).toBeNull(),
  );
});

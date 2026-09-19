import { describe, expect, it, vi } from 'vitest';
import { scanSource, topLevelKeys, typeValues, registeredTypes, sqlTypePairs } from '../../scripts/check-notification-sources.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notifyPayout, payoutNotificationBody, type PayoutClient } from '../../supabase/functions/_shared/payoutNotification';
import { planEmail } from '../../supabase/functions/_shared/notificationDefaults';
import { notificationRoute } from '../../supabase/functions/_shared/notificationRoutes';

// NOTIF-SOURCES-1: bronnen die stil faalden (p_data, camelCase, onbestaande
// categorie) of dubbel stuurden (twee webhooks per payout, twee mailplekken).

describe('check:notifications — de drie klassen die live stil faalden', () => {
  it('send_notification met p_data', () => {
    const src = `await c.rpc("send_notification", { p_tenant_id: t, p_category: "payments", p_data: m });`;
    expect(scanSource(src).join('\n')).toMatch(/onbekende parameter "p_data"/);
  });
  it('create-notification met camelCase shorthand (tenantId,) en actionUrl', () => {
    const src = `await supabase.functions.invoke('create-notification', { body: { tenantId, category: 'system', actionUrl: '/x' } });`;
    const found = scanSource(src).join('\n');
    expect(found).toMatch(/"tenantId" — camelCase/);
    expect(found).toMatch(/"actionUrl" — camelCase/);
  });
  it('categorie buiten de enum, ook via fetch en directe insert', () => {
    const viaFetch = "await fetch(`${u}/functions/v1/create-notification`, { method: 'POST', body: JSON.stringify({ tenant_id: t, category: 'inventory' }) });";
    const viaInsert = `await supabase.from("notifications").insert([{ tenant_id: t, category: "shipping" }]);`;
    expect(scanSource(viaFetch).join()).toMatch(/categorie "inventory"/);
    expect(scanSource(viaInsert).join()).toMatch(/categorie "shipping"/);
  });
  it('geldige vormen → geen bevindingen', () => {
    const src = `
      await c.rpc('send_notification', { p_tenant_id: t, p_category: 'payments', p_type: x, p_metadata: m });
      await s.functions.invoke('create-notification', { body: { tenant_id: t, category: 'orders', action_url: '/a', data: { orderId: 1 } } });
      await s.from('notifications').insert({ tenant_id: t, category: 'system' });`;
    expect(scanSource(src)).toEqual([]);
  });
  it('topLevelKeys negeert geneste sleutels en spreads', () => {
    expect(topLevelKeys(` tenant_id: t, data: { camelCase: 1 }, ...rest, type `)).toEqual(['tenant_id', 'data', 'type']);
  });
});

function fakeClient(opts: { tenantId?: string | null; existing?: boolean }) {
  const invoke = vi.fn(async () => ({ data: { success: true }, error: null }));
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self, eq: self, limit: self,
      maybeSingle: async () => {
        if (table === 'tenants') return { data: opts.tenantId ? { id: opts.tenantId } : null };
        if (table === 'tenant_subscriptions') return { data: null };
        if (table === 'notifications') return { data: opts.existing ? { id: 'n1' } : null };
        return { data: null };
      },
    });
    return chain;
  };
  return { client: { from, functions: { invoke } } as unknown as PayoutClient, invoke };
}

const payout = { stripeAccountId: 'acct_1', type: 'payout_completed', title: 'T', message: 'M', priority: 'medium', data: { payout_id: 'po_1', amount: 100 } };

describe('notifyPayout — één melding per payout, welke webhook ook stuurt', () => {
  it('eerste keer → create-notification met snake_case-body', async () => {
    const { client, invoke } = fakeClient({ tenantId: 'ten-1' });
    expect(await notifyPayout(client, payout)).toBe('sent');
    expect(invoke).toHaveBeenCalledWith('create-notification', { body: payoutNotificationBody('ten-1', payout) });
    const body = payoutNotificationBody('ten-1', payout);
    expect(Object.keys(body).filter((k) => /[a-z][A-Z]/.test(k))).toEqual([]);
    expect(body).toMatchObject({ tenant_id: 'ten-1', category: 'payments', action_url: '/admin/payments' });
  });
  it('zelfde payout_id + type bestaat al (andere webhook) → geen tweede', async () => {
    const { client, invoke } = fakeClient({ tenantId: 'ten-1', existing: true });
    expect(await notifyPayout(client, payout)).toBe('duplicate');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('onbekend Stripe-account → niets', async () => {
    const { client, invoke } = fakeClient({ tenantId: null });
    expect(await notifyPayout(client, payout)).toBe('no_tenant');
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('planEmail — één mailplek, throttle in het pad dat overblijft', () => {
  const base = { row: null, category: 'orders', type: 'order_high_value', priority: 'high', conversationKey: null, recent: [], now: new Date('2026-09-19T12:00:00Z') };

  it('de aanroep die zelf insert, mailt niet (de trigger doet dat)', () => {
    expect(planEmail({ ...base, insertedHere: true })).toEqual({ send: false, reason: 'via_trigger' });
  });
  it('triggerpad: high-priority zonder rij → mailen', () => {
    expect(planEmail({ ...base, insertedHere: false })).toEqual({ send: true });
  });
  it('triggerpad: twee berichten zelfde afzender binnen 15 min → één mail', () => {
    const msg = { ...base, insertedHere: false, category: 'messages', type: 'email_inbound', priority: 'medium', conversationKey: 'email_inbound|klant@x.be' };
    const first = planEmail(msg);
    expect(first).toEqual({ send: true });
    const second = planEmail({ ...msg, recent: [{ key: msg.conversationKey, emailSentAt: '2026-09-19T11:55:00Z' }] });
    expect(second).toEqual({ send: false, reason: 'throttled' });
  });
  it('na 15 min of andere afzender → wel mailen', () => {
    const msg = { ...base, insertedHere: false, category: 'messages', type: 'email_inbound', priority: 'medium', conversationKey: 'email_inbound|klant@x.be' };
    expect(planEmail({ ...msg, recent: [{ key: msg.conversationKey, emailSentAt: '2026-09-19T11:40:00Z' }] })).toEqual({ send: true });
    expect(planEmail({ ...msg, recent: [{ key: 'email_inbound|ander@x.be', emailSentAt: '2026-09-19T11:59:00Z' }] })).toEqual({ send: true });
  });
  it('rij met e-mail uit → niet', () => {
    expect(planEmail({ ...base, insertedHere: false, row: { email_enabled: false } })).toEqual({ send: false, reason: 'disabled' });
  });
});

describe('register — retour heeft nu categorie orders', () => {
  it('return_id gaat voor order_id', () => {
    const r = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const o = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(notificationRoute({ category: 'orders', type: 'return_new_request', data: { return_id: r, order_id: o } }))
      .toBe(`/admin/returns/${r}`);
  });
});

describe('check:notifications — elk type geregistreerd (NOTIF-TYPES-1)', () => {
  const registered = registeredTypes(readFileSync(resolve(__dirname, '../types/notification.ts'), 'utf8'));

  it('leest de config, ook types met cijfers', () => {
    expect(registered.has('invoices/invoice_overdue_7days')).toBe(true);
    expect(registered.has('ai_coach/ai_suggestion')).toBe(true);
    expect(registered.has('ai_coach/ai_coach_suggestion')).toBe(true);
    expect(registered.has('quotes/quote_created')).toBe(false);
  });
  it('onbekend type → fout', () => {
    const src = `await s.functions.invoke('create-notification', { body: { tenant_id: t, category: 'orders', type: 'order_teleported' } });`;
    expect(scanSource(src, 'x', registered).join()).toMatch(/"orders\/order_teleported" staat niet in NOTIFICATION_CONFIG/);
  });
  it('bekend type onder de verkeerde categorie → fout', () => {
    const src = `await s.from('notifications').insert({ tenant_id: t, category: 'system', type: 'order_new' });`;
    expect(scanSource(src, 'x', registered).join()).toMatch(/"system\/order_new"/);
  });
  it('ternary: alleen de takken, niet de vergelijkingswaarde', () => {
    expect(typeValues(`marketplace === "bol_com" ? "bol_inbound" : "email_inbound"`)).toEqual(['bol_inbound', 'email_inbound']);
  });
  it('template via DYNAMIC_TYPES; onbekende template → fout', () => {
    expect(typeValues('`tracking_${newStatus}`')).toContain('tracking_delivered');
    const src = "await s.from('notifications').insert({ tenant_id: t, category: 'orders', type: `x_${y}` });";
    expect(scanSource(src, 'x', registered).join()).toMatch(/dynamisch/);
  });
  it('SQL: laatste definitie per functie wint, $$-bodies worden correct afgesloten', () => {
    const files = [
      { rel: 'a.sql', src: "CREATE OR REPLACE FUNCTION public.f() RETURNS trigger AS $$ BEGIN PERFORM public.send_notification(t, 'orders', 'order_oud', 'a','b','c','d', x); END; $$ LANGUAGE plpgsql;\nCREATE OR REPLACE FUNCTION public.g() RETURNS trigger AS $$ BEGIN PERFORM public.send_notification(t, 'quotes', 'quote_new', 'a','b','c','d', x); END; $$ LANGUAGE plpgsql;" },
      { rel: 'b.sql', src: "CREATE OR REPLACE FUNCTION public.f() RETURNS trigger AS $function$ BEGIN v_type := 'order_new'; PERFORM public.send_notification(t, 'orders', v_type, 'a','b','c','d', x); END; $function$;" },
    ];
    const pairs = sqlTypePairs(files).map((p: { category: string; type: string }) => `${p.category}/${p.type}`).sort();
    expect(pairs).toEqual(['orders/order_new', 'quotes/quote_new']);
  });
});

describe('repo — nul bevindingen', () => {
  it('check:notifications is groen', async () => {
    const { execFileSync } = await import('node:child_process');
    expect(execFileSync('node', ['scripts/check-notification-sources.mjs'], { encoding: 'utf8' })).toMatch(/ok/);
  }, 30_000); // start het hele script; onder CI-belasting ruim boven de 5 s-default
});

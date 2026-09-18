import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CONFIG } from '@/types/notification';
import {
  NOTIFICATION_DEFAULTS,
  isEmailThrottled,
  messageConversationKey,
  resolveEmailEnabled,
  resolvePushEnabled,
} from '../../supabase/functions/_shared/notificationDefaults.ts';

// PUSH-DEFAULT-1: één bron van defaults. De UI (NOTIFICATION_CONFIG) en de backend
// (notificationDefaults.ts) moeten type voor type gelijk zijn, anders toont het scherm
// iets anders dan er verstuurd wordt.

describe('pariteit NOTIFICATION_CONFIG ↔ notificationDefaults', () => {
  const ui = NOTIFICATION_CONFIG.flatMap(c =>
    c.types.map(t => [`${c.category}/${t.type}`, { category: c.category, inApp: t.defaultInApp, email: t.defaultEmail }] as const),
  );

  it('kent dezelfde categorie/type-paren (een type kan in twee categorieën staan)', () => {
    expect(Object.keys(NOTIFICATION_DEFAULTS).sort()).toEqual(ui.map(([key]) => key).sort());
  });

  for (const [key, defaults] of ui) {
    it(`${key}: zelfde categorie en defaults`, () => {
      expect(NOTIFICATION_DEFAULTS[key]).toEqual(defaults);
    });
  }

  it('e-mail staat alleen standaard aan voor berichten', () => {
    for (const [type, d] of Object.entries(NOTIFICATION_DEFAULTS)) {
      expect(d.email, type).toBe(d.category === 'messages');
    }
  });
});

describe('resolveEmailEnabled', () => {
  it('een rij beslist', () => {
    expect(resolveEmailEnabled({ email_enabled: false }, 'messages', 'email_inbound', 'urgent')).toBe(false);
    expect(resolveEmailEnabled({ email_enabled: true }, 'orders', 'order_new', 'low')).toBe(true);
  });
  it('zonder rij: de default van het type', () => {
    expect(resolveEmailEnabled(null, 'messages', 'contact_form_inbound', 'medium')).toBe(true);
    expect(resolveEmailEnabled(null, 'orders', 'order_new', 'medium')).toBe(false);
  });
  it('zonder rij: high en urgent mailen altijd (bestaande regel)', () => {
    expect(resolveEmailEnabled(null, 'orders', 'order_cancelled', 'high')).toBe(true);
    expect(resolveEmailEnabled(undefined, 'system', 'onbekend_type', 'urgent')).toBe(true);
  });
});

describe('resolvePushEnabled', () => {
  it('een rij beslist', () => {
    expect(resolvePushEnabled({ push_enabled: false }, { isTenantMember: true })).toBe(false);
    expect(resolvePushEnabled({ push_enabled: true }, { isTenantMember: false })).toBe(true);
  });
  it('zonder rij: aan voor teamleden, uit voor een platform-admin zonder rol (opt-in)', () => {
    expect(resolvePushEnabled(null, { isTenantMember: true })).toBe(true);
    expect(resolvePushEnabled(null, { isTenantMember: false })).toBe(false);
  });
});

describe('messageConversationKey', () => {
  it('normaliseert het e-mailadres van de afzender', () => {
    expect(messageConversationKey('email_inbound', { from: 'Jan Klant <Jan@Klant.BE>' })).toBe('email_inbound|jan@klant.be');
    expect(messageConversationKey('contact_form_inbound', { from: 'jan@klant.be' })).toBe('contact_form_inbound|jan@klant.be');
  });
  it('gebruikt telefoon, sender_id of customer_id als er geen from is', () => {
    expect(messageConversationKey('whatsapp_inbound', { from_phone: '+32470000000' })).toBe('whatsapp_inbound|+32470000000');
    expect(messageConversationKey('instagram_inbound', { sender_id: 'abc' })).toBe('instagram_inbound|abc');
    expect(messageConversationKey('facebook_inbound', { customer_id: 'c1' })).toBe('facebook_inbound|customer:c1');
    expect(messageConversationKey('email_inbound', {})).toBeNull();
  });
});

describe('isEmailThrottled', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  const key = 'email_inbound|jan@klant.be';
  const at = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

  it('blokkeert een tweede mail binnen 15 minuten', () => {
    expect(isEmailThrottled(key, [{ key, emailSentAt: at(5) }], now)).toBe(true);
  });
  it('laat na 15 minuten weer door', () => {
    expect(isEmailThrottled(key, [{ key, emailSentAt: at(16) }], now)).toBe(false);
  });
  it('blokkeert geen ander gesprek of ander kanaal', () => {
    expect(isEmailThrottled(key, [{ key: 'email_inbound|piet@x.be', emailSentAt: at(1) }], now)).toBe(false);
    expect(isEmailThrottled(key, [{ key: 'contact_form_inbound|jan@klant.be', emailSentAt: at(1) }], now)).toBe(false);
  });
  it('telt een melding zonder verzonden mail niet mee', () => {
    expect(isEmailThrottled(key, [{ key, emailSentAt: null }], now)).toBe(false);
  });
  it('zonder sleutel nooit throttlen', () => {
    expect(isEmailThrottled(null, [{ key: null, emailSentAt: at(1) }], now)).toBe(false);
  });
});

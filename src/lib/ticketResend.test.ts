import { describe, expect, it } from 'vitest';
import { canResendTickets, ticketOrderClosed } from './ticketResend';
import { walletStatusKey, WALLET_STATUS_VARIANT, WALLET_STATUSES } from './orderTickets';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import nl from '@/i18n/locales/nl.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import de from '@/i18n/locales/de.json';
import uk from '@/i18n/locales/uk.json';

const LOCALES: Record<string, unknown> = { nl, en, fr, de, uk };
const lookup = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

describe('canResendTickets', () => {
  it('betaald of gedeeltelijk terugbetaald: knop blijft', () => {
    expect(canResendTickets({ status: 'delivered', payment_status: 'paid' })).toBe(true);
    expect(canResendTickets({ status: 'processing', payment_status: 'partially_refunded' })).toBe(true);
  });
  it('geannuleerd of volledig terugbetaald: geen knop', () => {
    expect(canResendTickets({ status: 'cancelled', payment_status: 'paid' })).toBe(false);
    expect(canResendTickets({ status: 'delivered', payment_status: 'refunded' })).toBe(false);
    expect(canResendTickets({ status: 'cancelled', payment_status: 'partially_refunded' })).toBe(false);
  });
  it('niet betaald: geen knop (zoals voorheen)', () => {
    expect(canResendTickets({ status: 'pending', payment_status: 'pending' })).toBe(false);
    expect(canResendTickets({ status: 'pending', payment_status: 'failed' })).toBe(false);
  });
  it('ticketOrderClosed volgt de serverregel', () => {
    expect(ticketOrderClosed({ status: 'cancelled', payment_status: 'pending' })).toBe(true);
    expect(ticketOrderClosed({ status: 'returned', payment_status: 'partially_refunded' })).toBe(false);
  });
});

describe('walletStatusKey', () => {
  it('geeft de bestaande sleutels uit Events → Munten', () => {
    expect(walletStatusKey('active')).toBe('events.tokens.status_active');
    expect(walletStatusKey('blocked')).toBe('events.tokens.status_blocked');
    expect(walletStatusKey('refund_requested')).toBe('events.tokens.status_refund_requested');
    expect(walletStatusKey('refunded')).toBe('events.tokens.status_refunded');
  });
  it('onbekend → null (geen badge)', () => {
    expect(walletStatusKey('iets')).toBeNull();
    expect(walletStatusKey(null)).toBeNull();
  });
  it('elke kaartstatus is vertaald in elke ondersteunde taal (dynamische sleutel)', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      expect(LOCALES[code], `locale ${code} ontbreekt in deze test`).toBeTruthy();
      for (const s of WALLET_STATUSES) {
        const v = lookup(LOCALES[code], walletStatusKey(s)!);
        expect(typeof v === 'string' && v.length > 0, `${code}: ${s}`).toBe(true);
      }
      expect(typeof lookup(LOCALES[code], 'admin.orderTickets.resend_closed')).toBe('string');
    }
  });
  it('elke status heeft een kleur', () => {
    for (const s of WALLET_STATUSES) expect(WALLET_STATUS_VARIANT[s]).toBeTruthy();
  });
});

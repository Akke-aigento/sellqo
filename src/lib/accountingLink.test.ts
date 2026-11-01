import { describe, expect, it } from 'vitest';
import { accountingUrl, CONNECT_ACCOUNTING_URL, SETTINGS_ACCOUNTING_URL } from './accountingLink';

describe('boekhoudkoppeling: één plek per winkel', () => {
  it('horeca zonder webshop/events: Instellingen', () => {
    expect(accountingUrl((t) => t === 'horeca')).toBe(SETTINGS_ACCOUNTING_URL);
  });
  it('met webshop of events: SellQo Connect', () => {
    expect(accountingUrl((t) => t === 'horeca' || t === 'webshop')).toBe(CONNECT_ACCOUNTING_URL);
    expect(accountingUrl((t) => t === 'events')).toBe(CONNECT_ACCOUNTING_URL);
    expect(accountingUrl((t) => t === 'webshop')).toBe(CONNECT_ACCOUNTING_URL);
  });
});

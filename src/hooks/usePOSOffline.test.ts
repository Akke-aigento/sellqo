import { describe, expect, it } from 'vitest';
import { isDueForSync, retryDelayMs, STALE_SYNCING_MS, type OfflineTransaction } from './usePOSOffline';
import { isPosNetworkError } from '@/lib/posNetwork';

const base: OfflineTransaction = {
  id: 'a', terminalId: 't', sessionId: null, tenantId: 'x', cashierId: 'u',
  items: [], payments: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0,
  createdOfflineAt: '2026-10-23T10:00:00Z', syncStatus: 'pending', syncAttempts: 0,
};
const now = Date.parse('2026-10-23T12:00:00Z');

describe('HORECA-0 offline-wachtrij', () => {
  it('pending gaat altijd mee', () => {
    expect(isDueForSync(base, now)).toBe(true);
  });

  it('failed wacht op de backoff en wordt daarna opnieuw geprobeerd (nooit opgegeven)', () => {
    const later = { ...base, syncStatus: 'failed' as const, syncAttempts: 9, nextRetryAt: new Date(now + 1000).toISOString() };
    expect(isDueForSync(later, now)).toBe(false);
    expect(isDueForSync({ ...later, nextRetryAt: new Date(now - 1).toISOString() }, now)).toBe(true);
    expect(isDueForSync({ ...base, syncStatus: 'failed', syncAttempts: 50 }, now)).toBe(true);
  });

  it('syncing die vastliep (app dicht) komt na 60 s terug', () => {
    const fresh = { ...base, syncStatus: 'syncing' as const, syncStartedAt: new Date(now - 5_000).toISOString() };
    expect(isDueForSync(fresh, now)).toBe(false);
    expect(isDueForSync({ ...fresh, syncStartedAt: new Date(now - STALE_SYNCING_MS - 1).toISOString() }, now)).toBe(true);
    expect(isDueForSync({ ...base, syncStatus: 'syncing' }, now)).toBe(true); // oude rij zonder starttijd
  });

  it('synced nooit opnieuw', () => {
    expect(isDueForSync({ ...base, syncStatus: 'synced' }, now)).toBe(false);
  });

  it('backoff groeit en is begrensd op 5 minuten', () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(10_000);
    expect(retryDelayMs(30)).toBe(300_000);
  });
});

describe('isPosNetworkError', () => {
  it('herkent fetch-fouten van supabase-js', () => {
    expect(isPosNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);
    expect(isPosNetworkError({ message: 'Load failed' })).toBe(true);
    expect(isPosNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });
  it('een databasefout is geen netwerkfout (anders dubbel boeken via offline)', () => {
    expect(isPosNetworkError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false);
    expect(isPosNetworkError({ message: 'timeout', code: '57014' })).toBe(false);
    expect(isPosNetworkError(null)).toBe(false);
  });
});

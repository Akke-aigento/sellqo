// EVENT-DOOR-2 — de netwerklogica van de deurscanner: timeout, één herhaling,
// herstel van een verloren antwoord en de wachtrij.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOCK_SKEW_MS, DoorNetworkError, RECOVER_WINDOW_MS, enqueueScan, invalidReasonKey, isNetworkError,
  recoverAlreadyInside, runWithRetry, withTimeout,
} from '@/lib/doorScanFlow';

describe('withTimeout', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('geeft het resultaat door als de oproep op tijd klaar is', async () => {
    await expect(withTimeout(async () => 42, 8000)).resolves.toBe(42);
  });

  it('breekt af na de deadline en zet het signaal op aborted', async () => {
    let seen: AbortSignal | null = null;
    const p = withTimeout((signal) => { seen = signal; return new Promise<never>(() => {}); }, 8000);
    const assertion = expect(p).rejects.toMatchObject({ name: 'DoorNetworkError', kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(seen!.aborted).toBe(true);
  });
});

describe('isNetworkError', () => {
  it('herkent timeout, abort, functions-js fetch/relay-fouten en gateway-statussen', () => {
    expect(isNetworkError(new DoorNetworkError('timeout'))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'FunctionsFetchError' }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'FunctionsRelayError' }))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'FunctionsHttpError', context: { status: 504 } }))).toBe(true);
  });

  it('een echt serverantwoord is geen netwerkfout', () => {
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'FunctionsHttpError', context: { status: 401 } }))).toBe(false);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'FunctionsHttpError', context: { status: 500 } }))).toBe(false);
    expect(isNetworkError(new Error('invalid qr_token'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('runWithRetry', () => {
  it('één poging bij succes', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(runWithRetry(fn)).resolves.toEqual({ value: 'ok', attempts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('herhaalt precies één keer bij een netwerkfout', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    await expect(runWithRetry(fn, { onRetry })).resolves.toEqual({ value: 'ok', attempts: 2 });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('geeft na twee netwerkfouten de netwerkfout door', async () => {
    const fn = vi.fn().mockRejectedValue(new DoorNetworkError('timeout'));
    await expect(runWithRetry(fn)).rejects.toMatchObject({ kind: 'timeout' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('herhaalt nooit bij een echt serverantwoord', async () => {
    const err = Object.assign(new Error('nope'), { name: 'FunctionsHttpError', context: { status: 401 } });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(runWithRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('probeert niet als het toestel offline is', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(runWithRetry(fn, { isOnline: () => false })).rejects.toMatchObject({ kind: 'offline' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('herhaalt na een timeout (trage oproep)', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn()
        .mockImplementationOnce(() => new Promise<never>(() => {}))
        .mockResolvedValueOnce('ok');
      const p = runWithRetry(fn, { timeoutMs: 8000 });
      await vi.advanceTimersByTimeAsync(8000);
      await expect(p).resolves.toEqual({ value: 'ok', attempts: 2 });
    } finally { vi.useRealTimers(); }
  });
});

describe('recoverAlreadyInside', () => {
  const now = Date.parse('2026-10-24T21:00:30Z');
  const already = (iso: string) => ({ success: true, result: 'already', checked_in_at: iso });

  it('al binnen sinds 2 s, na onze eigen poging zonder antwoord → groen', () => {
    const started = now - 10_000;
    expect(recoverAlreadyInside(already(new Date(now - 2_000).toISOString()), started, now)).toBe(true);
  });

  it('zonder eigen onbeantwoorde poging blijft het "al binnen"', () => {
    expect(recoverAlreadyInside(already(new Date(now - 2_000).toISOString()), null, now)).toBe(false);
  });

  it('check-in ouder dan het venster blijft "al binnen"', () => {
    const started = now - 60_000;
    expect(recoverAlreadyInside(already(new Date(now - RECOVER_WINDOW_MS - 1).toISOString()), started, now)).toBe(false);
  });

  it('check-in door een ander toestel vóór onze poging blijft "al binnen"', () => {
    const started = now - 5_000;
    const before = new Date(started - CLOCK_SKEW_MS - 1_000).toISOString();
    expect(recoverAlreadyInside(already(before), started, now)).toBe(false);
  });

  it('kleine klokspeling (server iets voor) wordt aanvaard', () => {
    expect(recoverAlreadyInside(already(new Date(now + 3_000).toISOString()), now - 8_000, now)).toBe(true);
  });

  it('alleen voor "already"; ok, invalid en fouten blijven wat ze zijn', () => {
    const iso = new Date(now - 1_000).toISOString();
    expect(recoverAlreadyInside({ success: true, result: 'ok', checked_in_at: iso }, now - 5_000, now)).toBe(false);
    expect(recoverAlreadyInside({ success: true, result: 'invalid', checked_in_at: iso }, now - 5_000, now)).toBe(false);
    expect(recoverAlreadyInside({ success: false, result: 'already', checked_in_at: iso }, now - 5_000, now)).toBe(false);
    expect(recoverAlreadyInside({ success: true, result: 'already', checked_in_at: null }, now - 5_000, now)).toBe(false);
  });
});

describe('enqueueScan', () => {
  it('voegt nieuwe tickets toe, zonder dubbels en zonder het lopende ticket', () => {
    expect(enqueueScan([], 'a', null)).toEqual(['a']);
    expect(enqueueScan(['a'], 'a', null)).toEqual(['a']);
    expect(enqueueScan([], 'b', 'b')).toEqual([]);
    expect(enqueueScan(['a'], 'b', 'c')).toEqual(['a', 'b']);
  });

  it('heeft een bovengrens', () => {
    expect(enqueueScan(['a', 'b', 'c'], 'd', null)).toEqual(['a', 'b', 'c']);
  });
});

describe('invalidReasonKey', () => {
  it('geeft een specifieke tekst voor geannuleerd en terugbetaald', () => {
    expect(invalidReasonKey('invalid', 'ticket_cancelled')).toBe('result.cancelled');
    expect(invalidReasonKey('invalid', 'ticket_refunded')).toBe('result.refunded');
    expect(invalidReasonKey('invalid', 'ticket_transferred')).toBe('result.transferred');
    expect(invalidReasonKey('cancelled', undefined)).toBe('result.cancelled');
    expect(invalidReasonKey('invalid', 'unknown_token')).toBe('result.invalid');
    expect(invalidReasonKey(undefined, undefined)).toBe('result.invalid');
  });
});

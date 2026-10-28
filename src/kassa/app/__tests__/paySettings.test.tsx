// BETAAL-1, review B1 — zonder antwoord van de server (offline, fout, nog aan het laden) geeft de hook
// bij elke render hetzelfde object terug uit de cache. Een nieuw object per render liet het
// afrekenvenster in een renderlus draaien.
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(() => {}) }) }) }) },
}));

const { useKassaPaySettings, DEFAULT_PAY_SETTINGS } = await import('../horeca/paySettings');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe('useKassaPaySettings', () => {
  it('leest de cache één keer: zelfde object bij elke render', () => {
    localStorage.setItem('sq_kassa_pay_settings:t1', JSON.stringify({ methods: ['cash', 'card'], terminal: 'standalone', kassa_tip: false }));
    const { result, rerender } = renderHook(() => useKassaPaySettings('t1'), { wrapper });
    const first = result.current;
    rerender(); rerender();
    expect(result.current).toBe(first);
    // PRINT-2: een oude cache zonder mail_button krijgt de standaard (knop aan).
    expect(first).toEqual({ methods: ['cash', 'card'], terminal: 'standalone', kassa_tip: false, mail_button: true });
  });
  it('zonder cache: de standaard, ook stabiel', () => {
    const { result, rerender } = renderHook(() => useKassaPaySettings('t2'), { wrapper });
    rerender();
    expect(result.current).toBe(DEFAULT_PAY_SETTINGS);
  });
});

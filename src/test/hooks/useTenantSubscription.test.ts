import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { activeSubscription, starterPlan } from '../fixtures/billing';

const { mockFromData, mockInvoke, mockTenantData, mockToast } = vi.hoisted(() => ({
  mockFromData: {} as Record<string, any>,
  mockInvoke: vi.fn(),
  mockTenantData: { value: null as any },
  mockToast: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const createChain = (data: any) => {
    const chain: any = {};
    const methods = ['select', 'eq', 'neq', 'order', 'limit', 'in'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: data?.single ?? null, error: null });
    chain.then = (resolve: Function) => resolve({ data: data?.list ?? [], error: null, count: data?.count ?? 0 });
    return chain;
  };
  return {
    supabase: {
      from: vi.fn((table: string) => createChain(mockFromData[table])),
      functions: { invoke: mockInvoke },
    },
  };
});

vi.mock('@/hooks/useTenant', () => ({
  TenantContext: React.createContext(null),
  useTenant: () => ({ currentTenant: mockTenantData.value }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { TenantContext } from '@/hooks/useTenant';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        TenantContext.Provider,
        { value: { currentTenant: mockTenantData.value } as any },
        children
      )
    );
}

describe('useTenantSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockFromData).forEach(key => delete mockFromData[key]);
    mockTenantData.value = null;
  });

  it('returns null subscription when no tenant', async () => {
    mockTenantData.value = null;

    const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

    // Query is disabled when no tenant, so subscription stays null
    expect(result.current.subscription).toBeUndefined();
  });

  it('returns empty invoices array by default', () => {
    mockTenantData.value = null;

    const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });
    expect(result.current.invoices).toEqual([]);
  });

  describe('createCheckout', () => {
    it('invokes create-platform-checkout function', async () => {
      mockTenantData.value = { id: 'tenant-1' };
      mockInvoke.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/test' },
        error: null,
      });

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.createCheckout.mutate({ planId: 'pro', interval: 'monthly' });
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create-platform-checkout', {
          body: { planId: 'pro', interval: 'monthly' },
        });
      });

      openSpy.mockRestore();
    });

    it('opens checkout URL in new tab', async () => {
      mockTenantData.value = { id: 'tenant-1' };
      mockInvoke.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/test' },
        error: null,
      });

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.createCheckout.mutate({ planId: 'pro', interval: 'monthly' });
      });

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith('https://checkout.stripe.com/test', '_blank');
      });

      openSpy.mockRestore();
    });

    it('shows error toast on checkout failure', async () => {
      mockTenantData.value = { id: 'tenant-1' };
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('Stripe unavailable'),
      });

      const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.createCheckout.mutate({ planId: 'pro', interval: 'monthly' });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive' })
        );
      });
    });
  });

  describe('openCustomerPortal', () => {
    it('invokes platform-customer-portal function', async () => {
      mockTenantData.value = { id: 'tenant-1' };
      mockInvoke.mockResolvedValue({
        data: { url: 'https://billing.stripe.com/portal/test' },
        error: null,
      });

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.openCustomerPortal.mutate();
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('platform-customer-portal', {});
      });

      openSpy.mockRestore();
    });

    it('shows error toast on portal failure', async () => {
      mockTenantData.value = { id: 'tenant-1' };
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('No billing account'),
      });

      const { result } = renderHook(() => useTenantSubscription(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.openCustomerPortal.mutate();
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Fout bij openen portaal',
            variant: 'destructive',
          })
        );
      });
    });
  });
});

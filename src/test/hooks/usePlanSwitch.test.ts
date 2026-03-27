import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockInvoke, mockToastError, mockToastSuccess, mockToastInfo } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastInfo: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: any[]) => mockToastError(...args),
    success: (...args: any[]) => mockToastSuccess(...args),
    info: (...args: any[]) => mockToastInfo(...args),
  }),
}));

import { useCalculatePlanSwitch, useExecutePlanSwitch } from '@/hooks/usePlanSwitch';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePlanSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCalculatePlanSwitch', () => {
    it('calls calculate-plan-switch with correct params', async () => {
      const preview = {
        current_plan: { id: 'starter', name: 'Starter', price: 29, interval: 'monthly' },
        target_plan: { id: 'pro', name: 'Pro', price: 79, interval: 'monthly' },
        proration: { days_remaining: 15, unused_credit: 14.50, amount_due_now: 39.50, next_invoice_date: '2026-04-15' },
        addons: { to_migrate: [], monthly_savings: 0 },
        features: { gained: ['customDomain', 'peppol'], lost: [] },
        is_upgrade: true,
        stripe_preview: { subtotal: 7900, tax: 1659, total: 9559, currency: 'eur' },
      };
      mockInvoke.mockResolvedValue({ data: preview, error: null });

      const { result } = renderHook(() => useCalculatePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        const data = await result.current.mutateAsync({
          target_plan_id: 'pro',
          target_interval: 'monthly',
        });
        expect(data).toEqual(preview);
      });

      expect(mockInvoke).toHaveBeenCalledWith('calculate-plan-switch', {
        body: { target_plan_id: 'pro', target_interval: 'monthly' },
      });
    });

    it('shows toast on error', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error('Calculation failed') });

      const { result } = renderHook(() => useCalculatePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        try {
          await result.current.mutateAsync({ target_plan_id: 'pro' });
        } catch {
          // Expected to throw
        }
      });

      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Kon plan preview niet berekenen'));
    });

    it('handles server-side error in data', async () => {
      mockInvoke.mockResolvedValue({ data: { error: 'No subscription found' }, error: null });

      const { result } = renderHook(() => useCalculatePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        try {
          await result.current.mutateAsync({ target_plan_id: 'pro' });
        } catch (e: any) {
          expect(e.message).toBe('No subscription found');
        }
      });
    });
  });

  describe('useExecutePlanSwitch', () => {
    it('calls execute-plan-switch with correct params', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          new_plan: { id: 'pro', name: 'Pro', interval: 'monthly' },
          migrated_addons: [],
          stripe_subscription_id: 'sub_123',
        },
        error: null,
      });

      const { result } = renderHook(() => useExecutePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          target_plan_id: 'pro',
          target_interval: 'monthly',
          proration_behavior: 'create_prorations',
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith('execute-plan-switch', {
        body: {
          target_plan_id: 'pro',
          target_interval: 'monthly',
          proration_behavior: 'create_prorations',
        },
      });
    });

    it('shows success toast on plan change', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          new_plan: { id: 'pro', name: 'Pro', interval: 'monthly' },
          migrated_addons: [],
        },
        error: null,
      });

      const { result } = renderHook(() => useExecutePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({ target_plan_id: 'pro' });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Plan succesvol gewijzigd naar Pro');
    });

    it('shows addon migration info toast', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          new_plan: { id: 'pro', name: 'Pro', interval: 'monthly' },
          migrated_addons: ['peppol', 'multi_warehouse'],
        },
        error: null,
      });

      const { result } = renderHook(() => useExecutePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({ target_plan_id: 'pro' });
      });

      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockToastInfo).toHaveBeenCalledWith('2 add-on(s) zijn nu inbegrepen in je plan');
    });

    it('shows error toast on failure', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: new Error('Stripe error') });

      const { result } = renderHook(() => useExecutePlanSwitch(), { wrapper: createWrapper() });

      await act(async () => {
        try {
          await result.current.mutateAsync({ target_plan_id: 'pro' });
        } catch {
          // Expected
        }
      });

      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Kon plan niet wijzigen'));
    });
  });
});

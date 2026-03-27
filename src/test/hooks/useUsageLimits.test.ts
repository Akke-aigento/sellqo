import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { starterPlan, proPlan, enterprisePlan } from '../fixtures/billing';

// Use vi.hoisted so mocks are available when vi.mock factories run
const { mockTenant, mockSubscription, mockAddons, mockToast, mockCountRef } = vi.hoisted(() => ({
  mockTenant: vi.fn(),
  mockSubscription: vi.fn(),
  mockAddons: vi.fn(),
  mockToast: vi.fn(),
  mockCountRef: { value: 0 },
}));

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => mockTenant(),
}));

vi.mock('@/hooks/useTenantSubscription', () => ({
  useTenantSubscription: () => mockSubscription(),
}));

vi.mock('@/hooks/useTenantAddons', () => ({
  useTenantAddons: () => mockAddons(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockImplementation(() =>
            Promise.resolve({ count: mockCountRef.value, error: null })
          ),
          [Symbol.for('then')]: undefined,
          then: undefined,
        }),
      }),
    }),
  },
}));

// Re-mock supabase more carefully - the chainable query builder needs to support the full chain
vi.mock('@/integrations/supabase/client', () => {
  const createChain = () => {
    const chain: any = {};
    const methods = ['select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'or', 'not', 'is', 'order', 'limit'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Make the chain thenable - resolves to count
    chain.then = (resolve: Function) => resolve({ count: mockCountRef.value, error: null, data: null });
    return chain;
  };
  return {
    supabase: {
      from: vi.fn().mockImplementation(() => createChain()),
    },
  };
});

import { useUsageLimits } from '@/hooks/useUsageLimits';

describe('useUsageLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountRef.value = 0;
    mockAddons.mockReturnValue({ addons: [] });
  });

  describe('checkLimit', () => {
    it('internal tenant bypasses all limits', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'internal', is_internal_tenant: true, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());

      expect(await result.current.checkLimit('products')).toBe(true);
      expect(await result.current.checkLimit('orders')).toBe(true);
      expect(await result.current.checkLimit('customers')).toBe(true);
      expect(await result.current.checkLimit('users')).toBe(true);
    });

    it('demo tenant bypasses all limits', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'demo', is_internal_tenant: false, is_demo: true },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.checkLimit('products')).toBe(true);
    });

    it('uses free plan defaults when no subscription', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      mockCountRef.value = 24;
      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.checkLimit('products')).toBe(true);

      mockCountRef.value = 25;
      expect(await result.current.checkLimit('products')).toBe(false);
    });

    it('respects plan-specific product limits', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: starterPlan } });

      mockCountRef.value = 200;
      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.checkLimit('products')).toBe(true);

      mockCountRef.value = 250;
      expect(await result.current.checkLimit('products')).toBe(false);
    });

    it('unlimited (null) limits always pass', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: enterprisePlan } });

      mockCountRef.value = 999999;
      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.checkLimit('products')).toBe(true);
    });

    it('allows when no tenant context', async () => {
      mockTenant.mockReturnValue({ currentTenant: null });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.checkLimit('products')).toBe(true);
    });
  });

  describe('enforceLimit', () => {
    it('shows toast when limit exceeded', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });
      mockCountRef.value = 30;

      const { result } = renderHook(() => useUsageLimits());
      const allowed = await result.current.enforceLimit('products');

      expect(allowed).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });

    it('does not show toast when within limit', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });
      mockCountRef.value = 10;

      const { result } = renderHook(() => useUsageLimits());
      const allowed = await result.current.enforceLimit('products');

      expect(allowed).toBe(true);
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('unlimited tenants never see toast', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'internal', is_internal_tenant: true, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());
      const allowed = await result.current.enforceLimit('products');

      expect(allowed).toBe(true);
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe('checkFeature', () => {
    it('internal tenant has all features', () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'internal', is_internal_tenant: true, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());

      expect(result.current.checkFeature('customDomain')).toBe(true);
      expect(result.current.checkFeature('peppol')).toBe(true);
      expect(result.current.checkFeature('whiteLabel')).toBe(true);
    });

    it('checks plan features', () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: proPlan } });

      const { result } = renderHook(() => useUsageLimits());

      expect(result.current.checkFeature('customDomain')).toBe(true);
      expect(result.current.checkFeature('whiteLabel')).toBe(false);
    });

    it('checks addon features when plan lacks them', () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: starterPlan } });
      mockAddons.mockReturnValue({
        addons: [{ addon_type: 'peppol', status: 'active' }],
      });

      const { result } = renderHook(() => useUsageLimits());
      expect(result.current.checkFeature('peppol')).toBe(true);
    });

    it('returns false for missing features without addon', () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: starterPlan } });
      mockAddons.mockReturnValue({ addons: [] });

      const { result } = renderHook(() => useUsageLimits());

      expect(result.current.checkFeature('peppol')).toBe(false);
      expect(result.current.checkFeature('customDomain')).toBe(false);
    });
  });

  describe('getUsagePercentage', () => {
    it('returns 0 for unlimited tenants', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'internal', is_internal_tenant: true, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: null });

      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.getUsagePercentage('products')).toBe(0);
    });

    it('returns 0 for unlimited (null) limits', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: enterprisePlan } });

      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.getUsagePercentage('products')).toBe(0);
    });

    it('calculates correct percentage', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: starterPlan } });

      mockCountRef.value = 125;
      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.getUsagePercentage('products')).toBe(50);
    });

    it('caps at 100%', async () => {
      mockTenant.mockReturnValue({
        currentTenant: { id: 'tenant-1', is_internal_tenant: false, is_demo: false },
      });
      mockSubscription.mockReturnValue({ subscription: { pricing_plan: starterPlan } });

      mockCountRef.value = 500;
      const { result } = renderHook(() => useUsageLimits());
      expect(await result.current.getUsagePercentage('products')).toBe(100);
    });
  });
});

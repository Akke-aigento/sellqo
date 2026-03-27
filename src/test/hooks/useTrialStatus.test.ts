import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Use vi.hoisted so mocks are available when vi.mock factories run
const { mockMaybeSingle, mockTenant } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockTenant: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    },
  };
});

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => mockTenant(),
}));

import { useTrialStatus } from '@/hooks/useTrialStatus';

describe('useTrialStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading false when no tenant', async () => {
    mockTenant.mockReturnValue({ currentTenant: null });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('internal tenant is always active, never on trial', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-internal', is_internal_tenant: true },
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isTrialing).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isPaid).toBe(true);
    expect(result.current.status).toBe('active');
    expect(result.current.planId).toBe('enterprise');
    expect(result.current.planName).toBe('Platform Owner');
  });

  it('no subscription = legacy trial with 14 days', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isTrialing).toBe(true);
    expect(result.current.isTrialExpired).toBe(false);
    expect(result.current.daysRemaining).toBe(14);
    expect(result.current.planId).toBe('free');
    expect(result.current.planName).toBe('Free Trial');
  });

  it('active trial with days remaining', async () => {
    const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'trialing',
        trial_end: trialEnd,
        plan_id: 'starter',
        pricing_plans: { id: 'starter', name: 'Starter', slug: 'starter', monthly_price: 29 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isTrialing).toBe(true);
    expect(result.current.isTrialExpired).toBe(false);
    expect(result.current.daysRemaining).toBeGreaterThanOrEqual(6);
    expect(result.current.daysRemaining).toBeLessThanOrEqual(8);
    expect(result.current.planId).toBe('starter');
    expect(result.current.planName).toBe('Starter');
  });

  it('expired trial = isTrialExpired true', async () => {
    const trialEnd = new Date(Date.now() - 86400000).toISOString();
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'trialing',
        trial_end: trialEnd,
        plan_id: 'starter',
        pricing_plans: { id: 'starter', name: 'Starter', slug: 'starter', monthly_price: 29 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isTrialing).toBe(true);
    expect(result.current.isTrialExpired).toBe(true);
    expect(result.current.daysRemaining).toBe(0);
  });

  it('active paid subscription = isPaid and isActive', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'active',
        trial_end: null,
        plan_id: 'pro',
        pricing_plans: { id: 'pro', name: 'Pro', slug: 'pro', monthly_price: 79 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.isPaid).toBe(true);
    expect(result.current.isTrialing).toBe(false);
    expect(result.current.planId).toBe('pro');
  });

  it('free plan active = isActive but not isPaid', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'active',
        trial_end: null,
        plan_id: 'free',
        pricing_plans: { id: 'free', name: 'Free', slug: 'free', monthly_price: 0 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.isPaid).toBe(false);
  });

  it('getUrgencyLevel returns expired for expired trial', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    const trialEnd = new Date(Date.now() - 86400000).toISOString();
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'trialing',
        trial_end: trialEnd,
        plan_id: 'starter',
        pricing_plans: { id: 'starter', name: 'Starter', slug: 'starter', monthly_price: 29 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getUrgencyLevel()).toBe('expired');
  });

  it('shouldBlockAccess blocks expired trials', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    const trialEnd = new Date(Date.now() - 86400000).toISOString();
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'trialing',
        trial_end: trialEnd,
        plan_id: 'starter',
        pricing_plans: { id: 'starter', name: 'Starter', slug: 'starter', monthly_price: 29 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.shouldBlockAccess()).toBe(true);
  });

  it('shouldBlockAccess does not block paid users', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        status: 'active',
        trial_end: null,
        plan_id: 'pro',
        pricing_plans: { id: 'pro', name: 'Pro', slug: 'pro', monthly_price: 79 },
      },
      error: null,
    });

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.shouldBlockAccess()).toBe(false);
  });

  it('shouldBlockAccess does not block while loading', () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.shouldBlockAccess()).toBe(false);
  });

  it('handles supabase error gracefully', async () => {
    mockTenant.mockReturnValue({
      currentTenant: { id: 'tenant-1', is_internal_tenant: false },
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    consoleSpy.mockRestore();
  });
});

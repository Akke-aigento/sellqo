import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

export interface TrialStatus {
  isLoading: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  isActive: boolean;
  isPaid: boolean;
  daysRemaining: number;
  trialEndDate: Date | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused' | null;
  planId: string | null;
  planName: string | null;
}

const initialStatus: TrialStatus = {
  isLoading: true,
  isTrialing: false,
  isTrialExpired: false,
  isActive: false,
  isPaid: false,
  daysRemaining: 0,
  trialEndDate: null,
  status: null,
  planId: null,
  planName: null,
};

export function useTrialStatus() {
  const { currentTenant } = useTenant();
  const { isPlatformAdmin } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus>(initialStatus);

  const checkTrialStatus = useCallback(async () => {
    if (!currentTenant?.id) {
      setTrialStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Internal tenants (SellQo) are never on trial - they're the platform owners
    if (currentTenant.is_internal_tenant) {
      setTrialStatus({
        isLoading: false,
        isTrialing: false,
        isTrialExpired: false,
        isActive: true,
        isPaid: true,
        daysRemaining: 0,
        trialEndDate: null,
        status: 'active',
        planId: 'enterprise',
        planName: 'Platform Owner',
      });
      return;
    }

    // Platform admins are never blocked - they manage all tenants
    if (isPlatformAdmin) {
      setTrialStatus({
        isLoading: false,
        isTrialing: false,
        isTrialExpired: false,
        isActive: true,
        isPaid: true,
        daysRemaining: 0,
        trialEndDate: null,
        status: 'active',
        planId: 'enterprise',
        planName: 'Platform Admin',
      });
      return;
    }

    try {
      // Fetch subscription with plan details
      const { data: subscription, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans:plan_id (
            id,
            name,
            slug,
            monthly_price
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setTrialStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!subscription) {
        // No subscription = show as trial (legacy tenant without subscription)
        setTrialStatus({
          isLoading: false,
          isTrialing: true,
          isTrialExpired: false,
          isActive: false,
          isPaid: false,
          daysRemaining: 14,
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'trialing',
          planId: 'free',
          planName: 'Free Trial',
        });
        return;
      }

      const now = new Date();
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
      const isTrialing = subscription.status === 'trialing';
      const isTrialExpired = isTrialing && trialEnd && trialEnd < now;
      const isActive = subscription.status === 'active';
      const isPaid = isActive && subscription.plan_id !== 'free';

      // Calculate days remaining
      let daysRemaining = 0;
      if (trialEnd && isTrialing && !isTrialExpired) {
        daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Get plan name from joined data
      const plan = subscription.pricing_plans as { id: string; name: string; slug: string; monthly_price: number } | null;

      setTrialStatus({
        isLoading: false,
        isTrialing,
        isTrialExpired: isTrialExpired || false,
        isActive,
        isPaid,
        daysRemaining,
        trialEndDate: trialEnd,
        status: subscription.status as TrialStatus['status'],
        planId: subscription.plan_id,
        planName: plan?.name || 'Free',
      });
    } catch (err) {
      console.error('Trial status check error:', err);
      setTrialStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    checkTrialStatus();
  }, [checkTrialStatus]);

  // Get urgency level for UI styling
  const getUrgencyLevel = useCallback((): 'normal' | 'warning' | 'critical' | 'expired' => {
    if (trialStatus.isTrialExpired) return 'expired';
    if (trialStatus.isPaid || trialStatus.isActive) return 'normal';
    if (trialStatus.daysRemaining <= 0) return 'expired';
    if (trialStatus.daysRemaining <= 3) return 'critical';
    if (trialStatus.daysRemaining <= 7) return 'warning';
    return 'normal';
  }, [trialStatus]);

  // Check if user should be blocked from using the app
  const shouldBlockAccess = useCallback((): boolean => {
    // Don't block if still loading
    if (trialStatus.isLoading) return false;
    // Don't block paid users
    if (trialStatus.isPaid) return false;
    // Don't block active subscriptions
    if (trialStatus.isActive && !trialStatus.isTrialing) return false;
    // Block if trial expired
    return trialStatus.isTrialExpired;
  }, [trialStatus]);

  return {
    ...trialStatus,
    getUrgencyLevel,
    shouldBlockAccess,
    refresh: checkTrialStatus,
  };
}

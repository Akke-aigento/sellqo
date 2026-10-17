import { countUsage } from '@/lib/planUsage';
import { useTenant } from '@/hooks/useTenant';
import { useTenantSubscription } from './useTenantSubscription';
import { useTenantAddons } from './useTenantAddons';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { isBillingExempt } from '../../supabase/functions/_shared/billingExempt';

export type LimitType = 'products' | 'orders' | 'customers' | 'users';

export interface EnforceLimitResult {
  allowed: boolean;
  isTrialing: boolean;
  current: number;
  limit: number | null;
}

export function useUsageLimits() {
  const { currentTenant } = useTenant();
  const { subscription, usage } = useTenantSubscription();
  const { addons } = useTenantAddons();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();

  // Platform admins in admin view bypass all limits
  const isPlatformBypass = isPlatformAdmin && isAdminView;

  // Internal tenants (SellQo) and demo tenants have unlimited everything
  // BILLING-EXEMPT-1: SellQo zelf, vrijgestelde winkels en demo's.
  const isUnlimited = isPlatformBypass || isBillingExempt(currentTenant) || currentTenant?.is_demo === true;

  const checkLimit = async (limitType: LimitType): Promise<boolean> => {
    // Unlimited tenants bypass all limits
    if (isUnlimited) return true;
    
    if (!currentTenant?.id) {
      return true; // Allow if no tenant context
    }

    // Get current plan limits
    let limit: number | null = null;
    
    if (subscription?.pricing_plan) {
      switch (limitType) {
        case 'products':
          limit = subscription.pricing_plan.limit_products;
          break;
        case 'orders':
          limit = subscription.pricing_plan.limit_orders;
          break;
        case 'customers':
          limit = subscription.pricing_plan.limit_customers;
          break;
        case 'users':
          limit = subscription.pricing_plan.limit_users;
          break;
      }
    } else {
      // LIMITS-1: geen abonnement = geen limiet, zoals de databank (enforce_plan_limit).
      limit = null;
    }

    // Unlimited
    if (limit === null) return true;

    // Get current count
    const count = await countUsage(currentTenant.id, limitType); // LIMITS-1: zelfde telling als de databank

    return count < limit;
  };

  // Synchronous check using cached usage data
  const isOverLimit = (limitType: LimitType): boolean => {
    if (isUnlimited) return false;
    if (!usage) return false;
    const u = usage[limitType];
    if (!u || u.limit === null) return false;
    return u.current >= u.limit;
  };

  const isTrialing = subscription?.status === 'trialing';

  const enforceLimit = async (limitType: LimitType): Promise<EnforceLimitResult> => {
    // Unlimited tenants bypass all limits
    if (isUnlimited) return { allowed: true, isTrialing: false, current: 0, limit: null };
    
    const withinLimit = await checkLimit(limitType);
    const u = usage?.[limitType];
    const current = u?.current ?? 0;
    const limit = u?.limit ?? null;
    
    if (!withinLimit) {
      const limitLabels: Record<LimitType, string> = {
        products: t('pricing.features.products'),
        orders: t('pricing.features.orders_per_month'),
        customers: t('pricing.features.customers'),
        users: t('pricing.features.team_members'),
      };

      if (isTrialing) {
        // Soft limit during trial — warn but allow
        toast({
          title: 'Limiet bereikt (proefperiode)',
          description: `Je hebt de ${limitLabels[limitType]} limiet bereikt. Na je proefperiode moet je upgraden om door te gaan.`,
        });
        return { allowed: true, isTrialing: true, current, limit };
      }

      // Hard block for paid/active plans
      toast({
        title: t('billing.upgrade_needed'),
        description: `Je hebt de ${limitLabels[limitType]} limiet van je abonnement bereikt. Upgrade je plan om door te gaan.`,
        variant: 'destructive',
      });
      return { allowed: false, isTrialing: false, current, limit };
    }
    
    return { allowed: true, isTrialing, current, limit };
  };

  const checkFeature = (featureKey: string): boolean => {
    // Platform admins in admin view and unlimited tenants have all features
    if (isUnlimited) return true;
    
    // 1. Check plan features first
    if (subscription?.pricing_plan?.features) {
      const features = subscription.pricing_plan.features;
      if (features[featureKey as keyof typeof features] === true) {
        return true;
      }
    }
    
    // 2. Check active add-ons (e.g., peppol purchased separately)
    const hasAddon = addons?.some(
      addon => addon.addon_type === featureKey && addon.status === 'active'
    );
    if (hasAddon) {
      return true;
    }
    
    // Free plan or feature not available
    return false;
  };

  const getUsagePercentage = async (limitType: LimitType): Promise<number> => {
    // Unlimited tenants always show 0% (unlimited)
    if (isUnlimited) return 0;
    
    if (!currentTenant?.id) return 0;

    let limit: number | null = null;
    
    if (subscription?.pricing_plan) {
      switch (limitType) {
        case 'products':
          limit = subscription.pricing_plan.limit_products;
          break;
        case 'orders':
          limit = subscription.pricing_plan.limit_orders;
          break;
        case 'customers':
          limit = subscription.pricing_plan.limit_customers;
          break;
        case 'users':
          limit = subscription.pricing_plan.limit_users;
          break;
      }
    }

    if (limit === null) return 0; // Unlimited

    const count = await countUsage(currentTenant.id, limitType); // LIMITS-1: zelfde telling als de databank

    return Math.min((count / limit) * 100, 100);
  };

  return {
    checkLimit,
    enforceLimit,
    checkFeature,
    getUsagePercentage,
    isOverLimit,
    isTrialing,
    isUnlimited,
    usage,
  };
}

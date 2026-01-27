import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useTenantSubscription } from './useTenantSubscription';
import { useTenantAddons } from './useTenantAddons';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

type LimitType = 'products' | 'orders' | 'customers' | 'users';

export function useUsageLimits() {
  const { currentTenant } = useTenant();
  const { subscription } = useTenantSubscription();
  const { addons } = useTenantAddons();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Internal tenants (SellQo) and demo tenants have unlimited everything
  const isUnlimited = currentTenant?.is_internal_tenant === true || currentTenant?.is_demo === true;

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
      // Default free plan limits
      const freeLimits = {
        products: 25,
        orders: 50,
        customers: 100,
        users: 1,
      };
      limit = freeLimits[limitType];
    }

    // Unlimited
    if (limit === null) return true;

    // Get current count
    let count = 0;
    
    switch (limitType) {
      case 'products':
        const { count: productCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = productCount || 0;
        break;
        
      case 'orders':
        // Orders per month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count: orderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', startOfMonth.toISOString());
        count = orderCount || 0;
        break;
        
      case 'customers':
        const { count: customerCount } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = customerCount || 0;
        break;
        
      case 'users':
        const { count: userCount } = await supabase
          .from('user_roles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = userCount || 0;
        break;
    }

    return count < limit;
  };

  const enforceLimit = async (limitType: LimitType): Promise<boolean> => {
    // Unlimited tenants bypass all limits
    if (isUnlimited) return true;
    
    const withinLimit = await checkLimit(limitType);
    
    if (!withinLimit) {
      const limitLabels: Record<LimitType, string> = {
        products: t('pricing.features.products'),
        orders: t('pricing.features.orders_per_month'),
        customers: t('pricing.features.customers'),
        users: t('pricing.features.team_members'),
      };

      toast({
        title: t('billing.upgrade_needed'),
        description: `Je hebt de ${limitLabels[limitType]} limiet van je abonnement bereikt. Upgrade je plan om door te gaan.`,
        variant: 'destructive',
      });
    }
    
    return withinLimit;
  };

  const checkFeature = (featureKey: string): boolean => {
    // Unlimited tenants have all features enabled
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

    let count = 0;
    
    switch (limitType) {
      case 'products':
        const { count: productCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = productCount || 0;
        break;
      case 'orders':
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count: orderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', startOfMonth.toISOString());
        count = orderCount || 0;
        break;
      case 'customers':
        const { count: customerCount } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = customerCount || 0;
        break;
      case 'users':
        const { count: userCount } = await supabase
          .from('user_roles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        count = userCount || 0;
        break;
    }

    return Math.min((count / limit) * 100, 100);
  };

  return {
    checkLimit,
    enforceLimit,
    checkFeature,
    getUsagePercentage,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  PlatformCoupon, 
  PlatformCouponFormData, 
  PlatformCouponRedemption,
  PlatformQuickAction,
  TenantLoyaltyReward 
} from '@/types/platformPromotion';

// Coupon Hooks
export function usePlatformCoupons() {
  return useQuery({
    queryKey: ['platform-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PlatformCoupon[];
    },
  });
}

export function usePlatformCoupon(couponId: string | undefined) {
  return useQuery({
    queryKey: ['platform-coupon', couponId],
    queryFn: async () => {
      if (!couponId) return null;
      const { data, error } = await supabase
        .from('platform_coupons')
        .select('*')
        .eq('id', couponId)
        .single();
      
      if (error) throw error;
      return data as PlatformCoupon;
    },
    enabled: !!couponId,
  });
}

export function useCreatePlatformCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: PlatformCouponFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('platform_coupons')
        .insert({
          ...formData,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as PlatformCoupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success('Coupon aangemaakt');
    },
    onError: (error) => {
      toast.error('Fout bij aanmaken coupon: ' + error.message);
    },
  });
}

export function useUpdatePlatformCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<PlatformCouponFormData> }) => {
      const { data, error } = await supabase
        .from('platform_coupons')
        .update(formData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as PlatformCoupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success('Coupon bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken coupon: ' + error.message);
    },
  });
}

export function useDeletePlatformCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_coupons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success('Coupon verwijderd');
    },
    onError: (error) => {
      toast.error('Fout bij verwijderen coupon: ' + error.message);
    },
  });
}

// Coupon Redemption Hooks
export function useCouponRedemptions(couponId?: string) {
  return useQuery({
    queryKey: ['platform-coupon-redemptions', couponId],
    queryFn: async () => {
      let query = supabase
        .from('platform_coupon_redemptions')
        .select('*, platform_coupons(*), tenants(id, name)')
        .order('redeemed_at', { ascending: false });
      
      if (couponId) {
        query = query.eq('coupon_id', couponId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(r => ({
        ...r,
        coupon: r.platform_coupons,
        tenant: r.tenants,
      })) as PlatformCouponRedemption[];
    },
  });
}

export function useTenantCouponRedemptions(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform-tenant-redemptions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('platform_coupon_redemptions')
        .select('*, platform_coupons(*)')
        .eq('tenant_id', tenantId)
        .order('redeemed_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(r => ({
        ...r,
        coupon: r.platform_coupons,
      })) as PlatformCouponRedemption[];
    },
    enabled: !!tenantId,
  });
}

export function useApplyCouponToTenant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ couponId, tenantId }: { couponId: string; tenantId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get coupon details
      const { data: coupon, error: couponError } = await supabase
        .from('platform_coupons')
        .select('*')
        .eq('id', couponId)
        .single();
      
      if (couponError) throw couponError;
      
      // Create redemption record
      const { data, error } = await supabase
        .from('platform_coupon_redemptions')
        .insert({
          coupon_id: couponId,
          tenant_id: tenantId,
          discount_applied: coupon.discount_value,
          applied_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update coupon usage count
      await supabase
        .from('platform_coupons')
        .update({ used_count: (coupon.used_count || 0) + 1 })
        .eq('id', couponId);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['platform-coupon-redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-redemptions', variables.tenantId] });
      toast.success('Coupon toegepast op tenant');
    },
    onError: (error) => {
      toast.error('Fout bij toepassen coupon: ' + error.message);
    },
  });
}

// Quick Actions Hooks
export function usePlatformQuickActions() {
  return useQuery({
    queryKey: ['platform-quick-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_quick_actions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PlatformQuickAction[];
    },
  });
}

export function useExecuteQuickAction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ actionId, tenantId }: { actionId: string; tenantId: string }) => {
      // Get the action config
      const { data: action, error: actionError } = await supabase
        .from('platform_quick_actions')
        .select('*')
        .eq('id', actionId)
        .single();
      
      if (actionError) throw actionError;
      
      const config = action.action_config as Record<string, unknown>;
      let notificationTitle = '';
      let notificationMessage = '';
      
      // Execute based on action type
      switch (action.action_type) {
        case 'add_credits': {
          const amount = config.amount as number;
          const reason = config.reason as string || action.name;
          
          await supabase.rpc('admin_adjust_ai_credits', {
            p_tenant_id: tenantId,
            p_adjustment: amount,
            p_reason: reason,
          });
          
          notificationTitle = '🎁 Gratis AI Credits Ontvangen!';
          notificationMessage = `Je hebt ${amount} gratis AI credits ontvangen. ${reason ? `Reden: ${reason}` : ''}`;
          break;
        }
        
        case 'gift_months': {
          const months = config.months as number;
          
          const { error } = await supabase.functions.invoke('platform-gift-month', {
            body: { tenantId, months },
          });
          
          if (error) throw error;
          
          notificationTitle = '🎉 Gratis Maand(en) Ontvangen!';
          notificationMessage = `Je abonnement is verlengd met ${months} gratis ${months === 1 ? 'maand' : 'maanden'}. Geniet ervan!`;
          break;
        }
        
        case 'unlock_feature': {
          const feature = config.feature as string;
          const days = config.days as number;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + days);
          
          // Check if override exists
          const { data: existing } = await supabase
            .from('tenant_feature_overrides')
            .select('id')
            .eq('tenant_id', tenantId)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from('tenant_feature_overrides')
              .update({ 
                [feature]: true,
                extended_trial_until: expiresAt.toISOString(),
              })
              .eq('tenant_id', tenantId);
          } else {
            await supabase
              .from('tenant_feature_overrides')
              .insert({ 
                tenant_id: tenantId,
                [feature]: true,
                extended_trial_until: expiresAt.toISOString(),
              });
          }
          
          const featureNames: Record<string, string> = {
            'module_ai_marketing': 'AI Marketing',
            'module_peppol': 'Peppol e-Facturatie',
            'module_multi_currency': 'Multi-Currency',
            'module_advanced_analytics': 'Geavanceerde Analytics',
            'module_api_access': 'API Access',
            'module_webhooks': 'Webhooks',
            'module_white_label': 'White Label',
          };
          
          notificationTitle = '🔓 Nieuwe Module Geactiveerd!';
          notificationMessage = `${featureNames[feature] || feature} is ${days} dagen gratis voor je geactiveerd. Probeer het uit!`;
          break;
        }
        
        case 'extend_trial': {
          const days = config.days as number;
          
          // Get current subscription
          const { data: sub } = await supabase
            .from('tenant_subscriptions')
            .select('trial_end')
            .eq('tenant_id', tenantId)
            .single();
          
          const currentEnd = sub?.trial_end ? new Date(sub.trial_end) : new Date();
          currentEnd.setDate(currentEnd.getDate() + days);
          
          await supabase
            .from('tenant_subscriptions')
            .update({ trial_end: currentEnd.toISOString() })
            .eq('tenant_id', tenantId);
          
          notificationTitle = '⏰ Trial Verlengd!';
          notificationMessage = `Je trial periode is verlengd met ${days} dagen. Blijf ontdekken!`;
          break;
        }
        
        case 'apply_discount': {
          const percent = config.percent as number;
          const months = config.months as number;
          const reason = config.reason as string || 'Churn prevention';
          
          // Get current subscription
          const { data: sub } = await supabase
            .from('tenant_subscriptions')
            .select('id')
            .eq('tenant_id', tenantId)
            .single();
          
          if (sub) {
            const discountEnd = new Date();
            discountEnd.setMonth(discountEnd.getMonth() + months);
            
            await supabase
              .from('tenant_subscriptions')
              .update({ 
                discount_percent: percent,
                discount_end_date: discountEnd.toISOString(),
              } as any)
              .eq('tenant_id', tenantId);
          }
          
          notificationTitle = '💰 Korting Geactiveerd!';
          notificationMessage = `Je krijgt ${percent}% korting voor de komende ${months} ${months === 1 ? 'maand' : 'maanden'}. ${reason}`;
          break;
        }
        
        default:
          throw new Error('Onbekend actie type: ' + action.action_type);
      }
      
      // Send notification to tenant
      if (notificationTitle && notificationMessage) {
        await supabase.functions.invoke('create-notification', {
          body: {
            tenant_id: tenantId,
            category: 'system',
            type: 'platform_gift',
            title: notificationTitle,
            message: notificationMessage,
            priority: 'high',
            action_url: '/admin/billing',
            data: {
              action_type: action.action_type,
              action_name: action.name,
              action_config: config,
            },
          },
        });
      }
      
      // Log the action
      await supabase.rpc('log_admin_action', {
        p_target_tenant_id: tenantId,
        p_action_type: 'quick_action_executed',
        p_action_details: JSON.parse(JSON.stringify({
          action_id: actionId,
          action_name: action.name,
          action_type: action.action_type,
          action_config: config,
        })),
      });
      
      return action;
    },
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-credits'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-actions'] });
      toast.success(`Actie "${action.name}" uitgevoerd`);
    },
    onError: (error) => {
      toast.error('Fout bij uitvoeren actie: ' + error.message);
    },
  });
}

// Loyalty Rewards Hooks
export function useTenantLoyaltyRewards(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform-tenant-rewards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('tenant_loyalty_rewards')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TenantLoyaltyReward[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateLoyaltyReward() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reward: {
      tenant_id: string;
      reward_type: string;
      name: string;
      description?: string | null;
      value: Record<string, unknown>;
      expires_at?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('tenant_loyalty_rewards')
        .insert({
          tenant_id: reward.tenant_id,
          reward_type: reward.reward_type,
          name: reward.name,
          description: reward.description,
          value: JSON.parse(JSON.stringify(reward.value)),
          expires_at: reward.expires_at,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as TenantLoyaltyReward;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-rewards', data.tenant_id] });
      toast.success('Loyalty reward aangemaakt');
    },
    onError: (error) => {
      toast.error('Fout bij aanmaken reward: ' + error.message);
    },
  });
}

export function useApplyLoyaltyReward() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('tenant_loyalty_rewards')
        .update({
          applied: true,
          applied_at: new Date().toISOString(),
          applied_by: user?.id,
        })
        .eq('id', rewardId)
        .select()
        .single();
      
      if (error) throw error;
      return data as TenantLoyaltyReward;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-rewards', data.tenant_id] });
      toast.success('Reward toegepast');
    },
    onError: (error) => {
      toast.error('Fout bij toepassen reward: ' + error.message);
    },
  });
}

// Helper to generate random coupon code
export function generateCouponCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

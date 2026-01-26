import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { 
  ORDER_MILESTONES, 
  REVENUE_MILESTONES, 
  CUSTOMER_MILESTONES,
  getMilestoneDefinition,
  type MilestoneType 
} from '@/config/milestones';

interface TenantMilestone {
  id: string;
  tenant_id: string;
  milestone_type: string;
  milestone_value: number;
  achieved_at: string;
  shown_at: string | null;
  acknowledged_at: string | null;
  feedback_requested: boolean;
}

interface PendingMilestone {
  id: string;
  type: MilestoneType;
  value: number;
  badgeId: string;
  badgeName: string;
  emoji: string;
  title: string;
  description: string;
  celebrationMessage: string;
  shouldRequestFeedback: boolean;
}

interface TenantStats {
  lifetime_order_count: number;
  lifetime_revenue: number;
  lifetime_customer_count: number;
}

export function useMilestones() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [pendingMilestone, setPendingMilestone] = useState<PendingMilestone | null>(null);

  // Fetch tenant stats
  const { data: tenantStats } = useQuery({
    queryKey: ['tenant-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('tenants')
        .select('lifetime_order_count, lifetime_revenue, lifetime_customer_count')
        .eq('id', currentTenant.id)
        .single();
      
      if (error) throw error;
      return data as TenantStats;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch achieved milestones
  const { data: achievedMilestones } = useQuery({
    queryKey: ['tenant-milestones', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('tenant_milestones')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('achieved_at', { ascending: false });
      
      if (error) throw error;
      return data as TenantMilestone[];
    },
    enabled: !!currentTenant?.id,
  });

  // Count total milestones for feedback timing
  const totalAchievedCount = achievedMilestones?.length || 0;

  // Check for new milestones and create them
  const checkAndCreateMilestones = useCallback(async () => {
    if (!currentTenant?.id || !tenantStats) return;

    const achievedValues = {
      orders: achievedMilestones?.filter((m) => m.milestone_type === 'orders').map((m) => m.milestone_value) || [],
      revenue: achievedMilestones?.filter((m) => m.milestone_type === 'revenue').map((m) => m.milestone_value) || [],
      customers: achievedMilestones?.filter((m) => m.milestone_type === 'customers').map((m) => m.milestone_value) || [],
    };

    const milestoneConfigs = [
      { type: 'orders' as const, current: tenantStats.lifetime_order_count || 0, thresholds: ORDER_MILESTONES },
      { type: 'revenue' as const, current: tenantStats.lifetime_revenue || 0, thresholds: REVENUE_MILESTONES },
      { type: 'customers' as const, current: tenantStats.lifetime_customer_count || 0, thresholds: CUSTOMER_MILESTONES },
    ];

    for (const config of milestoneConfigs) {
      // Find the highest milestone that:
      // 1. Current value has reached
      // 2. Is not yet achieved
      const newMilestones = config.thresholds.filter(
        (m) => config.current >= m.value && !achievedValues[config.type].includes(m.value)
      );

      for (const milestone of newMilestones) {
        // Create the milestone record
        const { data, error } = await supabase
          .from('tenant_milestones')
          .insert({
            tenant_id: currentTenant.id,
            milestone_type: config.type,
            milestone_value: milestone.value,
          })
          .select()
          .single();

        if (!error && data) {
          // Also create the badge
          await supabase
            .from('tenant_badges')
            .insert({
              tenant_id: currentTenant.id,
              badge_id: milestone.badgeId,
              badge_name: milestone.badgeName,
              badge_emoji: milestone.emoji,
              badge_description: milestone.description,
            })
            .single();
        }
      }
    }

    // Refresh milestones data
    queryClient.invalidateQueries({ queryKey: ['tenant-milestones', currentTenant.id] });
    queryClient.invalidateQueries({ queryKey: ['tenant-badges', currentTenant.id] });
  }, [currentTenant?.id, tenantStats, achievedMilestones, queryClient]);

  // Check for pending (unshown) milestones
  useEffect(() => {
    if (!achievedMilestones) return;

    const unshown = achievedMilestones.find((m) => m.shown_at === null);
    if (unshown) {
      const definition = getMilestoneDefinition(unshown.milestone_type as MilestoneType, unshown.milestone_value);
      if (definition) {
        // Request feedback every 5th milestone
        const shouldRequestFeedback = (totalAchievedCount + 1) % 5 === 0;
        
        setPendingMilestone({
          id: unshown.id,
          type: unshown.milestone_type as MilestoneType,
          value: unshown.milestone_value,
          badgeId: definition.badgeId,
          badgeName: definition.badgeName,
          emoji: definition.emoji,
          title: definition.title,
          description: definition.description,
          celebrationMessage: definition.celebrationMessage,
          shouldRequestFeedback,
        });
      }
    } else {
      setPendingMilestone(null);
    }
  }, [achievedMilestones, totalAchievedCount]);

  // Run milestone check on mount and when stats change
  useEffect(() => {
    if (tenantStats && achievedMilestones) {
      checkAndCreateMilestones();
    }
  }, [tenantStats?.lifetime_order_count, tenantStats?.lifetime_revenue, tenantStats?.lifetime_customer_count]);

  // Acknowledge milestone (mark as shown)
  const acknowledgeMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from('tenant_milestones')
        .update({ 
          shown_at: new Date().toISOString(),
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setPendingMilestone(null);
      queryClient.invalidateQueries({ queryKey: ['tenant-milestones', currentTenant?.id] });
    },
  });

  return {
    pendingMilestone,
    achievedMilestones: achievedMilestones || [],
    tenantStats,
    acknowledgeMilestone: (id: string) => acknowledgeMilestone.mutateAsync(id),
    isAcknowledging: acknowledgeMilestone.isPending,
  };
}

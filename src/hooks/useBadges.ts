import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { ALL_BADGES, getBadgeById, type BadgeDefinition } from '@/config/badges';

interface TenantBadge {
  id: string;
  tenant_id: string;
  badge_id: string;
  badge_name: string;
  badge_emoji: string;
  badge_description: string | null;
  earned_at: string;
  display_order: number;
}

export interface BadgeWithStatus extends BadgeDefinition {
  earned: boolean;
  earnedAt?: string;
}

export function useBadges() {
  const { currentTenant } = useTenant();

  // Fetch earned badges
  const { data: earnedBadges, isLoading } = useQuery({
    queryKey: ['tenant-badges', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('tenant_badges')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('earned_at', { ascending: true });
      
      if (error) throw error;
      return data as TenantBadge[];
    },
    enabled: !!currentTenant?.id,
  });

  // Create a map of earned badge IDs to their data
  const earnedBadgeMap = new Map(
    earnedBadges?.map((b) => [b.badge_id, b]) || []
  );

  // Combine all badges with their earned status
  const allBadgesWithStatus: BadgeWithStatus[] = ALL_BADGES.map((badge) => {
    const earned = earnedBadgeMap.get(badge.id);
    return {
      ...badge,
      earned: !!earned,
      earnedAt: earned?.earned_at,
    };
  });

  // Get only earned badges
  const earnedBadgesList = allBadgesWithStatus.filter((b) => b.earned);

  // Get badges by category with status
  const getBadgesByCategoryWithStatus = (category: BadgeDefinition['category']) => {
    return allBadgesWithStatus.filter((b) => b.category === category);
  };

  // Count earned badges by category
  const badgeCounts = {
    orders: earnedBadgesList.filter((b) => b.category === 'orders').length,
    revenue: earnedBadgesList.filter((b) => b.category === 'revenue').length,
    customers: earnedBadgesList.filter((b) => b.category === 'customers').length,
    special: earnedBadgesList.filter((b) => b.category === 'special').length,
    total: earnedBadgesList.length,
  };

  return {
    allBadges: allBadgesWithStatus,
    earnedBadges: earnedBadgesList,
    badgeCounts,
    getBadgesByCategoryWithStatus,
    isLoading,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface ContentEngagementStats {
  id: string;
  tenant_id: string;
  content_type: string;
  platform: string | null;
  title: string | null;
  language: string;
  created_at: string;
  is_used: boolean;
  used_at: string | null;
  publish_status: string;
  published_at: string | null;
  social_post_id: string | null;
  social_status: string | null;
  engagement_data: any;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export interface ContentAnalyticsSummary {
  totalContent: number;
  usedContent: number;
  publishedContent: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  contentByType: Record<string, number>;
  contentByPlatform: Record<string, number>;
  contentByLanguage: Record<string, number>;
  topPerformingContent: ContentEngagementStats[];
  recentContent: ContentEngagementStats[];
}

export function useContentAnalytics() {
  const { currentTenant } = useTenant();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['content-analytics', currentTenant?.id],
    queryFn: async (): Promise<ContentAnalyticsSummary> => {
      if (!currentTenant?.id) {
        return getEmptyStats();
      }

      // Fetch from the view
      const { data, error } = await supabase
        .from('ai_content_engagement_stats')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const contents = (data || []) as ContentEngagementStats[];

      // Calculate summary stats
      const totalContent = contents.length;
      const usedContent = contents.filter(c => c.is_used).length;
      const publishedContent = contents.filter(c => c.publish_status === 'published').length;
      
      const totalLikes = contents.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalComments = contents.reduce((sum, c) => sum + (c.comments || 0), 0);
      const totalShares = contents.reduce((sum, c) => sum + (c.shares || 0), 0);
      const totalImpressions = contents.reduce((sum, c) => sum + (c.impressions || 0), 0);

      const avgEngagementRate = totalImpressions > 0 
        ? ((totalLikes + totalComments + totalShares) / totalImpressions) * 100 
        : 0;

      // Group by type
      const contentByType: Record<string, number> = {};
      const contentByPlatform: Record<string, number> = {};
      const contentByLanguage: Record<string, number> = {};

      contents.forEach(c => {
        contentByType[c.content_type] = (contentByType[c.content_type] || 0) + 1;
        if (c.platform) {
          contentByPlatform[c.platform] = (contentByPlatform[c.platform] || 0) + 1;
        }
        contentByLanguage[c.language || 'nl'] = (contentByLanguage[c.language || 'nl'] || 0) + 1;
      });

      // Top performing (sorted by engagement)
      const topPerformingContent = [...contents]
        .filter(c => c.social_post_id)
        .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
        .slice(0, 5);

      // Recent content
      const recentContent = contents.slice(0, 10);

      return {
        totalContent,
        usedContent,
        publishedContent,
        totalLikes,
        totalComments,
        totalShares,
        totalImpressions,
        avgEngagementRate,
        contentByType,
        contentByPlatform,
        contentByLanguage,
        topPerformingContent,
        recentContent,
      };
    },
    enabled: !!currentTenant?.id,
  });

  return {
    stats: stats || getEmptyStats(),
    isLoading,
  };
}

function getEmptyStats(): ContentAnalyticsSummary {
  return {
    totalContent: 0,
    usedContent: 0,
    publishedContent: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalImpressions: 0,
    avgEngagementRate: 0,
    contentByType: {},
    contentByPlatform: {},
    contentByLanguage: {},
    topPerformingContent: [],
    recentContent: [],
  };
}

export function useContentTrends(days: number = 30) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['content-trends', currentTenant?.id, days],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('created_at, content_type, platform, is_used')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const trendsByDate: Record<string, { date: string; count: number; used: number }> = {};
      
      (data || []).forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        if (!trendsByDate[date]) {
          trendsByDate[date] = { date, count: 0, used: 0 };
        }
        trendsByDate[date].count++;
        if (item.is_used) {
          trendsByDate[date].used++;
        }
      });

      return Object.values(trendsByDate);
    },
    enabled: !!currentTenant?.id,
  });
}

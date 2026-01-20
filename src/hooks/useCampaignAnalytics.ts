import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LinkClickStats {
  link_url: string;
  click_count: number;
  unique_clicks: number;
}

interface HourlyStats {
  hour: string;
  opens: number;
  clicks: number;
}

export function useCampaignAnalytics(campaignId: string | undefined) {
  // Fetch link click statistics
  const { data: linkClicks = [], isLoading: linkClicksLoading } = useQuery({
    queryKey: ['campaign-link-clicks', campaignId],
    queryFn: async (): Promise<LinkClickStats[]> => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('campaign_link_clicks')
        .select('link_url')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Group by URL and count
      const urlCounts = new Map<string, { total: number; unique: Set<string> }>();
      
      data?.forEach((click: { link_url: string }) => {
        const existing = urlCounts.get(click.link_url) || { total: 0, unique: new Set() };
        existing.total++;
        urlCounts.set(click.link_url, existing);
      });

      return Array.from(urlCounts.entries())
        .map(([link_url, counts]) => ({
          link_url,
          click_count: counts.total,
          unique_clicks: counts.unique.size || counts.total,
        }))
        .sort((a, b) => b.click_count - a.click_count);
    },
    enabled: !!campaignId,
  });

  // Fetch hourly activity stats
  const { data: hourlyStats = [], isLoading: hourlyLoading } = useQuery({
    queryKey: ['campaign-hourly-stats', campaignId],
    queryFn: async (): Promise<HourlyStats[]> => {
      if (!campaignId) return [];

      const { data: sends, error } = await supabase
        .from('campaign_sends')
        .select('opened_at, clicked_at')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Group by hour
      const hourlyData = new Map<string, { opens: number; clicks: number }>();

      sends?.forEach((send: { opened_at: string | null; clicked_at: string | null }) => {
        if (send.opened_at) {
          const hour = new Date(send.opened_at).toISOString().slice(0, 13) + ':00';
          const existing = hourlyData.get(hour) || { opens: 0, clicks: 0 };
          existing.opens++;
          hourlyData.set(hour, existing);
        }
        if (send.clicked_at) {
          const hour = new Date(send.clicked_at).toISOString().slice(0, 13) + ':00';
          const existing = hourlyData.get(hour) || { opens: 0, clicks: 0 };
          existing.clicks++;
          hourlyData.set(hour, existing);
        }
      });

      return Array.from(hourlyData.entries())
        .map(([hour, data]) => ({
          hour,
          opens: data.opens,
          clicks: data.clicks,
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));
    },
    enabled: !!campaignId,
  });

  return {
    linkClicks,
    hourlyStats,
    isLoading: linkClicksLoading || hourlyLoading,
  };
}

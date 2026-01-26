import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

export interface CalendarContentItem {
  id: string;
  type: 'social_post' | 'email_campaign' | 'ai_content';
  title: string;
  platform: string | null;
  status: string;
  scheduled_at: string;
  content_preview: string | null;
  image_url: string | null;
}

export function useContentCalendar(view: 'week' | 'month', currentDate: Date) {
  const { currentTenant } = useTenant();

  const dateRange = view === 'week' 
    ? { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) }
    : { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };

  const { data: calendarItems = [], isLoading } = useQuery({
    queryKey: ['content-calendar', currentTenant?.id, view, format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const items: CalendarContentItem[] = [];
      const startISO = dateRange.start.toISOString();
      const endISO = dateRange.end.toISOString();

      // Fetch AI generated content with scheduled_at
      const { data: aiContent } = await supabase
        .from('ai_generated_content')
        .select('id, title, content_text, platform, scheduled_at, publish_status, image_urls')
        .eq('tenant_id', currentTenant.id)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', startISO)
        .lte('scheduled_at', endISO);

      if (aiContent) {
        for (const item of aiContent) {
          items.push({
            id: item.id,
            type: 'ai_content',
            title: item.title || 'AI Content',
            platform: item.platform,
            status: item.publish_status || 'draft',
            scheduled_at: item.scheduled_at!,
            content_preview: item.content_text?.slice(0, 100) || null,
            image_url: item.image_urls?.[0] || null,
          });
        }
      }

      // Fetch social posts with scheduled_for
      const { data: socialPosts } = await supabase
        .from('social_posts')
        .select('id, post_text, platform, status, scheduled_for, image_urls')
        .eq('tenant_id', currentTenant.id)
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', startISO)
        .lte('scheduled_for', endISO);

      if (socialPosts) {
        for (const post of socialPosts) {
          items.push({
            id: post.id,
            type: 'social_post',
            title: post.post_text?.slice(0, 50) || 'Social Post',
            platform: post.platform,
            status: post.status || 'draft',
            scheduled_at: post.scheduled_for!,
            content_preview: post.post_text?.slice(0, 100) || null,
            image_url: post.image_urls?.[0] || null,
          });
        }
      }

      // Fetch email campaigns with scheduled_at
      const { data: emailCampaigns } = await supabase
        .from('email_campaigns')
        .select('id, name, status, scheduled_at')
        .eq('tenant_id', currentTenant.id)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', startISO)
        .lte('scheduled_at', endISO);

      if (emailCampaigns) {
        for (const campaign of emailCampaigns) {
          items.push({
            id: campaign.id,
            type: 'email_campaign',
            title: campaign.name,
            platform: 'email',
            status: campaign.status,
            scheduled_at: campaign.scheduled_at!,
            content_preview: null,
            image_url: null,
          });
        }
      }

      // Sort by scheduled_at
      return items.sort((a, b) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
    },
    enabled: !!currentTenant?.id,
  });

  return {
    calendarItems,
    isLoading,
    dateRange,
  };
}

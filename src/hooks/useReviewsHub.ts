import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { 
  ReviewPlatformConnection, 
  ExternalReview, 
  ReviewPlatform,
  AggregateReviewData,
  getPlatformInfo 
} from '@/types/reviews-hub';
import { REVIEW_PLATFORMS } from '@/types/reviews-hub';

export function useReviewsHub() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch all platform connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['review-connections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('review_platform_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('platform');
      
      if (error) throw error;
      return data as ReviewPlatformConnection[];
    },
    enabled: !!tenantId,
  });

  // Fetch all external reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['external-reviews', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('external_reviews')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('review_date', { ascending: false });
      
      if (error) throw error;
      return data as ExternalReview[];
    },
    enabled: !!tenantId,
  });

  // Calculate aggregate data
  const aggregateData: AggregateReviewData = {
    average_rating: 0,
    total_reviews: 0,
    platforms: [],
  };

  const enabledConnections = connections.filter(c => c.is_enabled && c.cached_review_count > 0);
  if (enabledConnections.length > 0) {
    let totalRating = 0;
    let totalCount = 0;

    enabledConnections.forEach(conn => {
      const platformInfo = REVIEW_PLATFORMS.find(p => p.id === conn.platform);
      if (conn.cached_rating && conn.cached_review_count > 0) {
        totalRating += conn.cached_rating * conn.cached_review_count;
        totalCount += conn.cached_review_count;
        
        aggregateData.platforms.push({
          platform: conn.platform as ReviewPlatform,
          rating: conn.cached_rating,
          count: conn.cached_review_count,
          name: platformInfo?.name || conn.platform,
          logo: platformInfo?.logo || '',
        });
      }
    });

    if (totalCount > 0) {
      aggregateData.average_rating = Math.round((totalRating / totalCount) * 10) / 10;
      aggregateData.total_reviews = totalCount;
    }
  }

  // Create or update a platform connection
  const upsertConnection = useMutation({
    mutationFn: async (data: Partial<ReviewPlatformConnection> & { platform: ReviewPlatform }) => {
      if (!tenantId) throw new Error('No tenant');
      
      const existing = connections.find(c => c.platform === data.platform);
      
      // Extract only the fields we want to save
      const saveData = {
        platform: data.platform,
        is_enabled: data.is_enabled,
        api_key: data.api_key,
        api_secret: data.api_secret,
        external_id: data.external_id,
        external_url: data.external_url,
        display_name: data.display_name,
        sync_frequency: data.sync_frequency,
        settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : {},
      };
      
      if (existing) {
        const { error } = await supabase
          .from('review_platform_connections')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('review_platform_connections')
          .insert({
            tenant_id: tenantId,
            ...saveData,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-connections', tenantId] });
      toast.success('Platform verbinding opgeslagen');
    },
    onError: (error) => {
      toast.error('Fout bij opslaan: ' + error.message);
    },
  });

  // Delete a platform connection
  const deleteConnection = useMutation({
    mutationFn: async (platform: ReviewPlatform) => {
      const connection = connections.find(c => c.platform === platform);
      if (!connection) throw new Error('Connection not found');
      
      const { error } = await supabase
        .from('review_platform_connections')
        .delete()
        .eq('id', connection.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-connections', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['external-reviews', tenantId] });
      toast.success('Platform ontkoppeld');
    },
    onError: (error) => {
      toast.error('Fout bij ontkoppelen: ' + error.message);
    },
  });

  // Toggle review visibility
  const toggleReviewVisibility = useMutation({
    mutationFn: async ({ reviewId, visible }: { reviewId: string; visible: boolean }) => {
      const { error } = await supabase
        .from('external_reviews')
        .update({ is_visible: visible, updated_at: new Date().toISOString() })
        .eq('id', reviewId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-reviews', tenantId] });
    },
  });

  // Toggle review featured status
  const toggleReviewFeatured = useMutation({
    mutationFn: async ({ reviewId, featured }: { reviewId: string; featured: boolean }) => {
      const { error } = await supabase
        .from('external_reviews')
        .update({ is_featured: featured, updated_at: new Date().toISOString() })
        .eq('id', reviewId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-reviews', tenantId] });
      toast.success('Review status bijgewerkt');
    },
  });

  // Sync reviews for a platform
  const syncPlatform = useMutation({
    mutationFn: async (platform: ReviewPlatform) => {
      const connection = connections.find(c => c.platform === platform);
      if (!connection) throw new Error('Platform not connected');
      
      // Update status to syncing
      await supabase
        .from('review_platform_connections')
        .update({ sync_status: 'syncing' })
        .eq('id', connection.id);
      
      // Call edge function
      const { data, error } = await supabase.functions.invoke('sync-platform-reviews', {
        body: { 
          tenant_id: tenantId,
          platform,
          connection_id: connection.id,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['review-connections', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['external-reviews', tenantId] });
      const platformName = REVIEW_PLATFORMS.find(p => p.id === platform)?.name || platform;
      toast.success(`${platformName} reviews gesynchroniseerd`);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['review-connections', tenantId] });
      toast.error('Sync mislukt: ' + error.message);
    },
  });

  // Sync all enabled platforms
  const syncAllPlatforms = useMutation({
    mutationFn: async () => {
      const enabledPlatforms = connections.filter(c => c.is_enabled);
      const results = await Promise.allSettled(
        enabledPlatforms.map(c => syncPlatform.mutateAsync(c.platform as ReviewPlatform))
      );
      return results;
    },
    onSuccess: () => {
      toast.success('Alle platformen gesynchroniseerd');
    },
  });

  return {
    connections,
    reviews,
    aggregateData,
    isLoading: connectionsLoading || reviewsLoading,
    upsertConnection,
    deleteConnection,
    toggleReviewVisibility,
    toggleReviewFeatured,
    syncPlatform,
    syncAllPlatforms,
  };
}

// Hook for public storefront access
export function usePublicReviews(tenantId: string | undefined) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['public-reviews', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('external_reviews')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_visible', true)
        .order('is_featured', { ascending: false })
        .order('review_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ExternalReview[];
    },
    enabled: !!tenantId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['public-review-connections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('review_platform_connections')
        .select('platform, cached_rating, cached_review_count, display_name')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Calculate aggregate
  const aggregate: AggregateReviewData = {
    average_rating: 0,
    total_reviews: 0,
    platforms: [],
  };

  if (connections.length > 0) {
    let totalRating = 0;
    let totalCount = 0;

    connections.forEach(conn => {
      const platformInfo = REVIEW_PLATFORMS.find(p => p.id === conn.platform);
      if (conn.cached_rating && conn.cached_review_count > 0) {
        totalRating += conn.cached_rating * conn.cached_review_count;
        totalCount += conn.cached_review_count;
        
        aggregate.platforms.push({
          platform: conn.platform as ReviewPlatform,
          rating: conn.cached_rating,
          count: conn.cached_review_count,
          name: platformInfo?.name || conn.platform,
          logo: platformInfo?.logo || '',
        });
      }
    });

    if (totalCount > 0) {
      aggregate.average_rating = Math.round((totalRating / totalCount) * 10) / 10;
      aggregate.total_reviews = totalCount;
    }
  }

  return {
    reviews,
    aggregate,
    connections,
    isLoading,
  };
}

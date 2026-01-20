import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface SocialConnection {
  id: string;
  tenant_id: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  account_id: string | null;
  account_name: string | null;
  account_avatar: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  content_id: string | null;
  platform: string;
  post_text: string;
  image_urls: string[] | null;
  scheduled_for: string | null;
  posted_at: string | null;
  platform_post_id: string | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  error_message: string | null;
  engagement_data: {
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
  };
  created_at: string;
  updated_at: string;
}

export function useSocialConnections() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['social-connections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SocialConnection[];
    },
    enabled: !!currentTenant?.id,
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      toast({ title: 'Verbinding verwijderd' });
    },
  });

  const toggleConnection = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('social_connections')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-connections'] });
    },
  });

  const getConnectionByPlatform = (platform: string) => {
    return connections.find(c => c.platform === platform && c.is_active);
  };

  return {
    connections,
    isLoading,
    deleteConnection,
    toggleConnection,
    getConnectionByPlatform,
  };
}

export function useSocialPosts() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['social-posts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SocialPost[];
    },
    enabled: !!currentTenant?.id,
  });

  const createPost = useMutation({
    mutationFn: async (post: { platform: string; post_text: string; image_urls?: string[]; scheduled_for?: string; status?: string; connection_id?: string; content_id?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          tenant_id: currentTenant.id,
          platform: post.platform,
          post_text: post.post_text,
          image_urls: post.image_urls || [],
          scheduled_for: post.scheduled_for,
          status: post.status || 'draft',
          connection_id: post.connection_id,
          content_id: post.content_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({ title: 'Post aangemaakt!' });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SocialPost> & { id: string }) => {
      const { data, error } = await supabase
        .from('social_posts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({ title: 'Post verwijderd' });
    },
  });

  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const draftPosts = posts.filter(p => p.status === 'draft');
  const postedPosts = posts.filter(p => p.status === 'posted');

  return {
    posts,
    scheduledPosts,
    draftPosts,
    postedPosts,
    isLoading,
    createPost,
    updatePost,
    deletePost,
  };
}

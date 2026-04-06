import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface NewsletterConfig {
  id: string;
  tenant_id: string;
  provider: 'internal' | 'mailchimp' | 'klaviyo';
  mailchimp_api_key: string | null;
  mailchimp_server_prefix: string | null;
  mailchimp_audience_id: string | null;
  klaviyo_api_key: string | null;
  klaviyo_list_id: string | null;
  double_optin: boolean;
  welcome_email_enabled: boolean;
  welcome_email_subject: string | null;
  welcome_email_body: string | null;
}

export function useNewsletterConfig() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['newsletter-config', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('tenant_newsletter_config')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as NewsletterConfig | null;
    },
    enabled: !!currentTenant?.id,
  });

  const saveConfig = useMutation({
    mutationFn: async (newConfig: Partial<NewsletterConfig>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const configData = {
        tenant_id: currentTenant.id,
        ...newConfig,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('tenant_newsletter_config')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_newsletter_config')
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-config'] });
      toast.success('Nieuwsbrief instellingen opgeslagen');
    },
    onError: (error) => {
      console.error('Save config error:', error);
      toast.error('Fout bij opslaan instellingen');
    },
  });

  const testConnection = useMutation({
    mutationFn: async (testConfig: {
      provider: 'mailchimp' | 'klaviyo';
      apiKey: string;
      serverPrefix?: string;
      audienceId?: string;
      listId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('newsletter-test-connection', {
        body: testConfig,
      });

      if (error) throw error;
      return data;
    },
  });

  return {
    config,
    isLoading,
    saveConfig,
    testConnection,
  };
}

export function useNewsletterSubscribers() {
  const { currentTenant } = useTenant();

  const { data: subscribers, isLoading } = useQuery({
    queryKey: ['newsletter-subscribers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const stats = {
    total: subscribers?.length || 0,
    active: subscribers?.filter(s => s.status === 'active').length || 0,
    pending: subscribers?.filter(s => s.status === 'pending').length || 0,
    unsubscribed: subscribers?.filter(s => s.status === 'unsubscribed').length || 0,
    synced: subscribers?.filter(s => s.sync_status === 'synced').length || 0,
    failed: subscribers?.filter(s => s.sync_status === 'failed').length || 0,
  };

  return {
    subscribers,
    isLoading,
    stats,
  };
}

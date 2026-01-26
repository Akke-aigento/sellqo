import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { CustomerCommunicationSetting } from '@/types/customerCommunication';
import { COMMUNICATION_TRIGGERS } from '@/types/customerCommunication';

export function useCustomerCommunicationSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-communication-settings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('customer_communication_settings')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      return data as CustomerCommunicationSetting[];
    },
    enabled: !!currentTenant?.id,
  });

  // Initialize settings if they don't exist
  const initializeSettings = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('customer_communication_settings')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .limit(1);

      if (existing && existing.length > 0) return; // Already initialized

      // Insert default settings for all triggers
      const defaultSettings = COMMUNICATION_TRIGGERS.map(trigger => ({
        tenant_id: currentTenant.id,
        trigger_type: trigger.type,
        category: trigger.category,
        email_enabled: trigger.defaultEmailEnabled,
        whatsapp_enabled: trigger.defaultWhatsAppEnabled,
        delay_hours: trigger.defaultDelayHours || 0,
        delay_days: trigger.defaultDelayDays || 0,
      }));

      const { error } = await supabase
        .from('customer_communication_settings')
        .insert(defaultSettings);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-communication-settings'] });
    },
  });

  // Update a single setting
  const updateSetting = useMutation({
    mutationFn: async (params: {
      triggerType: string;
      updates: Partial<Pick<CustomerCommunicationSetting, 'email_enabled' | 'whatsapp_enabled' | 'delay_hours' | 'delay_days' | 'email_template_id' | 'whatsapp_template_id' | 'extra_settings'>>;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { triggerType, updates } = params;

      // First check if setting exists
      const { data: existing } = await supabase
        .from('customer_communication_settings')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('trigger_type', triggerType)
        .maybeSingle();

      if (existing) {
        // Update existing - transform extra_settings to Json compatible type
        const dbUpdates: Record<string, unknown> = { ...updates };
        if (updates.extra_settings) {
          dbUpdates.extra_settings = updates.extra_settings as Record<string, unknown>;
        }
        
        const { error } = await supabase
          .from('customer_communication_settings')
          .update(dbUpdates)
          .eq('tenant_id', currentTenant.id)
          .eq('trigger_type', triggerType);

        if (error) throw error;
      } else {
        // Insert new with defaults
        const trigger = COMMUNICATION_TRIGGERS.find(t => t.type === triggerType);
        const insertData = {
          tenant_id: currentTenant.id,
          trigger_type: triggerType,
          category: trigger?.category || 'orders',
          email_enabled: updates.email_enabled ?? trigger?.defaultEmailEnabled ?? true,
          whatsapp_enabled: updates.whatsapp_enabled ?? trigger?.defaultWhatsAppEnabled ?? false,
          delay_hours: updates.delay_hours ?? trigger?.defaultDelayHours ?? 0,
          delay_days: updates.delay_days ?? trigger?.defaultDelayDays ?? 0,
        };
        
        const { error } = await supabase
          .from('customer_communication_settings')
          .insert(insertData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-communication-settings'] });
      toast({
        title: 'Opgeslagen',
        description: 'Communicatie instelling bijgewerkt',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk update multiple settings
  const bulkUpdateSettings = useMutation({
    mutationFn: async (updates: Array<{
      triggerType: string;
      email_enabled?: boolean;
      whatsapp_enabled?: boolean;
      delay_hours?: number;
      delay_days?: number;
    }>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      for (const update of updates) {
        const { triggerType, ...changes } = update;
        const trigger = COMMUNICATION_TRIGGERS.find(t => t.type === triggerType);
        
        const upsertData = {
          tenant_id: currentTenant.id,
          trigger_type: triggerType,
          category: trigger?.category || 'orders',
          email_enabled: changes.email_enabled,
          whatsapp_enabled: changes.whatsapp_enabled,
          delay_hours: changes.delay_hours,
          delay_days: changes.delay_days,
        };
        
        const { error } = await supabase
          .from('customer_communication_settings')
          .upsert(upsertData, {
            onConflict: 'tenant_id,trigger_type',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-communication-settings'] });
      toast({
        title: 'Opgeslagen',
        description: 'Communicatie instellingen bijgewerkt',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get setting for a specific trigger
  const getSetting = (triggerType: string): CustomerCommunicationSetting | undefined => {
    return settings?.find(s => s.trigger_type === triggerType);
  };

  // Check if email is enabled for a trigger
  const isEmailEnabled = (triggerType: string): boolean => {
    const setting = getSetting(triggerType);
    if (!setting) {
      const trigger = COMMUNICATION_TRIGGERS.find(t => t.type === triggerType);
      return trigger?.defaultEmailEnabled ?? true;
    }
    return setting.email_enabled;
  };

  // Check if WhatsApp is enabled for a trigger
  const isWhatsAppEnabled = (triggerType: string): boolean => {
    const setting = getSetting(triggerType);
    if (!setting) {
      const trigger = COMMUNICATION_TRIGGERS.find(t => t.type === triggerType);
      return trigger?.defaultWhatsAppEnabled ?? false;
    }
    return setting.whatsapp_enabled;
  };

  return {
    settings,
    isLoading,
    error,
    refetch,
    initializeSettings,
    updateSetting,
    bulkUpdateSettings,
    getSetting,
    isEmailEnabled,
    isWhatsAppEnabled,
  };
}

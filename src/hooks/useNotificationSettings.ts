import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { NotificationSetting, NotificationCategory, NOTIFICATION_CONFIG } from '@/types/notification';

export function useNotificationSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('tenant_notification_settings')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const typedData = (data || []).map(s => ({
        ...s,
        category: s.category as NotificationCategory,
        email_recipients: s.email_recipients || [],
      }));

      setSettings(typedData);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = (category: NotificationCategory, type: string): NotificationSetting | undefined => {
    return settings.find(
      s => s.category === category && s.notification_type === type
    );
  };

  const getSettingValue = (
    category: NotificationCategory,
    type: string,
    defaultInApp: boolean,
    defaultEmail: boolean
  ) => {
    const setting = getSetting(category, type);
    return {
      in_app_enabled: setting?.in_app_enabled ?? defaultInApp,
      email_enabled: setting?.email_enabled ?? defaultEmail,
      email_recipients: setting?.email_recipients || [],
    };
  };

  const updateSetting = async (
    category: NotificationCategory,
    type: string,
    updates: {
      in_app_enabled?: boolean;
      email_enabled?: boolean;
      email_recipients?: string[];
    }
  ) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      const existing = getSetting(category, type);

      if (existing) {
        const { error } = await supabase
          .from('tenant_notification_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;

        setSettings(prev =>
          prev.map(s =>
            s.id === existing.id ? { ...s, ...updates } : s
          )
        );
      } else {
        const { data, error } = await supabase
          .from('tenant_notification_settings')
          .insert({
            tenant_id: currentTenant.id,
            category,
            notification_type: type,
            in_app_enabled: updates.in_app_enabled ?? true,
            email_enabled: updates.email_enabled ?? false,
            email_recipients: updates.email_recipients || [],
          })
          .select()
          .single();

        if (error) throw error;

        setSettings(prev => [...prev, {
          ...data,
          category: data.category as NotificationCategory,
          email_recipients: data.email_recipients || [],
        }]);
      }
    } catch (error) {
      console.error('Error updating notification setting:', error);
      toast({
        title: 'Fout',
        description: 'Kon instelling niet opslaan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategoryInApp = async (category: NotificationCategory, enabled: boolean, types: typeof NOTIFICATION_CONFIG[0]['types']) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      for (const typeConfig of types) {
        await updateSetting(category, typeConfig.type, { in_app_enabled: enabled });
      }
      toast({
        title: 'Opgeslagen',
        description: `Alle ${category} in-app notificaties ${enabled ? 'ingeschakeld' : 'uitgeschakeld'}`,
      });
    } catch (error) {
      console.error('Error toggling category:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategoryEmail = async (category: NotificationCategory, enabled: boolean, types: typeof NOTIFICATION_CONFIG[0]['types']) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      for (const typeConfig of types) {
        await updateSetting(category, typeConfig.type, { email_enabled: enabled });
      }
      toast({
        title: 'Opgeslagen',
        description: `Alle ${category} email notificaties ${enabled ? 'ingeschakeld' : 'uitgeschakeld'}`,
      });
    } catch (error) {
      console.error('Error toggling category emails:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    settings,
    isLoading,
    isSaving,
    getSetting,
    getSettingValue,
    updateSetting,
    toggleCategoryInApp,
    toggleCategoryEmail,
    refetch: fetchSettings,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type {
  NotificationSetting,
  NotificationCategory,
  NotificationTypeConfig,
} from '@/types/notification';

/** De drie kanalen waarlangs een melding kan binnenkomen. */
export type NotificationChannel = 'in_app' | 'email' | 'push';

/**
 * Wat een type toont zolang er nog geen rij in de database staat.
 *
 * Eén object in plaats van losse booleans. `getSettingValue` nam er eerst twee
 * op volgorde (`defaultInApp, defaultEmail`); met push erbij waren het er drie,
 * en drie booleans achter elkaar verwisselen is een fout die niemand ziet.
 */
export interface ChannelDefaults {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export function channelDefaults(typeConfig: NotificationTypeConfig): ChannelDefaults {
  return {
    inApp: typeConfig.defaultInApp,
    email: typeConfig.defaultEmail,
    // Optioneel veld: ontbreekt het, dan staat push uit. Zie notification.ts.
    push: typeConfig.defaultPush ?? false,
  };
}

const COLUMN: Record<NotificationChannel, 'in_app_enabled' | 'email_enabled' | 'push_enabled'> = {
  in_app: 'in_app_enabled',
  email: 'email_enabled',
  push: 'push_enabled',
};

export function useNotificationSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { t } = useTranslation();
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
    defaults: ChannelDefaults,
  ) => {
    const setting = getSetting(category, type);
    return {
      in_app_enabled: setting?.in_app_enabled ?? defaults.inApp,
      email_enabled: setting?.email_enabled ?? defaults.email,
      push_enabled: setting?.push_enabled ?? defaults.push,
      email_recipients: setting?.email_recipients || [],
    };
  };

  /**
   * Eén kanaal van één type wijzigen.
   *
   * Upsert op (tenant_id, category, notification_type) — daar staat een
   * UNIQUE-constraint op. Dit verving een lees-dan-update-of-insert met twee
   * problemen:
   *
   *  1. Het insert-pad schreef `in_app_enabled: updates.in_app_enabled ?? true`.
   *     Zette je op een type dat nog geen rij had alleen e-mail aan, dan werd
   *     in-app stilzwijgend `true` — ongeacht wat het scherm liet zien. Met push
   *     als derde kanaal kwam die fout drie keer zo vaak voor.
   *  2. Twee snelle klikken op een nieuwe rij konden twee inserts geven, en de
   *     tweede liep op de constraint stuk met een 23505.
   *
   * Nu wordt de rij opgebouwd uit wat er al stond, of — bij een nieuwe rij — uit
   * precies de standaardwaarden die het scherm op dat moment toonde. Wat de
   * gebruiker ziet is wat er opgeslagen wordt.
   */
  const updateSetting = async (
    category: NotificationCategory,
    type: string,
    updates: {
      in_app_enabled?: boolean;
      email_enabled?: boolean;
      push_enabled?: boolean;
      email_recipients?: string[];
    },
    defaults: ChannelDefaults,
  ) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      const existing = getSetting(category, type);
      const row = {
        tenant_id: currentTenant.id,
        category,
        notification_type: type,
        in_app_enabled: existing?.in_app_enabled ?? defaults.inApp,
        email_enabled: existing?.email_enabled ?? defaults.email,
        push_enabled: existing?.push_enabled ?? defaults.push,
        email_recipients: existing?.email_recipients ?? [],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('tenant_notification_settings')
        .upsert(row, { onConflict: 'tenant_id,category,notification_type' })
        .select()
        .single();

      if (error) throw error;

      const saved: NotificationSetting = {
        ...data,
        category: data.category as NotificationCategory,
        email_recipients: data.email_recipients || [],
      };
      setSettings(prev =>
        prev.some(s => s.id === saved.id)
          ? prev.map(s => (s.id === saved.id ? saved : s))
          : [...prev, saved],
      );
    } catch (error) {
      console.error('Error updating notification setting:', error);
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.notifications.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Eén kanaal voor een hele categorie aan of uit. Vervangt drie vrijwel
   * identieke functies — een per kanaal — die anders met elk nieuw kanaal
   * opnieuw gekopieerd zouden worden.
   */
  const toggleCategoryChannel = async (
    channel: NotificationChannel,
    category: NotificationCategory,
    enabled: boolean,
    types: NotificationTypeConfig[],
    categoryLabel: string,
  ) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      for (const typeConfig of types) {
        await updateSetting(
          category,
          typeConfig.type,
          { [COLUMN[channel]]: enabled },
          channelDefaults(typeConfig),
        );
      }
      // Twee volledige zinnen in plaats van één met een ingeplakt woord: in
      // andere talen staat "aan" of "uit" niet op dezelfde plek. De oude tekst
      // plakte bovendien de interne categoriesleutel ("orders") in een
      // Nederlandse zin.
      const channelLabel = t(`settings.notifications.${channel === 'in_app' ? 'inApp' : channel}`);
      toast({
        title: t('settings.notifications.saved'),
        description: t(
          enabled ? 'settings.notifications.categoryEnabled' : 'settings.notifications.categoryDisabled',
          { channel: channelLabel, category: categoryLabel },
        ),
      });
    } catch (error) {
      console.error('Error toggling category:', error);
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
    toggleCategoryChannel,
    refetch: fetchSettings,
  };
}

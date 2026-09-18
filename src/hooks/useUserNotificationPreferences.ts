import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { NotificationCategory } from '@/types/notification';
import { resolvePushEnabled } from '../../supabase/functions/_shared/notificationDefaults';


export interface UserNotificationPreference {
  id: string;
  user_id: string;
  tenant_id: string;
  category: NotificationCategory;
  notification_type: string;
  push_enabled: boolean;
}

/**
 * PUSH-2 — pushvoorkeuren van de ingelogde gebruiker, voor de actieve winkel.
 *
 * Push is persoonlijk: het is iemands telefoon. Daarom per gebruiker, en niet
 * op tenant_notification_settings zoals in PUSH-1. Er staat alleen een rij voor
 * wat iemand ooit omzette.
 *
 * PUSH-DEFAULT-1 — geen rij volgt de default, dezelfde resolver als
 * `send-push-notification`: aan voor wie een rol in deze winkel heeft, uit voor
 * een platform-admin zonder eigen rol (die blijft opt-in). Het scherm toont dus
 * wat de server echt doet.
 *
 * Opslaan gaat met een upsert op de UNIQUE (user_id, tenant_id, category,
 * notification_type) — dezelfde aanpak als `useNotificationSettings`, en om
 * dezelfde reden: twee snelle klikken op een type zonder rij gaven bij
 * lees-dan-insert een 23505.
 */
export function useUserNotificationPreferences() {
  const { user, roles } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<UserNotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const fetchPreferences = useCallback(async () => {
    if (!userId || !tenantId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('id, user_id, tenant_id, category, notification_type, push_enabled')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setPreferences((data ?? []) as UserNotificationPreference[]);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => {
    // Bij een winkelwissel horen de voorkeuren van de vorige winkel niet meer
    // op het scherm, ook niet de fractie van een seconde tot de nieuwe binnen zijn.
    setPreferences([]);
    fetchPreferences();
  }, [fetchPreferences]);

  // Zelfde definitie als de edge-functie: een rij in user_roles voor déze winkel.
  const isTenantMember = (roles ?? []).some(r => tenantId != null && r.tenant_id === tenantId);

  const findPreference = (category: NotificationCategory, type: string) =>
    preferences.find(p => p.category === category && p.notification_type === type);

  /** Effectieve stand: eigen rij, anders de default. */
  const isPushEnabled = (category: NotificationCategory, type: string): boolean =>
    resolvePushEnabled(findPreference(category, type) ?? null, { isTenantMember });

  /** Alleen een expliciet aangezette rij — los van de default. */
  const hasExplicitPushOn = (category: NotificationCategory, type: string): boolean =>
    findPreference(category, type)?.push_enabled === true;

  /** Eén of meer types tegelijk aan of uit, in één upsert. */
  const setPush = async (
    category: NotificationCategory,
    types: string[],
    enabled: boolean,
  ): Promise<boolean> => {
    if (!userId || !tenantId || types.length === 0) return false;
    setIsSaving(true);
    try {
      const rows = types.map(type => ({
        user_id: userId,
        tenant_id: tenantId,
        category,
        notification_type: type,
        push_enabled: enabled,
      }));
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert(rows, { onConflict: 'user_id,tenant_id,category,notification_type' })
        .select('id, user_id, tenant_id, category, notification_type, push_enabled');
      if (error) throw error;

      const saved = (data ?? []) as UserNotificationPreference[];
      setPreferences(prev => {
        const byKey = new Map(prev.map(p => [`${p.category}:${p.notification_type}`, p]));
        for (const row of saved) byKey.set(`${row.category}:${row.notification_type}`, row);
        return [...byKey.values()];
      });
      return true;
    } catch (error) {
      console.error('Error saving notification preference:', error);
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.notifications.saveError'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    preferences,
    isLoading,
    isSaving,
    isPushEnabled,
    hasExplicitPushOn,
    setPush,
    refetch: fetchPreferences,
  };
}

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { NotificationCategory } from '@/types/notification';

/**
 * `user_notification_preferences` staat pas in de gegenereerde types nadat de
 * migratie gedraaid is en de types opnieuw gegenereerd zijn. Tot dan is dit de
 * ene cast die de getypeerde client nodig heeft — hetzelfde vangnet als in
 * `useBrandDna.ts`. Na het regenereren kan `db` weer `supabase` worden.
 */
const db = supabase as unknown as SupabaseClient;
const TABLE = 'user_notification_preferences';

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
 * wat iemand ooit omzette; geen rij betekent uit.
 *
 * Opslaan gaat met een upsert op de UNIQUE (user_id, tenant_id, category,
 * notification_type) — dezelfde aanpak als `useNotificationSettings`, en om
 * dezelfde reden: twee snelle klikken op een type zonder rij gaven bij
 * lees-dan-insert een 23505.
 */
export function useUserNotificationPreferences() {
  const { user } = useAuth();
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
      const { data, error } = await db
        .from(TABLE)
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

  const isPushEnabled = (category: NotificationCategory, type: string): boolean =>
    preferences.some(
      p => p.category === category && p.notification_type === type && p.push_enabled,
    );

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
      const { data, error } = await db
        .from(TABLE)
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

  return { preferences, isLoading, isSaving, isPushEnabled, setPush, refetch: fetchPreferences };
}

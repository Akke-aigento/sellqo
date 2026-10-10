import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getPushPermissionStatus } from '@/native/pushRegistration';

const DISMISSED_KEY = 'sellqo.webpushDuplicate.dismissed';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // geen opslag: dan vragen we volgende keer opnieuw
  }
}

/**
 * WEBPUSH-1 — native app heeft voorrang.
 *
 * Alleen in de native app, en alleen als push hier toegestaan is. Staan er voor
 * deze gebruiker web-abonnementen van hetzelfde besturingssysteem (bv. SellQo
 * ook als beginscherm-webapp op een iPhone), dan vragen we of dat déze telefoon
 * is. Ja → die web-abonnementen weg, de native app neemt over. Nee → onthouden
 * voor die abonnementen, niet opnieuw vragen.
 *
 * Automatisch uitzetten kan niet: een server ziet niet of twee abonnementen op
 * dezelfde telefoon staan, en iemand met een native iPhone én een tweede iPhone
 * met de webapp zou dan geen meldingen meer krijgen op die tweede.
 */
export function NativeWebPushDuplicateDialog() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [webIds, setWebIds] = useState<string[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;
    let active = true;
    const os = Capacitor.getPlatform();
    (async () => {
      if ((await getPushPermissionStatus()) !== 'granted') return;
      const { data } = await supabase
        .from('device_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'web')
        .eq('os', os);
      const dismissed = readDismissed();
      const open = (data ?? []).map((r) => r.id as string).filter((id) => !dismissed.includes(id));
      if (active) setWebIds(open);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const close = () => setWebIds([]);

  const keepWeb = () => {
    writeDismissed([...readDismissed(), ...webIds]);
    close();
  };

  const removeWeb = async () => {
    const ids = webIds;
    close();
    const { error } = await supabase.from('device_tokens').delete().in('id', ids);
    if (error) console.warn('[webpush] removing web subscriptions failed', error);
  };

  return (
    <AlertDialog open={webIds.length > 0} onOpenChange={(open) => !open && keepWeb()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('settings.myDevices.nativeDuplicate.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('settings.myDevices.nativeDuplicate.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={keepWeb}>{t('settings.myDevices.nativeDuplicate.keep')}</AlertDialogCancel>
          <AlertDialogAction onClick={removeWeb}>{t('settings.myDevices.nativeDuplicate.remove')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

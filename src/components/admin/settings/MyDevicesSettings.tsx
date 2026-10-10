import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { BellRing, Globe, Loader2, Monitor, Share, Smartphone, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { supabase } from '@/integrations/supabase/client';
import {
  currentWebPushEndpoint, findRecentNativeSameOs, getWebPushState, subscribeWebPush,
  touchWebPushSubscription, unsubscribeWebPush, type DeviceRow, type WebPushState,
} from '@/lib/webPush';

/**
 * WEBPUSH-1 — "Dit toestel" en "Mijn toestellen" in Instellingen → Mijn meldingen.
 *
 * Bovenaan: web-meldingen aan/uit voor dit toestel (niet zichtbaar in de native
 * app, daar regelt FCM het). Daaronder: alle toestellen die jouw meldingen
 * krijgen, native en web, met een knop om er één los te koppelen. Zo zie je
 * meteen waar dubbele meldingen vandaan komen.
 */
export function MyDevicesSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const dateLocale = useDateFnsLocale();
  const userId = user?.id ?? null;

  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [nativeConflict, setNativeConflict] = useState<DeviceRow | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [s, endpoint, { data }] = await Promise.all([
      getWebPushState(userId),
      currentWebPushEndpoint(),
      supabase
        .from('device_tokens')
        .select('id, token, platform, os, device_name, last_seen_at')
        .eq('user_id', userId)
        .order('last_seen_at', { ascending: false }),
    ]);
    setState(s);
    setThisEndpoint(endpoint);
    setDevices((data as DeviceRow[] | null) ?? []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void touchWebPushSubscription(userId).then(refresh);
  }, [userId, refresh]);

  const doSubscribe = async () => {
    if (!userId) return;
    setBusy(true);
    const result = await subscribeWebPush(userId);
    setBusy(false);
    if (result === 'on') {
      toast({ title: t('settings.myDevices.webPush.enabledToast') });
    } else if (result === 'denied') {
      toast({ title: t('settings.myDevices.webPush.deniedToast'), variant: 'destructive' });
    } else {
      toast({ title: t('settings.myDevices.webPush.errorToast'), variant: 'destructive' });
    }
    await refresh();
  };

  const handleEnable = async () => {
    if (!userId) return;
    // Staat de native app misschien op deze telefoon? Eerst vragen.
    const native = await findRecentNativeSameOs(userId);
    if (native) {
      setNativeConflict(native);
      return;
    }
    await doSubscribe();
  };

  const handleDisable = async () => {
    setBusy(true);
    await unsubscribeWebPush();
    setBusy(false);
    toast({ title: t('settings.myDevices.webPush.disabledToast') });
    await refresh();
  };

  const removeDevice = async (device: DeviceRow) => {
    if (device.token === thisEndpoint) {
      await handleDisable();
      return;
    }
    const { error } = await supabase.from('device_tokens').delete().eq('id', device.id);
    if (error) {
      toast({ title: t('settings.myDevices.removeError'), variant: 'destructive' });
      return;
    }
    toast({ title: t('settings.myDevices.removed') });
    await refresh();
  };

  const deviceLabel = (d: DeviceRow) => {
    const os = d.os ?? d.platform;
    const osLabel = os === 'ios' ? 'iPhone / iPad' : os === 'android' ? 'Android' : (d.device_name ?? t('settings.myDevices.browser'));
    if (d.platform === 'web') {
      const name = os === 'desktop' ? (d.device_name ?? t('settings.myDevices.browser')) : (d.device_name ?? osLabel);
      return t('settings.myDevices.webLabel', { name });
    }
    return t('settings.myDevices.nativeLabel', { name: osLabel });
  };

  const DeviceIcon = ({ d }: { d: DeviceRow }) => {
    if (d.platform === 'web' && (d.os ?? 'desktop') === 'desktop') return <Monitor className="h-4 w-4 shrink-0" />;
    if (d.platform === 'web') return <Globe className="h-4 w-4 shrink-0" />;
    return <Smartphone className="h-4 w-4 shrink-0" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 shrink-0" />
          {t('settings.myDevices.title')}
        </CardTitle>
        <CardDescription>{t('settings.myDevices.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state !== null && state !== 'native-app' && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{t('settings.myDevices.webPush.title')}</p>

            {state === 'needs-install' && (
              <div className="flex gap-3 text-sm text-muted-foreground">
                <Share className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{t('settings.myDevices.webPush.needsInstall')}</p>
              </div>
            )}
            {state === 'unsupported' && (
              <p className="text-sm text-muted-foreground">{t('settings.myDevices.webPush.unsupported')}</p>
            )}
            {state === 'denied' && (
              <p className="text-sm text-muted-foreground">{t('settings.myDevices.webPush.denied')}</p>
            )}
            {state === 'off' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{t('settings.myDevices.webPush.offHint')}</p>
                <Button onClick={handleEnable} disabled={busy} className="shrink-0">
                  {busy && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                  {t('settings.myDevices.webPush.enable')}
                </Button>
              </div>
            )}
            {state === 'on' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{t('settings.myDevices.webPush.onHint')}</p>
                <Button variant="outline" onClick={handleDisable} disabled={busy} className="shrink-0">
                  {busy && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                  {t('settings.myDevices.webPush.disable')}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.myDevices.listTitle')}</p>
          {devices === null ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin text-muted-foreground" />
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.myDevices.empty')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <DeviceIcon d={d} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm">
                        <span className="truncate">{deviceLabel(d)}</span>
                        {d.token === thisEndpoint && (
                          <Badge variant="secondary" className="shrink-0">{t('settings.myDevices.thisDevice')}</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.myDevices.lastSeen', {
                          when: formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: dateLocale }),
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => removeDevice(d)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('settings.myDevices.remove')}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t('settings.myDevices.duplicateHint')}</p>
        </div>
      </CardContent>

      <AlertDialog open={nativeConflict !== null} onOpenChange={(open) => !open && setNativeConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.myDevices.conflict.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.myDevices.conflict.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.myDevices.conflict.sameDevice')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setNativeConflict(null);
                void doSubscribe();
              }}
            >
              {t('settings.myDevices.conflict.otherDevice')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

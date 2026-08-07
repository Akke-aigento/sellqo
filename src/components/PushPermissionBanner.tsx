import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BellOff, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getPushPermissionStatus, type PushPermissionStatus } from '@/native/pushRegistration';

/**
 * Native-only recovery path: once a user denies the notification permission the
 * OS never shows the prompt again, so registerPushForUser() stops silently.
 * This banner detects that state and explains how to re-enable it.
 */
export function PushPermissionBanner() {
  const [status, setStatus] = useState<PushPermissionStatus>('unsupported');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    getPushPermissionStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);

  if (dismissed || status !== 'denied') return null;

  const isIos = Capacitor.getPlatform() === 'ios';
  const path = isIos
    ? 'Instellingen → Meldingen → SellQo → Meldingen toestaan'
    : 'Instellingen → Apps → SellQo → Meldingen';

  return (
    <div className="px-4 pt-4 lg:px-6">
      <Alert>
        <BellOff className="h-4 w-4" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <AlertTitle>Meldingen staan uit</AlertTitle>
            <AlertDescription>
              Zet ze aan om bestellingen direct binnen te krijgen. Je telefoon vraagt dit niet
              opnieuw, dus je zet het zelf aan via: {path}.
            </AlertDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 flex-shrink-0 p-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Sluiten</span>
          </Button>
        </div>
      </Alert>
    </div>
  );
}
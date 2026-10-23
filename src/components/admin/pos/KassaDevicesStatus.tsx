// LIVE-1 — status van de SellQo Kassa-toestellen per kassa (uit de hartslag, kassa_devices).
// Toont per toestel wanneer het laatst gezien werd en of er nog iets op het toestel wacht.
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Tablet } from 'lucide-react';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';
import { isSilent, waitingCount, type KassaDevice } from '@/hooks/useKassaDevices';

export function KassaDevicesStatus({ devices }: { devices: KassaDevice[] }) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  if (!devices.length) return null;
  return (
    <ul className="space-y-1">
      {devices.map((d) => {
        const silent = isSilent(d);
        const waiting = waitingCount(d);
        return (
          <li key={d.device_id} className={cn('flex items-center gap-1.5 text-xs', silent || waiting ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
            {silent || waiting ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> : <Tablet className="h-3 w-3 shrink-0" aria-hidden />}
            <span className="truncate">
              {t('admin.pos.kassaDevice.seen', { when: formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale }) })}
              {waiting ? ` · ${t('admin.pos.kassaDevice.waiting', { n: waiting })}` : ''}
              {d.sw_version ? ` · ${d.sw_version.replace('sellqo-kassa-', 'v')}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

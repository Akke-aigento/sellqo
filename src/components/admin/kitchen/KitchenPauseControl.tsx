// PAUSE-1 — de keuken even pauzeren vanaf het keukenscherm (druk, oven vol).
// HORECA-STAAT-1: geldt voor afhalen en leveren via de webshop én de keukengerechten aan tafel (QR); dranken blijven.
import { PauseCircle, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTracks } from '@/hooks/useBusinessModules';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
// HORECA-NU-1: stand en schrijven in useKitchenPause (gedeeld met de tegel op het Nu-paneel).
import { PAUSE_MINUTES, endOfToday, useKitchenPause } from './useKitchenPause';

export function KitchenPauseControl({ now }: { now: number }) {
  const { t, i18n } = useTranslation();
  const { hasTrack } = useTracks();
  const { data, set } = useKitchenPause();

  const until = data?.until ? new Date(data.until) : null;
  const paused = !!until && until.getTime() > now;
  if (!paused && data && !data.webshop && !data.table && !hasTrack('webshop')) return null;
  if (paused) {
    return (
      <Button variant="destructive" size="sm" onClick={() => set.mutate(null)} disabled={set.isPending}>
        <PlayCircle className="mr-1.5 h-4 w-4" />
        {t('admin.kitchen.paused_until', { time: until!.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) })}
      </Button>
    );
  }
  const inMinutes = (m: number) => new Date(Date.now() + m * 60000);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={set.isPending} title={t('admin.kitchen.pause_online')} aria-label={t('admin.kitchen.pause_online')}>
          {/* HORECA-0 — op gsm enkel het icoon, zodat de kopbalk op één regel past. */}
          <PauseCircle className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{t('admin.kitchen.pause_online')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t(data?.table && !data.kitchenSplit ? 'admin.kitchen.pause_hint_all' : 'admin.kitchen.pause_hint')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PAUSE_MINUTES.map((m) => (
          <DropdownMenuItem key={m} onClick={() => set.mutate(inMinutes(m))}>{t('admin.kitchen.pause_minutes', { count: m })}</DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => set.mutate(endOfToday())}>{t('admin.kitchen.pause_today')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

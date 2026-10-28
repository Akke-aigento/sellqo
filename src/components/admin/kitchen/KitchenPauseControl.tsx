// PAUSE-1 — online bestellingen even pauzeren vanaf het keukenscherm (druk, oven vol).
// Geldt voor afhalen en leveren via de webshop; bestellen aan tafel blijft werken.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTracks } from '@/hooks/useBusinessModules';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Einde van vandaag (lokale tijd van dit toestel). */
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; };

export function KitchenPauseControl({ now }: { now: number }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { hasTrack } = useTracks();
  const qc = useQueryClient();
  const key = ['kitchen-pause', tenantId];
  const { data } = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [fs, ts] = await Promise.all([
        supabase.from('fulfillment_settings').select('paused_until').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (fs.error) throw fs.error;
      // WANDELING: de pauze geldt enkel voor bestellen via de webshop (ook een eigen frontend). Een horecazaak
      // zonder webshop en zonder online bestellen krijgt geen dode knop; bij twijfel (fout) blijft hij staan.
      return { until: fs.data?.paused_until ?? null, webshop: !!ts.error || (!!ts.data?.shop_live && !!ts.data?.shop_ordering) };
    },
  });
  const set = useMutation({
    mutationFn: async (until: Date | null) => {
      const { error } = await supabase.from('fulfillment_settings')
        .upsert({ tenant_id: tenantId!, paused_until: until ? until.toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
      if (error) throw error;
      return until;
    },
    onSuccess: (until) => toast.success(until ? t('admin.kitchen.paused_toast', { time: until.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) }) : t('admin.kitchen.resumed_toast')),
    onError: () => toast.error(t('admin.storefront.food.save_failed')),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const until = data?.until ? new Date(data.until) : null;
  const paused = !!until && until.getTime() > now;
  if (!paused && data && !data.webshop && !hasTrack('webshop')) return null;
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
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('admin.kitchen.pause_hint')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[15, 30, 60].map((m) => (
          <DropdownMenuItem key={m} onClick={() => set.mutate(inMinutes(m))}>{t('admin.kitchen.pause_minutes', { count: m })}</DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => set.mutate(endOfToday())}>{t('admin.kitchen.pause_today')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

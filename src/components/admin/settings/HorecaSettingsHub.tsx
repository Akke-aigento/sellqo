// WANDELING (28-10) — Instellingen › Horeca: één overzicht van alles wat een horecazaak instelt.
//
// Elke instelling woont op één vaste plek (Bestellen of Kassa); hier staat enkel een link met de
// huidige stand, zodat wie in Instellingen zoekt niet met lege handen staat. Geen tweede
// bewerkplek (regel "één plek per taak, een tweede plek is enkel een link").
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronRight, CreditCard, LayoutGrid, Loader2, Monitor, Printer, QrCode, Users, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Row { icon: LucideIcon; title: string; status: string; to: string }

export function HorecaSettingsHub() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['horeca-settings-hub', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const count = async (table: string, extra?: (q: never) => never) => {
        let q = supabase.from(table as never).select('*', { count: 'exact', head: true }).eq('tenant_id' as never, tenantId as never) as never;
        if (extra) q = extra(q);
        const { count: n } = await (q as unknown as Promise<{ count: number | null }>);
        return n ?? 0;
      };
      const active = (q: never) => (q as unknown as { eq: (c: string, v: boolean) => never }).eq('is_active', true);
      const [pay, qr, tables, stations, printers, devices, terminals, staff] = await Promise.all([
        supabase.from('horeca_pay_settings' as never).select('methods, online_pay, mail_online, receipt_print').eq('tenant_id' as never, tenantId as never).maybeSingle(),
        supabase.from('fulfillment_settings').select('qr_mode' as 'tenant_id').eq('tenant_id', tenantId!).maybeSingle(),
        count('dining_tables', active),
        count('prep_stations', active),
        count('printers', active),
        count('horeca_notify_devices'),
        count('pos_terminals'),
        count('pos_cashiers', active),
      ]);
      const p = pay.data as { methods?: string[] | null; online_pay?: boolean | null; mail_online?: boolean | null; receipt_print?: boolean | null } | null;
      return {
        methods: p?.methods?.length ?? 2,
        onlinePay: p?.online_pay === true,
        receiptPrint: p?.receipt_print === true,
        mailOnline: p?.mail_online === true,
        qrMode: (qr.data as { qr_mode?: string | null } | null)?.qr_mode || 'view',
        tables, stations, printers, devices, terminals, staff,
      };
    },
  });

  if (isLoading || !data) {
    return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const onOff = (v: boolean) => (v ? t('settings.horecaHub.on') : t('settings.horecaHub.off'));
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: t('settings.horecaHub.group_ordering'),
      rows: [
        { icon: QrCode, title: t('settings.horecaHub.qr'), status: t(`settings.horecaHub.qr_mode_${data.qrMode === 'order' ? 'order' : data.qrMode === 'off' ? 'off' : 'view'}`), to: '/admin/bestellen?tab=qr' },
        { icon: LayoutGrid, title: t('settings.horecaHub.floor'), status: t('settings.horecaHub.tables', { count: data.tables }), to: '/admin/bestellen?tab=zaal' },
        { icon: UtensilsCrossed, title: t('settings.horecaHub.stations'), status: t('settings.horecaHub.stations_count', { count: data.stations }), to: '/admin/bestellen?tab=posten' },
      ],
    },
    {
      title: t('settings.horecaHub.group_kassa'),
      rows: [
        { icon: Monitor, title: t('settings.horecaHub.terminals'), status: t('settings.horecaHub.terminals_count', { count: data.terminals }), to: '/admin/pos' },
        { icon: Users, title: t('settings.horecaHub.staff'), status: t('settings.horecaHub.staff_count', { count: data.staff }), to: '/admin/pos?tab=personeel' },
        { icon: CreditCard, title: t('settings.horecaHub.pay'), status: t('settings.horecaHub.pay_status', { count: data.methods, online: onOff(data.onlinePay) }), to: '/admin/pos?tab=betalen' },
        { icon: Printer, title: t('settings.horecaHub.printers'), status: t('settings.horecaHub.printers_status', { count: data.printers, print: onOff(data.receiptPrint), mail: onOff(data.mailOnline) }), to: '/admin/pos?tab=printers' },
        { icon: Bell, title: t('settings.horecaHub.alerts'), status: t('settings.horecaHub.devices_count', { count: data.devices }), to: '/admin/pos' },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.horecaHub.title')}</CardTitle>
        <CardDescription>{t('settings.horecaHub.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            <ul className="divide-y rounded-md border">
              {g.rows.map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.title}>
                    <Link to={r.to} className="flex min-h-[56px] items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.status}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

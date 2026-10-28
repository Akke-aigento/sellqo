// HORECA-1 — QR-menu in de zaak: uit, alleen bekijken of bestellen aan tafel, en hoe
// de klant aan tafel afrekent (aan de toog en/of meteen online). Sinds BETAAL-1 stel je dat laatste
// in bij Kassa › Betalen; hier staat de stand met een link.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { QR_MODES, type QrMode } from './qrModes';
import { useTranslation } from 'react-i18next';


type QrFlow = 'order' | 'check';
const QR_FLOWS: QrFlow[] = ['check', 'order'];

export function QrModeSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['qr-mode', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: raw, error }, ts] = await Promise.all([
        supabase.from('fulfillment_settings').select('qr_mode, qr_pay_counter, qr_pay_online, qr_flow, qr_auto_accept' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
        // QR-REKENING-1b — het QR-menu is pas zichtbaar als de zaak online staat (Webshop › Winkel openen).
        supabase.from('tenant_theme_settings').select('shop_live').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (error) throw error;
      const row = raw as { qr_mode?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null; qr_flow?: string | null; qr_auto_accept?: boolean | null } | null;
      return {
        qr_mode: (row?.qr_mode as QrMode) || 'view', qr_pay_counter: row?.qr_pay_counter !== false, qr_pay_online: !!row?.qr_pay_online,
        // QR-REKENING-1
        qr_flow: (row?.qr_flow === 'check' ? 'check' : 'order') as QrFlow, qr_auto_accept: row?.qr_auto_accept === true,
        // Onbekend (fout bij lezen) = geen melding: nooit een valse waarschuwing.
        shop_live: ts.error ? true : ts.data?.shop_live === true,
      };
    },
  });
  const [mode, setMode] = useState<QrMode>('view');
  const [counter, setCounter] = useState(true);
  const [online, setOnline] = useState(false);
  // BETAAL-1: counter/online worden enkel nog gelezen (getoond en meegestuurd); wijzigen gebeurt in Kassa › Betalen.
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<QrFlow>('order');
  const [autoAccept, setAutoAccept] = useState(false);
  useEffect(() => { if (data) { setMode(data.qr_mode); setCounter(data.qr_pay_counter); setOnline(data.qr_pay_online); setFlow(data.qr_flow); setAutoAccept(data.qr_auto_accept); } }, [data]);

  const dirty = !!data && (mode !== data.qr_mode || flow !== data.qr_flow || autoAccept !== data.qr_auto_accept);
  const save = async () => {
    if (!tenantId) return;
    // Op de tafelrekening betaalt de gast op het einde (kassa of later online): geen QR-betaalkeuze nodig.
    if (mode === 'order' && flow === 'order' && !counter && !online) { toast.error(t('admin.storefront.food.qr_pay_required')); return; }
    setSaving(true);
    const { error } = await supabase.from('fulfillment_settings').upsert(
      { tenant_id: tenantId, qr_mode: mode, qr_flow: flow, qr_auto_accept: flow === 'check' && autoAccept, updated_at: new Date().toISOString() } as never,
      { onConflict: 'tenant_id' },
    );
    setSaving(false);
    if (error) { toast.error(t('admin.storefront.food.save_failed_reason', { reason: error.message })); return; }
    toast.success(t('admin.storefront.food.qr_saved'));
    await qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] });
    await qc.invalidateQueries({ queryKey: ['ordering-hub', tenantId] });
    await qc.invalidateQueries({ queryKey: ['kassa-qr-auto-accept', tenantId] });
  };

  if (isLoading) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.storefront.food.qrModeSettings.qr_menu_in_je_zaak')}</CardTitle>
        <CardDescription>{t('admin.storefront.food.qrModeSettings.wat_ziet_een_klant_die_de')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {QR_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => setMode(m.value)} aria-pressed={mode === m.value}
              className={cn('rounded-lg border-2 p-3 text-left', mode === m.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
              <span className="block font-medium">{t(m.titleKey)}</span>
              <span className="block text-sm text-muted-foreground">{t(m.textKey)}</span>
            </button>
          ))}
        </div>
        {mode !== 'off' && data && !data.shop_live ? (
          <div role="status" className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-medium">{t('admin.qrFlow.offline_title')}</span>
              <span className="block">{t('admin.qrFlow.offline_desc')}</span>
              <Link to="/admin/storefront" className="font-medium underline">{t('admin.qrFlow.offline_link')}</Link>
            </span>
          </div>
        ) : null}
        {mode === 'order' ? (
          <div className="space-y-2 rounded-lg border p-4">
            {/* QR-REKENING-1: waar komt een bestelling aan tafel terecht? */}
            <p className="text-sm font-medium">{t('admin.qrFlow.title')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QR_FLOWS.map((f) => (
                <button key={f} type="button" onClick={() => setFlow(f)} aria-pressed={flow === f}
                  className={cn('rounded-lg border-2 p-3 text-left', flow === f ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                  <span className="block font-medium">{t(`admin.qrFlow.${f}_title`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`admin.qrFlow.${f}_desc`)}</span>
                </button>
              ))}
            </div>
            {flow === 'check' ? (
              <div className="space-y-2 rounded-md border p-3">
                <label className="flex items-center justify-between gap-4">
                  <span><span className="block text-sm font-medium">{t('admin.qrFlow.auto_title')}</span><span className="block text-xs text-muted-foreground">{t('admin.qrFlow.auto_desc')}</span></span>
                  <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
                </label>
                {autoAccept ? (
                  <p role="alert" className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('admin.qrFlow.auto_warning')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {flow === 'order' ? <>
            {/* BETAAL-1: hoe de klant aan tafel afrekent, staat bij de andere betaalinstellingen (Kassa › Betalen). */}
            <p className="text-sm font-medium">{t('admin.storefront.food.qrModeSettings.hoe_rekent_de_klant_af')}</p>
            <p className="text-sm text-muted-foreground">
              {[counter && t('admin.storefront.food.qrModeSettings.aan_de_toog'), online && t('admin.storefront.food.qrModeSettings.meteen_online')].filter(Boolean).join(' · ') || t('admin.horecaPay.qr_none')}
              {' · '}<Link to="/admin/pos?tab=betalen" className="font-medium text-primary underline">{t('admin.horecaPay.qr_set_in_pay')}</Link>
            </p>
            {/* De GKS-tip gaat over "aan de toog" en hoort dus enkel bij elke bestelling apart afrekenen. */}
            <p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('admin.storefront.food.qrModeSettings.restaurant_met_een_witte_kassa_gks')}
            </p>
            </> : null}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

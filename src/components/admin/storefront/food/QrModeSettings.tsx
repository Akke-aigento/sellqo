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
import { cn } from '@/lib/utils';
import { QR_MODES, type QrMode } from './qrModes';
import { useTranslation } from 'react-i18next';


export function QrModeSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['qr-mode', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('fulfillment_settings').select('qr_mode, qr_pay_counter, qr_pay_online').eq('tenant_id', tenantId!).maybeSingle();
      if (error) throw error;
      return { qr_mode: (row?.qr_mode as QrMode) || 'view', qr_pay_counter: row?.qr_pay_counter !== false, qr_pay_online: !!row?.qr_pay_online };
    },
  });
  const [mode, setMode] = useState<QrMode>('view');
  const [counter, setCounter] = useState(true);
  const [online, setOnline] = useState(false);
  // BETAAL-1: counter/online worden enkel nog gelezen (getoond en meegestuurd); wijzigen gebeurt in Kassa › Betalen.
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setMode(data.qr_mode); setCounter(data.qr_pay_counter); setOnline(data.qr_pay_online); } }, [data]);

  const dirty = !!data && mode !== data.qr_mode;
  const save = async () => {
    if (!tenantId) return;
    if (mode === 'order' && !counter && !online) { toast.error(t('admin.storefront.food.qr_pay_required')); return; }
    setSaving(true);
    const { error } = await supabase.from('fulfillment_settings').upsert({ tenant_id: tenantId, qr_mode: mode, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    setSaving(false);
    if (error) { toast.error(t('admin.storefront.food.save_failed_reason', { reason: error.message })); return; }
    toast.success(t('admin.storefront.food.qr_saved'));
    await qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] });
    await qc.invalidateQueries({ queryKey: ['ordering-hub', tenantId] });
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
        {mode === 'order' ? (
          <div className="space-y-2 rounded-lg border p-4">
            {/* BETAAL-1: hoe de klant aan tafel afrekent, staat bij de andere betaalinstellingen (Kassa › Betalen). */}
            <p className="text-sm font-medium">{t('admin.storefront.food.qrModeSettings.hoe_rekent_de_klant_af')}</p>
            <p className="text-sm text-muted-foreground">
              {[counter && t('admin.storefront.food.qrModeSettings.aan_de_toog'), online && t('admin.storefront.food.qrModeSettings.meteen_online')].filter(Boolean).join(' · ') || t('admin.horecaPay.qr_none')}
              {' · '}<Link to="/admin/pos?tab=betalen" className="font-medium text-primary underline">{t('admin.horecaPay.qr_set_in_pay')}</Link>
            </p>
            <p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('admin.storefront.food.qrModeSettings.restaurant_met_een_witte_kassa_gks')}
            </p>
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

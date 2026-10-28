// BETAAL-1 — Kassa › Betalen: alle betaalinstellingen van de zaak op één plek.
//
// - Aan de kassa: welke betaalwijzen SellQo Kassa toont (horeca_pay_settings), de betaalterminal
//   (geen = geen "kaart") en of de kassa fooi aanbiedt.
// - Aan tafel via de QR: aan de toog en/of meteen online (fulfillment_settings.qr_pay_*; vroeger in
//   Bestellen › QR, daar staat nu enkel nog een link hiernaartoe).
// Het rekeningnummer voor overschrijvingen komt uit de bedrijfsgegevens (tenants.iban): één bron.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatIBAN } from '@/lib/epcQrCode';
import { normalizePaySettings, type PaySettings, type SettingMethod, type TerminalMode } from '@/kassa/app/horeca/paySettings';

/** Betaalwijzen die je zelf aanvinkt; "kaart" volgt uit de terminal. */
const TICK_METHODS: Exclude<SettingMethod, 'card'>[] = ['cash', 'transfer', 'cheque_meal', 'voucher'];
const TERMINALS: TerminalMode[] = ['none', 'standalone'];

interface QrPay { mode: string; flow: 'order' | 'check'; counter: boolean; online: boolean }

export function HorecaPaySettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const iban = (currentTenant as { iban?: string | null } | null)?.iban?.trim() || '';
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['horeca-pay-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [pay, qr] = await Promise.all([
        supabase.from('horeca_pay_settings' as never).select('methods, terminal, kassa_tip').eq('tenant_id' as never, tenantId as never).maybeSingle(),
        supabase.from('fulfillment_settings').select('qr_mode, qr_pay_counter, qr_pay_online, qr_flow' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (pay.error) throw pay.error;
      if (qr.error) throw qr.error;
      const q = qr.data as { qr_mode?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null; qr_flow?: string | null } | null;
      return {
        pay: normalizePaySettings(pay.data as Partial<PaySettings> | null),
        qr: { mode: q?.qr_mode || 'view', flow: q?.qr_flow === 'check' ? 'check' : 'order', counter: q?.qr_pay_counter !== false, online: !!q?.qr_pay_online } as QrPay,
      };
    },
  });

  const [pay, setPay] = useState<PaySettings | null>(null);
  const [qr, setQr] = useState<QrPay | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setPay(data.pay); setQr(data.qr); } }, [data]);

  if (isLoading || !pay || !qr || !data) {
    return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const ticked = pay.methods.filter((m): m is Exclude<SettingMethod, 'card'> => m !== 'card');
  const toggle = (m: Exclude<SettingMethod, 'card'>, on: boolean) => {
    const next = on ? [...new Set([...ticked, m])] : ticked.filter((x) => x !== m);
    setPay({ ...pay, methods: [...next, ...(pay.terminal === 'standalone' ? ['card' as const] : [])] });
  };
  const setTerminal = (terminal: TerminalMode) => {
    setPay({ ...pay, terminal, methods: [...ticked, ...(terminal === 'standalone' ? ['card' as const] : [])] });
  };

  const sameMethods = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const dirty = !sameMethods(pay.methods, data.pay.methods) || pay.terminal !== data.pay.terminal || pay.kassa_tip !== data.pay.kassa_tip
    || qr.counter !== data.qr.counter || qr.online !== data.qr.online;
  const noMethod = pay.methods.length === 0;
  const qrNoWay = qr.mode === 'order' && qr.flow === 'order' && !qr.counter && !qr.online;
  const transferNoIban = pay.methods.includes('transfer') && !iban;

  const save = async () => {
    if (!tenantId || noMethod || qrNoWay) return;
    setSaving(true);
    const now = new Date().toISOString();
    // Review Mag-3: enkel opslaan wat wijzigde, zodat een kassa-wijziging nooit de QR-stand
    // van bij het laden terugschrijft (en omgekeerd).
    const payChanged = !sameMethods(pay.methods, data.pay.methods) || pay.terminal !== data.pay.terminal || pay.kassa_tip !== data.pay.kassa_tip;
    const qrChanged = qr.counter !== data.qr.counter || qr.online !== data.qr.online;
    const a = payChanged
      ? await supabase.from('horeca_pay_settings' as never).upsert(
          { tenant_id: tenantId, methods: pay.methods, terminal: pay.terminal, kassa_tip: pay.kassa_tip, updated_at: now, updated_by: user?.id ?? null } as never,
          { onConflict: 'tenant_id' },
        )
      : { error: null };
    const b = !a.error && qrChanged
      ? await supabase.from('fulfillment_settings').upsert(
          { tenant_id: tenantId, qr_pay_counter: qr.counter, qr_pay_online: qr.online, updated_at: now },
          { onConflict: 'tenant_id' },
        )
      : { error: null };
    setSaving(false);
    const err = a.error ?? b.error;
    if (err) { toast.error(t('admin.horecaPay.save_failed', { reason: err.message })); return; }
    toast.success(t('admin.horecaPay.saved'));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['horeca-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] }),
      qc.invalidateQueries({ queryKey: ['ordering-hub', tenantId] }),
    ]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPay.kassa_title')}</CardTitle>
          <CardDescription>{t('admin.horecaPay.kassa_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('admin.horecaPay.methods')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TICK_METHODS.map((m) => (
                <label key={m} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <Checkbox checked={ticked.includes(m)} onCheckedChange={(v) => toggle(m, v === true)} />
                  <span><span className="block font-medium">{t(`admin.horecaPay.method.${m}`)}</span><span className="block text-xs text-muted-foreground">{t(`admin.horecaPay.method_hint.${m}`)}</span></span>
                </label>
              ))}
            </div>
            {noMethod ? <p role="alert" className="text-sm text-destructive">{t('admin.horecaPay.need_method')}</p> : null}
            {transferNoIban ? (
              <p role="alert" className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('admin.horecaPay.no_iban')} <Link to="/admin/settings?section=company" className="font-medium underline">{t('admin.horecaPay.to_company')}</Link></span>
              </p>
            ) : pay.methods.includes('transfer') ? (
              <p className="text-xs text-muted-foreground">{t('admin.horecaPay.iban_used', { iban: formatIBAN(iban) })} <Link to="/admin/settings?section=company" className="underline">{t('admin.horecaPay.change')}</Link></p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('admin.horecaPay.terminal')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TERMINALS.map((m) => (
                <button key={m} type="button" onClick={() => setTerminal(m)} aria-pressed={pay.terminal === m}
                  className={cn('rounded-lg border-2 p-3 text-left', pay.terminal === m ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                  <span className="block font-medium">{t(`admin.horecaPay.terminal_${m}`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`admin.horecaPay.terminal_${m}_desc`)}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span><span className="block text-sm font-medium">{t('admin.horecaPay.kassa_tip')}</span><span className="block text-xs text-muted-foreground">{t('admin.horecaPay.kassa_tip_desc')}</span></span>
            <Switch checked={pay.kassa_tip} onCheckedChange={(v) => setPay({ ...pay, kassa_tip: v })} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPay.qr_title')}</CardTitle>
          <CardDescription>
            {qr.mode === 'order' ? t('admin.horecaPay.qr_desc_order') : t('admin.horecaPay.qr_desc_off')}{' '}
            <Link to="/admin/bestellen?tab=qr" className="underline">{t('admin.horecaPay.qr_to_menu')}</Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* QR-REKENING-1: op de tafelrekening betaalt de gast op het einde, niet per bestelling. */}
          {qr.flow === 'check' ? <p className="text-sm text-muted-foreground">{t('admin.qrFlow.pay_on_check')}</p> : <>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={qr.counter} onCheckedChange={(v) => setQr({ ...qr, counter: v === true })} className="mt-0.5" />
            <span><span className="font-medium">{t('admin.storefront.food.qrModeSettings.aan_de_toog')}</span><span className="block text-muted-foreground">{t('admin.storefront.food.qrModeSettings.na_de_maaltijd_via_je_eigen')}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={qr.online} onCheckedChange={(v) => setQr({ ...qr, online: v === true })} className="mt-0.5" />
            <span><span className="font-medium">{t('admin.storefront.food.qrModeSettings.meteen_online')}</span><span className="block text-muted-foreground">{t('admin.storefront.food.qrModeSettings.bancontact_kaart_of_apple_pay_zoals')}</span></span>
          </label>
          {qrNoWay ? <p role="alert" className="text-sm text-destructive">{t('admin.storefront.food.qr_pay_required')}</p> : null}
          </>}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !dirty || noMethod || qrNoWay}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}
        </Button>
      </div>
    </div>
  );
}

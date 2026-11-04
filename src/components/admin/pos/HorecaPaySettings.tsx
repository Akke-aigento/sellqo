// BETAAL-1 — Kassa › Betalen: alle betaalinstellingen van de zaak op één plek.
//
// - Aan de kassa: welke betaalwijzen SellQo Kassa toont (horeca_pay_settings), de betaalterminal
//   (geen = geen "kaart") en of de kassa fooi aanbiedt.
// - Aan tafel via de QR: sinds QR-MODULES-1 staan alle gast-schakelaars (aan de toog, meteen online,
//   de rekening online afrekenen, delen, fooi, oproepen) op één plek: Kaart › Instellen › QR-menu
//   (QrModeSettings). Hier staat enkel nog de stand met een link (één plek per taak).
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
import { useHorecaHref } from '@/hooks/useHorecaHref';

/** Betaalwijzen die je zelf aanvinkt; "kaart" volgt uit de terminal. */
const TICK_METHODS: Exclude<SettingMethod, 'card'>[] = ['cash', 'transfer', 'cheque_meal', 'voucher'];
const TERMINALS: TerminalMode[] = ['none', 'standalone'];

/** Enkel om de stand te tonen; wijzigen gebeurt in QR aan tafel (QR-MODULES-1). */
interface QrPay { mode: string; flow: 'order' | 'check'; counter: boolean; online: boolean }

/** HORECA-INSTELLINGEN-1 — welk deel dit scherm toont (Mijn zaak › Betalen verdeelt het over tabs). */
export type HorecaPayPart = 'methods' | 'terminal' | 'tip' | 'qr';
const ALL_PARTS: HorecaPayPart[] = ['methods', 'terminal', 'tip', 'qr'];

/**
 * `parts` kiest enkel wat getoond wordt; laden en opslaan blijven dezelfde (één rij, enkel de kassa-kolommen).
 * Een deel dat niet getoond wordt, schrijft dus ongewijzigd terug wat er stond. Zonder `parts`: alles, zoals
 * op Kassabeheer › Betalen.
 */
export function HorecaPaySettings({ parts = ALL_PARTS }: { parts?: HorecaPayPart[] } = {}) {
  const show = (p: HorecaPayPart) => parts.includes(p);
  const editable = show('methods') || show('terminal') || show('tip');
  const { t } = useTranslation();
  // HORECA-INSTELLINGEN-1: horeca-only linkt meteen naar de nieuwe plek (Mijn zaak / Personeel).
  const href = useHorecaHref();
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
        supabase.from('horeca_pay_settings' as never).select('methods, terminal, kassa_tip, online_pay').eq('tenant_id' as never, tenantId as never).maybeSingle(),
        supabase.from('fulfillment_settings').select('qr_mode, qr_pay_counter, qr_pay_online, qr_flow' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (pay.error) throw pay.error;
      if (qr.error) throw qr.error;
      const o = pay.data as { online_pay?: boolean | null } | null;
      const q = qr.data as { qr_mode?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null; qr_flow?: string | null } | null;
      return {
        pay: normalizePaySettings(pay.data as Partial<PaySettings> | null),
        qr: { mode: q?.qr_mode || 'view', flow: q?.qr_flow === 'check' ? 'check' : 'order', counter: q?.qr_pay_counter !== false, online: !!q?.qr_pay_online } as QrPay,
        checkOnline: o?.online_pay === true,
      };
    },
  });

  const [pay, setPay] = useState<PaySettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setPay(data.pay); }, [data]);

  if (isLoading || !pay || !data) {
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
  const dirty = !sameMethods(pay.methods, data.pay.methods) || pay.terminal !== data.pay.terminal || pay.kassa_tip !== data.pay.kassa_tip;
  const noMethod = pay.methods.length === 0;
  const qr = data.qr;
  const transferNoIban = pay.methods.includes('transfer') && !iban;

  const save = async () => {
    if (!tenantId || noMethod) return;
    setSaving(true);
    // Review Mag-3: enkel de kassa-kolommen; de gast-schakelaars (online_*, qr_*) schrijft enkel
    // QR aan tafel, zodat geen van beide schermen de stand van het andere terugschrijft.
    const { error: err } = await supabase.from('horeca_pay_settings' as never).upsert(
      { tenant_id: tenantId, methods: pay.methods, terminal: pay.terminal, kassa_tip: pay.kassa_tip, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never,
      { onConflict: 'tenant_id' },
    );
    setSaving(false);
    if (err) { toast.error(t('admin.horecaPay.save_failed', { reason: err.message })); return; }
    toast.success(t('admin.horecaPay.saved'));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['horeca-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] }),
      qc.invalidateQueries({ queryKey: ['horeca-settings-hub', tenantId] }),
    ]);
  };

  return (
    <div className="space-y-4">
      {editable ? <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPay.kassa_title')}</CardTitle>
          <CardDescription>{t('admin.horecaPay.kassa_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {show('methods') ? <div className="space-y-2">
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
                <span>{t('admin.horecaPay.no_iban')} <Link to={href('/admin/settings?section=company')} className="font-medium underline">{t('admin.horecaPay.to_company')}</Link></span>
              </p>
            ) : pay.methods.includes('transfer') ? (
              <p className="text-xs text-muted-foreground">{t('admin.horecaPay.iban_used', { iban: formatIBAN(iban) })} <Link to={href('/admin/settings?section=company')} className="underline">{t('admin.horecaPay.change')}</Link></p>
            ) : null}
          </div> : null}

          {show('terminal') ? <div className="space-y-2">
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
          </div> : null}

          {show('tip') ? <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span><span className="block text-sm font-medium">{t('admin.horecaPay.kassa_tip')}</span><span className="block text-xs text-muted-foreground">{t('admin.horecaPay.kassa_tip_desc')}</span></span>
            <Switch checked={pay.kassa_tip} onCheckedChange={(v) => setPay({ ...pay, kassa_tip: v })} />
          </label> : null}
        </CardContent>
      </Card> : null}

      {/* QR-MODULES-1: hoe de gast via de QR afrekent, stel je in bij QR aan tafel (één plek per taak). */}
      {show('qr') ? <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPay.qr_title')}</CardTitle>
          <CardDescription>{t('admin.horecaPay.qr_moved')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="text-muted-foreground">{t('admin.horecaPay.qr_now')} </span>
            {qr.mode !== 'order'
              ? t('admin.horecaPay.qr_not_ordering')
              : qr.flow === 'check'
                ? `${t('admin.qrFlow.check_short')} · ${t('admin.qrTable.check_online')}: ${data.checkOnline ? t('settings.horecaHub.on') : t('settings.horecaHub.off')}`
                : [qr.counter && t('admin.storefront.food.qrModeSettings.aan_de_toog'), qr.online && t('admin.qrTable.pay_online')].filter(Boolean).join(' · ') || t('admin.horecaPay.qr_none')}
          </p>
          <Button asChild variant="outline" size="sm"><Link to={href('/admin/bestellen?tab=qr')}>{t('admin.horecaPay.qr_to_settings')}</Link></Button>
        </CardContent>
      </Card> : null}

      {editable ? <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Zonder het deel Betaalwijzen in beeld (bv. tab Betaalterminal) toch zeggen waarom opslaan niet kan. */}
        {noMethod && !show('methods') ? <p role="alert" className="text-sm text-destructive">{t('admin.horecaPay.need_method')}</p> : null}
        <Button onClick={save} disabled={saving || !dirty || noMethod}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}
        </Button>
      </div> : null}
    </div>
  );
}

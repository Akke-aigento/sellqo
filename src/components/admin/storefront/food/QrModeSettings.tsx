// QR-MODULES-1 — "QR aan tafel": alles wat een gast via de QR-code op tafel kan doen, op één plek
// (Kaart › Instellen › QR-menu). Elke schakelaar werkt apart, in vier groepen:
//   1. QR-menu — uit, enkel bekijken of bestellen aan tafel (fulfillment_settings.qr_mode).
//   2. Bestellen — op de tafelrekening of elke bestelling apart (qr_flow), automatisch bevestigen
//      (qr_auto_accept). (HORECA-1, QR-REKENING-1)
//   3. Afrekenen door de gast — bij elke bestelling apart: aan de toog / meteen online
//      (qr_pay_counter / qr_pay_online); op de tafelrekening: de rekening online afrekenen, gelijk
//      delen, fooi (horeca_pay_settings.online_pay / online_split / online_tip, REKENING-ONLINE-1).
//   4. De bediening roepen — Ober roepen / Rekening vragen (qr_call_waiter / qr_call_bill, nieuw).
// Dezelfde kolommen blijven de bron; Kassa › Betalen (HorecaPaySettings) houdt enkel de
// kassa-betaalwijzen en linkt hiernaartoe. Een uitgegrijsde schakelaar zegt altijd waarom, met een
// link die het oplost.
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { QR_MODES, type QrMode } from './qrModes';
import { BUSINESS_HOURS_URL } from '@/components/admin/settings/hours/HoursModeChoice';
import { useHorecaHref } from '@/hooks/useHorecaHref';

type QrFlow = 'order' | 'check';
const QR_FLOWS: QrFlow[] = ['check', 'order'];

interface QrState {
  mode: QrMode; flow: QrFlow; autoAccept: boolean;
  counter: boolean; payOnline: boolean;
  checkOnline: boolean; split: boolean; tip: boolean;
  callWaiter: boolean; callBill: boolean;
  /** UREN-1b: bestellen aan tafel ook buiten de openingsuren (standaard aan = gedrag van vroeger). */
  outsideHours: boolean;
}
const FS_KEYS = ['mode', 'flow', 'autoAccept', 'counter', 'payOnline', 'callWaiter', 'callBill', 'outsideHours'] as const;
const PAY_KEYS = ['checkOnline', 'split', 'tip'] as const;

/** Eén schakelaar met één zin uitleg; uitgegrijsd altijd met de reden (en een link die het oplost). */
function ToggleRow({ title, desc, checked, onChange, disabled, reason, first }: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; reason?: ReactNode; first?: boolean;
}) {
  return (
    <div className={cn('space-y-1', !first && 'border-t pt-3')}>
      <label className={cn('flex items-center justify-between gap-4', disabled && 'cursor-not-allowed')}>
        <span className={cn(disabled && 'opacity-60')}>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{desc}</span>
        </span>
        <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
      </label>
      {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
    </div>
  );
}

function Group({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function QrModeSettings() {
  const { t } = useTranslation();
  // HORECA-INSTELLINGEN-1: horeca-only linkt meteen naar de nieuwe plek (Mijn zaak / Personeel).
  const href = useHorecaHref();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const stripeOk = !!currentTenant?.stripe_charges_enabled;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['qr-mode', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: raw, error }, calls, pay, ts, fiscal, hoursRule] = await Promise.all([
        supabase.from('fulfillment_settings').select('qr_mode, qr_pay_counter, qr_pay_online, qr_flow, qr_auto_accept' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
        // QR-MODULES-1 — apart gelezen: zonder de nieuwe kolommen (migratie nog niet gedraaid) blijft de
        // rest van het scherm werken en verdwijnt enkel de groep "De bediening roepen".
        supabase.from('fulfillment_settings').select('qr_call_waiter, qr_call_bill' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('horeca_pay_settings' as never).select('online_pay, online_tip, online_split').eq('tenant_id' as never, tenantId as never).maybeSingle(),
        // QR-REKENING-1b — het QR-menu is pas zichtbaar als de zaak online staat (Webshop › Winkel openen).
        supabase.from('tenant_theme_settings').select('shop_live').eq('tenant_id', tenantId!).maybeSingle(),
        // Met een geregistreerde kassa (FDM) sluit enkel de kassa een rekening af: geen online afrekenen.
        supabase.from('pos_terminals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('settings->fiscal->>mode' as never, 'fdm' as never),
        // UREN-1b — apart gelezen, zoals de oproepen: zonder de kolom verdwijnt enkel die schakelaar.
        supabase.from('fulfillment_settings').select('qr_block_outside_hours' as 'qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (error) throw error;
      if (pay.error) throw pay.error;
      const row = raw as { qr_mode?: string | null; qr_pay_counter?: boolean | null; qr_pay_online?: boolean | null; qr_flow?: string | null; qr_auto_accept?: boolean | null } | null;
      const c = calls.data as { qr_call_waiter?: boolean | null; qr_call_bill?: boolean | null } | null;
      const o = pay.data as { online_pay?: boolean | null; online_tip?: boolean | null; online_split?: boolean | null } | null;
      const state: QrState = {
        mode: (row?.qr_mode as QrMode) || 'view',
        flow: row?.qr_flow === 'check' ? 'check' : 'order',
        autoAccept: row?.qr_auto_accept === true,
        counter: row?.qr_pay_counter !== false,
        payOnline: !!row?.qr_pay_online,
        checkOnline: o?.online_pay === true, split: o?.online_split !== false, tip: o?.online_tip !== false,
        callWaiter: c?.qr_call_waiter !== false, callBill: c?.qr_call_bill !== false,
        outsideHours: (hoursRule.data as { qr_block_outside_hours?: boolean | null } | null)?.qr_block_outside_hours !== true,
      };
      return {
        state,
        callsAvailable: !calls.error,
        hoursRuleAvailable: !hoursRule.error,
        fiscal: (fiscal.count ?? 0) > 0,
        // Onbekend (fout bij lezen) = geen melding: nooit een valse waarschuwing.
        shop_live: ts.error ? true : ts.data?.shop_live === true,
      };
    },
  });
  const [s, setS] = useState<QrState | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setS(data.state); }, [data]);

  if (isLoading || !data || !s) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  const set = (patch: Partial<QrState>) => setS({ ...s, ...patch });
  const fsChanged = FS_KEYS.some((k) => s[k] !== data.state[k]);
  const payChanged = PAY_KEYS.some((k) => s[k] !== data.state[k]);
  const dirty = fsChanged || payChanged;
  const checkBlocked = !stripeOk || data.fiscal;
  // Meteen online bij het bestellen kan niet zonder Stripe; staat het toch aan, dan mag je het uitzetten.
  const payOnlineBlocked = !stripeOk && !s.payOnline;
  const qrNoWay = s.mode === 'order' && s.flow === 'order' && !s.counter && !s.payOnline;

  const save = async () => {
    if (!tenantId) return;
    // Op de tafelrekening betaalt de gast op het einde (kassa of later online): geen QR-betaalkeuze nodig.
    if (qrNoWay) { toast.error(t('admin.storefront.food.qr_pay_required')); return; }
    setSaving(true);
    const now = new Date().toISOString();
    // Enkel opslaan wat wijzigde (zoals Kassa › Betalen): nooit een stand van bij het laden terugschrijven.
    const a = fsChanged
      ? await supabase.from('fulfillment_settings').upsert(
          {
            tenant_id: tenantId, qr_mode: s.mode, qr_flow: s.flow, qr_auto_accept: s.flow === 'check' && s.autoAccept,
            qr_pay_counter: s.counter, qr_pay_online: s.payOnline,
            ...(data.callsAvailable ? { qr_call_waiter: s.callWaiter, qr_call_bill: s.callBill } : {}),
            ...(data.hoursRuleAvailable ? { qr_block_outside_hours: !s.outsideHours } : {}),
            updated_at: now,
          } as never,
          { onConflict: 'tenant_id' },
        )
      : { error: null };
    const b = !a.error && payChanged
      ? await supabase.from('horeca_pay_settings' as never).upsert(
          { tenant_id: tenantId, online_pay: s.checkOnline && !checkBlocked, online_tip: s.tip, online_split: s.split, updated_at: now, updated_by: user?.id ?? null } as never,
          { onConflict: 'tenant_id' },
        )
      : { error: null };
    setSaving(false);
    const err = a.error ?? b.error;
    if (err) { toast.error(t('admin.storefront.food.save_failed_reason', { reason: err.message })); return; }
    toast.success(t('admin.storefront.food.qr_saved'));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-qr-auto-accept', tenantId] }),
      qc.invalidateQueries({ queryKey: ['horeca-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-pay-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['horeca-settings-hub', tenantId] }),
    ]);
  };

  const noStripe = (
    <>{t('admin.horecaPay.online_no_stripe')} <Link to="/admin/payments" className="font-medium text-primary underline">{t('admin.horecaPay.online_to_stripe')}</Link></>
  );
  const fiscalReason = (
    <>{t('admin.horecaPay.online_fiscal')} <Link to={href('/admin/settings?section=horeca')} className="font-medium text-primary underline">{t('admin.qrTable.fiscal_link')}</Link></>
  );
  const checkReason = data.fiscal ? fiscalReason : !stripeOk ? noStripe : null;
  const needsCheckOnline = !s.checkOnline || checkBlocked ? t('admin.qrTable.needs_check_online') : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.qrTable.title')}</CardTitle>
        <CardDescription>{t('admin.qrTable.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Group title={t('admin.qrTable.group_menu')} desc={t('admin.storefront.food.qrModeSettings.wat_ziet_een_klant_die_de')}>
          <div className="grid gap-2 sm:grid-cols-3">
            {QR_MODES.map((m) => (
              <button key={m.value} type="button" onClick={() => set({ mode: m.value })} aria-pressed={s.mode === m.value}
                className={cn('rounded-lg border-2 p-3 text-left', s.mode === m.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                <span className="block font-medium">{t(m.titleKey)}</span>
                <span className="block text-sm text-muted-foreground">{t(m.textKey)}</span>
              </button>
            ))}
          </div>
          {s.mode !== 'off' && !data.shop_live ? (
            <div role="status" className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block font-medium">{t('admin.qrFlow.offline_title')}</span>
                <span className="block">{t('admin.qrFlow.offline_desc')}</span>
                <Link to="/admin/storefront" className="font-medium underline">{t('admin.qrFlow.offline_link')}</Link>
              </span>
            </div>
          ) : null}
          {s.mode !== 'order' ? <p className="text-xs text-muted-foreground">{t('admin.qrTable.order_only')}</p> : null}
        </Group>

        {s.mode === 'order' ? <>
          <Group title={t('admin.qrTable.group_order')} desc={t('admin.qrFlow.title')}>
            <div className="grid gap-2 sm:grid-cols-2">
              {QR_FLOWS.map((f) => (
                <button key={f} type="button" onClick={() => set({ flow: f })} aria-pressed={s.flow === f}
                  className={cn('rounded-lg border-2 p-3 text-left', s.flow === f ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                  <span className="block font-medium">{t(`admin.qrFlow.${f}_title`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`admin.qrFlow.${f}_desc`)}</span>
                </button>
              ))}
            </div>
            {s.flow === 'check' ? (
              <div className="space-y-2">
                <ToggleRow first title={t('admin.qrFlow.auto_title')} desc={t('admin.qrFlow.auto_desc')} checked={s.autoAccept} onChange={(v) => set({ autoAccept: v })} />
                {s.autoAccept ? (
                  <p role="alert" className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('admin.qrFlow.auto_warning')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {data.hoursRuleAvailable ? (
              <ToggleRow title={t('admin.qrTable.outside_hours')} desc={t('admin.qrTable.outside_hours_desc')} checked={s.outsideHours} onChange={(v) => set({ outsideHours: v })}
                reason={<Link to={href(BUSINESS_HOURS_URL)} className="font-medium text-primary underline">{t('settings.businessHours.edit_link')}</Link>} />
            ) : null}
          </Group>

          <Group title={t('admin.qrTable.group_pay')} desc={s.flow === 'check' ? t('admin.qrTable.pay_desc_check') : t('admin.qrTable.pay_desc_order')}>
            {s.flow === 'order' ? <>
              <ToggleRow first title={t('admin.storefront.food.qrModeSettings.aan_de_toog')} desc={t('admin.storefront.food.qrModeSettings.na_de_maaltijd_via_je_eigen')}
                checked={s.counter} onChange={(v) => set({ counter: v })} />
              <ToggleRow title={t('admin.qrTable.pay_online')} desc={t('admin.storefront.food.qrModeSettings.bancontact_kaart_of_apple_pay_zoals')}
                checked={s.payOnline} onChange={(v) => set({ payOnline: v })} disabled={payOnlineBlocked} reason={!stripeOk ? noStripe : null} />
              {qrNoWay ? <p role="alert" className="text-sm text-destructive">{t('admin.storefront.food.qr_pay_required')}</p> : null}
              {/* De GKS-tip gaat over "aan de toog" en hoort dus enkel bij elke bestelling apart afrekenen. */}
              <p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('admin.storefront.food.qrModeSettings.restaurant_met_een_witte_kassa_gks')}
              </p>
            </> : <>
              <ToggleRow first title={t('admin.qrTable.check_online')} desc={t('admin.horecaPay.online_pay_desc')}
                checked={s.checkOnline && !checkBlocked} onChange={(v) => set({ checkOnline: v })} disabled={checkBlocked} reason={checkReason} />
              <ToggleRow title={t('admin.horecaPay.online_split')} desc={t('admin.horecaPay.online_split_desc')}
                checked={s.split && s.checkOnline && !checkBlocked} onChange={(v) => set({ split: v })} disabled={!s.checkOnline || checkBlocked} reason={needsCheckOnline} />
              <ToggleRow title={t('admin.horecaPay.online_tip')} desc={t('admin.horecaPay.online_tip_desc')}
                checked={s.tip && s.checkOnline && !checkBlocked} onChange={(v) => set({ tip: v })} disabled={!s.checkOnline || checkBlocked} reason={needsCheckOnline} />
            </>}
          </Group>

          {data.callsAvailable ? (
            <Group title={t('admin.qrTable.group_calls')} desc={t('admin.qrTable.calls_desc')}>
              <ToggleRow first title={t('admin.qrTable.call_waiter')} desc={t('admin.qrTable.call_waiter_desc')} checked={s.callWaiter} onChange={(v) => set({ callWaiter: v })} />
              <ToggleRow title={t('admin.qrTable.call_bill')} desc={t('admin.qrTable.call_bill_desc')} checked={s.callBill} onChange={(v) => set({ callBill: v })} />
            </Group>
          ) : null}
        </> : null}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !dirty || qrNoWay}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

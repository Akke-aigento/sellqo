import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Info, RotateCcw, Package, FileText, Users, CreditCard, Store, Truck, Boxes, Bell, Tags } from 'lucide-react';
import { useReturnSettings, ReturnSettings as ReturnSettingsType } from '@/hooks/useReturnSettings';
import { Skeleton } from '@/components/ui/skeleton';

/** i18n-keys per retourreden; vertaald in de component. */
const REASON_CODE_LABELS: Record<string, string> = {
  defect: 'settings.returnSettings.reasons.defect',
  damaged_in_transit: 'settings.returnSettings.reasons.damaged_in_transit',
  wrong_product: 'settings.returnSettings.reasons.wrong_product',
  wrong_size: 'settings.returnSettings.reasons.wrong_size',
  not_as_described: 'settings.returnSettings.reasons.not_as_described',
  changed_mind: 'settings.returnSettings.reasons.changed_mind',
  late_delivery: 'settings.returnSettings.reasons.late_delivery',
  duplicate_order: 'settings.returnSettings.reasons.duplicate_order',
  other: 'settings.returnSettings.reasons.other',
};

export function ReturnSettingsPage() {
  const { t } = useTranslation();
  const { settings, isLoading, updateSettings, isSaving, resetToDefaults, DEFAULT_SETTINGS } = useReturnSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedUpdate = useCallback((updates: Partial<ReturnSettingsType>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateSettings(updates), 500);
  }, [updateSettings]);

  const handleSwitch = (key: keyof ReturnSettingsType, value: boolean) => {
    debouncedUpdate({ [key]: value });
  };

  const handleNumber = (key: keyof ReturnSettingsType, value: string) => {
    const num = parseInt(value) || 0;
    debouncedUpdate({ [key]: num });
  };

  const handleText = (key: keyof ReturnSettingsType, value: string) => {
    debouncedUpdate({ [key]: value });
  };

  const handleRadio = (key: keyof ReturnSettingsType, value: string) => {
    updateSettings({ [key]: value });
  };

  const toggleReasonCode = (code: string) => {
    if (!settings) return;
    const current = settings.enabled_reason_codes || [];
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    updateSettings({ enabled_reason_codes: updated });
  };

  const toggleConditionalReason = (code: string) => {
    if (!settings) return;
    const current = settings.conditional_free_reasons || [];
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    updateSettings({ conditional_free_reasons: updated });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('settings.returnSettings.title')}</h2>
        <p className="text-muted-foreground">{t('settings.returnSettings.subtitle')}</p>
        {/* APP-CLEAN-5: 14 opties werden opgeslagen maar door niets gebruikt; die staan uitgeschakeld. */}
        <p className="text-xs text-muted-foreground mt-1">{t('settings.returnSettings.disabledNote')}</p>
      </div>
      <Accordion type="multiple" defaultValue={['general', 'credit-notes', 'portal', 'refund', 'marketplace', 'shipping', 'stock', 'notifications', 'reasons']} className="space-y-4">
        
        {/* 1. Algemeen */}
        <AccordionItem value="general" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.general.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.general.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.general.enabled')}</Label>
              <Switch checked={settings.returns_enabled} disabled onCheckedChange={v => handleSwitch('returns_enabled', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('settings.returnSettings.general.windowDays')}</Label>
                <Input type="number" min={1} value={settings.return_window_days} disabled onChange={e => handleNumber('return_window_days', e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('settings.returnSettings.general.euMinimum')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.returnSettings.general.restockingFee')}</Label>
                <Input type="number" min={0} max={100} value={settings.default_restocking_fee_percent} onChange={e => handleNumber('default_restocking_fee_percent', e.target.value)} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Credit nota's */}
        <AccordionItem value="credit-notes" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.creditNotes.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.creditNotes.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.returnSettings.creditNotes.policy')}</Label>
              <RadioGroup value={settings.credit_note_policy} disabled onValueChange={v => handleRadio('credit_note_policy', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="cn-never" /><Label htmlFor="cn-never">{t('settings.returnSettings.creditNotes.never')}</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="b2b_only" id="cn-b2b" /><Label htmlFor="cn-b2b">{t('settings.returnSettings.creditNotes.b2bOnly')}</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="always" id="cn-always" /><Label htmlFor="cn-always">{t('settings.returnSettings.creditNotes.always')}</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.returnSettings.creditNotes.prefix')}</Label>
              <Input value={settings.credit_note_prefix} onChange={e => handleText('credit_note_prefix', e.target.value)} className="w-32" />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.creditNotes.autoEmail')}</Label>
              <Switch checked={settings.credit_note_auto_email} onCheckedChange={v => handleSwitch('credit_note_auto_email', v)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Klant-portaal */}
        <AccordionItem value="portal" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.portal.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.portal.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('settings.returnSettings.portal.enabled')}</Label>
                <Badge variant="outline" className="ml-2 text-xs">{t('settings.returnSettings.comingPhase4')}</Badge>
              </div>
              <Switch checked={settings.customer_portal_enabled} disabled onCheckedChange={v => handleSwitch('customer_portal_enabled', v)} />
            </div>
            {settings.customer_portal_enabled && (
              <>
                <div className="space-y-2">
                  <Label>{t('settings.returnSettings.portal.auth')}</Label>
                  <RadioGroup value={settings.customer_portal_auth} disabled onValueChange={v => handleRadio('customer_portal_auth', v)}>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="email_order_lookup" id="auth-email" /><Label htmlFor="auth-email">{t('settings.returnSettings.portal.authEmailOrder')}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="logged_in_only" id="auth-login" /><Label htmlFor="auth-login">{t('settings.returnSettings.portal.authLoggedIn')}</Label></div>
                  </RadioGroup>
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t('settings.returnSettings.portal.autoApprove')}</Label>
                  <Switch checked={settings.auto_approve_within_window} disabled onCheckedChange={v => handleSwitch('auto_approve_within_window', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t('settings.returnSettings.portal.manualOutside')}</Label>
                  <Switch checked={settings.manual_approval_outside_window} disabled onCheckedChange={v => handleSwitch('manual_approval_outside_window', v)} />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 4. Refund logica */}
        <AccordionItem value="refund" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.refund.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.refund.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.returnSettings.refund.method')}</Label>
              <RadioGroup value={settings.default_refund_method} onValueChange={v => handleRadio('default_refund_method', v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto_stripe" id="refund-auto" />
                  <Label htmlFor="refund-auto">{t('settings.returnSettings.refund.auto')}</Label>
                </div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="manual" id="refund-manual" /><Label htmlFor="refund-manual">{t('settings.returnSettings.refund.manual')}</Label></div>
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.refund.shippingByDefault')}</Label>
              <Switch checked={settings.refund_shipping_by_default} onCheckedChange={v => handleSwitch('refund_shipping_by_default', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.refund.partial')}</Label>
              <Switch checked={settings.allow_partial_refunds} disabled onCheckedChange={v => handleSwitch('allow_partial_refunds', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('settings.returnSettings.refund.requiresInspection')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.returnSettings.refund.requiresInspectionHelp')}
                </p>
              </div>
              <Switch checked={settings.refund_requires_inspection} onCheckedChange={v => handleSwitch('refund_requires_inspection', v)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Marketplace refunds */}
        <AccordionItem value="marketplace" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.marketplace.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">Bol.com, Amazon, Shopify</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/50">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t('settings.returnSettings.marketplace.info')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.returnSettings.marketplace.mode')}</Label>
              <RadioGroup value={settings.marketplace_refund_mode} onValueChange={v => handleRadio('marketplace_refund_mode', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="manual_redirect" id="mp-manual" /><Label htmlFor="mp-manual">{t('settings.returnSettings.marketplace.manual')}</Label></div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto_via_api" id="mp-auto" disabled />
                  <Label htmlFor="mp-auto" className="text-muted-foreground">{t('settings.returnSettings.marketplace.auto')}</Label>
                  <Badge variant="outline" className="text-xs">{t('settings.returnSettings.comingPhase3')}</Badge>
                </div>
              </RadioGroup>
            </div>
            {settings.marketplace_refund_mode === 'auto_via_api' && (
              <div className="flex items-center justify-between">
                <Label>{t('settings.returnSettings.marketplace.autoAccept')}</Label>
                <Switch checked={settings.marketplace_auto_accept_within_window} disabled onCheckedChange={v => handleSwitch('marketplace_auto_accept_within_window', v)} />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 6. Verzending retours */}
        <AccordionItem value="shipping" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.shipping.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.shipping.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.returnSettings.shipping.paidBy')}</Label>
              <RadioGroup value={settings.return_shipping_paid_by} disabled onValueChange={v => handleRadio('return_shipping_paid_by', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="customer" id="ship-cust" /><Label htmlFor="ship-cust">{t('settings.returnSettings.shipping.customer')}</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="merchant" id="ship-merch" /><Label htmlFor="ship-merch">{t('settings.returnSettings.shipping.merchant')}</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="conditional" id="ship-cond" /><Label htmlFor="ship-cond">{t('settings.returnSettings.shipping.conditional')}</Label></div>
              </RadioGroup>
            </div>
            {settings.return_shipping_paid_by === 'conditional' && (
              <div className="space-y-2">
                <Label>{t('settings.returnSettings.shipping.freeReasons')}</Label>
                <div className="flex flex-wrap gap-2">
                  {(settings.enabled_reason_codes || []).map(code => (
                    <Badge
                      key={code}
                      variant={(settings.conditional_free_reasons || []).includes(code) ? 'default' : 'outline'}
                      className="opacity-60"
                    >
                      {REASON_CODE_LABELS[code] ? t(REASON_CODE_LABELS[code]) : code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label>{t('settings.returnSettings.shipping.provider')}</Label>
              <RadioGroup value={settings.return_shipping_provider} disabled onValueChange={v => handleRadio('return_shipping_provider', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="prov-none" /><Label htmlFor="prov-none">{t('settings.returnSettings.shipping.none')}</Label></div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sendcloud" id="prov-sc" disabled />
                  <Label htmlFor="prov-sc" className="text-muted-foreground">Sendcloud</Label>
                  <Badge variant="outline" className="text-xs">{t('settings.returnSettings.comingPhase3')}</Badge>
                </div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="prov-other" /><Label htmlFor="prov-other">{t('settings.returnSettings.shipping.other')}</Label></div>
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between">
              <Label className={settings.return_shipping_provider === 'none' ? 'text-muted-foreground' : ''}>
                {t('settings.returnSettings.shipping.autoLabel')}
              </Label>
              <Switch
                checked={settings.auto_generate_return_label}
                onCheckedChange={v => handleSwitch('auto_generate_return_label', v)}
                disabled
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 7. Stock */}
        <AccordionItem value="stock" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.stock.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.stock.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.stock.autoRestock')}</Label>
              <Switch checked={settings.auto_restock_new_condition} onCheckedChange={v => handleSwitch('auto_restock_new_condition', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.stock.noRestockDamaged')}</Label>
              <Switch checked={settings.auto_no_restock_damaged} onCheckedChange={v => handleSwitch('auto_no_restock_damaged', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.returnSettings.stock.impactThreshold')}</Label>
              <Input type="number" min={1} max={100} value={settings.stock_impact_notification_threshold} disabled onChange={e => handleNumber('stock_impact_notification_threshold', e.target.value)} className="w-32" />
              <p className="text-xs text-muted-foreground">{t('settings.returnSettings.stock.impactThresholdHelp')}</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Notificaties */}
        <AccordionItem value="notifications" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.notifications.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.notifications.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{t('settings.returnSettings.notifications.customerHeading')}</p>
            {([
              ['notify_customer_request_received', 'settings.returnSettings.notifications.requestReceived'],
              ['notify_customer_approved', 'settings.returnSettings.notifications.approved'],
              ['notify_customer_package_received', 'settings.returnSettings.notifications.packageReceived'],
              ['notify_customer_refund_processed', 'settings.returnSettings.notifications.refundProcessed'],
            ] as const).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{t(labelKey)}</Label>
                <Switch checked={settings[key] as boolean} onCheckedChange={v => handleSwitch(key, v)} />
              </div>
            ))}
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">{t('settings.returnSettings.notifications.adminHeading')}</p>
            <div className="flex items-center justify-between">
              <Label>{t('settings.returnSettings.notifications.adminNewRequest')}</Label>
              <Switch checked={settings.notify_admin_new_request} onCheckedChange={v => handleSwitch('notify_admin_new_request', v)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 9. Retourredenen */}
        <AccordionItem value="reasons" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">{t('settings.returnSettings.reasonsSection.title')}</p>
                <p className="text-xs text-muted-foreground font-normal">{t('settings.returnSettings.reasonsSection.description')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(REASON_CODE_LABELS).map(([code, label]) => (
                <Badge
                  key={code}
                  variant={(settings.enabled_reason_codes || []).includes(code) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleReasonCode(code)}
                >
                  {t(label)}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => updateSettings({ enabled_reason_codes: DEFAULT_SETTINGS.enabled_reason_codes })}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {t('settings.returnSettings.reasonsSection.resetDefaults')}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Reset all */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">{t('settings.returnSettings.reset.title')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.returnSettings.reset.description')}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {t('settings.returnSettings.reset.button')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.returnSettings.reset.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.returnSettings.reset.confirmBody')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={resetToDefaults}>{t('settings.returnSettings.reset.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

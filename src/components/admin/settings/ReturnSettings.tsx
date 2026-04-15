import { useCallback, useRef } from 'react';
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

const REASON_CODE_LABELS: Record<string, string> = {
  defect: 'Defect',
  damaged_in_transit: 'Beschadigd bij transport',
  wrong_product: 'Verkeerd product ontvangen',
  wrong_size: 'Verkeerde maat',
  not_as_described: 'Niet zoals beschreven',
  changed_mind: 'Ik ben van gedachten veranderd',
  late_delivery: 'Te laat geleverd',
  duplicate_order: 'Dubbele bestelling',
  other: 'Anders',
};

export function ReturnSettingsPage() {
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
        <h2 className="text-2xl font-bold tracking-tight">Retourinstellingen</h2>
        <p className="text-muted-foreground">Configureer het retourbeleid, refund logica en klant-portaal.</p>
      </div>
      <Accordion type="multiple" defaultValue={['general', 'credit-notes', 'portal', 'refund', 'marketplace', 'shipping', 'stock', 'notifications', 'reasons']} className="space-y-4">
        
        {/* 1. Algemeen */}
        <AccordionItem value="general" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Algemeen</p>
                <p className="text-xs text-muted-foreground font-normal">Basisinstellingen voor retours</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Retours geactiveerd</Label>
              <Switch checked={settings.returns_enabled} onCheckedChange={v => handleSwitch('returns_enabled', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Retourtermijn (dagen)</Label>
                <Input type="number" min={1} value={settings.return_window_days} onChange={e => handleNumber('return_window_days', e.target.value)} />
                <p className="text-xs text-muted-foreground">EU minimum: 14 dagen</p>
              </div>
              <div className="space-y-1.5">
                <Label>Standaard restocking fee (%)</Label>
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
                <p className="font-semibold">Credit nota's</p>
                <p className="text-xs text-muted-foreground font-normal">Wanneer en hoe credit nota's worden aangemaakt</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Credit nota beleid</Label>
              <RadioGroup value={settings.credit_note_policy} onValueChange={v => handleRadio('credit_note_policy', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="cn-never" /><Label htmlFor="cn-never">Nooit</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="b2b_only" id="cn-b2b" /><Label htmlFor="cn-b2b">Alleen B2B</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="always" id="cn-always" /><Label htmlFor="cn-always">Altijd (ook B2C)</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label>Credit nota prefix</Label>
              <Input value={settings.credit_note_prefix} onChange={e => handleText('credit_note_prefix', e.target.value)} className="w-32" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-versturen credit nota per email bij refund</Label>
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
                <p className="font-semibold">Klant-portaal</p>
                <p className="text-xs text-muted-foreground font-normal">Self-service retour aanvragen</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Klanten mogen zelf retours aanvragen</Label>
                <Badge variant="outline" className="ml-2 text-xs">Komt in fase 4</Badge>
              </div>
              <Switch checked={settings.customer_portal_enabled} onCheckedChange={v => handleSwitch('customer_portal_enabled', v)} />
            </div>
            {settings.customer_portal_enabled && (
              <>
                <div className="space-y-2">
                  <Label>Authenticatie methode</Label>
                  <RadioGroup value={settings.customer_portal_auth} onValueChange={v => handleRadio('customer_portal_auth', v)}>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="email_order_lookup" id="auth-email" /><Label htmlFor="auth-email">Email + ordernummer (geen account)</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="logged_in_only" id="auth-login" /><Label htmlFor="auth-login">Alleen ingelogde klanten</Label></div>
                  </RadioGroup>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto-goedkeuren binnen retourtermijn</Label>
                  <Switch checked={settings.auto_approve_within_window} onCheckedChange={v => handleSwitch('auto_approve_within_window', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Buiten retourtermijn alleen op aanvraag</Label>
                  <Switch checked={settings.manual_approval_outside_window} onCheckedChange={v => handleSwitch('manual_approval_outside_window', v)} />
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
                <p className="font-semibold">Refund logica (eigen Stripe orders)</p>
                <p className="text-xs text-muted-foreground font-normal">Hoe refunds worden verwerkt voor eigen checkout</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Refund methode</Label>
              <RadioGroup value={settings.default_refund_method} onValueChange={v => handleRadio('default_refund_method', v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto_stripe" id="refund-auto" />
                  <Label htmlFor="refund-auto">Automatisch via Stripe</Label>
                </div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="manual" id="refund-manual" /><Label htmlFor="refund-manual">Handmatig (admin bevestigt)</Label></div>
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between">
              <Label>Verzendkosten standaard ook terugbetalen</Label>
              <Switch checked={settings.refund_shipping_by_default} onCheckedChange={v => handleSwitch('refund_shipping_by_default', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gedeeltelijke refunds toestaan (per item)</Label>
              <Switch checked={settings.allow_partial_refunds} onCheckedChange={v => handleSwitch('allow_partial_refunds', v)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Inspectie vereist voor refund</Label>
                <p className="text-xs text-muted-foreground">
                  Wanneer uitgeschakeld kan een refund worden verwerkt zonder dat de inspectie is afgerond.
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
                <p className="font-semibold">Marketplace refunds</p>
                <p className="text-xs text-muted-foreground font-normal">Bol.com, Amazon, Shopify</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/50">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Voor orders binnengekomen via marketplaces zoals Bol.com of Amazon verloopt de refund via hun platform. Onze refund logica geldt alleen voor eigen Stripe checkout orders.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Refund modus</Label>
              <RadioGroup value={settings.marketplace_refund_mode} onValueChange={v => handleRadio('marketplace_refund_mode', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="manual_redirect" id="mp-manual" /><Label htmlFor="mp-manual">Manueel — admin gaat zelf naar marketplace dashboard</Label></div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto_via_api" id="mp-auto" disabled />
                  <Label htmlFor="mp-auto" className="text-muted-foreground">Automatisch via marketplace API</Label>
                  <Badge variant="outline" className="text-xs">Komt in fase 3</Badge>
                </div>
              </RadioGroup>
            </div>
            {settings.marketplace_refund_mode === 'auto_via_api' && (
              <div className="flex items-center justify-between">
                <Label>Auto-accepteren binnen retourtermijn</Label>
                <Switch checked={settings.marketplace_auto_accept_within_window} onCheckedChange={v => handleSwitch('marketplace_auto_accept_within_window', v)} />
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
                <p className="font-semibold">Verzending retours</p>
                <p className="text-xs text-muted-foreground font-normal">Wie betaalt verzending en label generatie</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Retourverzending betaald door</Label>
              <RadioGroup value={settings.return_shipping_paid_by} onValueChange={v => handleRadio('return_shipping_paid_by', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="customer" id="ship-cust" /><Label htmlFor="ship-cust">Klant betaalt</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="merchant" id="ship-merch" /><Label htmlFor="ship-merch">Wij betalen</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="conditional" id="ship-cond" /><Label htmlFor="ship-cond">Conditioneel (gratis bij bepaalde redenen)</Label></div>
              </RadioGroup>
            </div>
            {settings.return_shipping_paid_by === 'conditional' && (
              <div className="space-y-2">
                <Label>Gratis retour bij deze redenen</Label>
                <div className="flex flex-wrap gap-2">
                  {(settings.enabled_reason_codes || []).map(code => (
                    <Badge
                      key={code}
                      variant={(settings.conditional_free_reasons || []).includes(code) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleConditionalReason(code)}
                    >
                      {REASON_CODE_LABELS[code] || code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label>Verzendintegratie</Label>
              <RadioGroup value={settings.return_shipping_provider} onValueChange={v => handleRadio('return_shipping_provider', v)}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="prov-none" /><Label htmlFor="prov-none">Geen integratie</Label></div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sendcloud" id="prov-sc" disabled />
                  <Label htmlFor="prov-sc" className="text-muted-foreground">Sendcloud</Label>
                  <Badge variant="outline" className="text-xs">Komt in fase 3</Badge>
                </div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="prov-other" /><Label htmlFor="prov-other">Andere koerier</Label></div>
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between">
              <Label className={settings.return_shipping_provider === 'none' ? 'text-muted-foreground' : ''}>
                Auto-genereer retourlabel bij goedkeuring
              </Label>
              <Switch
                checked={settings.auto_generate_return_label}
                onCheckedChange={v => handleSwitch('auto_generate_return_label', v)}
                disabled={settings.return_shipping_provider === 'none'}
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
                <p className="font-semibold">Voorraad</p>
                <p className="text-xs text-muted-foreground font-normal">Automatische herbevoorrading bij retours</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Auto-restock bij conditie 'nieuw' of 'ongeopend'</Label>
              <Switch checked={settings.auto_restock_new_condition} onCheckedChange={v => handleSwitch('auto_restock_new_condition', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto NIET restocken bij 'beschadigd' of 'defect'</Label>
              <Switch checked={settings.auto_no_restock_damaged} onCheckedChange={v => handleSwitch('auto_no_restock_damaged', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notificatie bij voorraad-impact (%)</Label>
              <Input type="number" min={1} max={100} value={settings.stock_impact_notification_threshold} onChange={e => handleNumber('stock_impact_notification_threshold', e.target.value)} className="w-32" />
              <p className="text-xs text-muted-foreground">Stuur notificatie als retour meer dan X% van voorraad betreft</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Notificaties */}
        <AccordionItem value="notifications" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Notificaties</p>
                <p className="text-xs text-muted-foreground font-normal">Email notificaties voor retours</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Klant ontvangt email bij:</p>
            {([
              ['notify_customer_request_received', 'Retour aanvraag ontvangen'],
              ['notify_customer_approved', 'Retour goedgekeurd'],
              ['notify_customer_package_received', 'Pakket ontvangen door ons'],
              ['notify_customer_refund_processed', 'Refund verwerkt'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={settings[key] as boolean} onCheckedChange={v => handleSwitch(key, v)} />
              </div>
            ))}
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Admin ontvangt notificatie bij:</p>
            <div className="flex items-center justify-between">
              <Label>Nieuwe retour aanvraag</Label>
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
                <p className="font-semibold">Retourredenen</p>
                <p className="text-xs text-muted-foreground font-normal">Welke redenen klanten mogen kiezen</p>
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
                  {label}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => updateSettings({ enabled_reason_codes: DEFAULT_SETTINGS.enabled_reason_codes })}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Standaard terugzetten
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Reset all */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Alle instellingen resetten</p>
            <p className="text-sm text-muted-foreground">Zet alle retourinstellingen terug naar de standaardwaarden.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset alles
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dit zet alle retourinstellingen terug naar de standaardwaarden. Dit kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={resetToDefaults}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

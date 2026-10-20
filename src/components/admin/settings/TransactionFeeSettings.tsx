import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  CreditCard, 
  QrCode, 
  Loader2, 
  TrendingUp,
  Infinity,
  AlertTriangle,
  CheckCircle,
  Info,
  GripVertical,
  Zap,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTransactionUsage } from '@/hooks/useTransactionUsage';
import type { PaymentMethodType } from '@/types/billing';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { useTenant } from '@/hooks/useTenant';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type PaymentSectionKey = 'direct' | 'later' | 'transfer';

/** `labelKey`/`descriptionKey` zijn i18n-keys; vertaald in de component. */
const PAYMENT_SECTIONS: Record<PaymentSectionKey, { labelKey: string; descriptionKey: string; icon: typeof CreditCard }> = {
  direct: { labelKey: 'settings.transactions.sections.direct.label', descriptionKey: 'settings.transactions.sections.direct.description', icon: Zap },
  later: { labelKey: 'settings.transactions.sections.later.label', descriptionKey: 'settings.transactions.sections.later.description', icon: Clock },
  transfer: { labelKey: 'settings.transactions.sections.transfer.label', descriptionKey: 'settings.transactions.sections.transfer.description', icon: QrCode },
};

/** `labelKey`, `descriptionKey` en `regionKey` zijn i18n-keys; merknamen (`label`) blijven onvertaald. */
const STRIPE_PAYMENT_METHODS: { code: string; label?: string; labelKey?: string; descriptionKey: string; region?: string; regionKey?: string; flag: string; cost: string }[] = [
  { code: 'card', labelKey: 'settings.transactions.stripeMethods.card.label', descriptionKey: 'settings.transactions.stripeMethods.card.description', regionKey: 'settings.transactions.stripeMethods.card.region', flag: '🌍', cost: '~1,5% + €0,25' },
  { code: 'ideal', label: 'iDEAL', descriptionKey: 'settings.transactions.stripeMethods.ideal.description', region: 'NL', flag: '🇳🇱', cost: '~€0,29' },
  { code: 'bancontact', label: 'Bancontact', descriptionKey: 'settings.transactions.stripeMethods.bancontact.description', region: 'BE', flag: '🇧🇪', cost: '~€0,25' },
  { code: 'klarna', label: 'Klarna', descriptionKey: 'settings.transactions.stripeMethods.klarna.description', region: 'EU', flag: '🇪🇺', cost: '~3,5% + €0,30' },
];

interface TenantPaymentConfig {
  payment_methods_enabled: PaymentMethodType[];
  pass_transaction_fee_to_customer: boolean;
  transaction_fee_label: string;
  iban: string | null;
  bic: string | null;
  stripe_payment_methods: string[];
  bank_transfer_acknowledged_manual: boolean;
  bank_transfer_hide_qr_mobile: boolean;
  payment_section_order: PaymentSectionKey[];
}

function SortablePaymentSection({ id, index }: { id: PaymentSectionKey; index: number }) {
  const { t } = useTranslation();
  const section = PAYMENT_SECTIONS[id];
  const Icon = section.icon;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg bg-background cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="p-2 bg-muted rounded-md">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{t(section.labelKey)}</div>
        <div className="text-xs text-muted-foreground">{t(section.descriptionKey)}</div>
      </div>
      <Badge variant="outline" className="shrink-0 text-xs tabular-nums">
        {index + 1}
      </Badge>
    </div>
  );
}

export function TransactionFeeSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const activeTenantId = currentTenant?.id;
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useTransactionUsage(activeTenantId || undefined);
  
  const [config, setConfig] = useState<TenantPaymentConfig>({
    payment_methods_enabled: ['stripe'],
    pass_transaction_fee_to_customer: false,
    transaction_fee_label: 'Transactiekosten',
    iban: null,
    bic: null,
    stripe_payment_methods: ['card', 'ideal', 'bancontact'],
    bank_transfer_acknowledged_manual: false,
    bank_transfer_hide_qr_mobile: false,
    payment_section_order: ['direct', 'later', 'transfer'],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TenantPaymentConfig | null>(null);
  const [showBankTransferDialog, setShowBankTransferDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (activeTenantId) {
      loadConfig();
    }
  }, [activeTenantId]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('payment_methods_enabled, pass_transaction_fee_to_customer, transaction_fee_label, iban, bic, stripe_payment_methods, bank_transfer_acknowledged_manual, bank_transfer_hide_qr_mobile, payment_section_order')
        .eq('id', activeTenantId)
        .single();

      if (error) throw error;

      const validStripeMethodCodes = STRIPE_PAYMENT_METHODS.map(m => m.code);
      const rawStripeMethods = (data.stripe_payment_methods as string[]) || ['card', 'ideal', 'bancontact'];
      const sanitizedStripeMethods = rawStripeMethods.filter(m => validStripeMethodCodes.includes(m));

      const rawOrder = (data.payment_section_order as PaymentSectionKey[] | null) || ['direct', 'later', 'transfer'];
      const validKeys: PaymentSectionKey[] = ['direct', 'later', 'transfer'];
      const sanitizedOrder = rawOrder.filter(k => validKeys.includes(k));
      const finalOrder = sanitizedOrder.length === 3 ? sanitizedOrder : ['direct', 'later', 'transfer'] as PaymentSectionKey[];

      const loaded: TenantPaymentConfig = {
        payment_methods_enabled: (data.payment_methods_enabled as PaymentMethodType[]) || ['stripe'],
        pass_transaction_fee_to_customer: data.pass_transaction_fee_to_customer || false,
        transaction_fee_label: data.transaction_fee_label || 'Transactiekosten',
        iban: data.iban,
        bic: data.bic,
        stripe_payment_methods: sanitizedStripeMethods.length > 0 ? sanitizedStripeMethods : ['card'],
        bank_transfer_acknowledged_manual: data.bank_transfer_acknowledged_manual || false,
        bank_transfer_hide_qr_mobile: (data as any).bank_transfer_hide_qr_mobile ?? false,
        payment_section_order: finalOrder,
      };
      setConfig(loaded);
      setInitialConfig(loaded);
    } catch (error) {
      console.error('Error loading payment config:', error);
      toast.error(t('settings.transactions.toast.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!activeTenantId) {
      console.error('[TransactionFeeSettings] saveConfig called but activeTenantId is null');
      return;
    }
    
    setIsSaving(true);
    try {
      const validCodes = STRIPE_PAYMENT_METHODS.map(m => m.code);
      const cleanedMethods = config.stripe_payment_methods.filter(m => validCodes.includes(m));
      
      const updatePayload = {
        payment_methods_enabled: config.payment_methods_enabled,
        pass_transaction_fee_to_customer: config.pass_transaction_fee_to_customer,
        transaction_fee_label: config.transaction_fee_label,
        stripe_payment_methods: cleanedMethods.length > 0 ? cleanedMethods : ['card'],
        bank_transfer_acknowledged_manual: config.bank_transfer_acknowledged_manual,
        bank_transfer_hide_qr_mobile: config.bank_transfer_hide_qr_mobile,
        payment_section_order: config.payment_section_order,
      };
      
      const { error, data } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', activeTenantId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error(t('settings.transactions.toast.saveNoAccess'));
        return;
      }

      const updatedConfig = { ...config, stripe_payment_methods: cleanedMethods.length > 0 ? cleanedMethods : ['card'] };
      setInitialConfig(updatedConfig);
      toast.success(t('settings.transactions.toast.saved'));
      refetchUsage();
    } catch (error) {
      console.error('[TransactionFeeSettings] Error saving config:', error);
      toast.error(t('settings.transactions.toast.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaymentMethod = (method: PaymentMethodType) => {
    setConfig(prev => {
      const methods = prev.payment_methods_enabled;
      if (methods.includes(method)) {
        if (methods.length === 1) {
          toast.error(t('settings.transactions.toast.minOneMethod'));
          return prev;
        }
        return { ...prev, payment_methods_enabled: methods.filter(m => m !== method) };
      }
      return { ...prev, payment_methods_enabled: [...methods, method] };
    });
  };

  const handleBankTransferToggle = () => {
    const isCurrentlyEnabled = config.payment_methods_enabled.includes('bank_transfer');
    if (isCurrentlyEnabled) {
      togglePaymentMethod('bank_transfer');
      return;
    }
    // Always show responsibility dialog when enabling bank transfer
    setShowBankTransferDialog(true);
  };

  const handleBankTransferAccepted = () => {
    setShowBankTransferDialog(false);
    setConfig(prev => ({
      ...prev,
      payment_methods_enabled: [...prev.payment_methods_enabled, 'bank_transfer'],
      bank_transfer_acknowledged_manual: true,
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfig(prev => {
      const oldIndex = prev.payment_section_order.indexOf(active.id as PaymentSectionKey);
      const newIndex = prev.payment_section_order.indexOf(over.id as PaymentSectionKey);
      return { ...prev, payment_section_order: arrayMove(prev.payment_section_order, oldIndex, newIndex) };
    });
  };

  const canEnableBankTransfer = config.iban && config.iban.length >= 10;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isUnlimited = usageData?.included_transactions === -1;
  const usagePercentage = isUnlimited ? 0 : 
    usageData?.included_transactions ? 
      Math.min(100, (usageData.total_transactions / usageData.included_transactions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('settings.transactions.usage.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.transactions.usage.description')}
              </CardDescription>
            </div>
            {isUnlimited ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Infinity className="h-3 w-3" />
                {t('settings.transactions.usage.unlimited')}
              </Badge>
            ) : usageData?.is_over_limit ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('settings.transactions.usage.overLimit')}
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t('settings.transactions.usage.withinLimit')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : usageData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.stripe_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">Stripe</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.bank_transfer_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.transactions.usage.bank')}</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.pos_cash_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.transactions.usage.posCash')}</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.pos_card_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.transactions.usage.posCard')}</div>
                </div>
              </div>

              {!isUnlimited && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('settings.transactions.usage.usedOf', { used: usageData.total_transactions, included: usageData.included_transactions })}</span>
                      <span>{t('settings.transactions.usage.remaining', { n: usageData.remaining_transactions })}</span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                  </div>

                  {usageData.is_over_limit && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {t('settings.transactions.usage.overLimitAlert', { n: usageData.total_transactions - usageData.included_transactions, fee: usageData.usage?.overage_fee_total?.toFixed(2) || '0.00' })}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center">{t('settings.transactions.usage.noData')}</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.transactions.methods.title')}</CardTitle>
          <CardDescription>
            {t('settings.transactions.methods.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stripe */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">{t('settings.transactions.methods.stripeTitle')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('settings.transactions.methods.stripeDescription')}
                </div>
              </div>
            </div>
            <Switch
              checked={config.payment_methods_enabled.includes('stripe')}
              onCheckedChange={() => togglePaymentMethod('stripe')}
            />
          </div>

          {/* Stripe sub-methods */}
          {config.payment_methods_enabled.includes('stripe') && (
            <div className="ml-12 space-y-2 p-4 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium mb-3">{t('settings.transactions.methods.availableStripe')}</p>
              {STRIPE_PAYMENT_METHODS.map((method) => {
                const isChecked = config.stripe_payment_methods.includes(method.code);
                const isKlarna = method.code === 'klarna';
                return (
                  <div key={method.code}>
                    <label
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setConfig(prev => {
                            const current = prev.stripe_payment_methods;
                            if (!checked) {
                              if (current.length === 1) {
                                toast.error(t('settings.transactions.toast.minOneStripeMethod'));
                                return prev;
                              }
                              return { ...prev, stripe_payment_methods: current.filter(c => c !== method.code) };
                            }
                            return { ...prev, stripe_payment_methods: [...current, method.code] };
                          });
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{method.flag} {method.labelKey ? t(method.labelKey) : method.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t(method.descriptionKey)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{method.regionKey ? t(method.regionKey) : method.region}</Badge>
                          <span className="text-xs text-muted-foreground">{method.cost}</span>
                        </div>
                      </div>
                    </label>
                    {isKlarna && isChecked && (
                      <Alert className="ml-8 mt-1 mb-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {t('settings.transactions.methods.klarnaNotice')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bank Transfer with acknowledgement */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <QrCode className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('settings.transactions.bankTransfer.title')}</span>
                  <Badge variant="secondary">{t('settings.transactions.bankTransfer.zeroCost')}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('settings.transactions.bankTransfer.description')}
                </div>
                {!canEnableBankTransfer && (
                  <div className="text-xs text-destructive mt-1">
                    ⚠️ {t('settings.transactions.bankTransfer.ibanRequired')}
                  </div>
                )}
                {config.bank_transfer_acknowledged_manual && config.payment_methods_enabled.includes('bank_transfer') && (
                  <div className="text-xs text-amber-600 mt-1">
                    ⚠️ {t('settings.transactions.bankTransfer.manualWarning')}
                  </div>
                )}
              </div>
            </div>
            <Switch
              checked={config.payment_methods_enabled.includes('bank_transfer')}
              onCheckedChange={handleBankTransferToggle}
              disabled={!canEnableBankTransfer}
            />
          </div>

          {config.payment_methods_enabled.includes('bank_transfer') && (
            <div className="flex items-start justify-between gap-4 p-4 pl-6 border rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t('settings.transactions.bankTransfer.hideQrMobile')}</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  {t('settings.transactions.bankTransfer.hideQrMobileHelp')}
                </div>
              </div>
              <Switch
                checked={config.bank_transfer_hide_qr_mobile}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, bank_transfer_hide_qr_mobile: checked }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Fee Passthrough */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.transactions.passthrough.title')}</CardTitle>
          <CardDescription>
            {t('settings.transactions.passthrough.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">{t('settings.transactions.passthrough.showAtCheckout')}</div>
              <div className="text-sm text-muted-foreground max-w-lg">
                {t('settings.transactions.passthrough.showAtCheckoutHelp')}
              </div>
            </div>
            <Switch
              checked={config.pass_transaction_fee_to_customer}
              onCheckedChange={(checked) => setConfig(prev => ({ 
                ...prev, 
                pass_transaction_fee_to_customer: checked 
              }))}
            />
          </div>

          {config.pass_transaction_fee_to_customer && (
            <div className="space-y-2">
              <Label htmlFor="fee-label">{t('settings.transactions.passthrough.feeLabel')}</Label>
              <Input
                id="fee-label"
                value={config.transaction_fee_label}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  transaction_fee_label: e.target.value 
                }))}
                placeholder={t('settings.transactions.passthrough.feeLabelPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.transactions.passthrough.feeLabelHelp')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Section Order */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.transactions.order.title')}</CardTitle>
          <CardDescription>
            {t('settings.transactions.order.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={config.payment_section_order}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {config.payment_section_order.map((key, index) => (
                  <SortablePaymentSection key={key} id={key} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              💡 {t('settings.transactions.order.tip')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Bank Transfer Acknowledgement Dialog */}
      <AlertDialog open={showBankTransferDialog} onOpenChange={setShowBankTransferDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('settings.transactions.dialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                {t('settings.transactions.dialog.introBefore')}<strong>{t('settings.transactions.dialog.introNot')}</strong>{t('settings.transactions.dialog.introAfter')}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm">
                <li>{t('settings.transactions.dialog.point1')}</li>
                <li>{t('settings.transactions.dialog.point2')}</li>
                <li>{t('settings.transactions.dialog.point3')}</li>
                <li>{t('settings.transactions.dialog.point4')}</li>
                <li>{t('settings.transactions.dialog.point5')}</li>
              </ul>
              <p className="text-sm text-muted-foreground italic">
                {t('settings.transactions.dialog.advice')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBankTransferAccepted}>
              {t('settings.transactions.dialog.accept')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Button */}
      <FloatingSaveBar
        isDirty={initialConfig !== null && JSON.stringify(config) !== JSON.stringify(initialConfig)}
        isSaving={isSaving}
        onSave={saveConfig}
        onCancel={() => { if (initialConfig) setConfig(initialConfig); }}
      />
    </div>
  );
}

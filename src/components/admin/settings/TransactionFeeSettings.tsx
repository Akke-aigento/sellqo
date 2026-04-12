import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  Building2, 
  QrCode, 
  Loader2, 
  Save,
  TrendingUp,
  Infinity,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTransactionUsage } from '@/hooks/useTransactionUsage';
import type { PaymentMethodType } from '@/types/billing';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { useTenant } from '@/hooks/useTenant';

const STRIPE_PAYMENT_METHODS = [
  { code: 'card', label: 'Creditcard / Apple Pay / Google Pay', description: 'Standaard kaartbetalingen + wallets', region: 'Internationaal', flag: '🌍', cost: '~1,5% + €0,25' },
  { code: 'ideal', label: 'iDEAL', description: 'Directe bankoverschrijving', region: 'NL', flag: '🇳🇱', cost: '~€0,29' },
  { code: 'bancontact', label: 'Bancontact', description: 'Belgisch betaalsysteem', region: 'BE', flag: '🇧🇪', cost: '~€0,25' },
  { code: 'klarna', label: 'Klarna', description: 'Achteraf betalen / gespreid', region: 'EU', flag: '🇪🇺', cost: '~3,5% + €0,30' },
];

interface TenantPaymentConfig {
  payment_methods_enabled: PaymentMethodType[];
  pass_transaction_fee_to_customer: boolean;
  transaction_fee_label: string;
  iban: string | null;
  bic: string | null;
  stripe_payment_methods: string[];
  bank_transfer_acknowledged_manual: boolean;
}

export function TransactionFeeSettings() {
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TenantPaymentConfig | null>(null);
  const [showBankTransferDialog, setShowBankTransferDialog] = useState(false);

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
        .select('payment_methods_enabled, pass_transaction_fee_to_customer, transaction_fee_label, iban, bic, stripe_payment_methods, bank_transfer_acknowledged_manual')
        .eq('id', activeTenantId)
        .single();

      if (error) throw error;

      const validStripeMethodCodes = STRIPE_PAYMENT_METHODS.map(m => m.code);
      const rawStripeMethods = (data.stripe_payment_methods as string[]) || ['card', 'ideal', 'bancontact'];
      const sanitizedStripeMethods = rawStripeMethods.filter(m => validStripeMethodCodes.includes(m));

      const loaded = {
        payment_methods_enabled: (data.payment_methods_enabled as PaymentMethodType[]) || ['stripe'],
        pass_transaction_fee_to_customer: data.pass_transaction_fee_to_customer || false,
        transaction_fee_label: data.transaction_fee_label || 'Transactiekosten',
        iban: data.iban,
        bic: data.bic,
        stripe_payment_methods: sanitizedStripeMethods.length > 0 ? sanitizedStripeMethods : ['card'],
        bank_transfer_acknowledged_manual: data.bank_transfer_acknowledged_manual || false,
      };
      setConfig(loaded);
      setInitialConfig(loaded);
    } catch (error) {
      console.error('Error loading payment config:', error);
      toast.error('Fout bij laden instellingen');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!activeTenantId) {
      console.error('[TransactionFeeSettings] saveConfig called but activeTenantId is null');
      return;
    }
    
    console.log('[TransactionFeeSettings] activeTenantId:', activeTenantId);
    console.log('[TransactionFeeSettings] currentTenant:', currentTenant?.name);
    
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
      };
      
      console.log('[TransactionFeeSettings] UPDATE payload:', JSON.stringify(updatePayload));
      console.log('[TransactionFeeSettings] UPDATE target tenant_id:', activeTenantId);
      
      const { error, data, count, status, statusText } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', activeTenantId)
        .select();

      console.log('[TransactionFeeSettings] UPDATE response:', { error, data, count, status, statusText });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.error('[TransactionFeeSettings] UPDATE returned 0 rows — possible RLS silent failure');
        toast.error('Opslaan mislukt: geen toegang (RLS). Neem contact op met support.');
        return;
      }

      const updatedConfig = { ...config, stripe_payment_methods: cleanedMethods.length > 0 ? cleanedMethods : ['card'] };
      setInitialConfig(updatedConfig);
      toast.success('Instellingen opgeslagen');
      refetchUsage();
    } catch (error) {
      console.error('[TransactionFeeSettings] Error saving config:', error);
      toast.error('Fout bij opslaan instellingen');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaymentMethod = (method: PaymentMethodType) => {
    setConfig(prev => {
      const methods = prev.payment_methods_enabled;
      if (methods.includes(method)) {
        if (methods.length === 1) {
          toast.error('Minimaal één betaalmethode vereist');
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
      // Turning off — no confirmation needed
      togglePaymentMethod('bank_transfer');
      return;
    }

    // Turning on — check if already acknowledged
    if (config.bank_transfer_acknowledged_manual) {
      togglePaymentMethod('bank_transfer');
      return;
    }

    // First time enabling — show dialog
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
                Transactie Gebruik
              </CardTitle>
              <CardDescription>
                Deze maand verwerkte transacties
              </CardDescription>
            </div>
            {isUnlimited ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Infinity className="h-3 w-3" />
                Onbeperkt
              </Badge>
            ) : usageData?.is_over_limit ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Over limiet
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Binnen limiet
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
                  <div className="text-xs text-muted-foreground">Bank</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.pos_cash_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">POS Cash</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{usageData.usage?.pos_card_transactions || 0}</div>
                  <div className="text-xs text-muted-foreground">POS Kaart</div>
                </div>
              </div>

              {!isUnlimited && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{usageData.total_transactions} van {usageData.included_transactions} transacties</span>
                      <span>{usageData.remaining_transactions} resterend</span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                  </div>

                  {usageData.is_over_limit && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Je bent {usageData.total_transactions - usageData.included_transactions} transacties over je limiet. 
                        Extra kosten: €{usageData.usage?.overage_fee_total?.toFixed(2) || '0.00'}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center">Geen data beschikbaar</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Betaalmethoden</CardTitle>
          <CardDescription>
            Kies welke betaalmethoden beschikbaar zijn voor je klanten
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
                <div className="font-medium">Stripe (iDEAL, Creditcard, Bancontact)</div>
                <div className="text-sm text-muted-foreground">
                  Directe online betaling via Stripe
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
              <p className="text-sm font-medium mb-3">Beschikbare Stripe betaalmethodes</p>
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
                                toast.error('Minimaal één Stripe methode vereist');
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
                          <span className="text-sm font-medium">{method.flag} {method.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{method.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{method.region}</Badge>
                          <span className="text-xs text-muted-foreground">{method.cost}</span>
                        </div>
                      </div>
                    </label>
                    {/* Klarna warning */}
                    {isKlarna && isChecked && (
                      <Alert className="ml-8 mt-1 mb-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Klarna kost 3,5% + €0,30 per transactie. Zorg dat je deze fees doorrekent aan klanten of slik ze zelf in. Klarna is alleen beschikbaar voor orders boven €35.
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
                  <span className="font-medium">Directe Bankoverschrijving (QR)</span>
                  <Badge variant="secondary">0% kosten</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Klant scant QR-code met bank-app - SEPA Instant
                </div>
                {!canEnableBankTransfer && (
                  <div className="text-xs text-destructive mt-1">
                    ⚠️ Configureer eerst je IBAN in Bedrijfsgegevens
                  </div>
                )}
                {config.bank_transfer_acknowledged_manual && config.payment_methods_enabled.includes('bank_transfer') && (
                  <div className="text-xs text-amber-600 mt-1">
                    ⚠️ Betalingen worden NIET automatisch gedetecteerd — je moet ze handmatig verwerken
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
        </CardContent>
      </Card>

      {/* Transaction Fee Passthrough */}
      <Card>
        <CardHeader>
          <CardTitle>Transactiekosten Doorberekenen</CardTitle>
          <CardDescription>
            Kies of je transactiekosten wilt doorberekenen aan je klanten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Transactiekosten tonen bij checkout</div>
              <div className="text-sm text-muted-foreground max-w-lg">
                Wanneer ingeschakeld, kiest de klant zijn betaalmethode in jouw checkout en ziet hij de exacte transactiekosten van die methode bovenop het ordertotaal. Voorbeeld: Bancontact +€0,25, Creditcard +€1,75 op een €100 order. Wanneer uitgeschakeld, worden de kosten van je eigen marge afgehouden.
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
              <Label htmlFor="fee-label">Label voor transactiekosten</Label>
              <Input
                id="fee-label"
                value={config.transaction_fee_label}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  transaction_fee_label: e.target.value 
                }))}
                placeholder="Transactiekosten"
              />
              <p className="text-xs text-muted-foreground">
                Dit label wordt getoond in de checkout bij de transactiekosten
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Transfer Acknowledgement Dialog */}
      <AlertDialog open={showBankTransferDialog} onOpenChange={setShowBankTransferDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Belangrijk — Bankoverschrijving handmatig verifiëren
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                Bij bankoverschrijving (QR-code / SEPA Instant) wordt de betaling <strong>NIET</strong> automatisch gedetecteerd. Dit betekent:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm">
                <li>De bestelling blijft op status 'Wacht op betaling' tot jij de betaling handmatig bevestigt</li>
                <li>Jij bent zelf verantwoordelijk voor het controleren van je bankrekening</li>
                <li>Jij moet de bestelling handmatig op 'Betaald' zetten in het admin paneel</li>
                <li>Klant ontvangt pas een verzendbevestiging nadat jij de status hebt aangepast</li>
                <li>Als jij de betaling vergeet te controleren, kan dit leiden tot ontevreden klanten</li>
              </ul>
              <p className="text-sm text-muted-foreground italic">
                Bij twijfel raden we aan om alleen Stripe-betalingen aan te bieden, deze worden automatisch verwerkt.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleBankTransferAccepted}>
              Ik begrijp het en accepteer de verantwoordelijkheid
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

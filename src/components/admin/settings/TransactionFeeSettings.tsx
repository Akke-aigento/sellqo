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
  CreditCard, 
  Building2, 
  QrCode, 
  Loader2, 
  Save,
  TrendingUp,
  Infinity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionUsage } from '@/hooks/useTransactionUsage';
import type { PaymentMethodType } from '@/types/billing';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';

const STRIPE_PAYMENT_METHODS = [
  { code: 'card', label: 'Creditcard / Apple Pay / Google Pay', description: 'Standaard kaartbetalingen + wallets', region: 'Internationaal', flag: '🌍', cost: '~1,5% + €0,25' },
  { code: 'ideal', label: 'iDEAL', description: 'Directe bankoverschrijving', region: 'NL', flag: '🇳🇱', cost: '~€0,29' },
  { code: 'bancontact', label: 'Bancontact', description: 'Belgisch betaalsysteem', region: 'BE', flag: '🇧🇪', cost: '~€0,25' },
  { code: 'klarna', label: 'Klarna', description: 'Achteraf betalen / gespreid', region: 'EU', flag: '🇪🇺', cost: '~3-4%' },
];

interface TenantPaymentConfig {
  payment_methods_enabled: PaymentMethodType[];
  pass_transaction_fee_to_customer: boolean;
  transaction_fee_label: string;
  iban: string | null;
  bic: string | null;
  stripe_payment_methods: string[];
}

export function TransactionFeeSettings() {
  const { roles } = useAuth();
  const activeTenantId = roles.find(r => r.tenant_id)?.tenant_id;
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useTransactionUsage(activeTenantId || undefined);
  
  const [config, setConfig] = useState<TenantPaymentConfig>({
    payment_methods_enabled: ['stripe'],
    pass_transaction_fee_to_customer: false,
    transaction_fee_label: 'Transactiekosten',
    iban: null,
    bic: null,
    stripe_payment_methods: ['card'],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TenantPaymentConfig | null>(null);
  const [liveCapabilities, setLiveCapabilities] = useState<Record<string, string>>({});
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);

  // Capability map: method code -> Stripe capability name
  const capabilityMap: Record<string, string> = {
    card: 'card_payments',
    ideal: 'ideal_payments',
    bancontact: 'bancontact_payments',
    klarna: 'klarna_payments',
  };

  useEffect(() => {
    if (activeTenantId) {
      loadConfig();
      loadCapabilities();
    }
  }, [activeTenantId]);

  const loadCapabilities = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-connect-status', {
        body: { tenant_id: activeTenantId },
      });
      if (!error && data?.capabilities) {
        setLiveCapabilities(data.capabilities);
      }
    } catch (e) {
      console.error('Could not load Stripe capabilities:', e);
    } finally {
      setCapabilitiesLoaded(true);
    }
  };

  const isMethodActive = (code: string): boolean => {
    if (!capabilitiesLoaded || Object.keys(liveCapabilities).length === 0) return true; // unknown = allow
    const cap = capabilityMap[code];
    return cap ? liveCapabilities[cap] === 'active' : false;
  };

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('payment_methods_enabled, pass_transaction_fee_to_customer, transaction_fee_label, iban, bic, stripe_payment_methods')
        .eq('id', activeTenantId)
        .single();

      if (error) throw error;

      // Sanitize: only keep codes that are in the current valid set
      const validStripeMethodCodes = STRIPE_PAYMENT_METHODS.map(m => m.code);
      const rawStripeMethods = (data.stripe_payment_methods as string[]) || ['card'];
      const sanitizedStripeMethods = rawStripeMethods.filter(m => validStripeMethodCodes.includes(m));

      const loaded = {
        payment_methods_enabled: (data.payment_methods_enabled as PaymentMethodType[]) || ['stripe'],
        pass_transaction_fee_to_customer: data.pass_transaction_fee_to_customer || false,
        transaction_fee_label: data.transaction_fee_label || 'Transactiekosten',
        iban: data.iban,
        bic: data.bic,
        stripe_payment_methods: sanitizedStripeMethods.length > 0 ? sanitizedStripeMethods : ['card'],
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
    if (!activeTenantId) return;
    
    setIsSaving(true);
    try {
      // Sanitize before saving: only valid codes, fallback to ['card']
      const validCodes = STRIPE_PAYMENT_METHODS.map(m => m.code);
      const cleanedMethods = config.stripe_payment_methods.filter(m => validCodes.includes(m));
      
      const { error } = await supabase
        .from('tenants')
        .update({
          payment_methods_enabled: config.payment_methods_enabled,
          pass_transaction_fee_to_customer: config.pass_transaction_fee_to_customer,
          transaction_fee_label: config.transaction_fee_label,
          stripe_payment_methods: cleanedMethods.length > 0 ? cleanedMethods : ['card'],
        })
        .eq('id', activeTenantId);

      if (error) throw error;

      toast.success('Instellingen opgeslagen');
      refetchUsage();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Fout bij opslaan instellingen');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaymentMethod = (method: PaymentMethodType) => {
    setConfig(prev => {
      const methods = prev.payment_methods_enabled;
      if (methods.includes(method)) {
        // Don't allow removing last method
        if (methods.length === 1) {
          toast.error('Minimaal één betaalmethode vereist');
          return prev;
        }
        return { ...prev, payment_methods_enabled: methods.filter(m => m !== method) };
      }
      return { ...prev, payment_methods_enabled: [...methods, method] };
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
                const isActive = isMethodActive(method.code);
                const isDisabled = !isActive && capabilitiesLoaded && Object.keys(liveCapabilities).length > 0;
                return (
                  <label
                    key={method.code}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md cursor-pointer",
                      isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isChecked && !isDisabled}
                      disabled={isDisabled}
                      onCheckedChange={(checked) => {
                        if (isDisabled) return;
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
                        {isDisabled && (
                          <span className="text-xs text-destructive ml-2">• Niet actief op Stripe-account</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{method.region}</Badge>
                        <span className="text-xs text-muted-foreground">{method.cost}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Bank Transfer */}
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
              </div>
            </div>
            <Switch
              checked={config.payment_methods_enabled.includes('bank_transfer')}
              onCheckedChange={() => togglePaymentMethod('bank_transfer')}
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
              <div className="text-sm text-muted-foreground">
                Indien ingeschakeld, zien klanten de transactiekosten als aparte regel
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

import { useState } from 'react';
import { Network, Crown, Package, ExternalLink, AlertTriangle, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { usePlatformBankPayment } from '@/hooks/usePlatformBankPayment';
import { PlatformPaymentMethodSelector, type PlatformPaymentMethod } from '@/components/platform/PlatformPaymentMethodSelector';
import { PlatformBankPaymentDialog } from '@/components/platform/PlatformBankPaymentDialog';

interface PeppolUpgradeCardProps {
  showAsLocked?: boolean;
}

const PEPPOL_MONTHLY_PRICE = 12.00;

export function PeppolUpgradeCard({ showAsLocked = true }: PeppolUpgradeCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PlatformPaymentMethod>('bank_transfer');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  
  // Bank payment state
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankPaymentData, setBankPaymentData] = useState<{
    ogmReference: string;
    amount: number;
  } | null>(null);
  
  const { createBankPayment, isLoading: isBankLoading } = usePlatformBankPayment();

  const handleUpgradeToPro = () => {
    navigate('/pricing');
  };

  const handleActivateAddon = async () => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return;
    }

    if (paymentMethod === 'stripe') {
      // Use existing Stripe checkout flow
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-addon-checkout', {
          body: {
            tenant_id: currentTenant.id,
            addon_type: 'peppol',
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, '_blank');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Kon checkout niet starten';
        toast({
          title: 'Fout bij activeren',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Use bank transfer flow
      const result = await createBankPayment({
        tenantId: currentTenant.id,
        paymentType: 'addon',
        amount: PEPPOL_MONTHLY_PRICE,
        addonType: 'peppol',
      });

      if (result) {
        setBankPaymentData({
          ogmReference: result.ogmReference,
          amount: PEPPOL_MONTHLY_PRICE,
        });
        setBankDialogOpen(true);
      }
    }
  };

  const handleBankDialogComplete = () => {
    setBankDialogOpen(false);
    setBankPaymentData(null);
    toast({
      title: 'Betaalinstructies ontvangen',
      description: 'Je Peppol module wordt geactiveerd zodra we je betaling ontvangen.',
    });
  };

  const isProcessing = isLoading || isBankLoading;

  return (
    <>
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Network className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>Peppol e-Invoicing</CardTitle>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  🇧🇪 Verplicht 2026
                </Badge>
              </div>
              <CardDescription>
                Digitale B2B facturatie via het Europese Peppol netwerk
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Wettelijke verplichting:</strong> Vanaf 1 januari 2026 zijn alle Belgische ondernemingen 
              verplicht om B2B facturen elektronisch te versturen via Peppol.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Voordelen van Peppol:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Directe levering aan klanten via officieel netwerk</li>
              <li>✓ Automatische ontvangstbevestigingen</li>
              <li>✓ Wettelijke compliance voor B2B in België</li>
              <li>✓ Minder administratie en snellere betaling</li>
            </ul>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-center">Activeer Peppol voor jouw bedrijf</h4>

            {/* Option 1: Upgrade to Pro */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Crown className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium">Upgrade naar Pro</h5>
                    <p className="text-sm text-muted-foreground">
                      Peppol + SellQo Connect + AI features + alles inbegrepen
                    </p>
                    <p className="text-lg font-bold mt-2">€79/maand</p>
                  </div>
                  <Button onClick={handleUpgradeToPro} className="shrink-0">
                    Bekijk Pro
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-sm text-muted-foreground">of</span>
              <Separator className="flex-1" />
            </div>

            {/* Option 2: Standalone Add-on with payment method selection */}
            <Card className="border-muted">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-medium">Peppol Add-on</h5>
                    <p className="text-sm text-muted-foreground">
                      Alleen Peppol e-invoicing voor je huidige plan
                    </p>
                    <p className="text-lg font-bold mt-2">€{PEPPOL_MONTHLY_PRICE}/maand</p>
                  </div>
                  {!showPaymentOptions && (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPaymentOptions(true)}
                      className="shrink-0"
                    >
                      Activeren
                    </Button>
                  )}
                </div>

                {showPaymentOptions && (
                  <>
                    <Separator />
                    <PlatformPaymentMethodSelector
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      disabled={isProcessing}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowPaymentOptions(false)}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        Annuleren
                      </Button>
                      <Button 
                        onClick={handleActivateAddon}
                        disabled={isProcessing}
                        className={`flex-1 ${paymentMethod === 'bank_transfer' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Bezig...
                          </>
                        ) : paymentMethod === 'bank_transfer' ? (
                          <>
                            <Banknote className="mr-2 h-4 w-4" />
                            Betalen via bank
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Betalen met kaart
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Vragen over Peppol? <a href="https://peppol.be" target="_blank" rel="noopener noreferrer" className="underline">Lees meer op peppol.be</a>
          </p>
        </CardContent>
      </Card>

      {/* Bank Payment Dialog */}
      {bankPaymentData && (
        <PlatformBankPaymentDialog
          open={bankDialogOpen}
          onOpenChange={setBankDialogOpen}
          amount={bankPaymentData.amount}
          ogmReference={bankPaymentData.ogmReference}
          paymentType="addon"
          description="Peppol e-Invoicing Add-on"
          onComplete={handleBankDialogComplete}
        />
      )}
    </>
  );
}

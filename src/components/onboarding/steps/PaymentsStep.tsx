import { useState, useEffect } from 'react';
import { CreditCard, ArrowRight, ArrowLeft, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OnboardingTooltip, OnboardingInfoPopover } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { cn } from '@/lib/utils';

interface PaymentsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  tenantId: string | null;
}

export function PaymentsStep({
  data,
  updateData,
  onNext,
  onPrev,
  tenantId,
}: PaymentsStepProps) {
  const {
    status,
    isLoading,
    isCreatingAccount,
    checkStatus,
    createConnectAccount,
  } = useStripeConnect(tenantId || undefined);

  const [hasStartedStripe, setHasStartedStripe] = useState(false);

  useEffect(() => {
    if (tenantId) {
      checkStatus();
    }
  }, [tenantId, checkStatus]);

  useEffect(() => {
    if (status?.charges_enabled) {
      updateData({ stripeConnected: true });
    }
  }, [status, updateData]);

  const handleActivateStripe = async () => {
    setHasStartedStripe(true);
    await createConnectAccount();
  };

  const handleRefreshStatus = async () => {
    await checkStatus();
  };

  const isConnected = status?.charges_enabled && status?.payouts_enabled;
  const isPartiallyConnected = status?.configured && !isConnected;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Betalingen activeren</h2>
        <div className="flex items-center justify-center gap-2">
          <p className="text-muted-foreground">
            Ontvang betalingen via iDEAL, Bancontact, creditcard en meer.
          </p>
          <OnboardingInfoPopover title="Betalingen met Stripe">
            <div className="space-y-2">
              <p>Met Stripe Connect kun je direct betalingen ontvangen:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>iDEAL (Nederland)</li>
                <li>Bancontact (België)</li>
                <li>Creditcard / Debitcard</li>
                <li>Apple Pay & Google Pay</li>
                <li>Klarna, Sofort, en meer</li>
              </ul>
              <p className="pt-2 text-xs">
                Uitbetalingen komen automatisch op je bankrekening. Stripe rekent transactiekosten per betaling.
              </p>
            </div>
          </OnboardingInfoPopover>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {isConnected ? (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-700">Betalingen geactiveerd!</h3>
                  <p className="text-sm text-muted-foreground">
                    Je kunt nu betalingen ontvangen via je webshop.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isPartiallyConnected ? (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-700">Nog niet volledig actief</h3>
                  <p className="text-sm text-muted-foreground">
                    Je Stripe account moet nog worden afgerond.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleActivateStripe} disabled={isCreatingAccount}>
                  {isCreatingAccount ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Bezig...
                    </>
                  ) : (
                    <>
                      Onboarding afronden
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleRefreshStatus} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vernieuwen'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">Stripe Connect</h3>
                  <p className="text-sm text-muted-foreground">
                    Veilig en betrouwbaar betalingsplatform
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleActivateStripe} 
                className="w-full" 
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bezig...
                  </>
                ) : (
                  <>
                    Betalingen activeren
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              {hasStartedStripe && (
                <Button 
                  variant="outline" 
                  onClick={handleRefreshStatus} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Ik heb Stripe afgerond - Status vernieuwen'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Geen Stripe?</strong> Geen probleem! Je kunt ook betalingen ontvangen via bankoverschrijving. 
            Dit kun je later instellen.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vorige
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1"
        >
          {isConnected ? 'Afronden!' : 'Overslaan voor nu'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

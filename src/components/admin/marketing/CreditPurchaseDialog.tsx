import { useState } from 'react';
import { CreditCard, Zap, Sparkles, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { usePlatformBankPayment } from '@/hooks/usePlatformBankPayment';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlatformPaymentMethodSelector, type PlatformPaymentMethod } from '@/components/platform/PlatformPaymentMethodSelector';
import { PlatformBankPaymentDialog } from '@/components/platform/PlatformBankPaymentDialog';

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
  savings?: string;
}

const creditPackages: CreditPackage[] = [
  { id: 'pack_50', credits: 50, price: 4.99 },
  { id: 'pack_100', credits: 100, price: 8.99, popular: true, savings: '10% korting' },
  { id: 'pack_250', credits: 250, price: 19.99, savings: '20% korting' },
  { id: 'pack_500', credits: 500, price: 34.99, savings: '30% korting' },
];

interface CreditPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditPurchaseDialog({ open, onOpenChange }: CreditPurchaseDialogProps) {
  const { currentTenant } = useTenant();
  const [selectedPackage, setSelectedPackage] = useState<string>('pack_100');
  const [paymentMethod, setPaymentMethod] = useState<PlatformPaymentMethod>('bank_transfer');
  const [isLoading, setIsLoading] = useState(false);
  
  // Bank payment state
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankPaymentData, setBankPaymentData] = useState<{
    ogmReference: string;
    amount: number;
    description: string;
  } | null>(null);
  
  const { createBankPayment, isLoading: isBankLoading } = usePlatformBankPayment();

  const handlePurchase = async () => {
    if (!currentTenant?.id) {
      toast.error('Geen tenant geselecteerd');
      return;
    }

    const pkg = creditPackages.find(p => p.id === selectedPackage);
    if (!pkg) return;

    if (paymentMethod === 'stripe') {
      // Use existing Stripe checkout flow
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-ai-credits-checkout', {
          body: {
            tenantId: currentTenant.id,
            packageId: pkg.id,
            credits: pkg.credits,
            price: pkg.price,
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, '_blank');
          onOpenChange(false);
        }
      } catch (error) {
        console.error('Checkout error:', error);
        toast.error('Kon checkout niet starten', {
          description: error instanceof Error ? error.message : 'Probeer het opnieuw',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Use bank transfer flow
      const result = await createBankPayment({
        tenantId: currentTenant.id,
        paymentType: 'ai_credits',
        amount: pkg.price,
        creditsAmount: pkg.credits,
        packageId: pkg.id,
      });

      if (result) {
        setBankPaymentData({
          ogmReference: result.ogmReference,
          amount: pkg.price,
          description: `${pkg.credits} AI Credits`,
        });
        setBankDialogOpen(true);
        onOpenChange(false);
      }
    }
  };

  const handleBankDialogComplete = () => {
    setBankDialogOpen(false);
    setBankPaymentData(null);
    toast.success('Betaalinstructies ontvangen', {
      description: 'Je credits worden geactiveerd zodra we je betaling ontvangen.',
    });
  };

  const isProcessing = isLoading || isBankLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              AI Credits Bijkopen
            </DialogTitle>
            <DialogDescription>
              Koop extra AI credits om meer content te genereren. Credits verlopen niet en worden
              bovenop je maandelijkse credits toegevoegd.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 mt-4">
            {creditPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/50',
                  selectedPackage === pkg.id && 'border-primary ring-2 ring-primary/20',
                  pkg.popular && 'relative overflow-hidden'
                )}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Populair
                  </div>
                )}
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        selectedPackage === pkg.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/30'
                      )}
                    >
                      {selectedPackage === pkg.id && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pkg.credits} credits</span>
                        {pkg.savings && (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                            {pkg.savings}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        €{(pkg.price / pkg.credits).toFixed(3)} per credit
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">€{pkg.price.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Payment Method Selector */}
          <PlatformPaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            disabled={isProcessing}
          />

          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium">Credit kosten per actie</p>
                <ul className="text-muted-foreground mt-1 space-y-0.5">
                  <li>• Social media post: 1 credit</li>
                  <li>• Email content: 2 credits</li>
                  <li>• Campagne suggesties: 3 credits</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Annuleren
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={isProcessing}
              className={cn(
                paymentMethod === 'bank_transfer'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig...
                </>
              ) : paymentMethod === 'bank_transfer' ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Naar betaling
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Afrekenen
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Payment Dialog */}
      {bankPaymentData && (
        <PlatformBankPaymentDialog
          open={bankDialogOpen}
          onOpenChange={setBankDialogOpen}
          amount={bankPaymentData.amount}
          ogmReference={bankPaymentData.ogmReference}
          paymentType="ai_credits"
          description={bankPaymentData.description}
          onComplete={handleBankDialogComplete}
        />
      )}
    </>
  );
}

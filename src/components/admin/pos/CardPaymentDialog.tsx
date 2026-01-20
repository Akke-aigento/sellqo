import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStripeTerminal } from '@/hooks/useStripeTerminal';
import { Loader2, CreditCard, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CardPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  terminalId: string;
  readerId?: string;
  onSuccess: (paymentIntentId: string, cardDetails?: { brand: string; last4: string }) => void;
  onCancel: () => void;
}

type PaymentState = 'idle' | 'creating' | 'waiting' | 'processing' | 'success' | 'error';

export function CardPaymentDialog({
  open,
  onOpenChange,
  amount,
  terminalId,
  readerId,
  onSuccess,
  onCancel,
}: CardPaymentDialogProps) {
  const { createPaymentIntent, processPayment, cancelReaderAction, isProcessing } = useStripeTerminal();
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open && amount > 0) {
      startPayment();
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [open, amount]);

  const startPayment = async () => {
    setPaymentState('creating');
    setErrorMessage(null);

    try {
      // Create payment intent
      const { payment_intent_id, client_secret } = await createPaymentIntent(amount, terminalId);
      setPaymentIntentId(payment_intent_id);

      if (readerId) {
        // Process on physical terminal
        setPaymentState('waiting');
        await processPayment(payment_intent_id, readerId);
        
        // Start polling for payment status
        const interval = setInterval(async () => {
          try {
            const result = await processPayment(payment_intent_id);
            if (result.status === 'succeeded') {
              clearInterval(interval);
              setPaymentState('success');
              setTimeout(() => {
                onSuccess(payment_intent_id);
              }, 1500);
            } else if (result.status === 'canceled' || result.status === 'requires_payment_method') {
              clearInterval(interval);
              setPaymentState('error');
              setErrorMessage('Betaling geannuleerd of mislukt');
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 2000);
        setPollInterval(interval);
      } else {
        // Simulated payment for testing (no physical reader)
        setPaymentState('processing');
        setTimeout(() => {
          setPaymentState('success');
          setTimeout(() => {
            onSuccess(payment_intent_id, { brand: 'visa', last4: '4242' });
          }, 1500);
        }, 2000);
      }
    } catch (error: any) {
      setPaymentState('error');
      setErrorMessage(error.message || 'Er is een fout opgetreden');
    }
  };

  const handleCancel = async () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    if (readerId && paymentIntentId) {
      try {
        await cancelReaderAction(readerId);
      } catch (error) {
        console.error('Error canceling reader action:', error);
      }
    }

    setPaymentState('idle');
    setPaymentIntentId(null);
    onCancel();
  };

  const renderContent = () => {
    switch (paymentState) {
      case 'creating':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg">Betaling voorbereiden...</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="relative">
              <Smartphone className="h-16 w-16 text-primary animate-pulse" />
              <CreditCard className="h-8 w-8 text-primary absolute -right-2 -bottom-2" />
            </div>
            <p className="text-lg font-medium">Wacht op kaart...</p>
            <p className="text-muted-foreground text-center">
              Laat de klant de kaart aanbieden op de pinautomaat
            </p>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(amount)}
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg">Betaling verwerken...</p>
            <div className="text-2xl font-bold">
              {formatCurrency(amount)}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium text-green-600">Betaling geslaagd!</p>
            <div className="text-2xl font-bold">
              {formatCurrency(amount)}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <XCircle className="h-16 w-16 text-destructive" />
            <p className="text-lg font-medium text-destructive">Betaling mislukt</p>
            {errorMessage && (
              <p className="text-muted-foreground text-center">{errorMessage}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={startPayment}>Opnieuw proberen</Button>
              <Button variant="outline" onClick={handleCancel}>Annuleren</Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && paymentState !== 'success') {
        handleCancel();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Kaartbetaling
          </DialogTitle>
          <DialogDescription>
            {readerId ? 'Betaling via pinautomaat' : 'Simulatie modus (geen reader gekoppeld)'}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        {(paymentState === 'waiting' || paymentState === 'processing') && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleCancel}>
              Annuleren
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

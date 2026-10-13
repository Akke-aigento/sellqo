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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
    // APP-CLEAN-2: zonder gekoppelde kaartlezer bestaat er geen kaartbetaling.
    // Tot 12-10-2026 "simuleerde" de kassa hier na 2 s een geslaagde Visa ****4242
    // en registreerde de verkoop als betaald, terwijl er nooit geld binnenkwam
    // (VanXcel, bon 20260316-0001, €422,29). Nu: duidelijke fout, geen PaymentIntent.
    if (!readerId) {
      setPaymentState('error');
      setErrorMessage(
        'Geen kaartlezer gekoppeld aan deze kassa. Koppel een Stripe-lezer, of reken contant of via overschrijving af.',
      );
      return;
    }

    setPaymentState('creating');
    setErrorMessage(null);

    try {
      // Create payment intent
      const { payment_intent_id, client_secret } = await createPaymentIntent(amount, terminalId);
      setPaymentIntentId(payment_intent_id);

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
            <p className="text-lg">{t('admin.pos.cardPaymentDialog.betaling_voorbereiden')}</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="relative">
              <Smartphone className="h-16 w-16 text-primary animate-pulse" />
              <CreditCard className="h-8 w-8 text-primary absolute -right-2 -bottom-2" />
            </div>
            <p className="text-lg font-medium">{t('admin.pos.cardPaymentDialog.wacht_op_kaart')}</p>
            <p className="text-muted-foreground text-center">
              {t('admin.pos.cardPaymentDialog.laat_de_klant_de_kaart_aanbieden')}
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
            <p className="text-lg">{t('admin.pos.cardPaymentDialog.betaling_verwerken')}</p>
            <div className="text-2xl font-bold">
              {formatCurrency(amount)}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium text-green-600">{t('admin.pos.cardPaymentDialog.betaling_geslaagd')}</p>
            <div className="text-2xl font-bold">
              {formatCurrency(amount)}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <XCircle className="h-16 w-16 text-destructive" />
            <p className="text-lg font-medium text-destructive">{t('admin.pos.cardPaymentDialog.betaling_mislukt')}</p>
            {errorMessage && (
              <p className="text-muted-foreground text-center">{errorMessage}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={startPayment}>{t('admin.pos.cardPaymentDialog.opnieuw_proberen')}</Button>
              <Button variant="outline" onClick={handleCancel}>{t('common.cancel')}</Button>
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
            {t('admin.pos.cardPaymentDialog.kaartbetaling')}
          </DialogTitle>
          <DialogDescription>
            {readerId ? t('admin.pos.cardPaymentDialog.betaling_via_pinautomaat') : t('admin.pos.cardPaymentDialog.geen_kaartlezer_gekoppeld')}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        {(paymentState === 'waiting' || paymentState === 'processing') && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

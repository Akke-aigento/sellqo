import { useMemo } from 'react';
import { Banknote, Copy, Clock, CheckCircle2, Landmark } from 'lucide-react';
import QRCode from 'react-qr-code';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils';
import { generateEPCString, formatIBAN, generatePaytoURI } from '@/lib/epcQrCode';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

// SellQo platform bank details (placeholder - update with real values)
const SELLQO_BANK = {
  iban: 'BE00000000000000', // Will be replaced with real IBAN
  bic: 'GEBABEBB',
  beneficiary: 'SellQo BV',
};

interface PlatformBankPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  ogmReference: string;
  paymentType: 'ai_credits' | 'addon';
  description: string;
  onComplete?: () => void;
}

export function PlatformBankPaymentDialog({
  open,
  onOpenChange,
  amount,
  ogmReference,
  paymentType,
  description,
  onComplete,
}: PlatformBankPaymentDialogProps) {
  const isMobile = useIsMobile();

  // Generate EPC QR code data
  const epcQRData = useMemo(() => {
    return generateEPCString({
      iban: SELLQO_BANK.iban,
      bic: SELLQO_BANK.bic,
      beneficiaryName: SELLQO_BANK.beneficiary,
      amount,
      reference: ogmReference,
    });
  }, [amount, ogmReference]);

  // Generate payto:// URI for mobile
  const paytoURI = useMemo(() => {
    return generatePaytoURI({
      iban: SELLQO_BANK.iban,
      bic: SELLQO_BANK.bic,
      beneficiaryName: SELLQO_BANK.beneficiary,
      amount,
      reference: ogmReference,
    });
  }, [amount, ogmReference]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    toast.success(`${label} gekopieerd`);
  };

  const handleDone = () => {
    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            Directe Bankoverschrijving
          </DialogTitle>
          <DialogDescription>
            Scan de QR-code met je bank-app voor directe betaling
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* QR Code (desktop) / Deep Link (mobile) */}
          {isMobile ? (
            <div className="flex flex-col items-center gap-3">
              <a
                href={paytoURI}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-primary text-primary-foreground px-6 py-4 text-lg font-semibold shadow-lg hover:bg-primary/90 transition-colors"
              >
                <Landmark className="h-6 w-6" />
                Open je bank-app
              </a>
              <p className="text-xs text-center text-muted-foreground">
                Alle gegevens worden automatisch ingevuld. Bevestig met Face ID, vingerafdruk of PIN.
              </p>
              <p className="text-[11px] text-center text-muted-foreground/70">
                Werkt met KBC, BNP Paribas Fortis, Belfius, ING, Argenta en meer
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                <QRCode value={epcQRData} size={180} level="M" />
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(amount)}</p>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Begunstigde</span>
              <span className="font-medium">{SELLQO_BANK.beneficiary}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">IBAN</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{formatIBAN(SELLQO_BANK.iban)}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(SELLQO_BANK.iban, 'IBAN')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mededeling</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-primary">{ogmReference}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(ogmReference, 'Mededeling')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              <p className="font-medium">Verwerking binnen 24 uur</p>
              <p className="text-xs mt-1">
                Na ontvangst van je betaling worden je {paymentType === 'ai_credits' ? 'credits' : 'module'} automatisch geactiveerd. 
                Je ontvangt een bevestigingsmail.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleDone}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Ik heb betaald
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

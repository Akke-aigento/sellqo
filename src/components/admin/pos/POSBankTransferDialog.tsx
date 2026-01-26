import { useState, useMemo } from 'react';
import { Banknote, Check, Copy, Loader2 } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import { generateEPCString } from '@/lib/epcQrCode';
import { generateOGM } from '@/lib/ogm';
import { toast } from 'sonner';

interface POSBankTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  tenantName: string;
  tenantIBAN?: string;
  tenantBIC?: string;
  onConfirmPayment: (ogmReference: string) => void;
  isProcessing?: boolean;
}

export function POSBankTransferDialog({
  open,
  onOpenChange,
  amount,
  tenantName,
  tenantIBAN,
  tenantBIC,
  onConfirmPayment,
  isProcessing = false,
}: POSBankTransferDialogProps) {
  // Generate OGM using timestamp as base
  const ogmReference = useMemo(() => generateOGM(Date.now()), []);
  
  // Generate EPC QR code data
  const epcQRData = tenantIBAN
    ? generateEPCString({
        iban: tenantIBAN,
        bic: tenantBIC,
        beneficiaryName: tenantName,
        amount,
        reference: ogmReference,
      })
    : null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} gekopieerd`);
  };

  const handleConfirm = () => {
    onConfirmPayment(ogmReference);
  };

  if (!tenantIBAN || !tenantBIC) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank instellingen ontbreken</DialogTitle>
            <DialogDescription>
              Configureer eerst uw IBAN en BIC in de bedrijfsinstellingen om bankoverschrijvingen te accepteren.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Directe Bankoverschrijving
          </DialogTitle>
          <DialogDescription>
            Laat de klant de QR-code scannen met hun bank-app voor directe betaling
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code */}
          {epcQRData && (
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <QRCode value={epcQRData} size={200} level="M" />
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Te betalen</p>
            <p className="text-3xl font-bold">{formatCurrency(amount)}</p>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Begunstigde</span>
              <span className="font-medium">{tenantName}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">IBAN</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{tenantIBAN}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(tenantIBAN, 'IBAN')}
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

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">SEPA Instant Overschrijving</p>
            <p className="text-xs">
              Bij de meeste banken komt de betaling binnen enkele seconden binnen. 
              Bevestig zodra de klant de betaling heeft uitgevoerd.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Annuleren
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Betaling Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Copy, Clock, Smartphone, QrCode, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { generateEPCString, formatIBAN, generatePaytoURI } from '@/lib/epcQrCode';
import { formatOGM } from '@/lib/ogm';
import QRCode from 'react-qr-code';
import { useIsMobile } from '@/hooks/use-mobile';

interface BankTransferPaymentProps {
  orderNumber: string;
  amount: number;
  iban: string;
  bic?: string;
  beneficiaryName: string;
  ogmReference: string;
  currency?: string;
  onConfirmPayment?: () => void;
  showConfirmButton?: boolean;
  isConfirming?: boolean;
}

export function BankTransferPayment({
  orderNumber,
  amount,
  iban,
  bic,
  beneficiaryName,
  ogmReference,
  currency = 'EUR',
  onConfirmPayment,
  showConfirmButton = false,
  isConfirming = false,
}: BankTransferPaymentProps) {
  const isMobile = useIsMobile();

  // Generate EPC QR code string
  const epcString = useMemo(() => {
    return generateEPCString({
      beneficiaryName,
      iban: iban.replace(/\s/g, ''),
      amount,
      reference: ogmReference,
      bic,
    });
  }, [beneficiaryName, iban, amount, ogmReference, bic]);

  // Generate payto:// URI for mobile deep linking
  const paytoURI = useMemo(() => {
    return generatePaytoURI({
      beneficiaryName,
      iban: iban.replace(/\s/g, ''),
      amount,
      reference: ogmReference,
      bic,
    });
  }, [beneficiaryName, iban, amount, ogmReference, bic]);

  const formattedIBAN = formatIBAN(iban);
  const formattedOGM = formatOGM(ogmReference);
  const formattedAmount = new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
  }).format(amount);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} gekopieerd!`);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Directe Bankoverschrijving
            </CardTitle>
            <CardDescription className="mt-1">
              Bestelling {orderNumber}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Wacht op betaling
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Code Section (desktop) / Deep Link (mobile) */}
          <div className="flex flex-col items-center">
            {isMobile ? (
              <>
                <a
                  href={paytoURI}
                  className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-primary text-primary-foreground px-6 py-4 text-lg font-semibold shadow-lg hover:bg-primary/90 transition-colors"
                >
                  <Landmark className="h-6 w-6" />
                  Open je bank-app
                </a>
                <p className="text-xs text-center text-muted-foreground mt-3 max-w-[260px]">
                  Alle betaalgegevens worden automatisch ingevuld. Bevestig met Face ID, vingerafdruk of PIN.
                </p>
                <p className="text-[11px] text-center text-muted-foreground/70 mt-2">
                  Werkt met KBC, BNP Paribas Fortis, Belfius, ING, Argenta en meer
                </p>
                <Separator className="my-4 w-full" />
                <p className="text-xs text-muted-foreground">Opent niet? Kopieer de gegevens hieronder</p>
              </>
            ) : (
              <>
                <div className="bg-background p-4 rounded-xl shadow-sm border">
                  <QRCode
                    value={epcString}
                    size={180}
                    level="M"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                  <span>Scan met je bank-app</span>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2 max-w-[200px]">
                  De betaalgegevens worden automatisch ingevuld in je bank-app
                </p>
              </>
            )}
          </div>

          {/* Manual Transfer Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Of maak handmatig over:
            </h4>

            {/* Amount */}
            <div className="p-4 bg-primary/5 rounded-lg">
              <div className="text-sm text-muted-foreground">Te betalen</div>
              <div className="text-2xl font-bold text-primary">{formattedAmount}</div>
            </div>

            <Separator />

            {/* IBAN */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">IBAN</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                  {formattedIBAN}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(iban.replace(/\s/g, ''), 'IBAN')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* BIC */}
            {bic && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">BIC</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {bic}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(bic, 'BIC')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Beneficiary */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Begunstigde</div>
              <div className="text-sm font-medium">{beneficiaryName}</div>
            </div>

            {/* OGM Reference */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Mededeling <span className="text-destructive">*</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono bg-muted text-foreground px-2 py-1 rounded flex-1 font-bold border border-border">
                  {formattedOGM}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(ogmReference.replace(/[^\d]/g, ''), 'Mededeling')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-destructive">
                ⚠️ Gebruik exact deze mededeling voor automatische verwerking
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <p className="font-medium">SEPA Instant beschikbaar</p>
              <p className="mt-1 text-muted-foreground">
                Met de meeste Belgische en Nederlandse banken wordt je betaling binnen enkele seconden verwerkt. 
                Je bestelling wordt verzonden zodra de betaling is ontvangen.
              </p>
            </div>
          </div>
        </div>

        {/* Confirm Button (for admin/POS) */}
        {showConfirmButton && onConfirmPayment && (
          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={onConfirmPayment}
              disabled={isConfirming}
              className="w-full"
              size="lg"
            >
              {isConfirming ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Bevestigen...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Betaling ontvangen - Bevestigen
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

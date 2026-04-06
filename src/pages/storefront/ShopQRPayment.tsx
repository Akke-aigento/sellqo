import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateEPCString } from "@/lib/epcQrCode";
import { useCart } from "@/hooks/useCart";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Smartphone, ScanLine, CheckCircle2 } from "lucide-react";

interface QRPaymentState {
  orderId: string;
  orderNumber: string;
  total: number;
  currency?: string;
  bankDetails?: {
    account_holder?: string;
    beneficiary_name?: string;
    iban?: string;
    bic?: string;
    reference?: string;
    ogm_reference?: string;
  };
}

export default function ShopQRPayment() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as QRPaymentState | null;

  if (!state?.orderId || !state?.bankDetails?.iban) {
    navigate(`/shop/${tenantSlug}`, { replace: true });
    return null;
  }

  const { orderId, orderNumber, total, currency = "EUR", bankDetails } = state;

  const epcPayload = generateEPCString({
    bic: bankDetails.bic || "",
    beneficiaryName: bankDetails.beneficiary_name || bankDetails.account_holder || "",
    iban: bankDetails.iban || "",
    amount: total,
    text: orderNumber,
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <div className="max-w-md w-full bg-background rounded-2xl shadow-lg p-8 text-center space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scan om te betalen</h1>
          <p className="text-muted-foreground mt-1">
            Open je bankapp en scan de QR code hieronder
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white border-2 border-border rounded-xl p-4">
            <QRCode value={epcPayload} size={224} level="M" />
          </div>
        </div>

        {/* Amount & order number */}
        <div className="bg-muted rounded-lg p-4">
          <p className="text-3xl font-bold text-foreground">
            €{Number(total).toFixed(2)}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Bestelnummer: {orderNumber}
          </p>
        </div>

        {/* Instructions */}
        <div className="text-left text-sm text-muted-foreground space-y-3">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Stap 1:</strong> Open je bankapp (KBC, ING, Belfius, BNP, …)</p>
          </div>
          <div className="flex items-start gap-2">
            <ScanLine className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Stap 2:</strong> Kies "QR code scannen"</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Stap 3:</strong> Bevestig de betaling in je app</p>
          </div>
        </div>

        {/* CTA */}
        <Button
          className="w-full"
          size="lg"
          onClick={() =>
            navigate(`/shop/${tenantSlug}/order/${orderId}`, { replace: true })
          }
        >
          Ik heb betaald
        </Button>

        {/* Fallback: manual bank details */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
            QR code werkt niet? Schrijf handmatig over
            <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 text-left text-sm bg-muted rounded-lg p-4 space-y-1">
            <p><strong>Rekeninghouder:</strong> {bankDetails.beneficiary_name || bankDetails.account_holder}</p>
            <p><strong>IBAN:</strong> {bankDetails.iban}</p>
            <p><strong>Bedrag:</strong> €{Number(total).toFixed(2)}</p>
            <p><strong>Mededeling:</strong> {orderNumber}</p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

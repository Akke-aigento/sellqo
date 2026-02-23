import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentMethodIcons } from '@/components/storefront/PaymentMethodIcons';

export type PaymentMethod = 'stripe' | 'bank_transfer';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  enabledMethods: PaymentMethod[];
  transactionFee?: number;
  showTransactionFee?: boolean;
  transactionFeeLabel?: string;
}

// Small inline payment method icons for the stripe option
const MiniVisa = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" fill="currentColor">
    <path d="M293.2 348.7l33.4-195.7h53.4l-33.4 195.7zM540.7 157.2c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.6-.3 28.1 26.5 43.8 46.8 53.2 20.8 9.6 27.8 15.7 27.7 24.3-.1 13.1-16.6 19.1-32 19.1-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.6-26.3 93-66.8.2-22.3-14-39.2-44.8-53.2-18.6-9.1-30-15.1-29.9-24.3 0-8.1 9.7-16.8 30.5-16.8 17.4-.3 30 3.5 39.8 7.5l4.8 2.3 7.3-42.7zM676 153h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.4h56.2s9.2-24.1 11.3-29.4h68.6c1.6 6.9 6.5 29.4 6.5 29.4H720L676 153zm-65.9 126c4.4-11.3 21.4-54.8 21.4-54.8-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47 12.5 56.6h-44.6zM250.4 153l-52.3 133.4-5.6-27.1c-9.7-31.2-39.9-65-73.7-81.9l47.9 171.1 56.6-.1 84.3-195.4h-57.2z" />
    <path d="M146.9 153H60.1l-.7 4c67.1 16.2 111.5 55.4 129.9 102.4L171.1 170c-3.2-12.4-12.7-16.5-24.2-17z" fill="currentColor" opacity="0.7" />
  </svg>
);

const MiniMastercard = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500">
    <circle cx="312" cy="250" r="170" fill="currentColor" opacity="0.6" />
    <circle cx="468" cy="250" r="170" fill="currentColor" opacity="0.4" />
  </svg>
);

const MiniIdeal = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" fill="currentColor" opacity="0.1" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="700" fontFamily="sans-serif">iDEAL</text>
  </svg>
);

const MiniBancontact = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" fill="currentColor" opacity="0.1" />
    <circle cx="16" cy="20" r="7" fill="currentColor" opacity="0.4" />
    <circle cx="24" cy="20" r="7" fill="currentColor" opacity="0.6" />
  </svg>
);

const MiniApplePay = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="currentColor">
    <path d="M14.5 12.4c-.8 1-2.1 1.7-3.4 1.6-.2-1.3.5-2.7 1.2-3.5.8-1 2.2-1.7 3.3-1.7.1 1.3-.4 2.6-1.1 3.6zm1.1 1.8c-1.9-.1-3.5 1.1-4.4 1.1s-2.3-1-3.8-1c-2 0-3.8 1.1-4.8 2.9-2.1 3.5-.5 8.7 1.5 11.6 1 1.4 2.2 3 3.7 2.9 1.5-.1 2.1-.9 3.8-.9 1.8 0 2.3.9 3.9.9 1.6 0 2.6-1.4 3.6-2.9 1.1-1.6 1.6-3.2 1.6-3.3 0-.1-3-1.2-3.1-4.6 0-2.8 2.3-4.2 2.4-4.3-1.3-1.9-3.4-2.2-4.1-2.2l.7-.2z" />
    <text x="34" y="26" fill="currentColor" fontSize="13" fontWeight="600" fontFamily="sans-serif">Pay</text>
  </svg>
);

const MiniGooglePay = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600" fontFamily="sans-serif">G Pay</text>
  </svg>
);

const MiniKlarna = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <rect width="60" height="40" rx="6" fill="currentColor" opacity="0.08" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700" fontFamily="sans-serif">Klarna</text>
  </svg>
);

const MiniRevolut = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <rect width="60" height="40" rx="6" fill="currentColor" opacity="0.08" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600" fontFamily="sans-serif">Revolut</text>
  </svg>
);

const STRIPE_ICONS = [
  { key: 'visa', Icon: MiniVisa, label: 'Visa' },
  { key: 'mastercard', Icon: MiniMastercard, label: 'Mastercard' },
  { key: 'ideal', Icon: MiniIdeal, label: 'iDEAL' },
  { key: 'bancontact', Icon: MiniBancontact, label: 'Bancontact' },
  { key: 'applepay', Icon: MiniApplePay, label: 'Apple Pay' },
  { key: 'googlepay', Icon: MiniGooglePay, label: 'Google Pay' },
  { key: 'klarna', Icon: MiniKlarna, label: 'Klarna' },
  { key: 'revolut', Icon: MiniRevolut, label: 'Revolut Pay' },
];

export function PaymentMethodSelector({
  value,
  onChange,
  enabledMethods,
  transactionFee,
  showTransactionFee = false,
  transactionFeeLabel = 'Transactiekosten',
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation();

  const hasStripe = enabledMethods.includes('stripe');
  const hasBankTransfer = enabledMethods.includes('bank_transfer');

  // If only one method is enabled, don't show selector
  if (!hasStripe && !hasBankTransfer) return null;
  if (hasStripe && !hasBankTransfer) return null;
  if (!hasStripe && hasBankTransfer) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  const showStripeFee = showTransactionFee && transactionFee && transactionFee > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">{t('checkout.choosePaymentMethod', 'Kies je betaalmethode')}</h3>
        
        <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
          <div className="space-y-3">
            {/* Stripe / Online Payment Option */}
            {hasStripe && (
              <Label
                htmlFor="stripe"
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  value === 'stripe'
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="stripe" id="stripe" className="mt-1" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t('checkout.onlinePayment')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('checkout.onlinePaymentSubtitle')}
                  </p>
                  {/* Payment method icons */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {STRIPE_ICONS.map(({ key, Icon, label }) => (
                      <div
                        key={key}
                        className="h-6 w-auto text-muted-foreground/70"
                        title={label}
                      >
                        <Icon className="h-6 w-auto" />
                      </div>
                    ))}
                  </div>
                  {showStripeFee && (
                    <p className="text-sm text-muted-foreground mt-1">
                      + {formatCurrency(transactionFee)} {transactionFeeLabel.toLowerCase()}
                    </p>
                  )}
                </div>
              </Label>
            )}

            {/* Bank Transfer Option */}
            {hasBankTransfer && (
              <Label
                htmlFor="bank_transfer"
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  value === 'bank_transfer'
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="bank_transfer" id="bank_transfer" className="mt-1" />
                
                <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                  <QrCode className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t('checkout.bankTransfer')}</span>
                    <Badge variant="secondary" className="text-xs">
                      0% {t('checkout.fees', 'kosten')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('checkout.bankTransferSubtitle')}
                  </p>
                </div>
                
                <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>SEPA Instant</span>
                </div>
              </Label>
            )}
          </div>
        </RadioGroup>

        <PaymentMethodIcons variant="checkout" />
      </CardContent>
    </Card>
  );
}

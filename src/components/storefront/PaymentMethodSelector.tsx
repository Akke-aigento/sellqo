import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'card' | 'ideal' | 'bancontact' | 'klarna' | 'bank_transfer';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  enabledMethods: PaymentMethod[];
  stripePaymentMethods?: string[];
  transactionFee?: number;
  showTransactionFee?: boolean;
  transactionFeeLabel?: string;
}

interface MethodOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  isStripe: boolean;
}

const IdealIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" className="fill-[#CC0066]" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="sans-serif">iDEAL</text>
  </svg>
);

const CardIcon = () => (
  <div className="flex items-center gap-1">
    <svg className="h-6 w-9" viewBox="0 0 780 500" fill="currentColor" opacity="0.7">
      <path d="M293.2 348.7l33.4-195.7h53.4l-33.4 195.7zM540.7 157.2c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.6-.3 28.1 26.5 43.8 46.8 53.2 20.8 9.6 27.8 15.7 27.7 24.3-.1 13.1-16.6 19.1-32 19.1-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.6-26.3 93-66.8.2-22.3-14-39.2-44.8-53.2-18.6-9.1-30-15.1-29.9-24.3 0-8.1 9.7-16.8 30.5-16.8 17.4-.3 30 3.5 39.8 7.5l4.8 2.3 7.3-42.7zM676 153h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.4h56.2s9.2-24.1 11.3-29.4h68.6c1.6 6.9 6.5 29.4 6.5 29.4H720L676 153zm-65.9 126c4.4-11.3 21.4-54.8 21.4-54.8-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47 12.5 56.6h-44.6zM250.4 153l-52.3 133.4-5.6-27.1c-9.7-31.2-39.9-65-73.7-81.9l47.9 171.1 56.6-.1 84.3-195.4h-57.2z" />
    </svg>
    <svg className="h-6 w-9" viewBox="0 0 780 500">
      <circle cx="312" cy="250" r="170" fill="currentColor" opacity="0.5" />
      <circle cx="468" cy="250" r="170" fill="currentColor" opacity="0.35" />
    </svg>
  </div>
);

const BancontactIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" className="fill-[#005498]" />
    <circle cx="16" cy="20" r="7" fill="white" opacity="0.5" />
    <circle cx="24" cy="20" r="7" fill="white" opacity="0.7" />
  </svg>
);

const KlarnaIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" className="fill-[#FFB3C7]" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="#17120F" fontSize="9" fontWeight="700" fontFamily="sans-serif">Klarna</text>
  </svg>
);

function buildMethodOptions(stripePaymentMethods: string[], hasBankTransfer: boolean): MethodOption[] {
  const options: MethodOption[] = [];

  if (stripePaymentMethods.includes('ideal')) {
    options.push({
      id: 'ideal',
      label: 'iDEAL',
      description: 'Direct betalen via je bank',
      icon: <IdealIcon />,
      badge: '🇳🇱',
      isStripe: true,
    });
  }

  if (stripePaymentMethods.includes('card')) {
    options.push({
      id: 'card',
      label: 'Creditcard / Apple Pay',
      description: 'Visa, Mastercard, Apple Pay, Google Pay',
      icon: <CardIcon />,
      isStripe: true,
    });
  }

  if (stripePaymentMethods.includes('bancontact')) {
    options.push({
      id: 'bancontact',
      label: 'Bancontact',
      description: 'Betalen met Bancontact',
      icon: <BancontactIcon />,
      badge: '🇧🇪',
      isStripe: true,
    });
  }

  if (stripePaymentMethods.includes('klarna')) {
    options.push({
      id: 'klarna',
      label: 'Klarna',
      description: 'Achteraf betalen of in termijnen',
      icon: <KlarnaIcon />,
      isStripe: true,
    });
  }

  if (hasBankTransfer) {
    options.push({
      id: 'bank_transfer',
      label: 'Overschrijving',
      description: 'Betaal via QR-code of overschrijving',
      icon: <QrCode className="h-6 w-6 text-muted-foreground" />,
      isStripe: false,
    });
  }

  return options;
}

export function PaymentMethodSelector({
  value,
  onChange,
  enabledMethods,
  stripePaymentMethods = ['card'],
  transactionFee,
  showTransactionFee = false,
  transactionFeeLabel = 'Transactiekosten',
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation();

  const hasStripe = enabledMethods.includes('card') || enabledMethods.includes('ideal') || enabledMethods.includes('bancontact') || enabledMethods.includes('klarna') || enabledMethods.some(m => m !== 'bank_transfer');
  const hasBankTransfer = enabledMethods.includes('bank_transfer');

  const options = buildMethodOptions(stripePaymentMethods, hasBankTransfer);

  if (options.length <= 1) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const showStripeFee = showTransactionFee && transactionFee && transactionFee > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">{t('checkout.choosePaymentMethod', 'Kies je betaalmethode')}</h3>

        <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
          <div className="space-y-3">
            {options.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  value === option.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value={option.id} id={option.id} className="shrink-0" />

                <div className="shrink-0">{option.icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    {option.badge && <span className="text-sm">{option.badge}</span>}
                    {!option.isStripe && (
                      <Badge variant="secondary" className="text-xs">0% kosten</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  {option.isStripe && showStripeFee && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      + {formatCurrency(transactionFee)} {transactionFeeLabel.toLowerCase()}
                    </p>
                  )}
                </div>

                {!option.isStripe && (
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>SEPA Instant</span>
                  </div>
                )}
              </Label>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

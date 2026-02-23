import { useTranslation } from 'react-i18next';
import { Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentMethodIconsProps {
  variant: 'checkout' | 'footer';
}

// Inline SVG payment method icons - clean, minimal style
const VisaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" fill="currentColor">
    <path d="M293.2 348.7l33.4-195.7h53.4l-33.4 195.7zM540.7 157.2c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.6-.3 28.1 26.5 43.8 46.8 53.2 20.8 9.6 27.8 15.7 27.7 24.3-.1 13.1-16.6 19.1-32 19.1-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.6-26.3 93-66.8.2-22.3-14-39.2-44.8-53.2-18.6-9.1-30-15.1-29.9-24.3 0-8.1 9.7-16.8 30.5-16.8 17.4-.3 30 3.5 39.8 7.5l4.8 2.3 7.3-42.7zM676 153h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.4h56.2s9.2-24.1 11.3-29.4h68.6c1.6 6.9 6.5 29.4 6.5 29.4H720L676 153zm-65.9 126c4.4-11.3 21.4-54.8 21.4-54.8-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47 12.5 56.6h-44.6zM250.4 153l-52.3 133.4-5.6-27.1c-9.7-31.2-39.9-65-73.7-81.9l47.9 171.1 56.6-.1 84.3-195.4h-57.2z" />
    <path d="M146.9 153H60.1l-.7 4c67.1 16.2 111.5 55.4 129.9 102.4L171.1 170c-3.2-12.4-12.7-16.5-24.2-17z" fill="currentColor" opacity="0.7" />
  </svg>
);

const MastercardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500">
    <circle cx="312" cy="250" r="170" fill="currentColor" opacity="0.6" />
    <circle cx="468" cy="250" r="170" fill="currentColor" opacity="0.4" />
  </svg>
);

const IdealIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" fill="currentColor" opacity="0.1" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="700" fontFamily="sans-serif">iDEAL</text>
  </svg>
);

const BancontactIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="6" fill="currentColor" opacity="0.1" />
    <circle cx="16" cy="20" r="7" fill="currentColor" opacity="0.4" />
    <circle cx="24" cy="20" r="7" fill="currentColor" opacity="0.6" />
  </svg>
);

const ApplePayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="currentColor">
    <path d="M14.5 12.4c-.8 1-2.1 1.7-3.4 1.6-.2-1.3.5-2.7 1.2-3.5.8-1 2.2-1.7 3.3-1.7.1 1.3-.4 2.6-1.1 3.6zm1.1 1.8c-1.9-.1-3.5 1.1-4.4 1.1s-2.3-1-3.8-1c-2 0-3.8 1.1-4.8 2.9-2.1 3.5-.5 8.7 1.5 11.6 1 1.4 2.2 3 3.7 2.9 1.5-.1 2.1-.9 3.8-.9 1.8 0 2.3.9 3.9.9 1.6 0 2.6-1.4 3.6-2.9 1.1-1.6 1.6-3.2 1.6-3.3 0-.1-3-1.2-3.1-4.6 0-2.8 2.3-4.2 2.4-4.3-1.3-1.9-3.4-2.2-4.1-2.2l.7-.2z" />
    <text x="34" y="26" fill="currentColor" fontSize="13" fontWeight="600" fontFamily="sans-serif">Pay</text>
  </svg>
);

const GooglePayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600" fontFamily="sans-serif">G Pay</text>
  </svg>
);

const KlarnaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <rect width="60" height="40" rx="6" fill="currentColor" opacity="0.08" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700" fontFamily="sans-serif">Klarna</text>
  </svg>
);

const RevolutPayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 40" fill="none">
    <rect width="60" height="40" rx="6" fill="currentColor" opacity="0.08" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600" fontFamily="sans-serif">Revolut</text>
  </svg>
);

const PAYMENT_ICONS = [
  { key: 'visa', Icon: VisaIcon, label: 'Visa' },
  { key: 'mastercard', Icon: MastercardIcon, label: 'Mastercard' },
  { key: 'ideal', Icon: IdealIcon, label: 'iDEAL' },
  { key: 'bancontact', Icon: BancontactIcon, label: 'Bancontact' },
  { key: 'applepay', Icon: ApplePayIcon, label: 'Apple Pay' },
  { key: 'googlepay', Icon: GooglePayIcon, label: 'Google Pay' },
  { key: 'klarna', Icon: KlarnaIcon, label: 'Klarna' },
  { key: 'revolut', Icon: RevolutPayIcon, label: 'Revolut Pay' },
];

export function PaymentMethodIcons({ variant }: PaymentMethodIconsProps) {
  const { t } = useTranslation();

  if (variant === 'checkout') {
    return (
      <div className="flex flex-col items-center gap-2 py-3 border-t mt-2">
        <span className="text-xs text-muted-foreground">
          {t('checkout.securePayment')}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {PAYMENT_ICONS.map(({ key, Icon, label }) => (
            <div
              key={key}
              className="h-8 w-auto text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              title={label}
            >
              <Icon className="h-8 w-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Footer variant
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Payment icons row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {PAYMENT_ICONS.map(({ key, Icon, label }) => (
          <div
            key={key}
            className="h-6 w-auto text-muted-foreground/40"
            title={label}
          >
            <Icon className="h-6 w-auto" />
          </div>
        ))}
      </div>

      {/* Trust text row */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          <span>{t('footer.sslSecure')}</span>
        </div>
        <span className="text-muted-foreground/30">•</span>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{t('footer.verifiedPartner')}</span>
        </div>
      </div>
    </div>
  );
}

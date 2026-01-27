import { Banknote, CreditCard, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlatformPaymentMethod = 'bank_transfer' | 'stripe';

interface PlatformPaymentMethodSelectorProps {
  value: PlatformPaymentMethod;
  onChange: (method: PlatformPaymentMethod) => void;
  disabled?: boolean;
}

export function PlatformPaymentMethodSelector({
  value,
  onChange,
  disabled = false,
}: PlatformPaymentMethodSelectorProps) {
  const options = [
    {
      id: 'bank_transfer' as PlatformPaymentMethod,
      icon: Banknote,
      title: 'Bank',
      description: 'Geen transactiekosten',
      highlight: true,
    },
    {
      id: 'stripe' as PlatformPaymentMethod,
      icon: CreditCard,
      title: 'Kaart',
      description: 'Betaal direct met creditcard of iDEAL',
      highlight: false,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Hoe wil je betalen?</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.id;
          
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-left',
                'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-muted bg-background',
                disabled && 'opacity-50 cursor-not-allowed',
                option.highlight && !isSelected && 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
              )}
            >
              {option.highlight && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                  Aanbevolen
                </div>
              )}
              
              <div className={cn(
                'p-2 rounded-lg',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <Icon className="h-5 w-5" />
              </div>
              
              <div className="text-center">
                <p className="font-medium text-sm">{option.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              </div>
              
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, QrCode, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentMethodIcons } from '@/components/storefront/PaymentMethodIcons';

export type PaymentMethod = 'stripe' | 'bank_transfer';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
}

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  enabledMethods: PaymentMethod[];
  transactionFee?: number;
  showTransactionFee?: boolean;
  transactionFeeLabel?: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'stripe',
    label: 'iDEAL / Creditcard / Bancontact',
    description: 'Direct afrekenen via beveiligde betaling',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    id: 'bank_transfer',
    label: 'Directe Bankoverschrijving',
    description: 'Scan de QR-code met je bank-app - direct betaald!',
    icon: <QrCode className="h-5 w-5" />,
    badge: '0% kosten',
    badgeVariant: 'secondary',
  },
];

export function PaymentMethodSelector({
  value,
  onChange,
  enabledMethods,
  transactionFee,
  showTransactionFee = false,
  transactionFeeLabel = 'Transactiekosten',
}: PaymentMethodSelectorProps) {
  const availableMethods = PAYMENT_METHODS.filter(m => enabledMethods.includes(m.id));

  // If only one method is enabled, don't show selector
  if (availableMethods.length <= 1) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Kies je betaalmethode</h3>
        
        <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
          <div className="space-y-3">
            {availableMethods.map((method) => {
              const isSelected = value === method.id;
              const showFee = showTransactionFee && method.id === 'stripe' && transactionFee && transactionFee > 0;
              
              return (
                <Label
                  key={method.id}
                  htmlFor={method.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                  
                  <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                    {method.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{method.label}</span>
                      {method.badge && (
                        <Badge variant={method.badgeVariant || 'default'} className="text-xs">
                          {method.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {method.description}
                    </p>
                    {showFee && (
                      <p className="text-sm text-muted-foreground mt-1">
                        + {formatCurrency(transactionFee)} {transactionFeeLabel.toLowerCase()}
                      </p>
                    )}
                  </div>
                  
                  {method.id === 'bank_transfer' && (
                    <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>SEPA Instant</span>
                    </div>
                  )}
                </Label>
              );
            })}
          </div>
        </RadioGroup>

        <PaymentMethodIcons variant="checkout" />
      </CardContent>
    </Card>
  );
}

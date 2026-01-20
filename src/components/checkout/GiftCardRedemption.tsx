import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { useValidateGiftCardCode } from '@/hooks/useGiftCards';
import type { AppliedGiftCard } from '@/lib/promotions/types';

interface GiftCardRedemptionProps {
  appliedGiftCards: AppliedGiftCard[];
  amountDue: number;
  onApplyGiftCard: (giftCard: AppliedGiftCard) => void;
  onRemoveGiftCard: (giftCardId: string) => void;
}

export function GiftCardRedemption({
  appliedGiftCards,
  amountDue,
  onApplyGiftCard,
  onRemoveGiftCard,
}: GiftCardRedemptionProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const validateCode = useValidateGiftCardCode();

  const handleApply = async () => {
    if (!code.trim()) return;

    setError(null);

    // Check if already applied
    const normalizedCode = code.toUpperCase().trim();
    if (appliedGiftCards.some((gc) => gc.code === normalizedCode)) {
      setError('Deze cadeaukaart is al toegepast');
      return;
    }

    try {
      const result = await validateCode.mutateAsync(normalizedCode);

      // Calculate how much to apply (min of balance or remaining amount due)
      const remainingDue = amountDue - appliedGiftCards.reduce((sum, gc) => sum + gc.applied_amount, 0);
      const applyAmount = Math.min(Number(result.current_balance), remainingDue);

      if (applyAmount <= 0) {
        setError('Het openstaande bedrag is al volledig gedekt');
        return;
      }

      onApplyGiftCard({
        gift_card_id: result.id,
        code: result.code,
        applied_amount: applyAmount,
        remaining_balance: Number(result.current_balance) - applyAmount,
      });

      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ongeldige code');
    }
  };

  const totalApplied = appliedGiftCards.reduce((sum, gc) => sum + gc.applied_amount, 0);
  const remainingToPay = Math.max(0, amountDue - totalApplied);

  const maskCode = (giftCardCode: string) => {
    const parts = giftCardCode.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-****-${parts[parts.length - 1]}`;
    }
    return giftCardCode;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Cadeaukaart
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Applied gift cards */}
        {appliedGiftCards.length > 0 && (
          <div className="space-y-2">
            {appliedGiftCards.map((gc) => (
              <div
                key={gc.gift_card_id}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <div>
                    <code className="text-sm font-medium">{maskCode(gc.code)}</code>
                    <p className="text-xs text-muted-foreground">
                      Resterend: €{gc.remaining_balance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    -€{gc.applied_amount.toFixed(2)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveGiftCard(gc.gift_card_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input for new gift card */}
        {remainingToPay > 0 && (
          <div className="flex gap-2">
            <Input
              placeholder="Voer cadeaukaart code in"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              className="font-mono"
            />
            <Button
              onClick={handleApply}
              disabled={!code.trim() || validateCode.isPending}
              variant="outline"
            >
              {validateCode.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Toepassen'
              )}
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary */}
        {appliedGiftCards.length > 0 && (
          <div className="pt-2 border-t space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Cadeaukaart tegoed</span>
              <span>-€{totalApplied.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Nog te betalen</span>
              <span>€{remainingToPay.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState } from 'react';
import { Gift, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useValidateGiftCardCode } from '@/hooks/useGiftCards';
import { formatCurrency } from '@/lib/utils';

export interface AppliedGiftCard {
  id: string;
  code: string;
  availableBalance: number;
  amountToUse: number;
}

interface POSGiftCardInputProps {
  appliedCards: AppliedGiftCard[];
  onAddCard: (card: AppliedGiftCard) => void;
  onRemoveCard: (cardId: string) => void;
  onUpdateAmount: (cardId: string, amount: number) => void;
  maxAmount: number;
}

export function POSGiftCardInput({
  appliedCards,
  onAddCard,
  onRemoveCard,
  onUpdateAmount,
  maxAmount,
}: POSGiftCardInputProps) {
  const [code, setCode] = useState('');
  const validateCode = useValidateGiftCardCode();

  const handleValidate = async () => {
    if (!code.trim()) return;

    try {
      const giftCard = await validateCode.mutateAsync(code);
      
      // Check if already applied
      if (appliedCards.some(c => c.id === giftCard.id)) {
        return;
      }

      const availableBalance = Number(giftCard.current_balance);
      const remainingToPay = maxAmount - appliedCards.reduce((sum, c) => sum + c.amountToUse, 0);
      const amountToUse = Math.min(availableBalance, remainingToPay);

      onAddCard({
        id: giftCard.id,
        code: giftCard.code,
        availableBalance,
        amountToUse,
      });

      setCode('');
    } catch {
      // Error is handled by the mutation
    }
  };

  const totalApplied = appliedCards.reduce((sum, c) => sum + c.amountToUse, 0);

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Gift className="h-4 w-4" />
        Cadeaukaart
      </Label>

      {/* Applied cards */}
      {appliedCards.map((card) => (
        <div
          key={card.id}
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border"
        >
          <div className="flex-1">
            <p className="font-mono text-sm font-medium">{card.code}</p>
            <p className="text-xs text-muted-foreground">
              Beschikbaar: {formatCurrency(card.availableBalance)}
            </p>
          </div>
          <Input
            type="number"
            min={0}
            max={Math.min(card.availableBalance, maxAmount)}
            step={0.01}
            value={card.amountToUse}
            onChange={(e) => onUpdateAmount(card.id, parseFloat(e.target.value) || 0)}
            className="w-24 h-8 text-right"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemoveCard(card.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add new card */}
      <div className="flex gap-2">
        <Input
          placeholder="Voer cadeaukaart code in..."
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          className="font-mono"
        />
        <Button
          variant="outline"
          onClick={handleValidate}
          disabled={!code.trim() || validateCode.isPending}
        >
          {validateCode.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>

      {totalApplied > 0 && (
        <p className="text-sm text-green-600 font-medium">
          Totaal van cadeaukaarten: -{formatCurrency(totalApplied)}
        </p>
      )}
    </div>
  );
}

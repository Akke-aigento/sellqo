import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAdjustGiftCardBalance } from '@/hooks/useGiftCards';
import { Minus, Plus } from 'lucide-react';
import type { GiftCard } from '@/types/giftCard';
import { useTranslation } from 'react-i18next';

interface GiftCardBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  giftCard: GiftCard | null;
}

export function GiftCardBalanceDialog({
  open,
  onOpenChange,
  giftCard,
}: GiftCardBalanceDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [isAddition, setIsAddition] = useState(true);
  const [description, setDescription] = useState('');
  const adjustBalance = useAdjustGiftCardBalance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCard || !amount) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    await adjustBalance.mutateAsync({
      id: giftCard.id,
      amount: isAddition ? numericAmount : -numericAmount,
      description: description || (isAddition ? t('admin.promotions.giftCardBalanceDialog.saldo_verhoogd') : t('admin.promotions.giftCardBalanceDialog.saldo_verlaagd')),
    });

    setAmount('');
    setDescription('');
    onOpenChange(false);
  };

  if (!giftCard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.promotions.giftCardBalanceDialog.saldo_aanpassen')}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            {t('admin.promotions.giftCardBalanceDialog.code')} <span className="font-mono font-medium">{giftCard.code}</span>
          </p>
          <p className="text-lg font-semibold">
            Huidig saldo: €{Number(giftCard.current_balance).toFixed(2)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isAddition ? 'default' : 'outline'}
              onClick={() => setIsAddition(true)}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.promotions.giftCardBalanceDialog.ophogen')}
            </Button>
            <Button
              type="button"
              variant={!isAddition ? 'default' : 'outline'}
              onClick={() => setIsAddition(false)}
              className="flex-1"
            >
              <Minus className="mr-2 h-4 w-4" />
              {t('admin.promotions.giftCardBalanceDialog.verlagen')}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.promotions.giftCardBalanceDialog.bedrag')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.promotions.giftCardBalanceDialog.reden_optioneel')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('admin.promotions.giftCardBalanceDialog.bijv_correctie_compensatie')}
              rows={2}
            />
          </div>

          {amount && (
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{t('admin.promotions.giftCardBalanceDialog.nieuw_saldo_na_aanpassing')}</p>
              <p className="text-xl font-bold">
                €
                {(
                  Number(giftCard.current_balance) +
                  (isAddition ? parseFloat(amount) || 0 : -(parseFloat(amount) || 0))
                ).toFixed(2)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={adjustBalance.isPending}>
              {adjustBalance.isPending ? t('admin.marketing.creditPurchaseDialog.bezig') : t('admin.promotions.giftCardBalanceDialog.saldo_aanpassen')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

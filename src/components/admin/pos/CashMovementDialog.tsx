import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { POSCashMovementType } from '@/types/pos';
import { useTranslation } from 'react-i18next';

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    movement_type: POSCashMovementType;
    amount: number;
    reason: string;
    notes?: string;
  }) => Promise<void>;
  isPending?: boolean;
}

const COMMON_REASONS = {
  in: [
    'Wisselgeld aanvulling',
    'Kasstorting',
    'Correctie',
  ],
  out: [
    'Kasopname',
    'Fooien uitbetaling',
    'Kleine uitgaven',
    'Correctie',
  ],
};

export function CashMovementDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: CashMovementDialogProps) {
  const { t } = useTranslation();
  const [movementType, setMovementType] = useState<POSCashMovementType>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    const finalReason = reason === 'custom' ? customReason : reason;
    if (!finalReason || !amount) return;

    await onSubmit({
      movement_type: movementType,
      amount: parseFloat(amount),
      reason: finalReason,
      notes: notes || undefined,
    });

    // Reset form
    setMovementType('in');
    setAmount('');
    setReason('');
    setCustomReason('');
    setNotes('');
    onOpenChange(false);
  };

  const reasons = COMMON_REASONS[movementType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.pos.cashMovementDialog.kasmutatie_toevoegen')}</DialogTitle>
          <DialogDescription>
            {t('admin.pos.cashMovementDialog.registreer_een_kasstorting_of_opname')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Movement Type */}
          <div className="space-y-2">
            <Label>{t('admin.pos.cashMovementDialog.type_mutatie')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMovementType('in');
                  setReason('');
                }}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  movementType === 'in'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <TrendingUp className="h-5 w-5" />
                <span className="font-medium">{t('admin.pos.cashMovementDialog.geld_in')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementType('out');
                  setReason('');
                }}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  movementType === 'out'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <TrendingDown className="h-5 w-5" />
                <span className="font-medium">{t('admin.pos.cashMovementDialog.geld_uit')}</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t('admin.promotions.autoDiscountFormDialog.bedrag')}</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg"
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>{t('admin.stockLedger.colReason')}</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reasons.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="font-normal cursor-pointer">
                    {r}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  {t('admin.pos.cashMovementDialog.anders')}
                </Label>
              </div>
            </RadioGroup>
            
            {reason === 'custom' && (
              <Input
                placeholder={t('admin.pos.cashMovementDialog.specificeer_reden')}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('admin.marketing.aIFeedbackWidget.opmerkingen_optioneel')}</Label>
            <Textarea
              id="notes"
              placeholder={t('admin.pos.cashMovementDialog.extra_informatie')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !amount ||
              parseFloat(amount) <= 0 ||
              (!reason || (reason === 'custom' && !customReason))
            }
            className={movementType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isPending ? 'Verwerken...' : movementType === 'in' ? t('admin.pos.cashMovementDialog.geld_toevoegen') : t('admin.pos.cashMovementDialog.geld_opnemen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Undo2 } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Props {
  amountLabel: string;
  /** Stripe refund already executed (metadata.stripe_refund_id present). */
  hasRefund?: boolean;
  /** A non-cancelled credit note already exists for this invoice. */
  hasCreditNote?: boolean;
  onConfirm: () => Promise<unknown>;
}

/**
 * Menu-item + confirmatiedialoog voor "Terugbetalen & crediteren".
 * Alleen renderen op facturen met status 'paid'.
 */
export function RefundInvoiceButton({
  amountLabel,
  hasRefund = false,
  hasCreditNote = false,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Drive the state from BOTH facts: refund executed and credit note present.
  const disabled = hasCreditNote;
  const completionMode = hasRefund && !hasCreditNote;
  const label = disabled
    ? hasRefund
      ? t('admin.invoiceRefund.alreadyRefunded')
      : t('admin.invoiceRefund.alreadyCredited')
    : completionMode
      ? t('admin.invoiceRefund.completeAction')
      : t('admin.invoiceRefund.action');

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      toast({
        title: t('admin.invoiceRefund.successTitle'),
        description: t('admin.invoiceRefund.successDescription'),
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: t('admin.invoiceRefund.errorTitle'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenuItem
        disabled={disabled}
        title={label}
        className={disabled ? '' : 'text-destructive focus:text-destructive'}
        onSelect={(e) => {
          e.preventDefault();
          if (!disabled) setOpen(true);
        }}
      >
        <Undo2 className="h-4 w-4" />
        <span className="ml-2">{label}</span>
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.invoiceRefund.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.invoiceRefund.confirmAmount', { amount: amountLabel })}
              <br />
              {completionMode
                ? t('admin.invoiceRefund.completeConfirmDescription')
                : t('admin.invoiceRefund.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('admin.invoiceRefund.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {completionMode
                ? t('admin.invoiceRefund.completeAction')
                : t('admin.invoiceRefund.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
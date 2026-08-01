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
  /** Already refunded → item disabled with explanatory label. */
  alreadyRefunded?: boolean;
  onConfirm: () => Promise<unknown>;
}

/**
 * Menu-item + confirmatiedialoog voor "Terugbetalen & crediteren".
 * Alleen renderen op facturen met status 'paid'.
 */
export function RefundInvoiceButton({ amountLabel, alreadyRefunded = false, onConfirm }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
        disabled={alreadyRefunded}
        className={alreadyRefunded ? '' : 'text-destructive focus:text-destructive'}
        onSelect={(e) => {
          e.preventDefault();
          if (!alreadyRefunded) setOpen(true);
        }}
      >
        <Undo2 className="h-4 w-4" />
        <span className="ml-2">
          {alreadyRefunded
            ? t('admin.invoiceRefund.alreadyRefunded')
            : t('admin.invoiceRefund.action')}
        </span>
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.invoiceRefund.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.invoiceRefund.confirmAmount', { amount: amountLabel })}
              <br />
              {t('admin.invoiceRefund.confirmDescription')}
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
              {t('admin.invoiceRefund.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
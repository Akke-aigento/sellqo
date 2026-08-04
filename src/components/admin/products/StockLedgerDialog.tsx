import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStockMovements, type StockMovementReason } from '@/hooks/useStockLedger';
import { cn } from '@/lib/utils';

interface StockLedgerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  variantId?: string | null;
  title?: string;
}

export function StockLedgerDialog({
  open, onOpenChange, productId, variantId = null, title,
}: StockLedgerDialogProps) {
  const { t } = useTranslation();
  const { data: movements, isLoading } = useStockMovements(productId, variantId, open);

  const reasonLabel = (reason: StockMovementReason) =>
    t(`admin.stockLedger.reason.${reason}`, { defaultValue: reason });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('admin.stockLedger.title')}</DialogTitle>
          <DialogDescription>{title || t('admin.stockLedger.subtitle')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !movements || movements.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t('admin.stockLedger.empty')}</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.stockLedger.colDate')}</TableHead>
                  <TableHead>{t('admin.stockLedger.colReason')}</TableHead>
                  <TableHead className="text-right">{t('admin.stockLedger.colDelta')}</TableHead>
                  <TableHead className="text-right">{t('admin.stockLedger.colBalance')}</TableHead>
                  <TableHead>{t('admin.stockLedger.colNote')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{reasonLabel(m.reason)}</Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono font-medium',
                        m.delta < 0 ? 'text-destructive' : 'text-emerald-600',
                      )}
                    >
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.balance_after}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

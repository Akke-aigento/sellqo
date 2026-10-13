import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Banknote,
  CreditCard,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Printer,
  Receipt,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { POSSession, POSTransaction, POSCashMovement } from '@/types/pos';
import { useTranslation } from 'react-i18next';

interface SessionReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: POSSession | null;
  transactions: POSTransaction[];
  cashMovements: POSCashMovement[];
  onClose?: () => void;
}

interface PaymentSummary {
  cash: number;
  card: number;
  other: number;
  total: number;
}

interface TransactionSummary {
  count: number;
  completed: number;
  voided: number;
  refunded: number;
}

export function SessionReportDialog({
  open,
  onOpenChange,
  session,
  transactions,
  cashMovements,
  onClose,
}: SessionReportDialogProps) {
  const { t, i18n } = useTranslation();
  // Calculate payment summary
  const paymentSummary = useMemo<PaymentSummary>(() => {
    const summary = { cash: 0, card: 0, other: 0, total: 0 };
    
    transactions
      .filter(t => t.status === 'completed')
      .forEach(t => {
        t.payments.forEach(p => {
          if (p.method === 'cash') {
            summary.cash += p.amount;
          } else if (p.method === 'card') {
            summary.card += p.amount;
          } else {
            summary.other += p.amount;
          }
          summary.total += p.amount;
        });
      });
    
    return summary;
  }, [transactions]);

  // Calculate transaction summary
  const transactionSummary = useMemo<TransactionSummary>(() => {
    return {
      count: transactions.length,
      completed: transactions.filter(t => t.status === 'completed').length,
      voided: transactions.filter(t => t.status === 'voided').length,
      refunded: transactions.filter(t => t.status === 'refunded').length,
    };
  }, [transactions]);

  // Calculate cash movements summary
  const cashMovementsSummary = useMemo(() => {
    const inflows = cashMovements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + m.amount, 0);
    const outflows = cashMovements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + Math.abs(m.amount), 0);
    
    return { inflows, outflows, net: inflows - outflows };
  }, [cashMovements]);

  // Calculate expected cash
  const expectedCash = useMemo(() => {
    const opening = session?.opening_cash || 0;
    const cashSales = paymentSummary.cash;
    const movements = cashMovementsSummary.net;
    return opening + cashSales + movements;
  }, [session, paymentSummary, cashMovementsSummary]);

  // Calculate cash difference
  const cashDifference = useMemo(() => {
    if (session?.closing_cash === null || session?.closing_cash === undefined) {
      return null;
    }
    return session.closing_cash - expectedCash;
  }, [session, expectedCash]);

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Export to text
  const handleExport = () => {
    if (!session) return;

    // Labels in de UI-taal; uitgelijnd met padEnd zodat het tekstbestand leesbaar blijft.
    const row = (key: string, value: string) => `${`${t(key)}:`.padEnd(16)}${value}`;
    const title = (key: string) => t(key).toUpperCase().padStart(Math.floor((39 + t(key).length) / 2));
    const lines = [
      '═══════════════════════════════════════',
      title('admin.pos.zreport.title'),
      '═══════════════════════════════════════',
      '',
      row('admin.pos.zreport.terminal', session.terminal?.name || t('admin.pos.zreport.unknown')),
      row('admin.pos.zreport.date', new Date(session.opened_at).toLocaleDateString(i18n.language)),
      row('admin.pos.zreport.opened', new Date(session.opened_at).toLocaleTimeString(i18n.language)),
      session.closed_at ? row('admin.pos.zreport.closed', new Date(session.closed_at).toLocaleTimeString(i18n.language)) : '',
      '',
      '───────────────────────────────────────',
      title('admin.pos.zreport.transactions'),
      '───────────────────────────────────────',
      row('admin.pos.zreport.total_transactions', String(transactionSummary.count)),
      row('admin.pos.zreport.completed', String(transactionSummary.completed)),
      row('admin.pos.zreport.voided', String(transactionSummary.voided)),
      row('admin.pos.zreport.refunded', String(transactionSummary.refunded)),
      '',
      '───────────────────────────────────────',
      title('admin.pos.zreport.payment_methods'),
      '───────────────────────────────────────',
      row('admin.pos.zreport.cash', formatCurrency(paymentSummary.cash)),
      row('admin.pos.zreport.card', formatCurrency(paymentSummary.card)),
      row('admin.pos.zreport.other', formatCurrency(paymentSummary.other)),
      `─────────────────────────────`,
      row('admin.pos.zreport.total', formatCurrency(paymentSummary.total)),
      '',
      '───────────────────────────────────────',
      title('admin.pos.zreport.cash_check'),
      '───────────────────────────────────────',
      row('admin.pos.zreport.opening_cash', formatCurrency(session.opening_cash)),
      row('admin.pos.zreport.cash_sales', formatCurrency(paymentSummary.cash)),
      row('admin.pos.zreport.cash_movements', formatCurrency(cashMovementsSummary.net)),
      `─────────────────────────────`,
      row('admin.pos.zreport.expected', formatCurrency(expectedCash)),
      session.closing_cash !== null ? row('admin.pos.zreport.counted', formatCurrency(session.closing_cash)) : '',
      cashDifference !== null ? row('admin.pos.zreport.difference', formatCurrency(cashDifference)) : '',
      '',
      '═══════════════════════════════════════',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('admin.pos.zreport.file_name')}-${new Date(session.opened_at).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('admin.pos.sessionReportDialog.dagafsluiting')}
          </DialogTitle>
          <DialogDescription>
            {session.terminal?.name || 'Terminal'} - {new Date(session.opened_at).toLocaleDateString(i18n.language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Session Time */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.pos.sessionReportDialog.sessieduur')}</p>
                  <p className="font-medium">
                    {new Date(session.opened_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {session.closed_at 
                      ? new Date(session.closed_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
                      : 'Nu'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                {session.status === 'open' ? t('admin.marketing.aBTestingPanel.actief') : t('admin.storefront.food.fulfillmentSettings.gesloten')}
              </Badge>
            </div>

            {/* Transaction Summary */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('admin.pos.dashboardPOSWidget.transacties')}</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{transactionSummary.count}</p>
                  <p className="text-xs text-muted-foreground">{t('common.total')}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                  <p className="text-2xl font-bold text-green-600">{transactionSummary.completed}</p>
                  <p className="text-xs text-green-600">{t('admin.products.productEventDatesTab.statuses.completed')}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 text-center">
                  <p className="text-2xl font-bold text-orange-600">{transactionSummary.voided}</p>
                  <p className="text-xs text-orange-600">{t('admin.marketing.aBTestingPanel.geannuleerd')}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-center">
                  <p className="text-2xl font-bold text-blue-600">{transactionSummary.refunded}</p>
                  <p className="text-xs text-blue-600">{t('admin.orderFilters.terugbetaald')}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Methods */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('admin.pos.sessionReportDialog.betalingsmethodes')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span>{t('admin.pos.pOSMultiPaymentDialog.contant')}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(paymentSummary.cash)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span>{t('admin.pos.sessionReportDialog.pin_kaart')}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(paymentSummary.card)}</span>
                </div>
                {paymentSummary.other > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                      <span>{t('admin.pos.sessionReportDialog.overig')}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(paymentSummary.other)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                  <span className="font-semibold">{t('admin.ads.totale_omzet')}</span>
                  <span className="text-xl font-bold">{formatCurrency(paymentSummary.total)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Cash Reconciliation */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t('admin.pos.sessionReportDialog.kascontrole')}</h3>
              <div className="w-full overflow-x-auto">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">{t('admin.pos.sessionReportDialog.startbedrag')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(session.opening_cash)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">{t('admin.pos.sessionReportDialog.contante_omzet')}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      +{formatCurrency(paymentSummary.cash)}
                    </TableCell>
                  </TableRow>
                  {cashMovementsSummary.inflows > 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          {t('admin.pos.sessionReportDialog.kasstortingen')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{formatCurrency(cashMovementsSummary.inflows)}
                      </TableCell>
                    </TableRow>
                  )}
                  {cashMovementsSummary.outflows > 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          {t('admin.pos.sessionReportDialog.kasopnames')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        -{formatCurrency(cashMovementsSummary.outflows)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold">{t('admin.pos.sessionReportDialog.verwacht_in_kas')}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(expectedCash)}
                    </TableCell>
                  </TableRow>
                  {session.closing_cash !== null && (
                    <>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{t('admin.pos.sessionReportDialog.geteld_bedrag')}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(session.closing_cash)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold">{t('admin.seo.competitorAnalysisPanel.verschil')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cashDifference === 0 ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="font-bold text-green-600">{t('admin.pos.sessionReportDialog.kloppend')}</span>
                              </>
                            ) : cashDifference !== null && cashDifference > 0 ? (
                              <>
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <span className="font-bold text-blue-600">
                                  +{formatCurrency(cashDifference)}
                                </span>
                              </>
                            ) : cashDifference !== null ? (
                              <>
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="font-bold text-red-600">
                                  {formatCurrency(cashDifference)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>

            {/* Cash Movements Detail */}
            {cashMovements.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-3">{t('admin.pos.sessionReportDialog.kasmutaties')}</h3>
                  <div className="space-y-2">
                    {cashMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{movement.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(movement.created_at).toLocaleTimeString(i18n.language, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {movement.notes && ` - ${movement.notes}`}
                          </p>
                        </div>
                        <span className={`font-semibold ${
                          movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.movement_type === 'in' ? '+' : '-'}
                          {formatCurrency(Math.abs(movement.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              {t('admin.pos.sessionReportDialog.exporteren')}
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              {t('admin.pos.sessionReportDialog.afdrukken')}
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              onClose?.();
            }} className="flex-1">
              {session.status === 'open' ? t('common.close') : t('admin.pos.sessionReportDialog.gereed')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

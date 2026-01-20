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

    const lines = [
      '═══════════════════════════════════════',
      '           DAGAFSLUITING',
      '═══════════════════════════════════════',
      '',
      `Terminal: ${session.terminal?.name || 'Onbekend'}`,
      `Datum: ${new Date(session.opened_at).toLocaleDateString('nl-NL')}`,
      `Geopend: ${new Date(session.opened_at).toLocaleTimeString('nl-NL')}`,
      session.closed_at ? `Gesloten: ${new Date(session.closed_at).toLocaleTimeString('nl-NL')}` : '',
      '',
      '───────────────────────────────────────',
      '            TRANSACTIES',
      '───────────────────────────────────────',
      `Totaal transacties: ${transactionSummary.count}`,
      `Afgerond: ${transactionSummary.completed}`,
      `Geannuleerd: ${transactionSummary.voided}`,
      `Terugbetaald: ${transactionSummary.refunded}`,
      '',
      '───────────────────────────────────────',
      '          BETALINGSMETHODES',
      '───────────────────────────────────────',
      `Contant:     ${formatCurrency(paymentSummary.cash)}`,
      `PIN/Kaart:   ${formatCurrency(paymentSummary.card)}`,
      `Overig:      ${formatCurrency(paymentSummary.other)}`,
      `─────────────────────────────`,
      `TOTAAL:      ${formatCurrency(paymentSummary.total)}`,
      '',
      '───────────────────────────────────────',
      '           KASCONTROLE',
      '───────────────────────────────────────',
      `Startbedrag:   ${formatCurrency(session.opening_cash)}`,
      `Contant omzet: ${formatCurrency(paymentSummary.cash)}`,
      `Kasmutaties:   ${formatCurrency(cashMovementsSummary.net)}`,
      `─────────────────────────────`,
      `Verwacht:      ${formatCurrency(expectedCash)}`,
      session.closing_cash !== null ? `Geteld:        ${formatCurrency(session.closing_cash)}` : '',
      cashDifference !== null ? `Verschil:      ${formatCurrency(cashDifference)}` : '',
      '',
      '═══════════════════════════════════════',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dagafsluiting-${new Date(session.opened_at).toISOString().split('T')[0]}.txt`;
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
            Dagafsluiting
          </DialogTitle>
          <DialogDescription>
            {session.terminal?.name || 'Terminal'} - {new Date(session.opened_at).toLocaleDateString('nl-NL', {
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
                  <p className="text-sm text-muted-foreground">Sessieduur</p>
                  <p className="font-medium">
                    {new Date(session.opened_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {session.closed_at 
                      ? new Date(session.closed_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                      : 'Nu'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                {session.status === 'open' ? 'Actief' : 'Gesloten'}
              </Badge>
            </div>

            {/* Transaction Summary */}
            <div>
              <h3 className="text-sm font-medium mb-3">Transacties</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{transactionSummary.count}</p>
                  <p className="text-xs text-muted-foreground">Totaal</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                  <p className="text-2xl font-bold text-green-600">{transactionSummary.completed}</p>
                  <p className="text-xs text-green-600">Afgerond</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 text-center">
                  <p className="text-2xl font-bold text-orange-600">{transactionSummary.voided}</p>
                  <p className="text-xs text-orange-600">Geannuleerd</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-center">
                  <p className="text-2xl font-bold text-blue-600">{transactionSummary.refunded}</p>
                  <p className="text-xs text-blue-600">Terugbetaald</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Methods */}
            <div>
              <h3 className="text-sm font-medium mb-3">Betalingsmethodes</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span>Contant</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(paymentSummary.cash)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span>PIN / Kaart</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(paymentSummary.card)}</span>
                </div>
                {paymentSummary.other > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                      <span>Overig</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(paymentSummary.other)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                  <span className="font-semibold">Totale Omzet</span>
                  <span className="text-xl font-bold">{formatCurrency(paymentSummary.total)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Cash Reconciliation */}
            <div>
              <h3 className="text-sm font-medium mb-3">Kascontrole</h3>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Startbedrag</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(session.opening_cash)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Contante omzet</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      +{formatCurrency(paymentSummary.cash)}
                    </TableCell>
                  </TableRow>
                  {cashMovementsSummary.inflows > 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Kasstortingen
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
                          Kasopnames
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        -{formatCurrency(cashMovementsSummary.outflows)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold">Verwacht in kas</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(expectedCash)}
                    </TableCell>
                  </TableRow>
                  {session.closing_cash !== null && (
                    <>
                      <TableRow>
                        <TableCell className="text-muted-foreground">Geteld bedrag</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(session.closing_cash)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold">Verschil</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cashDifference === 0 ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="font-bold text-green-600">Kloppend</span>
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

            {/* Cash Movements Detail */}
            {cashMovements.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-3">Kasmutaties</h3>
                  <div className="space-y-2">
                    {cashMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{movement.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(movement.created_at).toLocaleTimeString('nl-NL', {
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
              Exporteren
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Afdrukken
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              onClose?.();
            }} className="flex-1">
              {session.status === 'open' ? 'Sluiten' : 'Gereed'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

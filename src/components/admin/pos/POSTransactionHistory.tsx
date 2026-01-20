import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Receipt,
  RotateCcw,
  Eye,
  Clock,
  CreditCard,
  Banknote,
  Gift,
  User,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { POSTransaction } from '@/types/pos';

interface POSTransactionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: POSTransaction[];
  onViewReceipt: (transaction: POSTransaction) => void;
  onRefund: (transaction: POSTransaction) => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Voltooid', variant: 'default' },
  pending: { label: 'In behandeling', variant: 'secondary' },
  voided: { label: 'Geannuleerd', variant: 'destructive' },
  refunded: { label: 'Geretourneerd', variant: 'outline' },
};

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3 w-3" />,
  card: <CreditCard className="h-3 w-3" />,
  gift_card: <Gift className="h-3 w-3" />,
  loyalty_points: <User className="h-3 w-3" />,
};

export function POSTransactionHistory({
  open,
  onOpenChange,
  transactions,
  onViewReceipt,
  onRefund,
}: POSTransactionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.receipt_number?.toLowerCase().includes(query) ||
      t.id.toLowerCase().includes(query) ||
      t.items.some(item => item.name.toLowerCase().includes(query))
    );
  });

  // Group by date
  const groupedTransactions = filteredTransactions.reduce((acc, transaction) => {
    const date = new Date(transaction.created_at).toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(transaction);
    return acc;
  }, {} as Record<string, POSTransaction[]>);

  const handleViewDetails = (transaction: POSTransaction) => {
    setSelectedTransaction(transaction);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transactiegeschiedenis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op bonnummer, ID of productnaam..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Transaction List or Detail View */}
          {selectedTransaction ? (
            <TransactionDetail
              transaction={selectedTransaction}
              onBack={() => setSelectedTransaction(null)}
              onViewReceipt={() => {
                onViewReceipt(selectedTransaction);
                onOpenChange(false);
              }}
              onRefund={() => {
                onRefund(selectedTransaction);
                onOpenChange(false);
              }}
            />
          ) : (
            <ScrollArea className="h-[50vh]">
              <div className="space-y-6 pr-4">
                {Object.entries(groupedTransactions).map(([date, txns]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                      {date}
                    </h3>
                    <div className="space-y-2">
                      {txns.map((transaction) => (
                        <TransactionCard
                          key={transaction.id}
                          transaction={transaction}
                          onClick={() => handleViewDetails(transaction)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {filteredTransactions.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Geen transacties gevonden</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransactionCard({
  transaction,
  onClick,
}: {
  transaction: POSTransaction;
  onClick: () => void;
}) {
  const status = statusConfig[transaction.status] || statusConfig.completed;
  const time = new Date(transaction.created_at).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              #{transaction.receipt_number || transaction.id.slice(0, 8)}
            </span>
            <Badge variant={status.variant} className="text-xs">
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {transaction.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {time}
            </span>
            <span className="flex items-center gap-1">
              {paymentIcons[transaction.payments[0]?.method] || paymentIcons.cash}
              {transaction.payments[0]?.method === 'card' && transaction.card_last4
                ? `•••• ${transaction.card_last4}`
                : transaction.payments[0]?.method === 'cash'
                ? 'Contant'
                : 'Overig'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className={`font-bold ${transaction.status === 'refunded' ? 'text-destructive' : ''}`}>
            {transaction.status === 'refunded' && '-'}
            {formatCurrency(transaction.total)}
          </span>
        </div>
      </div>
    </button>
  );
}

function TransactionDetail({
  transaction,
  onBack,
  onViewReceipt,
  onRefund,
}: {
  transaction: POSTransaction;
  onBack: () => void;
  onViewReceipt: () => void;
  onRefund: () => void;
}) {
  const status = statusConfig[transaction.status] || statusConfig.completed;
  const canRefund = transaction.status === 'completed';

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        <X className="mr-2 h-4 w-4" />
        Terug naar overzicht
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            #{transaction.receipt_number || transaction.id.slice(0, 8)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {new Date(transaction.created_at).toLocaleString('nl-NL')}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <Separator />

      {/* Items */}
      <div>
        <h4 className="text-sm font-medium mb-2">Items</h4>
        <div className="space-y-2">
          {transaction.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotaal</span>
          <span>{formatCurrency(transaction.subtotal)}</span>
        </div>
        {transaction.discount_total > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Korting</span>
            <span>-{formatCurrency(transaction.discount_total)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">BTW</span>
          <span>{formatCurrency(transaction.tax_total)}</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-2">
          <span>Totaal</span>
          <span>{formatCurrency(transaction.total)}</span>
        </div>
      </div>

      <Separator />

      {/* Payment info */}
      <div>
        <h4 className="text-sm font-medium mb-2">Betaling</h4>
        <div className="space-y-1 text-sm">
          {transaction.payments.map((payment, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {paymentIcons[payment.method]}
                {payment.method === 'card' && transaction.card_brand
                  ? `${transaction.card_brand} •••• ${transaction.card_last4}`
                  : payment.method === 'cash'
                  ? 'Contant'
                  : payment.method === 'gift_card'
                  ? `Cadeaubon (${payment.reference})`
                  : payment.method === 'loyalty_points'
                  ? `Spaarpunten (${payment.reference})`
                  : payment.method}
              </span>
              <span>{formatCurrency(payment.amount)}</span>
            </div>
          ))}
          {transaction.cash_change !== null && transaction.cash_change > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Wisselgeld</span>
              <span>{formatCurrency(transaction.cash_change)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Refund info if refunded */}
      {transaction.status === 'refunded' && transaction.refunded_at && (
        <>
          <Separator />
          <div className="bg-destructive/10 rounded-lg p-3">
            <h4 className="text-sm font-medium text-destructive mb-1">Geretourneerd</h4>
            <p className="text-sm text-muted-foreground">
              {new Date(transaction.refunded_at).toLocaleString('nl-NL')}
            </p>
          </div>
        </>
      )}

      {/* Void info if voided */}
      {transaction.status === 'voided' && transaction.voided_at && (
        <>
          <Separator />
          <div className="bg-destructive/10 rounded-lg p-3">
            <h4 className="text-sm font-medium text-destructive mb-1">Geannuleerd</h4>
            <p className="text-sm text-muted-foreground">
              {new Date(transaction.voided_at).toLocaleString('nl-NL')}
            </p>
            {transaction.voided_reason && (
              <p className="text-sm mt-1">Reden: {transaction.voided_reason}</p>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onViewReceipt}>
          <Receipt className="mr-2 h-4 w-4" />
          Bekijk bon
        </Button>
        {canRefund && (
          <Button variant="destructive" className="flex-1" onClick={onRefund}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retour
          </Button>
        )}
      </div>
    </div>
  );
}

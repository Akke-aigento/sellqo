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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { POSTransaction, POSCartItem } from '@/types/pos';

interface POSRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: POSTransaction | null;
  onRefund: (data: RefundData) => Promise<void>;
  isProcessing: boolean;
}

export interface RefundData {
  transactionId: string;
  reason: string;
  refundItems: Array<{
    itemId: string;
    quantity: number;
    amount: number;
  }>;
  totalRefundAmount: number;
  restockItems: boolean;
}

export function POSRefundDialog({
  open,
  onOpenChange,
  transaction,
  onRefund,
  isProcessing,
}: POSRefundDialogProps) {
  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [restockItems, setRestockItems] = useState(true);

  // Reset state when dialog opens with new transaction
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && transaction) {
      // Initialize all items as selected with full quantity
      const initialSelection: Record<string, number> = {};
      transaction.items.forEach(item => {
        initialSelection[item.id] = item.quantity;
      });
      setSelectedItems(initialSelection);
      setReason('');
      setRestockItems(true);
    }
    onOpenChange(newOpen);
  };

  // Calculate refund amount
  const calculateRefundAmount = () => {
    if (!transaction) return 0;
    
    let itemsTotal = 0;
    transaction.items.forEach(item => {
      const qty = selectedItems[item.id] || 0;
      if (qty > 0) {
        itemsTotal += (item.price * qty) - (item.discount * (qty / item.quantity));
      }
    });

    // Calculate proportional tax
    const originalSubtotal = transaction.subtotal;
    const taxRate = originalSubtotal > 0 ? transaction.tax_total / originalSubtotal : 0;
    const refundTax = itemsTotal * taxRate;

    return itemsTotal + refundTax;
  };

  const refundAmount = calculateRefundAmount();
  const hasSelection = Object.values(selectedItems).some(qty => qty > 0);

  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: prev[itemId] === maxQty ? 0 : maxQty,
    }));
  };

  const updateItemQuantity = (itemId: string, qty: number, maxQty: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: Math.min(Math.max(0, qty), maxQty),
    }));
  };

  const handleSubmit = async () => {
    if (!transaction || !hasSelection || !reason.trim()) return;

    const refundItems = transaction.items
      .filter(item => (selectedItems[item.id] || 0) > 0)
      .map(item => {
        const qty = selectedItems[item.id];
        const itemTotal = (item.price * qty) - (item.discount * (qty / item.quantity));
        return {
          itemId: item.id,
          quantity: qty,
          amount: itemTotal,
        };
      });

    await onRefund({
      transactionId: transaction.id,
      reason: reason.trim(),
      refundItems,
      totalRefundAmount: refundAmount,
      restockItems,
    });
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Retour verwerken
          </DialogTitle>
          <DialogDescription>
            Transactie #{transaction.receipt_number || transaction.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items selection */}
          <div>
            <Label className="text-sm font-medium">Selecteer items voor retour</Label>
            <ScrollArea className="h-48 mt-2 border rounded-lg">
              <div className="p-2 space-y-2">
                {transaction.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                  >
                    <Checkbox
                      checked={(selectedItems[item.id] || 0) > 0}
                      onCheckedChange={() => toggleItem(item.id, item.quantity)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} per stuk
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={selectedItems[item.id] || 0}
                        onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0, item.quantity)}
                        className="w-16 h-8 text-center text-sm"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Reden voor retour *</Label>
            <Textarea
              id="reason"
              placeholder="Bijv. defect product, verkeerd artikel, klant niet tevreden..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Restock option */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="restock"
              checked={restockItems}
              onCheckedChange={(checked) => setRestockItems(!!checked)}
            />
            <Label htmlFor="restock" className="flex items-center gap-2 cursor-pointer">
              <Package className="h-4 w-4" />
              Items terugboeken naar voorraad
            </Label>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Retour bedrag</span>
              <span className="text-xl font-bold text-destructive">
                -{formatCurrency(refundAmount)}
              </span>
            </div>
            {transaction.payments[0]?.method === 'card' && (
              <p className="text-xs text-muted-foreground mt-2">
                💳 Kaartbetaling wordt automatisch teruggestort via Stripe
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!hasSelection || !reason.trim() || isProcessing}
          >
            {isProcessing ? 'Verwerken...' : `Retour verwerken (${formatCurrency(refundAmount)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

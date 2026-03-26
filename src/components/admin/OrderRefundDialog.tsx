import { useState, useMemo } from 'react';
import { RotateCcw, CreditCard, Building2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useProcessRefund } from '@/hooks/useReturns';
import type { Order, OrderItem } from '@/types/order';

interface OrderRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  formatCurrency: (amount: number) => string;
}

interface RefundItem {
  item: OrderItem;
  selected: boolean;
  quantity: number;
}

export function OrderRefundDialog({ open, onOpenChange, order, formatCurrency }: OrderRefundDialogProps) {
  const processRefund = useProcessRefund();
  const [reason, setReason] = useState('');
  const [restockItems, setRestockItems] = useState(true);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);

  const [refundItems, setRefundItems] = useState<RefundItem[]>(() =>
    (order.order_items || []).map((item) => ({
      item,
      selected: true,
      quantity: item.quantity,
    }))
  );

  const hasStripe = !!order.stripe_payment_intent_id;

  const calculatedAmount = useMemo(() => {
    return refundItems
      .filter((ri) => ri.selected)
      .reduce((sum, ri) => sum + ri.quantity * Number(ri.item.unit_price), 0);
  }, [refundItems]);

  const finalAmount = useCustomAmount ? parseFloat(customAmount) || 0 : calculatedAmount;
  const maxAmount = Number(order.total);

  const toggleItem = (index: number) => {
    setRefundItems((prev) =>
      prev.map((ri, i) => (i === index ? { ...ri, selected: !ri.selected } : ri))
    );
  };

  const updateQuantity = (index: number, qty: number) => {
    setRefundItems((prev) =>
      prev.map((ri, i) =>
        i === index ? { ...ri, quantity: Math.max(1, Math.min(qty, ri.item.quantity)) } : ri
      )
    );
  };

  const handleSubmit = () => {
    if (!reason.trim()) return;
    if (finalAmount <= 0 || finalAmount > maxAmount) return;

    const selectedItems = refundItems
      .filter((ri) => ri.selected)
      .map((ri) => ({
        product_id: ri.item.product_id,
        product_name: ri.item.product_name,
        quantity: ri.quantity,
        unit_price: Number(ri.item.unit_price),
      }));

    processRefund.mutate(
      {
        orderId: order.id,
        items: selectedItems,
        reason,
        refundAmount: finalAmount,
        restockItems,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason('');
          setCustomAmount('');
          setUseCustomAmount(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Retour verwerken — {order.order_number}
          </DialogTitle>
          <DialogDescription>
            Selecteer items en bedrag voor de terugbetaling
          </DialogDescription>
        </DialogHeader>

        {/* Payment method indicator */}
        <Alert variant={hasStripe ? 'default' : 'destructive'}>
          <AlertDescription className="flex items-center gap-2">
            {hasStripe ? (
              <>
                <CreditCard className="h-4 w-4 text-primary" />
                <span>Automatische Stripe terugbetaling — bedrag wordt direct teruggestort</span>
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4" />
                <span>Handmatige terugbetaling vereist — betaling was niet via kaart</span>
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Item selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Items</Label>
          {refundItems.map((ri, index) => (
            <div key={ri.item.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={ri.selected}
                onCheckedChange={() => toggleItem(index)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ri.item.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(Number(ri.item.unit_price))} per stuk
                </div>
              </div>
              <Input
                type="number"
                min={1}
                max={ri.item.quantity}
                value={ri.quantity}
                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                className="w-16 h-8 text-center"
                disabled={!ri.selected}
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Amount */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Terugbetaalbedrag</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="custom-amount"
                checked={useCustomAmount}
                onCheckedChange={(v) => setUseCustomAmount(!!v)}
              />
              <Label htmlFor="custom-amount" className="text-xs">Aangepast bedrag</Label>
            </div>
          </div>

          {useCustomAmount ? (
            <Input
              type="number"
              step="0.01"
              min={0}
              max={maxAmount}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`Max ${formatCurrency(maxAmount)}`}
            />
          ) : (
            <div className="text-2xl font-bold">{formatCurrency(calculatedAmount)}</div>
          )}

          {finalAmount > maxAmount && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Bedrag mag niet hoger zijn dan {formatCurrency(maxAmount)}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reden *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Beschrijf de reden voor de retour..."
            rows={2}
          />
        </div>

        {/* Restock */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="restock"
            checked={restockItems}
            onCheckedChange={(v) => setRestockItems(!!v)}
          />
          <Label htmlFor="restock" className="text-sm">Voorraad herstellen</Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              processRefund.isPending ||
              !reason.trim() ||
              finalAmount <= 0 ||
              finalAmount > maxAmount
            }
            variant="destructive"
          >
            {processRefund.isPending ? 'Verwerken...' : `Retour verwerken (${formatCurrency(finalAmount)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

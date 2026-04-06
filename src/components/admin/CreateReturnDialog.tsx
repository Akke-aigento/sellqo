import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useReturnMutations, type ReturnItem } from '@/hooks/useReturns';

interface OrderItem {
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  price: number;
}

interface CreateReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string;
  customerName?: string;
  orderItems: OrderItem[];
  paymentMethod?: string; // stripe, bolcom, amazon, manual
}

const REASON_OPTIONS = [
  { value: 'defect', label: 'Defect' },
  { value: 'wrong_product', label: 'Verkeerd product' },
  { value: 'not_as_expected', label: 'Niet naar wens' },
  { value: 'other', label: 'Anders' },
];

export function CreateReturnDialog({
  open,
  onOpenChange,
  orderId,
  customerId,
  customerName,
  orderItems,
  paymentMethod = 'manual',
}: CreateReturnDialogProps) {
  const { createReturn } = useReturnMutations();
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const toggleItem = (itemKey: string, checked: boolean, maxQty: number) => {
    if (checked) {
      setSelectedItems((prev) => ({ ...prev, [itemKey]: 1 }));
    } else {
      setSelectedItems((prev) => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
    }
  };

  const updateQuantity = (itemKey: string, qty: number) => {
    setSelectedItems((prev) => ({ ...prev, [itemKey]: qty }));
  };

  const handleSubmit = () => {
    const items: ReturnItem[] = orderItems
      .filter((_, i) => selectedItems[i.toString()] !== undefined)
      .map((item, i) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        quantity: selectedItems[i.toString()] || 1,
        price: item.price,
      }));

    if (items.length === 0) return;

    const refundAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    createReturn.mutate(
      {
        order_id: orderId,
        customer_id: customerId,
        customer_name: customerName,
        items,
        return_reason: reason || undefined,
        return_reason_code: reason || undefined,
        refund_amount: refundAmount,
        refund_method: paymentMethod,
        internal_notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedItems({});
          setReason('');
          setNotes('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retour aanmaken</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Selecteer producten</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {orderItems.map((item, index) => {
                const key = index.toString();
                const isSelected = selectedItems[key] !== undefined;
                return (
                  <div key={key} className="flex items-center gap-3 p-2 border rounded-md">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleItem(key, !!checked, item.quantity)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={selectedItems[key]}
                        onChange={(e) => updateQuantity(key, Math.min(Number(e.target.value), item.quantity))}
                        className="w-16"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">max {item.quantity}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Reden</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer reden..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Interne notities</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele notities..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(selectedItems).length === 0 || createReturn.isPending}
          >
            {createReturn.isPending ? 'Bezig...' : 'Retour aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import {
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  PauseCircle,
  ShoppingCart,
  X,
  Tag,
  Percent,
  Gift,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { POSCartItem } from '@/types/pos';
import type { Customer } from '@/types/order';
import type { POSDiscount } from '@/components/admin/pos/POSDiscountPanel';
import type { POSCartTotals } from '@/hooks/usePOSCart';

interface POSCartPanelProps {
  vatHandling?: 'inclusive' | 'exclusive';
  cart: POSCartItem[];
  cartTotals: POSCartTotals;
  selectedCustomer: Customer | null;
  cartDiscount: POSDiscount | null;
  isStripeProcessing: boolean;
  hasIban: boolean;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onParkCart: () => void;
  onSelectCustomer: () => void;
  onClearCustomer: () => void;
  onApplyDiscount: () => void;
  onClearDiscount: () => void;
  onCashPayment: () => void;
  onCardPayment: () => void;
  onBankTransfer: () => void;
  onMultiPayment: () => void;
}

export function POSCartPanel({
  cart,
  cartTotals,
  selectedCustomer,
  cartDiscount,
  isStripeProcessing,
  hasIban,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onParkCart,
  onSelectCustomer,
  onClearCustomer,
  onApplyDiscount,
  onClearDiscount,
  onCashPayment,
  onCardPayment,
  onBankTransfer,
  onMultiPayment,
}: POSCartPanelProps) {
  return (
    <div className="w-96 border-l bg-card flex flex-col">
      {/* Cart Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="font-semibold">Winkelwagen</h2>
          {cart.length > 0 && (
            <Badge variant="secondary">{cart.length}</Badge>
          )}
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearCart}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Customer & Discount Bar */}
      {(selectedCustomer || cartDiscount) && (
        <div className="px-4 py-2 border-b bg-muted/30 space-y-1">
          {selectedCustomer && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {selectedCustomer.company_name ||
                    `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() ||
                    selectedCustomer.email}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onClearCustomer}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {cartDiscount && (
            <div className="flex items-center justify-between text-sm text-green-600">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {cartDiscount.type === 'percentage'
                    ? `${cartDiscount.value}% korting`
                    : `€${cartDiscount.value} korting`}
                  {cartDiscount.reason && ` (${cartDiscount.reason})`}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onClearDiscount}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
            <p>Winkelwagen is leeg</p>
            <p className="text-sm">Scan een product of gebruik snelknoppen</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-12 h-12 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => onRemoveItem(item.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Cart Footer */}
      <div className="border-t p-4 space-y-4">
        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotaal</span>
            <span>{formatCurrency(cartTotals.subtotal)}</span>
          </div>
          {cartTotals.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Korting</span>
              <span>-{formatCurrency(cartTotals.discount)}</span>
            </div>
          )}
          {/* Tax breakdown per rate */}
          {cartTotals.taxBreakdown.length <= 1 ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                BTW ({cartTotals.taxBreakdown[0]?.rate ?? 21}%)
              </span>
              <span>{formatCurrency(cartTotals.taxTotal)}</span>
            </div>
          ) : (
            cartTotals.taxBreakdown.map((tb) => (
              <div key={tb.rate} className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTW {tb.rate}%</span>
                <span>{formatCurrency(tb.tax)}</span>
              </div>
            ))
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Totaal</span>
            <span>{formatCurrency(cartTotals.total)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" disabled={cart.length === 0} onClick={onParkCart}>
            <PauseCircle className="mr-2 h-4 w-4" />
            Parkeren
          </Button>
          <Button variant={selectedCustomer ? 'secondary' : 'outline'} onClick={onSelectCustomer}>
            <User className="mr-2 h-4 w-4" />
            {selectedCustomer ? 'Klant ✓' : 'Klant'}
          </Button>
          <Button variant={cartDiscount ? 'secondary' : 'outline'} disabled={cart.length === 0} onClick={onApplyDiscount}>
            <Percent className="mr-2 h-4 w-4" />
            {cartDiscount ? 'Korting ✓' : 'Korting'}
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button className="h-14 flex-col gap-1 text-xs" disabled={cart.length === 0} onClick={onCashPayment}>
            <Banknote className="h-5 w-5" />
            Contant
          </Button>
          <Button className="h-14 flex-col gap-1 text-xs" disabled={cart.length === 0 || isStripeProcessing} onClick={onCardPayment}>
            <CreditCard className="h-5 w-5" />
            PIN
          </Button>
          <Button variant="outline" className="h-14 flex-col gap-1 text-xs" disabled={cart.length === 0 || !hasIban} onClick={onBankTransfer}>
            <QrCode className="h-5 w-5" />
            Bank
          </Button>
          <Button variant="secondary" className="h-14 flex-col gap-1 text-xs" disabled={cart.length === 0} onClick={onMultiPayment}>
            <Gift className="h-4 w-4" />
            Meer
          </Button>
        </div>
      </div>
    </div>
  );
}

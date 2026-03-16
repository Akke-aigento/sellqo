import { ShoppingCart, Plus, Minus, X, Banknote, CreditCard, QrCode, Gift, User, Percent, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/utils';
import type { POSCartItem } from '@/types/pos';
import type { Customer } from '@/types/order';
import type { POSDiscount } from '@/components/admin/pos/POSDiscountPanel';
import type { POSCartTotals } from '@/hooks/usePOSCart';

interface POSMobileCartDrawerProps {
  vatHandling?: 'inclusive' | 'exclusive';
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function POSMobileCartDrawer({
  open,
  onOpenChange,
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
}: POSMobileCartDrawerProps) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Winkelwagen
            {totalItems > 0 && <Badge variant="secondary">{totalItems}</Badge>}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Winkelwagen overzicht</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-auto px-4 pb-2">
          {/* Customer & Discount */}
          {(selectedCustomer || cartDiscount) && (
            <div className="mb-3 space-y-1">
              {selectedCustomer && (
                <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
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
                <div className="flex items-center justify-between text-sm text-green-600 p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <span className="truncate">
                    {cartDiscount.type === 'percentage'
                      ? `${cartDiscount.value}% korting`
                      : `€${cartDiscount.value} korting`}
                    {cartDiscount.reason && ` (${cartDiscount.reason})`}
                  </span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onClearDiscount}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Cart Items */}
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-50" />
              <p>Winkelwagen is leeg</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => onRemoveItem(item.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Actions */}
        <div className="border-t px-4 py-3 space-y-3">
          {/* Totals */}
          <div className="space-y-1">
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
            {cartTotals.taxBreakdown.length <= 1 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTW ({cartTotals.taxBreakdown[0]?.rate ?? 21}%)</span>
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

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" disabled={cart.length === 0} onClick={() => { onParkCart(); onOpenChange(false); }}>
              <PauseCircle className="mr-1 h-4 w-4" />
              Park
            </Button>
            <Button variant={selectedCustomer ? 'secondary' : 'outline'} size="sm" onClick={onSelectCustomer}>
              <User className="mr-1 h-4 w-4" />
              Klant
            </Button>
            <Button variant={cartDiscount ? 'secondary' : 'outline'} size="sm" disabled={cart.length === 0} onClick={onApplyDiscount}>
              <Percent className="mr-1 h-4 w-4" />
              Korting
            </Button>
          </div>

          {/* Payment buttons */}
          <div className="grid grid-cols-4 gap-2">
            <Button className="h-12 flex-col gap-1 text-xs" disabled={cart.length === 0} onClick={() => { onCashPayment(); onOpenChange(false); }}>
              <Banknote className="h-4 w-4" />
              Cash
            </Button>
            <Button className="h-12 flex-col gap-1 text-xs" disabled={cart.length === 0 || isStripeProcessing} onClick={() => { onCardPayment(); onOpenChange(false); }}>
              <CreditCard className="h-4 w-4" />
              PIN
            </Button>
            <Button variant="outline" className="h-12 flex-col gap-1 text-xs" disabled={cart.length === 0 || !hasIban} onClick={() => { onBankTransfer(); onOpenChange(false); }}>
              <QrCode className="h-4 w-4" />
              Bank
            </Button>
            <Button variant="secondary" className="h-12 flex-col gap-1 text-xs" disabled={cart.length === 0} onClick={() => { onMultiPayment(); onOpenChange(false); }}>
              <Gift className="h-3 w-3" />
              Meer
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

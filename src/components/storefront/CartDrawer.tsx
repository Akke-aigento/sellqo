import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
  currency?: string;
}

export function CartDrawer({ open, onOpenChange, basePath, currency = 'EUR' }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getSubtotal } = useCart();
  const subtotal = getSubtotal();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Winkelwagen ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-muted-foreground">Je winkelwagen is leeg</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Verder winkelen
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex gap-4">
                    {item.image && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{item.name}</h4>
                      {item.variantTitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.variantTitle}</p>
                      )}
                      <p className="font-semibold text-sm mt-1">
                        {formatCurrency(item.price, currency)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border rounded-md">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="font-semibold text-sm flex-shrink-0">
                      {formatCurrency(item.price * item.quantity, currency)}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-col gap-3 px-6 py-4 border-t">
              <div className="flex justify-between items-center w-full">
                <span className="font-medium">Subtotaal</span>
                <span className="text-lg font-bold">{formatCurrency(subtotal, currency)}</span>
              </div>
              <Button asChild className="w-full" size="lg" onClick={() => onOpenChange(false)}>
                <Link to={`${basePath}/checkout`}>Afrekenen</Link>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                Verder winkelen
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

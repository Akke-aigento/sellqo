import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
  currency?: string;
  tenantId?: string;
}

export function CartDrawer({ open, onOpenChange, basePath, currency = 'EUR', tenantId }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getSubtotal, appliedDiscount, applyDiscountCode, removeDiscountCode } = useCart();
  const subtotal = getSubtotal();
  const discountAmount = appliedDiscount?.calculated_amount || 0;

  const [discountCode, setDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const handleApplyDiscount = async () => {
    const code = discountCode.trim();
    if (!code || !tenantId) return;
    setApplyingDiscount(true);
    try {
      const { data, error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'validate_discount_code',
          tenant_id: tenantId,
          params: { code, subtotal },
        },
      });
      if (error) throw error;
      const result = data?.data || data;
      if (result?.valid) {
        let calcAmount = 0;
        if (result.discount_type === 'percentage') {
          calcAmount = Math.round(subtotal * (result.discount_value / 100) * 100) / 100;
        } else {
          calcAmount = Math.min(result.discount_value, subtotal);
        }
        applyDiscountCode({
          code,
          discount_type: result.discount_type,
          discount_value: result.discount_value,
          applies_to: result.applies_to,
          description: result.description,
          calculated_amount: calcAmount,
        });
        setDiscountCode('');
        toast.success('Kortingscode toegepast!');
      } else {
        toast.error(result?.error || 'Ongeldige kortingscode');
      }
    } catch {
      toast.error('Er ging iets mis bij het valideren van de kortingscode');
    } finally {
      setApplyingDiscount(false);
    }
  };

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
            <ScrollArea className="flex-1 px-6 pr-7">
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex gap-3">
                    {item.image && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{item.name}</h4>
                        <p className="font-semibold text-sm flex-shrink-0 whitespace-nowrap">
                          {formatCurrency(item.price * item.quantity, currency)}
                        </p>
                      </div>
                      {item.variantTitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.variantTitle}</p>
                      )}
                      {item.giftCard ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-primary font-medium">🎁 Cadeaukaart</p>
                          <p className="text-xs text-muted-foreground">
                            Voor: {item.giftCard.recipientName} ({item.giftCard.recipientEmail})
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(item.price, currency)} per stuk
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {!item.giftCard && (
                          <div className="flex items-center border rounded-md">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="!flex-col gap-3 px-6 py-4 border-t sm:flex-col">
              {/* Discount code */}
              {!appliedDiscount ? (
                <div className="flex gap-2 w-full">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Kortingscode"
                    className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                  />
                  <Button
                    variant="outline" size="sm"
                    onClick={handleApplyDiscount}
                    disabled={applyingDiscount || !discountCode.trim()}
                  >
                    {applyingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Toepassen'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
                      {appliedDiscount.code}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDiscountCode()}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Totals */}
              <div className="w-full space-y-1">
                <div className="flex justify-between items-center w-full text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {appliedDiscount && discountAmount > 0 && (
                  <div className="flex justify-between items-center w-full text-sm text-green-600">
                    <span>Korting ({appliedDiscount.discount_type === 'percentage' ? `${appliedDiscount.discount_value}%` : formatCurrency(appliedDiscount.discount_value, currency)})</span>
                    <span>-{formatCurrency(discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center w-full font-medium">
                  <span>Totaal</span>
                  <span className="text-lg font-bold">{formatCurrency(subtotal - discountAmount, currency)}</span>
                </div>
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

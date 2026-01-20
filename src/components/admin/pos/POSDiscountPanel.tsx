import { useState } from 'react';
import { Percent, Euro, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

export interface POSDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  reason?: string;
}

interface POSDiscountPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDiscount: POSDiscount | null;
  cartSubtotal: number;
  onApplyDiscount: (discount: POSDiscount | null) => void;
}

export function POSDiscountPanel({
  open,
  onOpenChange,
  currentDiscount,
  cartSubtotal,
  onApplyDiscount,
}: POSDiscountPanelProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    currentDiscount?.type || 'percentage'
  );
  const [discountValue, setDiscountValue] = useState(
    currentDiscount?.value.toString() || ''
  );
  const [reason, setReason] = useState(currentDiscount?.reason || '');

  const parsedValue = parseFloat(discountValue) || 0;
  
  const calculatedDiscount = discountType === 'percentage'
    ? (cartSubtotal * parsedValue) / 100
    : parsedValue;
    
  const discountExceedsTotal = calculatedDiscount > cartSubtotal;
  const isValidDiscount = parsedValue > 0 && !discountExceedsTotal;

  const handleApply = () => {
    if (!isValidDiscount) return;
    
    onApplyDiscount({
      type: discountType,
      value: parsedValue,
      reason: reason || undefined,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    onApplyDiscount(null);
    setDiscountValue('');
    setReason('');
    onOpenChange(false);
  };

  const quickPercentages = [5, 10, 15, 20, 25];
  const quickAmounts = [1, 2, 5, 10, 20];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Korting Toepassen
          </DialogTitle>
        </DialogHeader>

        {/* Current Discount Display */}
        {currentDiscount && (
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">
                Huidige korting: {currentDiscount.type === 'percentage' 
                  ? `${currentDiscount.value}%` 
                  : formatCurrency(currentDiscount.value)}
              </p>
              {currentDiscount.reason && (
                <p className="text-sm text-muted-foreground">{currentDiscount.reason}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Tabs 
          value={discountType} 
          onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="percentage" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Percentage
            </TabsTrigger>
            <TabsTrigger value="fixed" className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Vast bedrag
            </TabsTrigger>
          </TabsList>

          <TabsContent value="percentage" className="space-y-4 mt-4">
            {/* Quick Select */}
            <div className="flex flex-wrap gap-2">
              {quickPercentages.map((pct) => (
                <Button
                  key={pct}
                  variant={parsedValue === pct ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountValue(pct.toString())}
                >
                  {pct}%
                </Button>
              ))}
            </div>

            {/* Manual Input */}
            <div>
              <Label htmlFor="percentageValue">Of voer percentage in</Label>
              <div className="relative mt-1">
                <Input
                  id="percentageValue"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fixed" className="space-y-4 mt-4">
            {/* Quick Select */}
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={parsedValue === amount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountValue(amount.toString())}
                >
                  €{amount}
                </Button>
              ))}
            </div>

            {/* Manual Input */}
            <div>
              <Label htmlFor="fixedValue">Of voer bedrag in</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
                <Input
                  id="fixedValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Reason */}
        <div>
          <Label htmlFor="reason">Reden (optioneel)</Label>
          <Input
            id="reason"
            placeholder="Bijv: Klantkorting, Beschadigde verpakking..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Preview */}
        {parsedValue > 0 && (
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotaal</span>
              <span>{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Korting</span>
              <span>-{formatCurrency(Math.min(calculatedDiscount, cartSubtotal))}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Nieuw subtotaal</span>
              <span>{formatCurrency(Math.max(0, cartSubtotal - calculatedDiscount))}</span>
            </div>
          </div>
        )}

        {discountExceedsTotal && (
          <p className="text-sm text-destructive">
            Korting kan niet hoger zijn dan het subtotaal
          </p>
        )}

        <DialogFooter className="gap-2">
          {currentDiscount && (
            <Button variant="ghost" onClick={handleClear} className="mr-auto">
              Verwijderen
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleApply} disabled={!isValidDiscount}>
            Toepassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

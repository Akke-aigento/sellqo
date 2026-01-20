import { useState, useMemo } from 'react';
import { 
  Banknote, 
  CreditCard, 
  Gift, 
  Star, 
  Loader2,
  ChevronRight,
  Check,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { POSGiftCardInput, AppliedGiftCard } from './POSGiftCardInput';
import { POSLoyaltyPanel } from './POSLoyaltyPanel';
import { formatCurrency } from '@/lib/utils';

interface POSMultiPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  customerId: string | null;
  onPaymentComplete: (paymentData: MultiPaymentData) => void;
  isProcessing?: boolean;
}

export interface MultiPaymentData {
  giftCards: AppliedGiftCard[];
  loyaltyPoints: number;
  loyaltyEuroValue: number;
  cashAmount: number;
  cashReceived: number;
  cashChange: number;
  cardAmount: number;
  finalPaymentMethod: 'cash' | 'card';
}

export function POSMultiPaymentDialog({
  open,
  onOpenChange,
  total,
  customerId,
  onPaymentComplete,
  isProcessing = false,
}: POSMultiPaymentDialogProps) {
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyEuroValue, setLoyaltyEuroValue] = useState(0);
  const [cashReceived, setCashReceived] = useState('');
  const [activeTab, setActiveTab] = useState('giftcard');

  // Calculate remaining amount after gift cards and loyalty
  const giftCardTotal = useMemo(() => 
    appliedGiftCards.reduce((sum, c) => sum + c.amountToUse, 0),
    [appliedGiftCards]
  );

  const remainingAmount = useMemo(() => 
    Math.max(0, total - giftCardTotal - loyaltyEuroValue),
    [total, giftCardTotal, loyaltyEuroValue]
  );

  const cashReceivedAmount = parseFloat(cashReceived) || 0;
  const cashChange = Math.max(0, cashReceivedAmount - remainingAmount);

  // Gift card handlers
  const handleAddGiftCard = (card: AppliedGiftCard) => {
    setAppliedGiftCards(prev => [...prev, card]);
  };

  const handleRemoveGiftCard = (cardId: string) => {
    setAppliedGiftCards(prev => prev.filter(c => c.id !== cardId));
  };

  const handleUpdateGiftCardAmount = (cardId: string, amount: number) => {
    setAppliedGiftCards(prev =>
      prev.map(c => c.id === cardId ? { ...c, amountToUse: amount } : c)
    );
  };

  // Loyalty handler
  const handleLoyaltyChange = (points: number, euroValue: number) => {
    setLoyaltyPoints(points);
    setLoyaltyEuroValue(euroValue);
  };

  // Payment handlers
  const handleCashPayment = () => {
    if (remainingAmount > 0 && cashReceivedAmount < remainingAmount) return;

    onPaymentComplete({
      giftCards: appliedGiftCards,
      loyaltyPoints,
      loyaltyEuroValue,
      cashAmount: remainingAmount,
      cashReceived: cashReceivedAmount,
      cashChange,
      cardAmount: 0,
      finalPaymentMethod: 'cash',
    });
  };

  const handleCardPayment = () => {
    onPaymentComplete({
      giftCards: appliedGiftCards,
      loyaltyPoints,
      loyaltyEuroValue,
      cashAmount: 0,
      cashReceived: 0,
      cashChange: 0,
      cardAmount: remainingAmount,
      finalPaymentMethod: 'card',
    });
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAppliedGiftCards([]);
      setLoyaltyPoints(0);
      setLoyaltyEuroValue(0);
      setCashReceived('');
      setActiveTab('giftcard');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Betaling</DialogTitle>
          <DialogDescription>
            Kies betaalmethode(s) voor dit bedrag
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex justify-between">
            <span>Totaal</span>
            <span className="font-bold">{formatCurrency(total)}</span>
          </div>
          
          {giftCardTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Cadeaukaarten
              </span>
              <span>-{formatCurrency(giftCardTotal)}</span>
            </div>
          )}
          
          {loyaltyEuroValue > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                Loyalty ({loyaltyPoints} punten)
              </span>
              <span>-{formatCurrency(loyaltyEuroValue)}</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between text-lg font-bold">
            <span>Te betalen</span>
            <span>{formatCurrency(remainingAmount)}</span>
          </div>
        </div>

        {/* Payment Options */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="giftcard" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Cadeaukaart
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Loyalty
            </TabsTrigger>
          </TabsList>

          <TabsContent value="giftcard" className="mt-4">
            <POSGiftCardInput
              appliedCards={appliedGiftCards}
              onAddCard={handleAddGiftCard}
              onRemoveCard={handleRemoveGiftCard}
              onUpdateAmount={handleUpdateGiftCardAmount}
              maxAmount={total - loyaltyEuroValue}
            />
          </TabsContent>

          <TabsContent value="loyalty" className="mt-4">
            <POSLoyaltyPanel
              customerId={customerId}
              pointsToRedeem={loyaltyPoints}
              onPointsChange={handleLoyaltyChange}
              maxRedeemValue={total - giftCardTotal}
            />
          </TabsContent>
        </Tabs>

        {/* Final Payment */}
        {remainingAmount > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label>Restbedrag betalen</Label>
              
              {/* Cash option */}
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  <span className="font-medium">Contant</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Ontvangen bedrag"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    step={0.01}
                    min={0}
                  />
                  <Button 
                    onClick={handleCashPayment}
                    disabled={isProcessing || (remainingAmount > 0 && cashReceivedAmount < remainingAmount)}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Betalen
                      </>
                    )}
                  </Button>
                </div>
                {cashReceivedAmount > 0 && cashReceivedAmount >= remainingAmount && (
                  <p className="text-sm text-muted-foreground">
                    Wisselgeld: {formatCurrency(cashChange)}
                  </p>
                )}
              </div>

              {/* Card option */}
              <Button 
                variant="outline" 
                className="w-full h-12"
                onClick={handleCardPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                PIN / Kaart - {formatCurrency(remainingAmount)}
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Fully paid with gift cards / loyalty */}
        {remainingAmount === 0 && (
          <DialogFooter>
            <Button onClick={handleCashPayment} disabled={isProcessing} className="w-full">
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Betaling Afronden
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

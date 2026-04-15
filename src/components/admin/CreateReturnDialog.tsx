import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronDown, ChevronUp, RotateCcw, AlertTriangle, CalendarIcon, Info, ShoppingBag, Store, Globe } from 'lucide-react';
import { useReturnMutations, type ReturnItemInput } from '@/hooks/useReturns';
import { useReturnSettings } from '@/hooks/useReturnSettings';
import { calculateActualItemPrice, calculateItemRefundAmount } from '@/lib/returnPricing';

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
  quantity: number;
  price: number; // catalog unit_price
  already_returned?: number;
}

interface CreateReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string;
  customerName?: string;
  orderItems: OrderItem[];
  paymentMethod?: string;
  orderSource?: string;
  marketplaceConnectionId?: string;
  shippingCost?: number;
  orderSubtotal?: number;
  orderDiscountAmount?: number;
  orderDiscountCode?: string;
}

const REASON_LABELS: Record<string, string> = {
  defect: 'Defect',
  damaged_in_transit: 'Beschadigd bij transport',
  wrong_product: 'Verkeerd product ontvangen',
  wrong_size: 'Verkeerde maat',
  not_as_described: 'Niet zoals beschreven',
  changed_mind: 'Bedacht / niet nodig',
  late_delivery: 'Te late levering',
  duplicate_order: 'Dubbele bestelling',
  other: 'Anders',
};

const CONDITION_OPTIONS = [
  { value: 'new_unopened', label: 'Nieuw / ongeopend' },
  { value: 'opened_unused', label: 'Geopend, ongebruikt' },
  { value: 'used_good', label: 'Gebruikt, goede staat' },
  { value: 'damaged', label: 'Beschadigd' },
  { value: 'defective', label: 'Defect' },
];

interface ItemDetail {
  selected: boolean;
  quantity: number;
  reasonCode: string;
  reasonNotes: string;
  condition: string;
  restock: boolean;
  restockingFee: number;
  refundAmount: number;
  expanded: boolean;
  restockOverridden: boolean;
  restockingFeeOverridden: boolean;
  refundAmountOverridden: boolean;
}

function DefaultIndicator({ isOverridden, onReset }: { isOverridden: boolean; onReset: () => void }) {
  if (!isOverridden) {
    return <p className="text-xs text-muted-foreground mt-0.5">Standaard ingesteld</p>;
  }
  return (
    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
      Aangepast voor deze retour
      <button type="button" onClick={onReset} className="hover:text-amber-800">
        <RotateCcw className="h-3 w-3" />
      </button>
    </p>
  );
}

export function CreateReturnDialog({
  open,
  onOpenChange,
  orderId,
  customerId,
  customerName,
  orderItems,
  paymentMethod = 'manual',
  orderSource,
  marketplaceConnectionId,
  shippingCost = 0,
  orderSubtotal,
  orderDiscountAmount,
  orderDiscountCode,
}: CreateReturnDialogProps) {
  const { createReturn } = useReturnMutations();
  const { settings } = useReturnSettings();
  const [step, setStep] = useState(1);

  const defaultRestockingPercent = settings?.default_restocking_fee_percent ?? 0;
  const enabledReasons = settings?.enabled_reason_codes ?? Object.keys(REASON_LABELS);
  const refundShippingDefault = settings?.refund_shipping_by_default ?? true;
  const autoRestockNew = settings?.auto_restock_new_condition ?? true;
  const autoNoRestockDamaged = settings?.auto_no_restock_damaged ?? true;

  // Pre-compute actual prices for all items
  const actualPrices = useMemo(() =>
    orderItems.map((oi) =>
      calculateActualItemPrice(oi.price, orderSubtotal, orderDiscountAmount)
    ), [orderItems, orderSubtotal, orderDiscountAmount]
  );

  const hasDiscount = (orderDiscountAmount ?? 0) > 0;

  const [items, setItems] = useState<ItemDetail[]>(() =>
    orderItems.map((oi, idx) => {
      const maxQty = oi.quantity - (oi.already_returned || 0);
      const actualPrice = calculateActualItemPrice(oi.price, orderSubtotal, orderDiscountAmount);
      const fee = (actualPrice * defaultRestockingPercent) / 100;
      return {
        selected: false,
        quantity: Math.max(1, maxQty),
        reasonCode: '',
        reasonNotes: '',
        condition: 'new_unopened',
        restock: autoRestockNew,
        restockingFee: Math.round(fee * 100) / 100,
        refundAmount: calculateItemRefundAmount(Math.max(1, maxQty), actualPrice, fee),
        expanded: false,
        restockOverridden: false,
        restockingFeeOverridden: false,
        refundAmountOverridden: false,
      };
    })
  );

  const [refundShipping, setRefundShipping] = useState(refundShippingDefault);
  const [refundShippingOverridden, setRefundShippingOverridden] = useState(false);
  const [coulanceAmount, setCoulanceAmount] = useState(0);
  const [internalNotes, setInternalNotes] = useState('');
  const [expectedArrival, setExpectedArrival] = useState<Date | undefined>();

  const selectedItems = items.filter((it) => it.selected);

  const updateItem = useCallback((index: number, updates: Partial<ItemDetail>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const recalcRefundAmount = (index: number, qty: number, fee: number) => {
    return calculateItemRefundAmount(qty, actualPrices[index], fee);
  };

  const handleConditionChange = (index: number, condition: string) => {
    const isDamaged = condition === 'damaged' || condition === 'defective';
    const item = items[index];
    const newRestock = item.restockOverridden
      ? item.restock
      : isDamaged && autoNoRestockDamaged
        ? false
        : autoRestockNew;
    updateItem(index, { condition, restock: newRestock });
  };

  // Totals using actual prices
  const subtotalItems = selectedItems.reduce((s, it) => {
    const origIdx = items.indexOf(it);
    return s + it.quantity * actualPrices[origIdx];
  }, 0);

  const totalRestockingFees = selectedItems.reduce(
    (s, it) => s + it.restockingFee * it.quantity,
    0
  );

  const shippingRefundAmount = refundShipping ? shippingCost : 0;

  const totalRefund = selectedItems.reduce((s, it) => s + it.refundAmount, 0) +
    shippingRefundAmount + coulanceAmount;

  // Marketplace detection
  const isMarketplace = orderSource && orderSource !== 'sellqo' && orderSource !== 'pos';
  const marketplaceName = orderSource === 'bolcom' || orderSource === 'bol_com'
    ? 'Bol.com'
    : orderSource === 'amazon'
      ? 'Amazon'
      : orderSource === 'shopify'
        ? 'Shopify'
        : orderSource === 'woocommerce'
          ? 'WooCommerce'
          : orderSource || 'Marketplace';

  const detectRefundMethod = () => {
    if (!orderSource || orderSource === 'sellqo' || orderSource === 'pos' || paymentMethod === 'stripe') return 'stripe';
    if (orderSource === 'bolcom' || orderSource === 'bol_com') return 'bolcom';
    if (orderSource === 'amazon') return 'amazon';
    if (orderSource === 'shopify') return 'shopify';
    if (orderSource === 'woocommerce') return 'woocommerce';
    return 'manual';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

  const canProceedStep1 = selectedItems.length > 0 && selectedItems.every((it) => it.reasonCode);

  const handleSubmit = () => {
    const returnItems: ReturnItemInput[] = [];
    items.forEach((it, idx) => {
      if (!it.selected) return;
      const oi = orderItems[idx];
      const actualPrice = actualPrices[idx];
      returnItems.push({
        order_item_id: oi.id,
        product_id: oi.product_id,
        variant_id: oi.variant_id,
        product_name: oi.product_name,
        variant_title: oi.variant_name,
        sku: oi.sku,
        quantity: it.quantity,
        unit_price: actualPrice,
        line_total: it.quantity * actualPrice,
        reason_code: it.reasonCode,
        reason_notes: it.reasonNotes || undefined,
        condition: it.condition,
        restock: it.restock,
        restocking_fee: it.restockingFee,
        refund_amount: it.refundAmount,
      });
    });

    createReturn.mutate(
      {
        order_id: orderId,
        customer_id: customerId,
        customer_name: customerName,
        items: returnItems,
        refund_amount: totalRefund,
        refund_method: detectRefundMethod(),
        internal_notes: internalNotes || undefined,
        subtotal: subtotalItems,
        restocking_fees_total: totalRestockingFees,
        shipping_refund: shippingRefundAmount,
        expected_arrival_date: expectedArrival?.toISOString(),
        source: 'manual',
        marketplace_connection_id: marketplaceConnectionId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setStep(1);
        },
      }
    );
  };

  const resetDialog = () => {
    setStep(1);
    setItems(
      orderItems.map((oi, idx) => {
        const maxQty = oi.quantity - (oi.already_returned || 0);
        const actualPrice = calculateActualItemPrice(oi.price, orderSubtotal, orderDiscountAmount);
        const fee = (actualPrice * defaultRestockingPercent) / 100;
        return {
          selected: false,
          quantity: Math.max(1, maxQty),
          reasonCode: '',
          reasonNotes: '',
          condition: 'new_unopened',
          restock: autoRestockNew,
          restockingFee: Math.round(fee * 100) / 100,
          refundAmount: calculateItemRefundAmount(Math.max(1, maxQty), actualPrice, fee),
          expanded: false,
          restockOverridden: false,
          restockingFeeOverridden: false,
          refundAmountOverridden: false,
        };
      })
    );
    setRefundShipping(refundShippingDefault);
    setRefundShippingOverridden(false);
    setCoulanceAmount(0);
    setInternalNotes('');
    setExpectedArrival(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Retour aanmaken
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                  step === s ? 'bg-primary text-primary-foreground' :
                    step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {s}
                </div>
                <span className={cn('text-xs', step === s ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {s === 1 ? 'Producten' : s === 2 ? 'Samenvatting' : 'Bevestiging'}
                </span>
                {s < 3 && <Separator className="w-6" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* STEP 1: Product selection */}
        {step === 1 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Selecteer producten om te retourneren</Label>
            {hasDiscount && (
              <Alert className="py-2">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Deze order had {formatCurrency(orderDiscountAmount!)} korting{orderDiscountCode ? ` (${orderDiscountCode})` : ''}. Refund bedragen zijn berekend op basis van de werkelijke betaalde prijs.
                </AlertDescription>
              </Alert>
            )}
            <TooltipProvider>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {orderItems.map((oi, index) => {
                  const item = items[index];
                  const maxQty = oi.quantity - (oi.already_returned || 0);
                  const actualPrice = actualPrices[index];
                  const pricesDiffer = hasDiscount && Math.abs(oi.price - actualPrice) > 0.01;

                  if (maxQty <= 0) return (
                    <div key={index} className="p-3 border rounded-md opacity-50">
                      <p className="text-sm">{oi.product_name} — <span className="text-xs text-muted-foreground">Volledig geretourneerd</span></p>
                    </div>
                  );

                  return (
                    <div key={index} className="border rounded-md">
                      <div className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(checked) => updateItem(index, { selected: !!checked, expanded: !!checked })}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{oi.product_name}</p>
                          {oi.variant_name && <p className="text-xs text-muted-foreground">{oi.variant_name}</p>}
                          <div className="flex items-center gap-1">
                            {pricesDiffer ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground cursor-help">
                                    <span className="line-through">{formatCurrency(oi.price)}</span>{' '}
                                    <span className="text-foreground font-medium">{formatCurrency(actualPrice)}</span>
                                    {' '}× max {maxQty}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Originele prijs {formatCurrency(oi.price)}, na proportionele korting {formatCurrency(actualPrice)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">{formatCurrency(oi.price)} × max {maxQty}</span>
                            )}
                          </div>
                        </div>
                        {item.selected && (
                          <>
                            <Input
                              type="number"
                              min={1}
                              max={maxQty}
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Math.min(Math.max(1, Number(e.target.value)), maxQty);
                                const refund = item.refundAmountOverridden
                                  ? item.refundAmount
                                  : recalcRefundAmount(index, qty, item.restockingFee);
                                updateItem(index, { quantity: qty, refundAmount: refund });
                              }}
                              className="w-16"
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(index, { expanded: !item.expanded })}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {item.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>

                      {item.selected && item.expanded && (
                        <div className="px-3 pb-3 pt-1 border-t space-y-3">
                          <div>
                            <Label className="text-xs">Reden *</Label>
                            <Select value={item.reasonCode} onValueChange={(v) => updateItem(index, { reasonCode: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Selecteer reden..." />
                              </SelectTrigger>
                              <SelectContent>
                                {enabledReasons.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    {REASON_LABELS[code] || code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Toelichting</Label>
                            <Textarea
                              value={item.reasonNotes}
                              onChange={(e) => updateItem(index, { reasonNotes: e.target.value })}
                              placeholder="Optionele toelichting..."
                              rows={2}
                              className="text-sm"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Conditie</Label>
                            <Select value={item.condition} onValueChange={(v) => handleConditionChange(index, v)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Terug op voorraad</Label>
                              <DefaultIndicator
                                isOverridden={item.restockOverridden}
                                onReset={() => {
                                  const isDamaged = item.condition === 'damaged' || item.condition === 'defective';
                                  const defaultRestock = isDamaged && autoNoRestockDamaged ? false : autoRestockNew;
                                  updateItem(index, { restock: defaultRestock, restockOverridden: false });
                                }}
                              />
                            </div>
                            <Switch
                              checked={item.restock}
                              onCheckedChange={(checked) => updateItem(index, { restock: checked, restockOverridden: true })}
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Restocking fee (per stuk)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.restockingFee}
                              onChange={(e) => {
                                const fee = Math.max(0, Number(e.target.value));
                                const refund = item.refundAmountOverridden
                                  ? item.refundAmount
                                  : recalcRefundAmount(index, item.quantity, fee);
                                updateItem(index, {
                                  restockingFee: fee,
                                  restockingFeeOverridden: true,
                                  refundAmount: refund,
                                });
                              }}
                              className="h-8 text-sm w-28"
                            />
                            <DefaultIndicator
                              isOverridden={item.restockingFeeOverridden}
                              onReset={() => {
                                const fee = (actualPrices[index] * defaultRestockingPercent) / 100;
                                const refund = item.refundAmountOverridden
                                  ? item.refundAmount
                                  : recalcRefundAmount(index, item.quantity, fee);
                                updateItem(index, { restockingFee: Math.round(fee * 100) / 100, restockingFeeOverridden: false, refundAmount: refund });
                              }}
                            />
                            {item.restock && item.restockingFee > 0 && (
                              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                Item wordt als verkoopbaar teruggeboekt maar je rekent restocking fee
                              </p>
                            )}
                          </div>

                          <div>
                            <Label className="text-xs">Refund bedrag (totaal voor dit item)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.refundAmount}
                              onChange={(e) => updateItem(index, {
                                refundAmount: Math.max(0, Number(e.target.value)),
                                refundAmountOverridden: true,
                              })}
                              className="h-8 text-sm w-32"
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Berekend: {formatCurrency(recalcRefundAmount(index, item.quantity, item.restockingFee))} ({item.quantity} × {formatCurrency(actualPrices[index])} − {formatCurrency(item.restockingFee)} fee)
                            </p>
                            <DefaultIndicator
                              isOverridden={item.refundAmountOverridden}
                              onReset={() => {
                                updateItem(index, {
                                  refundAmount: recalcRefundAmount(index, item.quantity, item.restockingFee),
                                  refundAmountOverridden: false,
                                });
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* STEP 2: Shipping + Summary */}
        {step === 2 && (
          <div className="space-y-4">
            {shippingCost > 0 && (
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <Label className="text-sm">Verzendkosten ook terugbetalen?</Label>
                  <p className="text-xs text-muted-foreground">Inclusief {formatCurrency(shippingCost)} verzendkosten</p>
                  <DefaultIndicator
                    isOverridden={refundShippingOverridden}
                    onReset={() => {
                      setRefundShipping(refundShippingDefault);
                      setRefundShippingOverridden(false);
                    }}
                  />
                </div>
                <Switch
                  checked={refundShipping}
                  onCheckedChange={(v) => { setRefundShipping(v); setRefundShippingOverridden(true); }}
                />
              </div>
            )}

            <div>
              <Label className="text-sm">Coulance / extra bedrag (optioneel)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={coulanceAmount || ''}
                onChange={(e) => setCoulanceAmount(Math.max(0, Number(e.target.value)))}
                placeholder="€ 0,00"
                className="w-32"
              />
            </div>

            <Separator />

            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotaal items{hasDiscount ? ' (na korting)' : ''}</span>
                  <span>{formatCurrency(subtotalItems)}</span>
                </div>
                {totalRestockingFees > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Restocking fees</span>
                    <span>-{formatCurrency(totalRestockingFees)}</span>
                  </div>
                )}
                {shippingRefundAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Verzendkosten refund</span>
                    <span>{formatCurrency(shippingRefundAmount)}</span>
                  </div>
                )}
                {coulanceAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Coulance</span>
                    <span>{formatCurrency(coulanceAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Totaal refund</span>
                  <span className="text-primary">{formatCurrency(totalRefund)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{selectedItems.length} item(s) geselecteerd</Label>
              {selectedItems.map((it) => {
                const origIdx = items.indexOf(it);
                const oi = orderItems[origIdx];
                return (
                  <div key={origIdx} className="flex justify-between text-sm py-1">
                    <span className="truncate">{it.quantity}× {oi.product_name}</span>
                    <span>{formatCurrency(it.refundAmount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Notes + Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            {isMarketplace && (
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <ShoppingBag className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Deze order komt van {marketplaceName}.</span>{' '}
                  De refund verloopt via hun platform conform je instellingen. SellQo registreert de retour intern.
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Refund modus: {settings?.marketplace_refund_mode === 'auto_via_api'
                      ? 'Automatisch via API (komt in fase 2/3)'
                      : `Handmatig via ${marketplaceName} dashboard`
                    }
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label className="text-sm">Interne notities</Label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Alleen zichtbaar voor admins..."
                rows={3}
              />
            </div>

            <div>
              <Label className="text-sm">Verwachte aankomstdatum (optioneel)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[200px] justify-start text-left font-normal', !expectedArrival && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedArrival ? format(expectedArrival, 'd MMM yyyy', { locale: nl }) : 'Kies datum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expectedArrival}
                    onSelect={setExpectedArrival}
                    disabled={(date) => date < new Date()}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Totaal refund</span>
                  <span className="text-primary">{formatCurrency(totalRefund)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedItems.length} product(en) · Methode: {detectRefundMethod()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Vorige
            </Button>
          )}
          <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }}>
            Annuleren
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canProceedStep1}
            >
              Volgende
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createReturn.isPending}
            >
              {createReturn.isPending ? 'Bezig...' : 'Retour aanmaken'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

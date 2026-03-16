import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Settings,
  LogOut,
  Receipt,
  Wifi,
  WifiOff,
  CreditCard,
  PauseCircle,
  TrendingUp,
  BarChart3,
  ListOrdered,
  CloudOff,
  RefreshCw,
  Loader2,
  ShoppingCart,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePOSTerminals, usePOSSessions, usePOSTransactions, usePOSQuickButtons, usePOSParkedCarts, usePOSCashMovements } from '@/hooks/usePOS';
import { useProducts } from '@/hooks/useProducts';
import { useStripeTerminal } from '@/hooks/useStripeTerminal';
import { usePOSOffline, OfflineTransaction } from '@/hooks/usePOSOffline';
import { usePOSLoyalty } from '@/hooks/usePOSLoyalty';
import { usePOSCart } from '@/hooks/usePOSCart';
import { useVatRates } from '@/hooks/useVatRates';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

// POS Components
import { POSProductPanel } from '@/components/admin/pos/POSProductPanel';
import { POSCartPanel } from '@/components/admin/pos/POSCartPanel';
import { POSMobileCartDrawer } from '@/components/admin/pos/POSMobileCartDrawer';
import { CardPaymentDialog } from '@/components/admin/pos/CardPaymentDialog';
import { StripeReaderDialog } from '@/components/admin/pos/StripeReaderDialog';
import { QuickButtonDialog } from '@/components/admin/pos/QuickButtonDialog';
import { ReceiptDialog } from '@/components/admin/pos/ReceiptDialog';
import { SessionReportDialog } from '@/components/admin/pos/SessionReportDialog';
import { CashMovementDialog } from '@/components/admin/pos/CashMovementDialog';
import { POSCustomerDialog } from '@/components/admin/pos/POSCustomerDialog';
import { POSDiscountPanel } from '@/components/admin/pos/POSDiscountPanel';
import { POSMultiPaymentDialog, MultiPaymentData } from '@/components/admin/pos/POSMultiPaymentDialog';
import { POSRefundDialog } from '@/components/admin/pos/POSRefundDialog';
import { POSTransactionHistory } from '@/components/admin/pos/POSTransactionHistory';
import { POSGiftCardSellDialog } from '@/components/admin/pos/POSGiftCardSellDialog';
import { POSBankTransferDialog } from '@/components/admin/pos/POSBankTransferDialog';

import type { POSCartItem, POSPayment, POSTransaction } from '@/types/pos';
import type { GiftCard } from '@/types/giftCard';
import type { Product } from '@/types/product';

export default function POSTerminalPage({ standalone = false }: { standalone?: boolean }) {
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();

  // Core hooks
  const { terminals, updateTerminal } = usePOSTerminals();
  const { activeSession, openSession, closeSession } = usePOSSessions(terminalId);
  const { transactions, createTransaction, refundTransaction } = usePOSTransactions(activeSession?.id);
  const { movements: cashMovements, createMovement } = usePOSCashMovements(activeSession?.id);
  const { buttons: quickButtons } = usePOSQuickButtons(terminalId);
  const { parkedCarts, parkCart, resumeCart } = usePOSParkedCarts(terminalId);
  const { products } = useProducts();
  const { readers, listReaders, isProcessing: isStripeProcessing } = useStripeTerminal();
  const { earnPoints, redeemPoints } = usePOSLoyalty();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { vatRates } = useVatRates();

  const terminal = terminals.find(t => t.id === terminalId);
  const defaultTaxRate = terminal?.settings?.default_tax_rate ?? 21;

  // VAT rate lookup map: vat_rate_id -> rate percentage
  const vatRateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const vr of vatRates) {
      map.set(vr.id, vr.rate);
    }
    return map;
  }, [vatRates]);

  // Cart hook with dynamic tax
  const {
    cart, setCart, cartTotals,
    selectedCustomer, setSelectedCustomer,
    cartDiscount, setCartDiscount,
    lastTransaction, setLastTransaction,
    lastPaymentWasCash, setLastPaymentWasCash,
    addToCart: addToCartRaw,
    updateQuantity, removeItem, clearCart,
  } = usePOSCart({ defaultTaxRate });

  // Wrap addToCart to inject product vat_rate
  const addToCart = useCallback((product: Product) => {
    const vatRate = product.vat_rate_id ? vatRateMap.get(product.vat_rate_id) : undefined;
    addToCartRaw(product, vatRate);
  }, [addToCartRaw, vatRateMap]);

  // Offline sync
  const handleSyncTransaction = useCallback(async (offlineTxn: OfflineTransaction): Promise<POSTransaction | null> => {
    try {
      const { data, error } = await supabase
        .from('pos_transactions')
        .insert([{
          tenant_id: offlineTxn.tenantId,
          terminal_id: offlineTxn.terminalId,
          session_id: offlineTxn.sessionId,
          cashier_id: offlineTxn.cashierId,
          customer_id: offlineTxn.customerId || null,
          items: JSON.parse(JSON.stringify(offlineTxn.items)),
          payments: JSON.parse(JSON.stringify(offlineTxn.payments)),
          cash_received: offlineTxn.cashReceived || null,
          cash_change: offlineTxn.cashChange || null,
          subtotal: offlineTxn.subtotal,
          discount_total: offlineTxn.discountTotal,
          tax_total: offlineTxn.taxTotal,
          total: offlineTxn.total,
          status: 'completed',
        }])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as POSTransaction;
    } catch (error) {
      console.error('Failed to sync offline transaction:', error);
      throw error;
    }
  }, []);

  const { isOnline, pendingCount, isSyncing, saveForOffline, syncAll } = usePOSOffline({
    terminalId,
    tenantId: currentTenant?.id,
    userId: user?.id,
    onSyncTransaction: handleSyncTransaction,
    enabled: !!activeSession,
  });

  // Dialog state
  const [searchQuery, setSearchQuery] = useState('');
  const [showOpenSessionDialog, setShowOpenSessionDialog] = useState(false);
  const [showCloseSessionDialog, setShowCloseSessionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCardPaymentDialog, setShowCardPaymentDialog] = useState(false);
  const [showReaderDialog, setShowReaderDialog] = useState(false);
  const [showQuickButtonDialog, setShowQuickButtonDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showSessionReportDialog, setShowSessionReportDialog] = useState(false);
  const [showCashMovementDialog, setShowCashMovementDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [showMultiPaymentDialog, setShowMultiPaymentDialog] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showGiftCardSellDialog, setShowGiftCardSellDialog] = useState(false);
  const [showBankTransferDialog, setShowBankTransferDialog] = useState(false);
  const [showParkedCartsDialog, setShowParkedCartsDialog] = useState(false);
  const [showMobileCartDrawer, setShowMobileCartDrawer] = useState(false);
  const [pendingGiftCard, setPendingGiftCard] = useState<{ giftCard: GiftCard; amount: number } | null>(null);
  const [refundTxn, setRefundTxn] = useState<POSTransaction | null>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedReaderId, setSelectedReaderId] = useState<string | null>(null);

  const isMobile = useIsMobile();

  // Stripe reader init
  useEffect(() => { listReaders(); }, [listReaders]);
  useEffect(() => {
    if (terminal?.stripe_reader_id) setSelectedReaderId(terminal.stripe_reader_id);
  }, [terminal?.stripe_reader_id]);

  const connectedReader = useMemo(() => readers.find(r => r.id === selectedReaderId), [readers, selectedReaderId]);

  // Session auto-open
  useEffect(() => {
    if (terminal && !activeSession && !showOpenSessionDialog) {
      setShowOpenSessionDialog(true);
    }
  }, [terminal, activeSession]);

  // Barcode scanner
  const findProductByBarcode = useCallback((barcode: string): Product | undefined => {
    return products.find(p =>
      p.barcode?.toLowerCase() === barcode.toLowerCase() ||
      p.sku?.toLowerCase() === barcode.toLowerCase()
    );
  }, [products]);

  useBarcodeScanner({
    onScan: (barcode) => {
      const product = findProductByBarcode(barcode);
      if (product) {
        addToCart(product);
        toast.success(`${product.name} toegevoegd`);
        setSearchQuery('');
      } else {
        setSearchQuery(barcode);
        toast.error(`Product niet gevonden: ${barcode}`);
      }
    },
    enabled: !!activeSession,
  });

  // --- Payment handlers ---
  const handleOpenSession = async () => {
    if (!terminalId) return;
    await openSession.mutateAsync({ terminal_id: terminalId, opening_cash: parseFloat(openingCash) || 0 });
    setShowOpenSessionDialog(false);
    setOpeningCash('');
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    await closeSession.mutateAsync({ sessionId: activeSession.id, data: { closing_cash: parseFloat(closingCash) || 0 } });
    setShowCloseSessionDialog(false);
    setClosingCash('');
    setShowSessionReportDialog(true);
  };

  const handleCashMovement = async (data: { movement_type: 'in' | 'out' | 'adjustment'; amount: number; reason: string; notes?: string }) => {
    if (!activeSession || !terminalId) return;
    await createMovement.mutateAsync({ sessionId: activeSession.id, terminalId, data });
    toast.success(data.movement_type === 'in' ? 'Kasstorting geregistreerd' : 'Kasopname geregistreerd');
  };

  const completeTransaction = useCallback(async (payments: POSPayment[], opts: { cashReceived?: number; cashChange?: number; stripePaymentIntentId?: string; cardBrand?: string; cardLast4?: string } = {}) => {
    if (!terminalId) return;
    try {
      const transaction = await createTransaction.mutateAsync({
        terminalId,
        sessionId: activeSession?.id || null,
        items: cart,
        payments,
        cashReceived: opts.cashReceived,
        cashChange: opts.cashChange,
        stripePaymentIntentId: opts.stripePaymentIntentId,
        cardBrand: opts.cardBrand,
        cardLast4: opts.cardLast4,
        customerId: selectedCustomer?.id,
      });

      if (selectedCustomer?.id && cartTotals.total > 0) {
        earnPoints.mutate({
          customerId: selectedCustomer.id,
          orderTotal: cartTotals.total,
          description: `POS transactie #${transaction?.receipt_number || 'onbekend'}`,
        });
      }

      clearCart();
      if (transaction) {
        setLastTransaction(transaction as unknown as POSTransaction);
        setLastPaymentWasCash(payments[0]?.method === 'cash');
        setShowReceiptDialog(true);
      }
      return transaction;
    } catch {
      toast.error('Betaling mislukt');
      return null;
    }
  }, [terminalId, activeSession?.id, cart, selectedCustomer, cartTotals.total, createTransaction, earnPoints, clearCart, setLastTransaction, setLastPaymentWasCash]);

  const handleCashPayment = async () => {
    if (!terminalId || cart.length === 0) return;
    const cashReceivedAmount = parseFloat(cashReceived) || cartTotals.total;
    const cashChangeAmount = Math.max(0, cashReceivedAmount - cartTotals.total);
    const payments: POSPayment[] = [{ method: 'cash', amount: cartTotals.total }];

    if (!isOnline) {
      try {
        const offlineTxn = await saveForOffline({ items: cart, payments, sessionId: activeSession?.id || null, cashReceived: cashReceivedAmount, cashChange: cashChangeAmount, customerId: selectedCustomer?.id });
        if (offlineTxn) {
          toast.success(`Offline verkoop opgeslagen! Wisselgeld: ${formatCurrency(cashChangeAmount)}`, { description: 'Wordt gesynchroniseerd wanneer online.' });
          clearCart();
          setShowPaymentDialog(false);
          setCashReceived('');
        }
      } catch { toast.error('Fout bij offline opslag'); }
      return;
    }

    const txn = await completeTransaction(payments, { cashReceived: cashReceivedAmount, cashChange: cashChangeAmount });
    if (txn) {
      toast.success(`Betaling succesvol! Wisselgeld: ${formatCurrency(cashChangeAmount)}`);
      setShowPaymentDialog(false);
      setCashReceived('');
    }
  };

  const handleCardPaymentSuccess = async (paymentIntentId: string, cardDetails?: { brand: string; last4: string }) => {
    const payments: POSPayment[] = [{ method: 'card', amount: cartTotals.total, reference: paymentIntentId }];
    const txn = await completeTransaction(payments, { stripePaymentIntentId: paymentIntentId, cardBrand: cardDetails?.brand, cardLast4: cardDetails?.last4 });
    if (txn) {
      toast.success('Kaartbetaling succesvol!');
      setShowCardPaymentDialog(false);
    }
  };

  const handleBankTransferPayment = async (ogmReference: string) => {
    const payments: POSPayment[] = [{ method: 'manual', amount: cartTotals.total, reference: ogmReference }];
    const txn = await completeTransaction(payments);
    if (txn) {
      toast.success('Bankoverschrijving geregistreerd!');
      setShowBankTransferDialog(false);
    }
  };

  const handleMultiPaymentComplete = async (paymentData: MultiPaymentData) => {
    if (!terminalId) return;
    const payments: POSPayment[] = [];
    for (const gc of paymentData.giftCards) {
      if (gc.amountToUse > 0) payments.push({ method: 'gift_card', amount: gc.amountToUse, reference: gc.code });
    }
    if (paymentData.loyaltyEuroValue > 0) payments.push({ method: 'loyalty_points', amount: paymentData.loyaltyEuroValue, reference: `${paymentData.loyaltyPoints} punten` });
    if (paymentData.finalPaymentMethod === 'cash' && paymentData.cashAmount > 0) {
      payments.push({ method: 'cash', amount: paymentData.cashAmount });
    } else if (paymentData.finalPaymentMethod === 'card' && paymentData.cardAmount > 0) {
      setShowMultiPaymentDialog(false);
      setShowCardPaymentDialog(true);
      return;
    }

    try {
      const transaction = await createTransaction.mutateAsync({
        terminalId, sessionId: activeSession?.id || null, items: cart, payments,
        cashReceived: paymentData.cashReceived || undefined, cashChange: paymentData.cashChange || undefined,
        customerId: selectedCustomer?.id,
      });
      if (selectedCustomer?.id && paymentData.loyaltyPoints > 0) {
        await redeemPoints.mutateAsync({ customerId: selectedCustomer.id, points: paymentData.loyaltyPoints, euroValue: paymentData.loyaltyEuroValue, description: `POS inwisseling transactie #${transaction?.receipt_number || 'onbekend'}` });
      }
      const actualSpent = cartTotals.total - paymentData.loyaltyEuroValue;
      if (selectedCustomer?.id && actualSpent > 0) {
        earnPoints.mutate({ customerId: selectedCustomer.id, orderTotal: actualSpent, description: `POS transactie #${transaction?.receipt_number || 'onbekend'}` });
      }
      toast.success(paymentData.cashChange > 0 ? `Betaling succesvol! Wisselgeld: ${formatCurrency(paymentData.cashChange)}` : 'Betaling succesvol!');
      clearCart();
      setShowMultiPaymentDialog(false);
      if (transaction) {
        setLastTransaction(transaction as unknown as POSTransaction);
        setLastPaymentWasCash(paymentData.finalPaymentMethod === 'cash');
        setShowReceiptDialog(true);
      }
    } catch { toast.error('Betaling mislukt'); }
  };

  const handleReaderSelect = async (readerId: string) => {
    setSelectedReaderId(readerId);
    if (terminalId) {
      try {
        await updateTerminal.mutateAsync({ id: terminalId, data: { stripe_reader_id: readerId } as unknown as { name?: string } });
        toast.success('Reader gekoppeld aan terminal');
      } catch { /* silent */ }
    }
  };

  const handleParkCart = async () => {
    if (!terminalId || cart.length === 0) return;
    await parkCart.mutateAsync({ terminalId, sessionId: activeSession?.id, items: cart });
    toast.success('Winkelwagen geparkeerd');
    clearCart();
  };

  const handleResumeCart = async (cartId: string) => {
    const resumed = await resumeCart.mutateAsync(cartId);
    if (resumed) { setCart(resumed.items); toast.success('Winkelwagen hervat'); }
    setShowParkedCartsDialog(false);
  };

  if (!terminal) {
    return <div className="flex items-center justify-center min-h-screen"><p>Terminal niet gevonden</p></div>;
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 lg:gap-4">
          {!standalone && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pos')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="font-semibold text-sm lg:text-base">{terminal.name}</h1>
            {activeSession && (
              <p className="text-xs lg:text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">Dag gestart om </span>
                {new Date(activeSession.opened_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 lg:gap-2">
          {!isOnline && <Badge variant="destructive" className="gap-1"><CloudOff className="h-3 w-3" /><span className="hidden sm:inline">Offline</span></Badge>}
          {pendingCount > 0 && (
            <Button variant={isOnline ? 'outline' : 'secondary'} size="sm" onClick={() => isOnline && syncAll()} disabled={isSyncing || !isOnline}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:ml-2 sm:inline">{pendingCount} wachtend</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowReaderDialog(true)} className={cn("hidden sm:flex", connectedReader?.status === 'online' && 'border-green-500')}>
            {connectedReader ? (
              <>{connectedReader.status === 'online' ? <Wifi className="mr-2 h-4 w-4 text-green-500" /> : <WifiOff className="mr-2 h-4 w-4 text-muted-foreground" />}{connectedReader.label}</>
            ) : (
              <><CreditCard className="mr-2 h-4 w-4" />Geen reader</>
            )}
          </Button>
          {parkedCarts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowParkedCartsDialog(true)}>
              <PauseCircle className="h-4 w-4" /><span className="hidden sm:ml-2 sm:inline">Geparkeerd ({parkedCarts.length})</span>
            </Button>
          )}
          {activeSession && (
            <>
              <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => setShowCashMovementDialog(true)}><TrendingUp className="mr-2 h-4 w-4" />Kas +/-</Button>
              <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setShowSessionReportDialog(true)}><BarChart3 className="mr-2 h-4 w-4" />Rapport</Button>
              <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setShowTransactionHistory(true)}><ListOrdered className="mr-2 h-4 w-4" />Retouren</Button>
            </>
          )}
          <Button variant="outline" size="icon" onClick={() => setShowReaderDialog(true)}><Settings className="h-4 w-4" /></Button>
          {activeSession && (
            <Button variant="outline" size="sm" onClick={() => setShowCloseSessionDialog(true)}><LogOut className="h-4 w-4" /><span className="hidden sm:ml-2 sm:inline">Dag Sluiten</span></Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Products Panel - always visible, full width on mobile */}
        <POSProductPanel
          products={products}
          quickButtons={quickButtons}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddToCart={addToCart}
          onConfigureQuickButtons={() => setShowQuickButtonDialog(true)}
          onSellGiftCard={() => setShowGiftCardSellDialog(true)}
          activeSession={!!activeSession}
          cart={cart}
          onUpdateQuantity={updateQuantity}
        />

        {/* Cart Panel - desktop only */}
        <div className="hidden lg:block">
          <POSCartPanel
            cart={cart}
            cartTotals={cartTotals}
            selectedCustomer={selectedCustomer}
            cartDiscount={cartDiscount}
            isStripeProcessing={isStripeProcessing}
            hasIban={!!currentTenant?.iban}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onParkCart={handleParkCart}
            onSelectCustomer={() => setShowCustomerDialog(true)}
            onClearCustomer={() => setSelectedCustomer(null)}
            onApplyDiscount={() => setShowDiscountPanel(true)}
            onClearDiscount={() => setCartDiscount(null)}
            onCashPayment={() => setShowPaymentDialog(true)}
            onCardPayment={() => cart.length > 0 && setShowCardPaymentDialog(true)}
            onBankTransfer={() => setShowBankTransferDialog(true)}
            onMultiPayment={() => setShowMultiPaymentDialog(true)}
          />
        </div>
      </div>

      {/* Mobile floating cart bar */}
      <button
        onClick={() => setShowMobileCartDrawer(true)}
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between w-full px-4 py-3 shadow-lg border-t bg-primary text-primary-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-semibold">
            {totalItems > 0 ? `${totalItems} items` : 'Winkelwagen'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{formatCurrency(cartTotals.total)}</span>
          <ChevronUp className="w-5 h-5" />
        </div>
      </button>

      {/* Mobile Cart Drawer */}
      <POSMobileCartDrawer
        open={showMobileCartDrawer}
        onOpenChange={setShowMobileCartDrawer}
        cart={cart}
        cartTotals={cartTotals}
        selectedCustomer={selectedCustomer}
        cartDiscount={cartDiscount}
        isStripeProcessing={isStripeProcessing}
        hasIban={!!currentTenant?.iban}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
        onParkCart={handleParkCart}
        onSelectCustomer={() => setShowCustomerDialog(true)}
        onClearCustomer={() => setSelectedCustomer(null)}
        onApplyDiscount={() => setShowDiscountPanel(true)}
        onClearDiscount={() => setCartDiscount(null)}
        onCashPayment={() => setShowPaymentDialog(true)}
        onCardPayment={() => cart.length > 0 && setShowCardPaymentDialog(true)}
        onBankTransfer={() => setShowBankTransferDialog(true)}
        onMultiPayment={() => setShowMultiPaymentDialog(true)}
      />

      {/* =================== DIALOGS =================== */}

      {/* Open Session */}
      <Dialog open={showOpenSessionDialog} onOpenChange={setShowOpenSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassadag Openen</DialogTitle>
            <DialogDescription>Voer het startbedrag in de kassalade in om de dag te beginnen.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="openingCash">Startbedrag (€)</Label>
            <Input id="openingCash" type="number" step="0.01" placeholder="0.00" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="mt-2" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/admin/pos')}>Annuleren</Button>
            <Button onClick={handleOpenSession} disabled={openSession.isPending}>{openSession.isPending ? 'Openen...' : 'Dag Starten'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session */}
      <Dialog open={showCloseSessionDialog} onOpenChange={setShowCloseSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassadag Sluiten</DialogTitle>
            <DialogDescription>Tel de kassalade en voer het eindbedrag in.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div><Label>Startbedrag</Label><p className="text-lg font-semibold">{formatCurrency(activeSession?.opening_cash || 0)}</p></div>
            <div><Label htmlFor="closingCash">Eindbedrag (€)</Label><Input id="closingCash" type="number" step="0.01" placeholder="0.00" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="mt-2" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseSessionDialog(false)}>Annuleren</Button>
            <Button onClick={handleCloseSession} disabled={closeSession.isPending}>{closeSession.isPending ? 'Afsluiten...' : 'Dag Afsluiten'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Payment */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contante Betaling</DialogTitle>
            <DialogDescription>Totaal te betalen: {formatCurrency(cartTotals.total)}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="cashReceived">Ontvangen bedrag (€)</Label>
              <Input id="cashReceived" type="number" step="0.01" placeholder={cartTotals.total.toFixed(2)} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="mt-2 text-lg" autoFocus />
            </div>
            {parseFloat(cashReceived) > cartTotals.total && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">Wisselgeld</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(parseFloat(cashReceived) - cartTotals.total)}</p>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((amount) => (
                <Button key={amount} variant="outline" onClick={() => setCashReceived(amount.toString())}>€{amount}</Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[100, 200, 500].map((amount) => (
                <Button key={amount} variant="outline" onClick={() => setCashReceived(amount.toString())}>€{amount}</Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Annuleren</Button>
            <Button onClick={handleCashPayment} disabled={createTransaction.isPending}>
              <Receipt className="mr-2 h-4 w-4" />{createTransaction.isPending ? 'Verwerken...' : 'Afronden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parked Carts */}
      <Dialog open={showParkedCartsDialog} onOpenChange={setShowParkedCartsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geparkeerde Winkelwagens</DialogTitle>
            <DialogDescription>Selecteer een winkelwagen om verder te gaan.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-80 overflow-auto">
            {parkedCarts.map((parked) => (
              <button key={parked.id} className="w-full p-4 rounded-lg border hover:bg-muted text-left" onClick={() => handleResumeCart(parked.id)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{parked.customer_name || `${parked.items.length} items`}</p>
                    <p className="text-sm text-muted-foreground">Geparkeerd om {new Date(parked.parked_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(parked.items.reduce((sum, i) => sum + i.price * i.quantity, 0))}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowParkedCartsDialog(false)}>Sluiten</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* External dialogs */}
      <CardPaymentDialog open={showCardPaymentDialog} onOpenChange={setShowCardPaymentDialog} amount={cartTotals.total} terminalId={terminalId || ''} readerId={selectedReaderId || undefined} onSuccess={handleCardPaymentSuccess} onCancel={() => setShowCardPaymentDialog(false)} />
      <StripeReaderDialog open={showReaderDialog} onOpenChange={setShowReaderDialog} onReaderSelect={handleReaderSelect} />
      <QuickButtonDialog open={showQuickButtonDialog} onOpenChange={setShowQuickButtonDialog} terminalId={terminalId} />
      <ReceiptDialog open={showReceiptDialog} onOpenChange={(open) => { setShowReceiptDialog(open); if (!open) setLastPaymentWasCash(false); }} transaction={lastTransaction} autoPrint={terminal?.settings?.auto_print === true} openCashDrawer={lastPaymentWasCash} />
      <SessionReportDialog open={showSessionReportDialog} onOpenChange={setShowSessionReportDialog} session={activeSession} transactions={transactions} cashMovements={cashMovements} onClose={() => { if (activeSession?.status !== 'open') navigate('/admin/pos'); }} />
      <CashMovementDialog open={showCashMovementDialog} onOpenChange={setShowCashMovementDialog} onSubmit={handleCashMovement} isPending={createMovement.isPending} />
      <POSCustomerDialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog} selectedCustomer={selectedCustomer} onSelectCustomer={setSelectedCustomer} />
      <POSDiscountPanel open={showDiscountPanel} onOpenChange={setShowDiscountPanel} currentDiscount={cartDiscount} cartSubtotal={cartTotals.subtotal} onApplyDiscount={setCartDiscount} />
      <POSMultiPaymentDialog open={showMultiPaymentDialog} onOpenChange={setShowMultiPaymentDialog} total={cartTotals.total} customerId={selectedCustomer?.id || null} onPaymentComplete={handleMultiPaymentComplete} isProcessing={createTransaction.isPending} />
      <POSTransactionHistory open={showTransactionHistory} onOpenChange={setShowTransactionHistory} transactions={transactions} onViewReceipt={(txn) => { setLastTransaction(txn); setShowReceiptDialog(true); }} onRefund={(txn) => { setRefundTxn(txn); setShowRefundDialog(true); }} />
      <POSRefundDialog open={showRefundDialog} onOpenChange={setShowRefundDialog} transaction={refundTxn} onRefund={async (data) => { await refundTransaction.mutateAsync({ id: data.transactionId, reason: data.reason, refundAmount: data.totalRefundAmount, restockItems: data.restockItems }); setShowRefundDialog(false); setRefundTxn(null); }} isProcessing={refundTransaction.isPending} />
      {terminalId && (
        <POSGiftCardSellDialog open={showGiftCardSellDialog} onOpenChange={setShowGiftCardSellDialog} terminalId={terminalId} onGiftCardCreated={(giftCard, amount) => {
          const giftCardItem: POSCartItem = { id: crypto.randomUUID(), product_id: giftCard.id, name: `Cadeaukaart ${giftCard.code}`, sku: giftCard.code, price: amount, quantity: 1, tax_rate: 0, discount: 0, total: amount };
          setCart([...cart, giftCardItem]);
          setPendingGiftCard({ giftCard, amount });
        }} />
      )}
      <POSBankTransferDialog open={showBankTransferDialog} onOpenChange={setShowBankTransferDialog} amount={cartTotals.total} tenantName={currentTenant?.name || ''} tenantIBAN={currentTenant?.iban || undefined} tenantBIC={currentTenant?.bic || undefined} onConfirmPayment={handleBankTransferPayment} isProcessing={createTransaction.isPending} />
    </div>
  );
}

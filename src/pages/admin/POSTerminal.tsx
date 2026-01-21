import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  PauseCircle,
  Clock,
  ShoppingCart,
  X,
  Settings,
  LogOut,
  Receipt,
  Wifi,
  WifiOff,
  Grid3X3,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Tag,
  Percent,
  Gift,
  ListOrdered,
  CloudOff,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { usePOSTerminals, usePOSSessions, usePOSTransactions, usePOSQuickButtons, usePOSParkedCarts, usePOSCashMovements } from '@/hooks/usePOS';
import { useProducts } from '@/hooks/useProducts';
import { useStripeTerminal } from '@/hooks/useStripeTerminal';
import { usePOSOffline, OfflineTransaction } from '@/hooks/usePOSOffline';
import { usePOSLoyalty } from '@/hooks/usePOSLoyalty';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { CardPaymentDialog } from '@/components/admin/pos/CardPaymentDialog';
import { StripeReaderDialog } from '@/components/admin/pos/StripeReaderDialog';
import { QuickButtonDialog } from '@/components/admin/pos/QuickButtonDialog';
import { ReceiptDialog } from '@/components/admin/pos/ReceiptDialog';
import { SessionReportDialog } from '@/components/admin/pos/SessionReportDialog';
import { CashMovementDialog } from '@/components/admin/pos/CashMovementDialog';
import { POSCustomerDialog } from '@/components/admin/pos/POSCustomerDialog';
import { POSDiscountPanel, POSDiscount } from '@/components/admin/pos/POSDiscountPanel';
import { POSMultiPaymentDialog, MultiPaymentData } from '@/components/admin/pos/POSMultiPaymentDialog';
import { POSRefundDialog, RefundData } from '@/components/admin/pos/POSRefundDialog';
import { POSTransactionHistory } from '@/components/admin/pos/POSTransactionHistory';
import { POSGiftCardSellDialog } from '@/components/admin/pos/POSGiftCardSellDialog';
import type { AppliedGiftCard } from '@/components/admin/pos/POSGiftCardInput';
import type { POSCartItem, POSPayment, POSTransaction } from '@/types/pos';
import type { GiftCard } from '@/types/giftCard';
import type { Product } from '@/types/product';
import type { Customer } from '@/types/order';
import { formatCurrency } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { supabase } from '@/integrations/supabase/client';

export default function POSTerminalPage() {
  const { terminalId } = useParams<{ terminalId: string }>();
  const navigate = useNavigate();
  
  // Hooks
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
  
  // Offline sync handler
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

  // Offline queue hook
  const { 
    isOnline, 
    pendingCount, 
    isSyncing, 
    saveForOffline, 
    syncAll 
  } = usePOSOffline({
    terminalId,
    tenantId: currentTenant?.id,
    userId: user?.id,
    onSyncTransaction: handleSyncTransaction,
    enabled: !!activeSession,
  });
  
  // Local State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOpenSessionDialog, setShowOpenSessionDialog] = useState(false);
  const [showCloseSessionDialog, setShowCloseSessionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showParkedCartsDialog, setShowParkedCartsDialog] = useState(false);
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
  const [pendingGiftCard, setPendingGiftCard] = useState<{ giftCard: GiftCard; amount: number } | null>(null);
  const [refundTxn, setRefundTxn] = useState<POSTransaction | null>(null);
  const [lastTransaction, setLastTransaction] = useState<POSTransaction | null>(null);
  const [lastPaymentWasCash, setLastPaymentWasCash] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedReaderId, setSelectedReaderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartDiscount, setCartDiscount] = useState<POSDiscount | null>(null);
  const terminal = terminals.find(t => t.id === terminalId);
  
  // Load Stripe readers on mount
  useEffect(() => {
    listReaders();
  }, [listReaders]);
  
  // Set selected reader from terminal settings
  useEffect(() => {
    if (terminal?.stripe_reader_id) {
      setSelectedReaderId(terminal.stripe_reader_id);
    }
  }, [terminal?.stripe_reader_id]);
  
  // Find connected reader
  const connectedReader = useMemo(() => {
    return readers.find(r => r.id === selectedReaderId);
  }, [readers, selectedReaderId]);
  
  // Calculate totals
  const cartTotals = useMemo(() => {
    const itemSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
    
    // Apply cart-level discount
    let cartDiscountAmount = 0;
    if (cartDiscount) {
      if (cartDiscount.type === 'percentage') {
        cartDiscountAmount = (itemSubtotal * cartDiscount.value) / 100;
      } else {
        cartDiscountAmount = cartDiscount.value;
      }
    }
    
    const totalDiscount = itemDiscount + cartDiscountAmount;
    const subtotal = itemSubtotal;
    const taxRate = 21; // Default VAT
    const taxTotal = (subtotal - totalDiscount) * (taxRate / 100);
    const total = subtotal - totalDiscount + taxTotal;
    
    return { subtotal, discount: totalDiscount, cartDiscountAmount, taxTotal, total };
  }, [cart, cartDiscount]);
  
  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      
      const newItem: POSCartItem = {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        sku: product.sku || null,
        price: product.price,
        quantity: 1,
        tax_rate: 21,
        discount: 0,
        total: product.price,
        image_url: (product as unknown as { image_url?: string }).image_url || null,
      };
      
      return [...prev, newItem];
    });
  }, []);
  
  // Update quantity
  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.id === itemId) {
            const newQty = Math.max(0, item.quantity + delta);
            if (newQty === 0) return null;
            return { ...item, quantity: newQty, total: newQty * item.price };
          }
          return item;
        })
        .filter(Boolean) as POSCartItem[];
    });
  }, []);
  
  // Remove item
  const removeItem = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);
  
  // Clear cart
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);
  
  // Handle session open
  const handleOpenSession = async () => {
    if (!terminalId) return;
    
    await openSession.mutateAsync({
      terminal_id: terminalId,
      opening_cash: parseFloat(openingCash) || 0,
    });
    
    setShowOpenSessionDialog(false);
    setOpeningCash('');
  };
  
  // Handle session close
  const handleCloseSession = async () => {
    if (!activeSession) return;
    
    await closeSession.mutateAsync({
      sessionId: activeSession.id,
      data: {
        closing_cash: parseFloat(closingCash) || 0,
      },
    });
    
    setShowCloseSessionDialog(false);
    setClosingCash('');
    // Show session report after closing
    setShowSessionReportDialog(true);
  };

  // Handle cash movement
  const handleCashMovement = async (data: {
    movement_type: 'in' | 'out' | 'adjustment';
    amount: number;
    reason: string;
    notes?: string;
  }) => {
    if (!activeSession || !terminalId) return;
    
    await createMovement.mutateAsync({
      sessionId: activeSession.id,
      terminalId,
      data: {
        movement_type: data.movement_type,
        amount: data.amount,
        reason: data.reason,
        notes: data.notes,
      },
    });
    
    toast.success(data.movement_type === 'in' ? 'Kasstorting geregistreerd' : 'Kasopname geregistreerd');
  };
  
  // Handle cash payment (with offline support)
  const handleCashPayment = async () => {
    if (!terminalId || cart.length === 0) return;
    
    const cashReceivedAmount = parseFloat(cashReceived) || cartTotals.total;
    const cashChangeAmount = Math.max(0, cashReceivedAmount - cartTotals.total);
    
    const payments: POSPayment[] = [{
      method: 'cash',
      amount: cartTotals.total,
    }];
    
    // If offline, save to IndexedDB queue
    if (!isOnline) {
      try {
        const offlineTxn = await saveForOffline({
          items: cart,
          payments,
          sessionId: activeSession?.id || null,
          cashReceived: cashReceivedAmount,
          cashChange: cashChangeAmount,
          customerId: selectedCustomer?.id,
        });
        
        if (offlineTxn) {
          toast.success(`Offline verkoop opgeslagen! Wisselgeld: ${formatCurrency(cashChangeAmount)}`, {
            description: 'Wordt gesynchroniseerd wanneer online.',
          });
          clearCart();
          setSelectedCustomer(null);
          setCartDiscount(null);
          setShowPaymentDialog(false);
          setCashReceived('');
        } else {
          toast.error('Kon offline verkoop niet opslaan');
        }
      } catch (error) {
        toast.error('Fout bij offline opslag');
      }
      return;
    }
    
    // Online: proceed with normal transaction
    try {
      const transaction = await createTransaction.mutateAsync({
        terminalId,
        sessionId: activeSession?.id || null,
        items: cart,
        payments,
        cashReceived: cashReceivedAmount,
        cashChange: cashChangeAmount,
        customerId: selectedCustomer?.id,
      });
      
      // Award loyalty points if customer is linked
      if (selectedCustomer?.id && cartTotals.total > 0) {
        earnPoints.mutate({
          customerId: selectedCustomer.id,
          orderTotal: cartTotals.total,
          description: `POS transactie #${transaction?.receipt_number || 'onbekend'}`,
        });
      }
      
      toast.success(`Betaling succesvol! Wisselgeld: ${formatCurrency(cashChangeAmount)}`);
      clearCart();
      setSelectedCustomer(null);
      setCartDiscount(null);
      setShowPaymentDialog(false);
      setCashReceived('');
      
      // Show receipt dialog
      if (transaction) {
        setLastTransaction(transaction as unknown as POSTransaction);
        setLastPaymentWasCash(true);
        setShowReceiptDialog(true);
      }
    } catch (error) {
      toast.error('Betaling mislukt');
    }
  };
  
  // Handle card payment initiation
  const handleCardPaymentStart = () => {
    if (cart.length === 0) return;
    setShowCardPaymentDialog(true);
  };
  
  // Handle card payment success
  const handleCardPaymentSuccess = async (
    paymentIntentId: string,
    cardDetails?: { brand: string; last4: string }
  ) => {
    if (!terminalId) return;
    
    const payments: POSPayment[] = [{
      method: 'card',
      amount: cartTotals.total,
      reference: paymentIntentId,
    }];
    
    try {
      const transaction = await createTransaction.mutateAsync({
        terminalId,
        sessionId: activeSession?.id || null,
        items: cart,
        payments,
        stripePaymentIntentId: paymentIntentId,
        cardBrand: cardDetails?.brand,
        cardLast4: cardDetails?.last4,
        customerId: selectedCustomer?.id,
      });
      
      // Award loyalty points if customer is linked
      if (selectedCustomer?.id && cartTotals.total > 0) {
        earnPoints.mutate({
          customerId: selectedCustomer.id,
          orderTotal: cartTotals.total,
          description: `POS transactie #${transaction?.receipt_number || 'onbekend'}`,
        });
      }
      
      toast.success('Kaartbetaling succesvol!');
      clearCart();
      setSelectedCustomer(null);
      setCartDiscount(null);
      setShowCardPaymentDialog(false);
      
      // Show receipt dialog
      if (transaction) {
        setLastTransaction(transaction as unknown as POSTransaction);
        setLastPaymentWasCash(false);
        setShowReceiptDialog(true);
      }
    } catch (error) {
      toast.error('Fout bij opslaan transactie');
    }
  };

  // Handle multi-payment (gift cards, loyalty, etc.)
  const handleMultiPaymentComplete = async (paymentData: MultiPaymentData) => {
    if (!terminalId) return;

    const payments: POSPayment[] = [];

    // Add gift card payments
    for (const gc of paymentData.giftCards) {
      if (gc.amountToUse > 0) {
        payments.push({
          method: 'gift_card',
          amount: gc.amountToUse,
          reference: gc.code,
        });
      }
    }

    // Add loyalty points payment
    if (paymentData.loyaltyEuroValue > 0) {
      payments.push({
        method: 'loyalty_points',
        amount: paymentData.loyaltyEuroValue,
        reference: `${paymentData.loyaltyPoints} punten`,
      });
    }

    // Add final payment method
    if (paymentData.finalPaymentMethod === 'cash' && paymentData.cashAmount > 0) {
      payments.push({
        method: 'cash',
        amount: paymentData.cashAmount,
      });
    } else if (paymentData.finalPaymentMethod === 'card' && paymentData.cardAmount > 0) {
      // For card, we'll need to process via Stripe first
      setShowMultiPaymentDialog(false);
      setShowCardPaymentDialog(true);
      return; // Card payment will complete separately
    }

    try {
      const transaction = await createTransaction.mutateAsync({
        terminalId,
        sessionId: activeSession?.id || null,
        items: cart,
        payments,
        cashReceived: paymentData.cashReceived || undefined,
        cashChange: paymentData.cashChange || undefined,
        customerId: selectedCustomer?.id,
      });

      // Redeem loyalty points if used
      if (selectedCustomer?.id && paymentData.loyaltyPoints > 0) {
        await redeemPoints.mutateAsync({
          customerId: selectedCustomer.id,
          points: paymentData.loyaltyPoints,
          euroValue: paymentData.loyaltyEuroValue,
          description: `POS inwisseling transactie #${transaction?.receipt_number || 'onbekend'}`,
        });
      }

      // Award loyalty points for the remaining payment (excluding points used)
      // Only award on the actual money spent, not the loyalty points value
      const actualSpent = cartTotals.total - paymentData.loyaltyEuroValue;
      if (selectedCustomer?.id && actualSpent > 0) {
        earnPoints.mutate({
          customerId: selectedCustomer.id,
          orderTotal: actualSpent,
          description: `POS transactie #${transaction?.receipt_number || 'onbekend'}`,
        });
      }

      toast.success(
        paymentData.cashChange > 0
          ? `Betaling succesvol! Wisselgeld: ${formatCurrency(paymentData.cashChange)}`
          : 'Betaling succesvol!'
      );
      clearCart();
      setSelectedCustomer(null);
      setCartDiscount(null);
      setShowMultiPaymentDialog(false);

      if (transaction) {
        setLastTransaction(transaction as unknown as POSTransaction);
        setLastPaymentWasCash(paymentData.finalPaymentMethod === 'cash');
        setShowReceiptDialog(true);
      }
    } catch (error) {
      toast.error('Betaling mislukt');
    }
  };
  
  // Handle reader selection
  const handleReaderSelect = async (readerId: string) => {
    setSelectedReaderId(readerId);
    
    // Save reader to terminal settings
    if (terminalId) {
      try {
        await updateTerminal.mutateAsync({
          id: terminalId,
          data: { stripe_reader_id: readerId } as unknown as { name?: string },
        });
        toast.success('Reader gekoppeld aan terminal');
      } catch (error) {
        // Silent fail - reader is still selected locally
      }
    }
  };
  
  // Handle park cart
  const handleParkCart = async () => {
    if (!terminalId || cart.length === 0) return;
    
    await parkCart.mutateAsync({
      terminalId,
      sessionId: activeSession?.id,
      items: cart,
    });
    
    toast.success('Winkelwagen geparkeerd');
    clearCart();
  };
  
  // Handle resume cart
  const handleResumeCart = async (cartId: string) => {
    const resumed = await resumeCart.mutateAsync(cartId);
    if (resumed) {
      setCart(resumed.items);
      toast.success('Winkelwagen hervat');
    }
    setShowParkedCartsDialog(false);
  };
  
  // Filtered products (including barcode search)
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  // Find product by exact barcode match
  const findProductByBarcode = useCallback((barcode: string): Product | undefined => {
    return products.find(p => 
      p.barcode?.toLowerCase() === barcode.toLowerCase() ||
      p.sku?.toLowerCase() === barcode.toLowerCase()
    );
  }, [products]);

  // Barcode scanner integration
  useBarcodeScanner({
    onScan: (barcode) => {
      const product = findProductByBarcode(barcode);
      if (product) {
        addToCart(product);
        toast.success(`${product.name} toegevoegd`);
        setSearchQuery('');
      } else {
        // Show barcode in search so user can see what was scanned
        setSearchQuery(barcode);
        toast.error(`Product niet gevonden: ${barcode}`);
      }
    },
    enabled: !!activeSession, // Only scan when session is active
  });
  
  // Check if session needed
  useEffect(() => {
    if (terminal && !activeSession && !showOpenSessionDialog) {
      setShowOpenSessionDialog(true);
    }
  }, [terminal, activeSession]);
  
  if (!terminal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Terminal niet gevonden</p>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{terminal.name}</h1>
            {activeSession && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Dag gestart om {new Date(activeSession.opened_at).toLocaleTimeString('nl-NL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Offline/Sync Status */}
          {!isOnline && (
            <Badge variant="destructive" className="gap-1">
              <CloudOff className="h-3 w-3" />
              Offline
            </Badge>
          )}
          {pendingCount > 0 && (
            <Button
              variant={isOnline ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => isOnline && syncAll()}
              disabled={isSyncing || !isOnline}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {pendingCount} wachtend
            </Button>
          )}
          
          {/* Reader Status */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReaderDialog(true)}
            className={connectedReader?.status === 'online' ? 'border-green-500' : ''}
          >
            {connectedReader ? (
              <>
                {connectedReader.status === 'online' ? (
                  <Wifi className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="mr-2 h-4 w-4 text-muted-foreground" />
                )}
                {connectedReader.label}
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Geen reader
              </>
            )}
          </Button>
          {parkedCarts.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowParkedCartsDialog(true)}
            >
              <PauseCircle className="mr-2 h-4 w-4" />
              Geparkeerd ({parkedCarts.length})
            </Button>
          )}
          {activeSession && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCashMovementDialog(true)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Kas +/-
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSessionReportDialog(true)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Rapport
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTransactionHistory(true)}
              >
                <ListOrdered className="mr-2 h-4 w-4" />
                Retouren
              </Button>
            </>
          )}
          <Button variant="outline" size="icon" onClick={() => setShowReaderDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          {activeSession && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCloseSessionDialog(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Dag Sluiten
            </Button>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek product of scan barcode..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {/* Search Results Dropdown */}
            {filteredProducts.length > 0 && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50">
                <CardContent className="p-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left"
                      onClick={() => {
                        addToCart(product);
                        setSearchQuery('');
                      }}
                    >
                      {(product as unknown as { image_url?: string }).image_url ? (
                        <img 
                          src={(product as unknown as { image_url?: string }).image_url} 
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(product.price)}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Quick Buttons */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Snelknoppen</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowQuickButtonDialog(true)}
                className="h-7 text-xs"
              >
                <Grid3X3 className="mr-1 h-3 w-3" />
                Configureren
              </Button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {quickButtons.map((button) => (
                <button
                  key={button.id}
                  className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors"
                  style={{ borderColor: button.color || 'hsl(var(--border))' }}
                  onClick={() => button.product && addToCart(button.product as unknown as Product)}
                >
                  <span className="text-xs font-medium text-center line-clamp-2">
                    {button.label}
                  </span>
                  {button.product && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(button.product.price)}
                    </span>
                  )}
                </button>
              ))}
              {/* Gift Card Sell Button - Always visible */}
              <button
                className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors"
                style={{ borderColor: 'hsl(var(--primary))' }}
                onClick={() => setShowGiftCardSellDialog(true)}
                disabled={!activeSession}
              >
                <Gift className="h-5 w-5 mb-1 text-primary" />
                <span className="text-xs font-medium text-center">Cadeaukaart</span>
                <span className="text-[10px] text-muted-foreground">Verkopen</span>
              </button>
              {quickButtons.length === 0 && (
                <button
                  className="col-span-2 aspect-[2/1] rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors text-muted-foreground"
                  onClick={() => setShowQuickButtonDialog(true)}
                >
                  <Plus className="h-4 w-4 mb-1" />
                  <span className="text-xs">Snelknop toevoegen</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Recent Products or Categories can go here */}
          <div className="flex-1 overflow-auto">
            {/* Placeholder for product grid/categories */}
          </div>
        </div>
        
        {/* Right Panel - Cart */}
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
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Customer & Discount Bar */}
          {(selectedCustomer || cartDiscount) && (
            <div className="px-4 py-2 border-b bg-muted/30 space-y-1">
              {selectedCustomer && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">
                      {selectedCustomer.company_name || 
                       `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 
                       selectedCustomer.email}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5" 
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {cartDiscount && (
                <div className="flex items-center justify-between text-sm text-green-600">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3 w-3" />
                    <span>
                      {cartDiscount.type === 'percentage' 
                        ? `${cartDiscount.value}% korting` 
                        : `€${cartDiscount.value} korting`}
                      {cartDiscount.reason && ` (${cartDiscount.reason})`}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5" 
                    onClick={() => setCartDiscount(null)}
                  >
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
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTW (21%)</span>
                <span>{formatCurrency(cartTotals.taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Totaal</span>
                <span>{formatCurrency(cartTotals.total)}</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                disabled={cart.length === 0}
                onClick={handleParkCart}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Parkeren
              </Button>
              <Button 
                variant={selectedCustomer ? 'secondary' : 'outline'}
                onClick={() => setShowCustomerDialog(true)}
              >
                <User className="mr-2 h-4 w-4" />
                {selectedCustomer ? 'Klant ✓' : 'Klant'}
              </Button>
              <Button 
                variant={cartDiscount ? 'secondary' : 'outline'}
                disabled={cart.length === 0}
                onClick={() => setShowDiscountPanel(true)}
              >
                <Percent className="mr-2 h-4 w-4" />
                {cartDiscount ? 'Korting ✓' : 'Korting'}
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button 
                className="h-14 text-base"
                disabled={cart.length === 0}
                onClick={() => setShowPaymentDialog(true)}
              >
                <Banknote className="mr-2 h-5 w-5" />
                Contant
              </Button>
              <Button 
                className="h-14 text-base"
                disabled={cart.length === 0 || isStripeProcessing}
                onClick={handleCardPaymentStart}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                PIN
              </Button>
              <Button 
                variant="secondary"
                className="h-14 text-base"
                disabled={cart.length === 0}
                onClick={() => setShowMultiPaymentDialog(true)}
              >
                <Gift className="mr-2 h-4 w-4" />
                Meer
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Open Session Dialog */}
      <Dialog open={showOpenSessionDialog} onOpenChange={setShowOpenSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassadag Openen</DialogTitle>
            <DialogDescription>
              Voer het startbedrag in de kassalade in om de dag te beginnen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="openingCash">Startbedrag (€)</Label>
            <Input
              id="openingCash"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/admin/pos')}>
              Annuleren
            </Button>
            <Button onClick={handleOpenSession} disabled={openSession.isPending}>
              {openSession.isPending ? 'Openen...' : 'Dag Starten'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Close Session Dialog */}
      <Dialog open={showCloseSessionDialog} onOpenChange={setShowCloseSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassadag Sluiten</DialogTitle>
            <DialogDescription>
              Tel de kassalade en voer het eindbedrag in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Startbedrag</Label>
              <p className="text-lg font-semibold">{formatCurrency(activeSession?.opening_cash || 0)}</p>
            </div>
            <div>
              <Label htmlFor="closingCash">Eindbedrag (€)</Label>
              <Input
                id="closingCash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseSessionDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCloseSession} disabled={closeSession.isPending}>
              {closeSession.isPending ? 'Afsluiten...' : 'Dag Afsluiten'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cash Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contante Betaling</DialogTitle>
            <DialogDescription>
              Totaal te betalen: {formatCurrency(cartTotals.total)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="cashReceived">Ontvangen bedrag (€)</Label>
              <Input
                id="cashReceived"
                type="number"
                step="0.01"
                placeholder={cartTotals.total.toFixed(2)}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="mt-2 text-lg"
                autoFocus
              />
            </div>
            {parseFloat(cashReceived) > cartTotals.total && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">Wisselgeld</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(parseFloat(cashReceived) - cartTotals.total)}
                </p>
              </div>
            )}
            
            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setCashReceived(amount.toString())}
                >
                  €{amount}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[100, 200, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setCashReceived(amount.toString())}
                >
                  €{amount}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleCashPayment} 
              disabled={createTransaction.isPending}
            >
              <Receipt className="mr-2 h-4 w-4" />
              {createTransaction.isPending ? 'Verwerken...' : 'Afronden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Card Payment Dialog */}
      <CardPaymentDialog
        open={showCardPaymentDialog}
        onOpenChange={setShowCardPaymentDialog}
        amount={cartTotals.total}
        terminalId={terminalId || ''}
        readerId={selectedReaderId || undefined}
        onSuccess={handleCardPaymentSuccess}
        onCancel={() => setShowCardPaymentDialog(false)}
      />
      
      {/* Stripe Reader Management Dialog */}
      <StripeReaderDialog
        open={showReaderDialog}
        onOpenChange={setShowReaderDialog}
        onReaderSelect={handleReaderSelect}
      />
      
      {/* Quick Button Configuration Dialog */}
      <QuickButtonDialog
        open={showQuickButtonDialog}
        onOpenChange={setShowQuickButtonDialog}
        terminalId={terminalId}
      />
      
      {/* Parked Carts Dialog */}
      <Dialog open={showParkedCartsDialog} onOpenChange={setShowParkedCartsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geparkeerde Winkelwagens</DialogTitle>
            <DialogDescription>
              Selecteer een winkelwagen om verder te gaan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-80 overflow-auto">
            {parkedCarts.map((parked) => (
              <button
                key={parked.id}
                className="w-full p-4 rounded-lg border hover:bg-muted text-left"
                onClick={() => handleResumeCart(parked.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {parked.customer_name || `${parked.items.length} items`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Geparkeerd om {new Date(parked.parked_at).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(parked.items.reduce((sum, i) => sum + i.price * i.quantity, 0))}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParkedCartsDialog(false)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Receipt Dialog */}
      <ReceiptDialog
        open={showReceiptDialog}
        onOpenChange={(open) => {
          setShowReceiptDialog(open);
          if (!open) setLastPaymentWasCash(false);
        }}
        transaction={lastTransaction}
        autoPrint={terminal?.settings?.auto_print === true}
        openCashDrawer={lastPaymentWasCash}
      />

      {/* Session Report Dialog */}
      <SessionReportDialog
        open={showSessionReportDialog}
        onOpenChange={setShowSessionReportDialog}
        session={activeSession}
        transactions={transactions}
        cashMovements={cashMovements}
        onClose={() => {
          if (activeSession?.status !== 'open') {
            navigate('/admin/pos');
          }
        }}
      />

      {/* Cash Movement Dialog */}
      <CashMovementDialog
        open={showCashMovementDialog}
        onOpenChange={setShowCashMovementDialog}
        onSubmit={handleCashMovement}
        isPending={createMovement.isPending}
      />

      {/* Customer Dialog */}
      <POSCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
      />

      {/* Discount Panel */}
      <POSDiscountPanel
        open={showDiscountPanel}
        onOpenChange={setShowDiscountPanel}
        currentDiscount={cartDiscount}
        cartSubtotal={cartTotals.subtotal}
        onApplyDiscount={setCartDiscount}
      />

      {/* Multi-Payment Dialog (Gift Cards, Loyalty) */}
      <POSMultiPaymentDialog
        open={showMultiPaymentDialog}
        onOpenChange={setShowMultiPaymentDialog}
        total={cartTotals.total}
        customerId={selectedCustomer?.id || null}
        onPaymentComplete={handleMultiPaymentComplete}
        isProcessing={createTransaction.isPending}
      />

      {/* Transaction History Dialog */}
      <POSTransactionHistory
        open={showTransactionHistory}
        onOpenChange={setShowTransactionHistory}
        transactions={transactions}
        onViewReceipt={(txn) => {
          setLastTransaction(txn);
          setShowReceiptDialog(true);
        }}
        onRefund={(txn) => {
          setRefundTxn(txn);
          setShowRefundDialog(true);
        }}
      />

      {/* Refund Dialog */}
      <POSRefundDialog
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        transaction={refundTxn}
        onRefund={async (data) => {
          await refundTransaction.mutateAsync({
            id: data.transactionId,
            reason: data.reason,
            refundAmount: data.totalRefundAmount,
            restockItems: data.restockItems,
          });
          setShowRefundDialog(false);
          setRefundTxn(null);
        }}
        isProcessing={refundTransaction.isPending}
      />

      {/* Gift Card Sell Dialog */}
      {terminalId && (
        <POSGiftCardSellDialog
          open={showGiftCardSellDialog}
          onOpenChange={setShowGiftCardSellDialog}
          terminalId={terminalId}
          onGiftCardCreated={(giftCard, amount) => {
            // Add gift card to cart as an item
            const giftCardItem: POSCartItem = {
              id: crypto.randomUUID(),
              product_id: giftCard.id, // Use gift card ID as product reference
              name: `Cadeaukaart ${giftCard.code}`,
              sku: giftCard.code,
              price: amount,
              quantity: 1,
              tax_rate: 0, // Gift cards are typically tax-exempt
              discount: 0,
              total: amount,
            };
            setCart(prev => [...prev, giftCardItem]);
            setPendingGiftCard({ giftCard, amount });
          }}
        />
      )}
    </div>
  );
}

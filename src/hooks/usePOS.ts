import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type {
  POSTerminal,
  POSSession,
  POSTransaction,
  POSCashMovement,
  POSQuickButton,
  POSParkedCart,
  POSTerminalFormData,
  POSSessionOpenData,
  POSSessionCloseData,
  POSCashMovementFormData,
  POSCartItem,
  POSPayment,
} from '@/types/pos';

// ============= TERMINALS =============

export function usePOSTerminals() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const terminalsQuery = useQuery({
    queryKey: ['pos-terminals', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from('pos_terminals')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      return (data || []) as unknown as POSTerminal[];
    },
    enabled: !!currentTenant,
  });

  const createTerminal = useMutation({
    mutationFn: async (formData: POSTerminalFormData) => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('pos_terminals')
        .insert({
          tenant_id: currentTenant.id,
          name: formData.name,
          location_name: formData.location_name || null,
          status: formData.status || 'active',
          capabilities: formData.capabilities || { printer: false, scanner: false, cash_drawer: false },
          settings: formData.settings || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals', currentTenant?.id] });
      toast({ title: 'Terminal aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateTerminal = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<POSTerminalFormData> }) => {
      const { error } = await supabase
        .from('pos_terminals')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals', currentTenant?.id] });
      toast({ title: 'Terminal bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTerminal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pos_terminals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals', currentTenant?.id] });
      toast({ title: 'Terminal verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    terminals: terminalsQuery.data || [],
    isLoading: terminalsQuery.isLoading,
    error: terminalsQuery.error,
    createTerminal,
    updateTerminal,
    deleteTerminal,
    refetch: terminalsQuery.refetch,
  };
}

// ============= SESSIONS =============

export function usePOSSessions(terminalId?: string) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ['pos-sessions', currentTenant?.id, terminalId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from('pos_sessions')
        .select('*, terminal:pos_terminals(*)')
        .eq('tenant_id', currentTenant.id)
        .order('opened_at', { ascending: false });

      if (terminalId) {
        query = query.eq('terminal_id', terminalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as POSSession[];
    },
    enabled: !!currentTenant,
  });

  const activeSessionQuery = useQuery({
    queryKey: ['pos-active-session', currentTenant?.id, terminalId],
    queryFn: async () => {
      if (!currentTenant || !terminalId) return null;

      const { data, error } = await supabase
        .from('pos_sessions')
        .select('*, terminal:pos_terminals(*)')
        .eq('tenant_id', currentTenant.id)
        .eq('terminal_id', terminalId)
        .eq('status', 'open')
        .maybeSingle();

      if (error) throw error;
      return data as unknown as POSSession | null;
    },
    enabled: !!currentTenant && !!terminalId,
  });

  const openSession = useMutation({
    mutationFn: async (data: POSSessionOpenData) => {
      if (!currentTenant || !user) throw new Error('Not authenticated');

      const { data: session, error } = await supabase
        .from('pos_sessions')
        .insert({
          tenant_id: currentTenant.id,
          terminal_id: data.terminal_id,
          opened_by: user.id,
          opening_cash: data.opening_cash,
        })
        .select()
        .single();

      if (error) throw error;
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pos-active-session'] });
      toast({ title: 'Dag geopend', description: 'De kassadag is gestart.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const closeSession = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: string; data: POSSessionCloseData }) => {
      if (!user) throw new Error('Not authenticated');

      // Calculate expected cash
      const { data: expectedCash } = await supabase.rpc('calculate_session_expected_cash', {
        p_session_id: sessionId,
      });

      const { error } = await supabase
        .from('pos_sessions')
        .update({
          closed_by: user.id,
          closed_at: new Date().toISOString(),
          closing_cash: data.closing_cash,
          expected_cash: expectedCash,
          cash_difference: data.closing_cash - (expectedCash || 0),
          notes: data.notes || null,
          status: 'closed',
        })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pos-active-session'] });
      toast({ title: 'Dag afgesloten', description: 'De kassadag is afgesloten.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    sessions: sessionsQuery.data || [],
    activeSession: activeSessionQuery.data,
    isLoading: sessionsQuery.isLoading || activeSessionQuery.isLoading,
    error: sessionsQuery.error || activeSessionQuery.error,
    openSession,
    closeSession,
    refetch: sessionsQuery.refetch,
  };
}

// ============= TRANSACTIONS =============

export function usePOSTransactions(sessionId?: string) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({
    queryKey: ['pos-transactions', currentTenant?.id, sessionId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from('pos_transactions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []) as unknown as POSTransaction[];
    },
    enabled: !!currentTenant,
  });

  const createTransaction = useMutation({
    mutationFn: async ({
      terminalId,
      sessionId,
      items,
      payments,
      cashReceived,
      cashChange,
      customerId,
      stripePaymentIntentId,
      cardBrand,
      cardLast4,
      posCashierId,
    }: {
      terminalId: string;
      sessionId: string | null;
      items: POSCartItem[];
      payments: POSPayment[];
      cashReceived?: number;
      cashChange?: number;
      customerId?: string;
      stripePaymentIntentId?: string;
      cardBrand?: string;
      cardLast4?: string;
      posCashierId?: string;
    }) => {
      if (!currentTenant || !user) throw new Error('Not authenticated');

      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
      const taxTotal = items.reduce(
        (sum, item) => sum + (item.price * item.quantity - item.discount) * (item.tax_rate / 100),
        0
      );
      const total = subtotal - discountTotal + taxTotal;

      const { data, error } = await supabase
        .from('pos_transactions')
        .insert([{
          tenant_id: currentTenant.id,
          terminal_id: terminalId,
          session_id: sessionId,
          cashier_id: user.id,
          customer_id: customerId || null,
          pos_cashier_id: posCashierId || null,
          items: JSON.parse(JSON.stringify(items)),
          payments: JSON.parse(JSON.stringify(payments)),
          cash_received: cashReceived || null,
          cash_change: cashChange || null,
          stripe_payment_intent_id: stripePaymentIntentId || null,
          card_brand: cardBrand || null,
          card_last4: cardLast4 || null,
          subtotal,
          discount_total: discountTotal,
          tax_total: taxTotal,
          total,
          status: 'completed',
        }])
        .select()
        .single();

      if (error) throw error;

      // === CREATE ORDER FOR UNIFIED REPORTING ===
      let orderId: string | null = null;
      try {
        const { data: orderNumber } = await supabase.rpc('generate_order_number', {
          _tenant_id: currentTenant.id,
        });

        let customerName: string | null = null;
        let customerEmail = 'pos@local';
        let customerPhone: string | null = null;
        if (customerId) {
          const { data: customer } = await supabase
            .from('customers')
            .select('first_name, last_name, email, phone')
            .eq('id', customerId)
            .single();
          if (customer) {
            customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;
            customerEmail = customer.email || 'pos@local';
            customerPhone = customer.phone || null;
          }
        }

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([{
            tenant_id: currentTenant.id,
            order_number: orderNumber || '#POS',
            customer_id: customerId || null,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            status: 'delivered',
            payment_status: 'paid',
            subtotal,
            tax_amount: taxTotal,
            shipping_cost: 0,
            discount_amount: discountTotal,
            total,
            sales_channel: 'pos',
          }])
          .select('id')
          .single();

        if (orderError) throw orderError;
        orderId = orderData.id;

        const orderItems = items.map((item) => ({
          order_id: orderId!,
          product_id: item.product_id,
          product_name: item.name,
          product_sku: item.sku,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total,
        }));
        await supabase.from('order_items').insert(orderItems);

        await supabase
          .from('pos_transactions')
          .update({ order_id: orderId })
          .eq('id', data.id);
      } catch (orderErr) {
        console.warn('Failed to create order from POS transaction:', orderErr);
      }

      // Record transaction for usage tracking
      const primaryMethod = payments[0]?.method;
      const transactionType = primaryMethod === 'cash' ? 'pos_cash' : 
                              primaryMethod === 'card' ? 'pos_card' : 
                              primaryMethod === 'manual' ? 'bank_transfer' : 'pos_cash';

      try {
        await supabase.rpc('record_transaction', {
          p_tenant_id: currentTenant.id,
          p_transaction_type: transactionType,
          p_order_id: orderId,
        });
      } catch (txError) {
        console.warn('Failed to record transaction for usage tracking:', txError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      toast({ title: 'Verkoop voltooid' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const voidTransaction = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('pos_transactions')
        .update({
          status: 'voided',
          voided_at: new Date().toISOString(),
          voided_by: user.id,
          voided_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
      toast({ title: 'Transactie geannuleerd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const refundTransaction = useMutation({
    mutationFn: async ({ 
      id, 
      reason,
      refundAmount,
      restockItems = true,
    }: { 
      id: string; 
      reason: string;
      refundAmount: number;
      restockItems?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // First, get the transaction to check if it has a Stripe payment
      const { data: transaction, error: fetchError } = await supabase
        .from('pos_transactions')
        .select('stripe_payment_intent_id, status')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (transaction.status === 'refunded') {
        throw new Error('Transactie is al terugbetaald');
      }

      // If this was a card payment, process Stripe refund first
      if (transaction.stripe_payment_intent_id) {
        const { error: refundError } = await supabase.functions.invoke('pos-refund-payment', {
          body: {
            transaction_id: id,
            amount: Math.round(refundAmount * 100), // Convert to cents
            reason: reason,
          },
        });

        if (refundError) {
          throw new Error(`Stripe refund mislukt: ${refundError.message}`);
        }
      }

      // Update transaction status to refunded
      // The database trigger will handle restocking if restockItems is true
      const { error } = await supabase
        .from('pos_transactions')
        .update({
          status: restockItems ? 'refunded' : 'voided',
          refunded_at: new Date().toISOString(),
          refunded_by: user.id,
          voided_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Retour verwerkt', description: 'De transactie is succesvol geretourneerd.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij retour', description: error.message, variant: 'destructive' });
    },
  });

  return {
    transactions: transactionsQuery.data || [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    createTransaction,
    voidTransaction,
    refundTransaction,
    refetch: transactionsQuery.refetch,
  };
}

// ============= CASH MOVEMENTS =============

export function usePOSCashMovements(sessionId?: string) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const movementsQuery = useQuery({
    queryKey: ['pos-cash-movements', currentTenant?.id, sessionId],
    queryFn: async () => {
      if (!currentTenant || !sessionId) return [];

      const { data, error } = await supabase
        .from('pos_cash_movements')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as POSCashMovement[];
    },
    enabled: !!currentTenant && !!sessionId,
  });

  const createMovement = useMutation({
    mutationFn: async ({
      sessionId,
      terminalId,
      data,
    }: {
      sessionId: string;
      terminalId: string;
      data: POSCashMovementFormData;
    }) => {
      if (!currentTenant || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('pos_cash_movements').insert({
        tenant_id: currentTenant.id,
        session_id: sessionId,
        terminal_id: terminalId,
        user_id: user.id,
        movement_type: data.movement_type,
        amount: data.amount,
        reason: data.reason,
        notes: data.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-cash-movements'] });
      toast({ title: 'Kasmutatie geregistreerd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    movements: movementsQuery.data || [],
    isLoading: movementsQuery.isLoading,
    error: movementsQuery.error,
    createMovement,
    refetch: movementsQuery.refetch,
  };
}

// ============= QUICK BUTTONS =============

export function usePOSQuickButtons(terminalId?: string) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const buttonsQuery = useQuery({
    queryKey: ['pos-quick-buttons', currentTenant?.id, terminalId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from('pos_quick_buttons')
        .select('*, product:products(id, name, price)')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('position');

      if (terminalId) {
        query = query.or(`terminal_id.is.null,terminal_id.eq.${terminalId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as POSQuickButton[];
    },
    enabled: !!currentTenant,
  });

  const createButton = useMutation({
    mutationFn: async (data: {
      product_id: string;
      label: string;
      color?: string;
      terminal_id?: string;
      position?: number;
    }) => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { error } = await supabase.from('pos_quick_buttons').insert({
        tenant_id: currentTenant.id,
        terminal_id: data.terminal_id || null,
        product_id: data.product_id,
        label: data.label,
        color: data.color || null,
        position: data.position || 0,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-quick-buttons'] });
      toast({ title: 'Snelknop toegevoegd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteButton = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_quick_buttons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-quick-buttons'] });
      toast({ title: 'Snelknop verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    buttons: buttonsQuery.data || [],
    isLoading: buttonsQuery.isLoading,
    error: buttonsQuery.error,
    createButton,
    deleteButton,
    refetch: buttonsQuery.refetch,
  };
}

// ============= PARKED CARTS =============

export function usePOSParkedCarts(terminalId?: string) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cartsQuery = useQuery({
    queryKey: ['pos-parked-carts', currentTenant?.id, terminalId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from('pos_parked_carts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'parked')
        .order('parked_at', { ascending: false });

      if (terminalId) {
        query = query.eq('terminal_id', terminalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as POSParkedCart[];
    },
    enabled: !!currentTenant,
  });

  const parkCart = useMutation({
    mutationFn: async ({
      terminalId,
      sessionId,
      items,
      customerName,
      customerId,
      notes,
    }: {
      terminalId: string;
      sessionId?: string;
      items: POSCartItem[];
      customerName?: string;
      customerId?: string;
      notes?: string;
    }) => {
      if (!currentTenant || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('pos_parked_carts').insert([{
        tenant_id: currentTenant.id,
        terminal_id: terminalId,
        session_id: sessionId || null,
        customer_id: customerId || null,
        customer_name: customerName || null,
        items: JSON.parse(JSON.stringify(items)),
        notes: notes || null,
        parked_by: user.id,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-parked-carts'] });
      toast({ title: 'Winkelwagen geparkeerd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const resumeCart = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      // First get the cart data
      const { data: cart, error: fetchError } = await supabase
        .from('pos_parked_carts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Mark as resumed
      const { error } = await supabase
        .from('pos_parked_carts')
        .update({
          status: 'resumed',
          resumed_at: new Date().toISOString(),
          resumed_by: user.id,
        })
        .eq('id', id);

      if (error) throw error;
      return cart as unknown as POSParkedCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-parked-carts'] });
      toast({ title: 'Winkelwagen hervat' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteParkedCart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_parked_carts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-parked-carts'] });
      toast({ title: 'Geparkeerde winkelwagen verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    parkedCarts: cartsQuery.data || [],
    isLoading: cartsQuery.isLoading,
    error: cartsQuery.error,
    parkCart,
    resumeCart,
    deleteParkedCart,
    refetch: cartsQuery.refetch,
  };
}

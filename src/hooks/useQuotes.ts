import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { Quote, QuoteItem, QuoteFilters, QuoteItemInput, QuoteStatus } from '@/types/quote';

export function useQuotes(filters?: QuoteFilters) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes, isLoading, error, refetch } = useQuery({
    queryKey: ['quotes', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`quote_number.ilike.%${filters.search}%`);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentTenant?.id,
  });

  const createQuote = useMutation({
    mutationFn: async ({ 
      customerId, 
      items, 
      validUntil, 
      notes, 
      internalNotes,
      discountAmount = 0
    }: { 
      customerId: string; 
      items: QuoteItemInput[];
      validUntil?: Date;
      notes?: string;
      internalNotes?: string;
      discountAmount?: number;
    }) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      // Generate quote number
      const { data: quoteNumber, error: numberError } = await supabase
        .rpc('generate_quote_number', { _tenant_id: currentTenant.id });

      if (numberError) throw numberError;

      // Calculate totals
      const subtotal = items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
        return sum + itemTotal;
      }, 0);

      const taxAmount = subtotal * (currentTenant.tax_percentage || 21) / 100;
      const total = subtotal + taxAmount - discountAmount;

      // Create quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          tenant_id: currentTenant.id,
          customer_id: customerId,
          quote_number: quoteNumber,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total,
          valid_until: validUntil?.toISOString(),
          notes,
          internal_notes: internalNotes,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Create quote items
      const quoteItems = items.map((item, index) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_sku: item.product_sku || null,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        total_price: item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100),
        sort_order: index,
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) throw itemsError;

      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Offerte aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ 
      quoteId, 
      data,
      items 
    }: { 
      quoteId: string; 
      data: Partial<Quote>;
      items?: QuoteItemInput[];
    }) => {
      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update(data)
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      // If items provided, replace all items
      if (items) {
        // Delete existing items
        await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quoteId);

        // Insert new items
        const quoteItems = items.map((item, index) => ({
          quote_id: quoteId,
          product_id: item.product_id || null,
          product_name: item.product_name,
          product_sku: item.product_sku || null,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total_price: item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100),
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      toast({ title: 'Offerte bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken', description: error.message, variant: 'destructive' });
    },
  });

  const updateQuoteStatus = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      const updates: Partial<Quote> = { status };

      // Add timestamp based on status
      if (status === 'sent') updates.sent_at = new Date().toISOString();
      if (status === 'accepted') updates.accepted_at = new Date().toISOString();
      if (status === 'declined') updates.declined_at = new Date().toISOString();
      if (status === 'expired') updates.expired_at = new Date().toISOString();

      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      toast({ title: 'Status bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij status update', description: error.message, variant: 'destructive' });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Offerte verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  const generatePaymentLink = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke('create-quote-payment-link', {
        body: { quoteId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      toast({ title: 'Betalingslink aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij aanmaken link', description: error.message, variant: 'destructive' });
    },
  });

  const sendQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quoteId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      toast({ title: 'Offerte verstuurd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij versturen', description: error.message, variant: 'destructive' });
    },
  });

  const convertToOrder = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      // Fetch quote with items and customer
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`*, customer:customers(*), quote_items(*)`)
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;
      if (!quoteData) throw new Error('Offerte niet gevonden');
      if (quoteData.converted_order_id) throw new Error('Offerte is al omgezet');

      // Generate order number
      const { data: orderNumber, error: numberError } = await supabase
        .rpc('generate_order_number', { _tenant_id: currentTenant.id });
      if (numberError) throw numberError;

      const customer = quoteData.customer as any;
      const customerName = customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.company_name || customer.email
        : '';

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: currentTenant.id,
          customer_id: quoteData.customer_id,
          order_number: orderNumber,
          status: 'pending' as const,
          payment_status: 'pending' as const,
          subtotal: quoteData.subtotal,
          tax_amount: quoteData.tax_amount,
          discount_amount: quoteData.discount_amount,
          total: quoteData.total,
          customer_email: customer?.email || '',
          customer_name: customerName,
          customer_phone: customer?.phone || null,
          notes: quoteData.notes,
          internal_notes: quoteData.internal_notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items from quote items
      const items = (quoteData.quote_items as any[]) || [];
      if (items.length > 0) {
        const orderItems = items.map((item: any) => ({
          order_id: order.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          product_sku: item.product_sku || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);
        if (itemsError) throw itemsError;
      }

      // Update quote: status -> converted, link to order
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'converted', converted_order_id: order.id })
        .eq('id', quoteId);
      if (updateError) throw updateError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Offerte omgezet naar bestelling' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij omzetten', description: error.message, variant: 'destructive' });
    },
  });

  return {
    quotes: quotes ?? [],
    isLoading,
    error,
    refetch,
    createQuote,
    updateQuote,
    updateQuoteStatus,
    deleteQuote,
    generatePaymentLink,
    sendQuote,
    convertToOrder,
  };
}

export function useQuote(quoteId: string | undefined) {
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*),
          quote_items(*)
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      
      // Sort items by sort_order
      if (data.quote_items) {
        data.quote_items.sort((a: QuoteItem, b: QuoteItem) => a.sort_order - b.sort_order);
      }
      
      return data as Quote;
    },
    enabled: !!quoteId,
  });

  return { quote, isLoading, error };
}

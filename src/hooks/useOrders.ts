import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { Order, OrderItem, OrderStatus, PaymentStatus, OrderFilters } from '@/types/order';

export function useOrders(filters?: OrderFilters) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          customer:customers (*)
        `)
        .eq('tenant_id', currentTenant.id);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }
      if (filters?.sales_channel) {
        query = query.eq('sales_channel', filters.sales_channel);
      }
      if (filters?.search) {
        query = query.or(`order_number.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Sort by original_created_at (with fallback to created_at) - newest first
      const sortedData = (data as Order[]).sort((a, b) => {
        const dateA = a.original_created_at || a.created_at;
        const dateB = b.original_created_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      return sortedData;
    },
    enabled: !!currentTenant?.id,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const updateData: Partial<Order> & { fulfillment_status?: string } = { status };
      
      // Set timestamps and sync fulfillment_status based on status
      if (status === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
        updateData.fulfillment_status = 'shipped';
      } else if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.fulfillment_status = 'delivered';
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      toast({ title: 'Status bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken status', description: error.message, variant: 'destructive' });
    },
  });

  const updatePaymentStatus = useMutation({
    mutationFn: async ({ orderId, paymentStatus }: { orderId: string; paymentStatus: PaymentStatus }) => {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Betaalstatus bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken betaalstatus', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderNotes = useMutation({
    mutationFn: async ({ orderId, notes, internalNotes }: { orderId: string; notes?: string; internalNotes?: string }) => {
      const updateData: Partial<Order> = {};
      if (notes !== undefined) updateData.notes = notes;
      if (internalNotes !== undefined) updateData.internal_notes = internalNotes;

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Notities opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij opslaan notities', description: error.message, variant: 'destructive' });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Bestelling verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  return {
    orders: orders ?? [],
    isLoading,
    error,
    refetch,
    updateOrderStatus,
    updatePaymentStatus,
    updateOrderNotes,
    deleteOrder,
  };
}

export function useOrder(orderId: string | undefined) {
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          customer:customers (*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });

  return { order, isLoading, error };
}

export function useOrderStats() {
  const { currentTenant } = useTenant();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['order-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      // Get order counts by status
      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, payment_status, total')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const totalOrders = orders?.length ?? 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length ?? 0;
      const processingOrders = orders?.filter(o => o.status === 'processing').length ?? 0;
      const paidOrders = orders?.filter(o => o.payment_status === 'paid') ?? [];
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

      return {
        totalOrders,
        pendingOrders,
        processingOrders,
        totalRevenue,
      };
    },
    enabled: !!currentTenant?.id,
  });

  return { stats, isLoading };
}

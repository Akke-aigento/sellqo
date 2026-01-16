import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface PackingSlip {
  id: string;
  tenant_id: string;
  packing_slip_number: string;
  order_id: string | null;
  invoice_id: string | null;
  ship_from_address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  ship_to_address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  total_packages: number;
  total_weight: number | null;
  weight_unit: string;
  notes: string | null;
  created_at: string;
  printed_at: string | null;
}

export interface PackingSlipLine {
  id: string;
  packing_slip_id: string;
  sku: string | null;
  description: string;
  quantity: number;
}

export function usePackingSlips() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: packingSlips = [], isLoading } = useQuery({
    queryKey: ['packing-slips', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('packing_slips')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PackingSlip[];
    },
    enabled: !!currentTenant?.id,
  });

  const createPackingSlip = useMutation({
    mutationFn: async (data: {
      order_id?: string;
      invoice_id?: string;
      lines: Omit<PackingSlipLine, 'id' | 'packing_slip_id'>[];
      ship_to_address?: PackingSlip['ship_to_address'];
      notes?: string;
      total_packages?: number;
      total_weight?: number;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Generate packing slip number
      const { data: packingSlipNumber } = await supabase
        .rpc('generate_packing_slip_number', { _tenant_id: currentTenant.id });

      // Create packing slip
      const { data: packingSlip, error } = await supabase
        .from('packing_slips')
        .insert({
          tenant_id: currentTenant.id,
          packing_slip_number: packingSlipNumber,
          order_id: data.order_id,
          invoice_id: data.invoice_id,
          ship_from_address: {
            street: currentTenant.address,
            city: currentTenant.city,
            postal_code: currentTenant.postal_code,
            country: currentTenant.country,
          },
          ship_to_address: data.ship_to_address,
          total_packages: data.total_packages || 1,
          total_weight: data.total_weight,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Create lines
      if (data.lines.length > 0) {
        const lines = data.lines.map((line) => ({
          ...line,
          packing_slip_id: packingSlip.id,
        }));

        await supabase
          .from('packing_slip_lines')
          .insert(lines);
      }

      return packingSlip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-slips'] });
      toast.success('Pakbon aangemaakt');
    },
    onError: (error: Error) => {
      toast.error('Fout bij aanmaken pakbon', { description: error.message });
    },
  });

  const createFromOrder = useMutation({
    mutationFn: async (orderId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get order with items
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      // Generate packing slip number
      const { data: packingSlipNumber } = await supabase
        .rpc('generate_packing_slip_number', { _tenant_id: currentTenant.id });

      // Create packing slip
      const { data: packingSlip, error } = await supabase
        .from('packing_slips')
        .insert({
          tenant_id: currentTenant.id,
          packing_slip_number: packingSlipNumber,
          order_id: orderId,
          ship_from_address: {
            street: currentTenant.address,
            city: currentTenant.city,
            postal_code: currentTenant.postal_code,
            country: currentTenant.country,
          },
          ship_to_address: order.shipping_address,
          total_packages: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Create lines from order items (without prices!)
      if (orderItems?.length) {
        const lines = orderItems.map((item) => ({
          packing_slip_id: packingSlip.id,
          sku: item.product_sku,
          description: item.product_name,
          quantity: item.quantity,
        }));

        await supabase
          .from('packing_slip_lines')
          .insert(lines);
      }

      return packingSlip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-slips'] });
      toast.success('Pakbon aangemaakt van bestelling');
    },
    onError: (error: Error) => {
      toast.error('Fout bij aanmaken pakbon', { description: error.message });
    },
  });

  const markAsPrinted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('packing_slips')
        .update({ printed_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-slips'] });
    },
  });

  return {
    packingSlips,
    isLoading,
    createPackingSlip,
    createFromOrder,
    markAsPrinted,
  };
}

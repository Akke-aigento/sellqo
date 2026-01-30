import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface ShopifyConnectionRequest {
  id: string;
  tenant_id: string;
  store_name: string;
  store_url: string;
  status: 'pending' | 'in_review' | 'approved' | 'completed' | 'rejected';
  notes: string | null;
  admin_notes: string | null;
  install_link: string | null;
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useShopifyRequests() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['shopify-requests', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('shopify_connection_requests')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShopifyConnectionRequest[];
    },
    enabled: !!currentTenant?.id,
  });

  const createRequest = useMutation({
    mutationFn: async (params: { store_name: string; notes?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('shopify_connection_requests')
        .insert([{
          tenant_id: currentTenant.id,
          store_name: params.store_name.toLowerCase().trim(),
          notes: params.notes || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as ShopifyConnectionRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-requests'] });
      toast.success('Koppelverzoek ingediend! We nemen binnen 1-2 werkdagen contact op.');
    },
    onError: (error) => {
      toast.error('Kon verzoek niet indienen: ' + error.message);
    },
  });

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'in_review');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const completedRequests = requests.filter(r => r.status === 'completed');

  return {
    requests,
    pendingRequests,
    approvedRequests,
    completedRequests,
    isLoading,
    error,
    createRequest,
  };
}

// Admin hook for managing all requests
export function useShopifyRequestsAdmin() {
  const queryClient = useQueryClient();

  const { data: allRequests = [], isLoading, error } = useQuery({
    queryKey: ['shopify-requests-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_connection_requests')
        .select('*, tenants(name, slug)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateRequest = useMutation({
    mutationFn: async (params: {
      id: string;
      status?: ShopifyConnectionRequest['status'];
      admin_notes?: string;
      install_link?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      
      if (params.status) {
        updates.status = params.status;
        if (params.status === 'approved' || params.status === 'rejected') {
          updates.reviewed_at = new Date().toISOString();
        }
        if (params.status === 'completed') {
          updates.completed_at = new Date().toISOString();
        }
      }
      if (params.admin_notes !== undefined) updates.admin_notes = params.admin_notes;
      if (params.install_link !== undefined) updates.install_link = params.install_link;

      const { data, error } = await supabase
        .from('shopify_connection_requests')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-requests-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-requests'] });
      toast.success('Verzoek bijgewerkt');
    },
    onError: (error) => {
      toast.error('Kon verzoek niet bijwerken: ' + error.message);
    },
  });

  return {
    allRequests,
    isLoading,
    error,
    updateRequest,
  };
}

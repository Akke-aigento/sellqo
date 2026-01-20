import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { CustomerGroup, CustomerGroupMember, CustomerGroupProductPrice, CustomerGroupFormData } from '@/types/promotions';

export function useCustomerGroups() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['customer-groups', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('customer_groups')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('priority', { ascending: true });

      if (error) throw error;

      // Get member counts
      const groupIds = data.map(g => g.id);
      if (groupIds.length > 0) {
        const { data: members } = await supabase
          .from('customer_group_members')
          .select('customer_group_id')
          .in('customer_group_id', groupIds);

        const memberCounts = groupIds.reduce((acc, id) => {
          acc[id] = members?.filter(m => m.customer_group_id === id).length || 0;
          return acc;
        }, {} as Record<string, number>);

        return data.map(g => ({ ...g, member_count: memberCounts[g.id] || 0 })) as CustomerGroup[];
      }

      return data as CustomerGroup[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useCustomerGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['customer-groups', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('customer_groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CustomerGroup;
    },
    enabled: !!id,
  });
}

export function useCustomerGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['customer-group-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from('customer_group_members')
        .select(`
          *,
          customer:customers(id, email, first_name, last_name, company_name)
        `)
        .eq('customer_group_id', groupId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      return data as CustomerGroupMember[];
    },
    enabled: !!groupId,
  });
}

export function useCustomerGroupProductPrices(groupId: string | undefined) {
  return useQuery({
    queryKey: ['customer-group-prices', groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from('customer_group_product_prices')
        .select(`
          *,
          product:products(id, name, price)
        `)
        .eq('customer_group_id', groupId);

      if (error) throw error;
      return data as CustomerGroupProductPrice[];
    },
    enabled: !!groupId,
  });
}

export function useCreateCustomerGroup() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: CustomerGroupFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('customer_groups')
        .insert({
          ...formData,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast({ title: 'Klantengroep aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken klantengroep',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCustomerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<CustomerGroupFormData> }) => {
      const { data, error } = await supabase
        .from('customer_groups')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast({ title: 'Klantengroep bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken klantengroep',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCustomerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast({ title: 'Klantengroep verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen klantengroep',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAddCustomerToGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, customerId, expiresAt }: { groupId: string; customerId: string; expiresAt?: string }) => {
      const { data, error } = await supabase
        .from('customer_group_members')
        .insert({
          customer_group_id: groupId,
          customer_id: customerId,
          expires_at: expiresAt || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast({ title: 'Klant toegevoegd aan groep' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij toevoegen klant',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveCustomerFromGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, groupId }: { memberId: string; groupId: string }) => {
      const { error } = await supabase
        .from('customer_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      return groupId;
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast({ title: 'Klant verwijderd uit groep' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen klant',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSetProductPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      groupId, 
      productId, 
      customPrice, 
      discountPercentage 
    }: { 
      groupId: string; 
      productId: string; 
      customPrice?: number; 
      discountPercentage?: number;
    }) => {
      // Upsert price
      const { data, error } = await supabase
        .from('customer_group_product_prices')
        .upsert({
          customer_group_id: groupId,
          product_id: productId,
          custom_price: customPrice || null,
          discount_percentage: discountPercentage || null,
        }, {
          onConflict: 'customer_group_id,product_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-group-prices', groupId] });
      toast({ title: 'Productprijs ingesteld' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij instellen prijs',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export type SubscriptionInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'ended';

export interface SubscriptionLine {
  id: string;
  subscription_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate_id: string | null;
  vat_rate: number | null;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  interval: SubscriptionInterval;
  interval_count: number;
  subtotal: number;
  vat_total: number;
  total: number;
  start_date: string;
  end_date: string | null;
  next_invoice_date: string;
  last_invoice_date: string | null;
  status: SubscriptionStatus;
  auto_send: boolean;
  payment_term_days: number;
  generate_days_before: number;
  notify_before_renewal: boolean;
  notify_days_before: number;
  created_at: string;
  updated_at: string;
  lines?: SubscriptionLine[];
  customer?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  customerId?: string;
}

export interface CreateSubscriptionInput {
  customer_id: string;
  name: string;
  interval: SubscriptionInterval;
  interval_count: number;
  start_date: string;
  end_date?: string | null;
  auto_send: boolean;
  payment_term_days: number;
  generate_days_before: number;
  notify_before_renewal: boolean;
  notify_days_before: number;
  lines: {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate_id?: string | null;
    vat_rate?: number | null;
  }[];
}

export function useSubscriptions(filters?: SubscriptionFilters) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['subscriptions', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(id, email, first_name, last_name, company_name),
          lines:subscription_lines(*)
        `)
        .eq('tenant_id', tenantId)
        .order('next_invoice_date', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!tenantId,
  });
}

export function useSubscription(id: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['subscription', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(id, email, first_name, last_name, company_name),
          lines:subscription_lines(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!id && !!tenantId,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const vatTotal = input.lines.reduce((sum, line) => {
        const lineTotal = line.quantity * line.unit_price;
        return sum + (lineTotal * (line.vat_rate || 0) / 100);
      }, 0);
      const total = subtotal + vatTotal;

      // Create subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: currentTenant.id,
          customer_id: input.customer_id,
          name: input.name,
          interval: input.interval,
          interval_count: input.interval_count,
          start_date: input.start_date,
          end_date: input.end_date,
          next_invoice_date: input.start_date,
          subtotal,
          vat_total: vatTotal,
          total,
          auto_send: input.auto_send,
          payment_term_days: input.payment_term_days,
          generate_days_before: input.generate_days_before,
          notify_before_renewal: input.notify_before_renewal,
          notify_days_before: input.notify_days_before,
        })
        .select()
        .single();

      if (subError) throw subError;

      // Create lines
      if (input.lines.length > 0) {
        const { error: linesError } = await supabase
          .from('subscription_lines')
          .insert(
            input.lines.map((line, index) => ({
              subscription_id: subscription.id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              vat_rate_id: line.vat_rate_id,
              vat_rate: line.vat_rate,
              sort_order: index,
            }))
          );

        if (linesError) throw linesError;
      }

      return subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Abonnement aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Subscription> & { id: string }) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', data.id] });
      toast({ title: 'Abonnement bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateSubscriptionStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SubscriptionStatus }) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Status bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Abonnement verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

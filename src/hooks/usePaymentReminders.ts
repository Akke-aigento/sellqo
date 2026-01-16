import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface PaymentReminder {
  id: string;
  invoice_id: string;
  level: 1 | 2 | 3;
  sent_at: string;
  late_fee_amount: number;
  total_due_amount: number | null;
  email_sent_to: string | null;
  created_at: string;
}

export interface ReminderSettings {
  reminders_enabled: boolean;
  reminder_level1_days: number;
  reminder_level2_days: number;
  reminder_level3_days: number;
  reminder_late_fee_enabled: boolean;
  reminder_late_fee_percentage: number;
}

export function usePaymentReminders() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['payment-reminders', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('payment_reminders')
        .select(`
          *,
          invoice:invoices(id, invoice_number, customer_id, total)
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data as (PaymentReminder & { invoice: any })[];
    },
    enabled: !!currentTenant?.id,
  });

  const settings: ReminderSettings = {
    reminders_enabled: currentTenant?.reminders_enabled ?? false,
    reminder_level1_days: currentTenant?.reminder_level1_days ?? 7,
    reminder_level2_days: currentTenant?.reminder_level2_days ?? 21,
    reminder_level3_days: currentTenant?.reminder_level3_days ?? 35,
    reminder_late_fee_enabled: currentTenant?.reminder_late_fee_enabled ?? false,
    reminder_late_fee_percentage: currentTenant?.reminder_late_fee_percentage ?? 10,
  };

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<ReminderSettings>) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const { error } = await supabase
        .from('tenants')
        .update(newSettings)
        .eq('id', currentTenant.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Herinneringsinstellingen opgeslagen');
    },
    onError: (error: Error) => {
      toast.error('Fout bij opslaan', { description: error.message });
    },
  });

  const sendReminder = useMutation({
    mutationFn: async ({ invoiceId, level }: { invoiceId: string; level: 1 | 2 | 3 }) => {
      // Get invoice details
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(email, first_name, last_name, company_name)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Calculate late fee if level 3 and enabled
      let lateFeeAmount = 0;
      let totalDueAmount = invoice.total;

      if (level === 3 && settings.reminder_late_fee_enabled) {
        lateFeeAmount = invoice.total * (settings.reminder_late_fee_percentage / 100);
        totalDueAmount = invoice.total + lateFeeAmount;
      }

      // Create reminder record
      const { error } = await supabase
        .from('payment_reminders')
        .insert({
          invoice_id: invoiceId,
          level,
          late_fee_amount: lateFeeAmount,
          total_due_amount: totalDueAmount,
          email_sent_to: invoice.customer?.email,
        });

      if (error) throw error;

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          reminder_level: level,
          last_reminder_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      // TODO: Send actual email via edge function
      // await supabase.functions.invoke('send-payment-reminder', { ... });

      return { invoice, level, lateFeeAmount, totalDueAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Herinnering niveau ${data.level} verstuurd`);
    },
    onError: (error: Error) => {
      toast.error('Fout bij versturen herinnering', { description: error.message });
    },
  });

  return {
    reminders,
    isLoading,
    settings,
    updateSettings,
    sendReminder,
  };
}

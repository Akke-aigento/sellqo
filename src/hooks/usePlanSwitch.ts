import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlanSwitchPreview {
  current_plan: {
    id: string;
    name: string;
    price: number;
    interval: 'monthly' | 'yearly';
  };
  target_plan: {
    id: string;
    name: string;
    price: number;
    interval: 'monthly' | 'yearly';
  };
  proration: {
    days_remaining: number;
    unused_credit: number;
    amount_due_now: number;
    next_invoice_date: string;
  };
  addons: {
    to_migrate: Array<{
      id: string;
      type: string;
      monthly_price: number;
    }>;
    monthly_savings: number;
  };
  features: {
    gained: string[];
    lost: string[];
  };
  is_upgrade: boolean;
  stripe_preview: {
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
  };
}

export function useCalculatePlanSwitch() {
  return useMutation({
    mutationFn: async (params: {
      target_plan_id: string;
      target_interval?: 'monthly' | 'yearly';
    }): Promise<PlanSwitchPreview> => {
      const { data, error } = await supabase.functions.invoke('calculate-plan-switch', {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onError: (error) => {
      toast.error('Kon plan preview niet berekenen: ' + error.message);
    },
  });
}

export function useExecutePlanSwitch() {
  return useMutation({
    mutationFn: async (params: {
      target_plan_id: string;
      target_interval?: 'monthly' | 'yearly';
      proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
    }) => {
      const { data, error } = await supabase.functions.invoke('execute-plan-switch', {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Plan succesvol gewijzigd naar ${data.new_plan.name}`);
      if (data.migrated_addons?.length > 0) {
        toast.info(`${data.migrated_addons.length} add-on(s) zijn nu inbegrepen in je plan`);
      }
    },
    onError: (error) => {
      toast.error('Kon plan niet wijzigen: ' + error.message);
    },
  });
}

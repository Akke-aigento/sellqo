import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { GiftCard, GiftCardFormData, GiftCardStats } from '@/types/giftCard';

export function useGiftCards() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['gift-cards', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          design:gift_card_designs(*)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as GiftCard[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useGiftCard(id: string | undefined) {
  return useQuery({
    queryKey: ['gift-cards', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          design:gift_card_designs(*),
          transactions:gift_card_transactions(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as GiftCard;
    },
    enabled: !!id,
  });
}

export function useGiftCardStats() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['gift-card-stats', currentTenant?.id],
    queryFn: async (): Promise<GiftCardStats> => {
      if (!currentTenant?.id) {
        return {
          total_issued: 0,
          total_issued_amount: 0,
          total_redeemed_amount: 0,
          outstanding_balance: 0,
          active_count: 0,
          depleted_count: 0,
          expired_count: 0,
        };
      }

      const { data, error } = await supabase
        .from('gift_cards')
        .select('initial_balance, current_balance, status')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const stats = (data || []).reduce(
        (acc, card) => ({
          total_issued: acc.total_issued + 1,
          total_issued_amount: acc.total_issued_amount + Number(card.initial_balance),
          total_redeemed_amount:
            acc.total_redeemed_amount +
            (Number(card.initial_balance) - Number(card.current_balance)),
          outstanding_balance: acc.outstanding_balance + Number(card.current_balance),
          active_count: acc.active_count + (card.status === 'active' ? 1 : 0),
          depleted_count: acc.depleted_count + (card.status === 'depleted' ? 1 : 0),
          expired_count: acc.expired_count + (card.status === 'expired' ? 1 : 0),
        }),
        {
          total_issued: 0,
          total_issued_amount: 0,
          total_redeemed_amount: 0,
          outstanding_balance: 0,
          active_count: 0,
          depleted_count: 0,
          expired_count: 0,
        }
      );

      return stats;
    },
    enabled: !!currentTenant?.id,
  });
}

export function useCreateGiftCard() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: GiftCardFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      // Generate unique code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_gift_card_code');
      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from('gift_cards')
        .insert({
          tenant_id: currentTenant.id,
          code: codeData,
          initial_balance: formData.initial_balance,
          current_balance: formData.initial_balance,
          currency: formData.currency || 'EUR',
          recipient_email: formData.recipient_email,
          recipient_name: formData.recipient_name,
          personal_message: formData.personal_message,
          design_id: formData.design_id,
          expires_at: formData.expires_at,
        })
        .select()
        .single();

      if (error) throw error;

      // Create purchase transaction
      await supabase.from('gift_card_transactions').insert({
        gift_card_id: data.id,
        transaction_type: 'purchase',
        amount: formData.initial_balance,
        balance_after: formData.initial_balance,
        description: 'Handmatig aangemaakt',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-stats'] });
      toast({ title: 'Cadeaukaart aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken cadeaukaart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: Partial<GiftCard>;
    }) => {
      const { data, error } = await supabase
        .from('gift_cards')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-stats'] });
      toast({ title: 'Cadeaukaart bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken cadeaukaart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAdjustGiftCardBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      description,
    }: {
      id: string;
      amount: number;
      description: string;
    }) => {
      // Get current balance
      const { data: card, error: fetchError } = await supabase
        .from('gift_cards')
        .select('current_balance, status')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = Number(card.current_balance) + amount;
      if (newBalance < 0) throw new Error('Saldo kan niet negatief worden');

      const newStatus = newBalance <= 0 ? 'depleted' : 'active';

      // Update balance
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({
          current_balance: newBalance,
          status: newStatus,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Record transaction
      const { error: txError } = await supabase.from('gift_card_transactions').insert({
        gift_card_id: id,
        transaction_type: 'adjustment',
        amount: amount,
        balance_after: newBalance,
        description: description,
      });

      if (txError) throw txError;

      return { newBalance };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-stats'] });
      toast({ title: 'Saldo aangepast' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanpassen saldo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useValidateGiftCardCode() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!currentTenant?.id) throw new Error('Geen tenant');

      const { data, error } = await supabase
        .from('gift_cards')
        .select('id, code, current_balance, status, expires_at')
        .eq('tenant_id', currentTenant.id)
        .eq('code', code.toUpperCase().trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Ongeldige cadeaukaart code');
        }
        throw error;
      }

      if (data.status !== 'active') {
        throw new Error('Deze cadeaukaart is niet actief');
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Deze cadeaukaart is verlopen');
      }

      if (Number(data.current_balance) <= 0) {
        throw new Error('Deze cadeaukaart heeft geen saldo meer');
      }

      return data as Pick<GiftCard, 'id' | 'code' | 'current_balance' | 'status' | 'expires_at'>;
    },
  });
}

export function useSendGiftCardEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (giftCardId: string) => {
      const { data, error } = await supabase.functions.invoke('send-gift-card-email', {
        body: { gift_card_id: giftCardId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      toast({ title: 'Email verzonden' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verzenden email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

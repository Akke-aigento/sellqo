import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { GiftCard } from '@/types/giftCard';

interface CreatePOSGiftCardParams {
  amount: number;
  designId?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  personalMessage?: string | null;
  expiresAt?: string | null;
  terminalId: string;
  transactionId?: string | null;
  sendEmail?: boolean;
}

export function usePOSGiftCardSale() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  const createGiftCard = useMutation({
    mutationFn: async (params: CreatePOSGiftCardParams): Promise<GiftCard> => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      // Generate unique code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_gift_card_code');
      if (codeError) throw codeError;

      const code = codeData as string;

      // Create gift card
      const { data: giftCard, error: giftCardError } = await supabase
        .from('gift_cards')
        .insert({
          tenant_id: currentTenant.id,
          code,
          initial_balance: params.amount,
          current_balance: params.amount,
          currency: 'EUR',
          status: 'active',
          design_id: params.designId,
          recipient_name: params.recipientName,
          recipient_email: params.recipientEmail,
          personal_message: params.personalMessage,
          expires_at: params.expiresAt,
          activated_at: new Date().toISOString(),
          sold_via_pos: true,
          pos_terminal_id: params.terminalId,
          pos_transaction_id: params.transactionId,
        })
        .select(`
          *,
          design:gift_card_designs(*)
        `)
        .single();

      if (giftCardError) throw giftCardError;

      // Record purchase transaction
      const { error: transactionError } = await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: giftCard.id,
          transaction_type: 'purchase',
          amount: params.amount,
          balance_after: params.amount,
          description: 'Aankoop via POS',
        });

      if (transactionError) throw transactionError;

      // Send email if requested and recipient email exists
      if (params.sendEmail && params.recipientEmail) {
        try {
          await supabase.functions.invoke('send-gift-card-email', {
            body: { gift_card_id: giftCard.id },
          });
        } catch (emailError) {
          console.error('Failed to send gift card email:', emailError);
          // Don't fail the transaction, just log the error
        }
      }

      return giftCard as unknown as GiftCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
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

  const markAsPrinted = useMutation({
    mutationFn: async (giftCardId: string) => {
      const { error } = await supabase
        .from('gift_cards')
        .update({ printed_at: new Date().toISOString() })
        .eq('id', giftCardId);

      if (error) throw error;
    },
  });

  return {
    createGiftCard,
    markAsPrinted,
    isCreating: createGiftCard.isPending,
  };
}

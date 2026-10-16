// MARKETING-2 — terugkeer uit de Stripe-checkout voor AI-credits (?purchase=success|cancelled|open).
// Verhuisd uit AIMarketingHub (AI-CRED-2): niet blind "toegevoegd" melden, maar de betaling laten
// nakijken door verify-ai-credits-purchase (idempotent; de webhook blijft het vangnet).

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function useAICreditsReturn(onOpenPurchase: () => void, refetchCredits: () => void) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    if (!purchaseStatus) return;
    const creditsAdded = searchParams.get('credits');
    const sessionId = searchParams.get('session_id');
    const next = new URLSearchParams(searchParams);
    next.delete('purchase');
    next.delete('credits');
    next.delete('session_id');
    setSearchParams(next, { replace: true });

    if (purchaseStatus === 'success' && creditsAdded) {
      const verify = async () => {
        if (!sessionId) {
          refetchCredits();
          return;
        }
        const { data, error } = await supabase.functions.invoke('verify-ai-credits-purchase', { body: { sessionId } });
        const status = (data as { status?: string } | null)?.status;
        if (!error && (status === 'granted' || status === 'already_completed')) {
          toast.success(t('admin.aiCredits.return.added', { count: Number(creditsAdded) }), {
            description: t('admin.aiCredits.return.addedDescription'),
          });
        } else if (!error && status === 'pending') {
          toast.info(t('admin.aiCredits.return.pending'), { description: t('admin.aiCredits.return.pendingDescription') });
        } else {
          toast.error(t('admin.aiCredits.return.unconfirmed'), { description: t('admin.aiCredits.return.unconfirmedDescription') });
        }
        refetchCredits();
      };
      void verify();
    } else if (purchaseStatus === 'cancelled') {
      toast.info(t('admin.aiCredits.return.cancelled'));
    } else if (purchaseStatus === 'open') {
      onOpenPurchase();
    }
  }, [searchParams, setSearchParams, refetchCredits, onOpenPurchase, t]);
}

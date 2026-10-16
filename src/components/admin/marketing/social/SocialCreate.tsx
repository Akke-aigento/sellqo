// MARKETING-2 — tab "Maken" in Social: de AI-tools die vroeger in de AI Content Hub zaten,
// nu op de plek waar posts leven. Promo-kit, social post, beeld en (voor winkels met de module)
// de menukaart. Een gemaakte post gaat altijd naar de planning ter goedkeuring (MARKETING-1).

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeatureGate, useFeatureAccess } from '@/components/FeatureGate';
import { AICreditsBadge } from '@/components/admin/marketing/AICreditsBadge';
import { CreditPurchaseDialog } from '@/components/admin/marketing/CreditPurchaseDialog';
import { InlinePromoWizard } from '@/components/admin/marketing/InlinePromoWizard';
import { AdvancedToolsGrid } from '@/components/admin/marketing/AdvancedToolsGrid';
import { ContentMenuTab } from '@/components/admin/marketing/menu/ContentMenuTab';
import { useAICredits } from '@/hooks/useAICredits';
import { useAICreditsReturn } from '@/hooks/useAICreditsReturn';

export function SocialCreate() {
  const { t } = useTranslation();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const { refetch } = useAICredits();
  const openPurchase = useCallback(() => setPurchaseOpen(true), []);
  const refetchCredits = useCallback(() => { void refetch(); }, [refetch]);
  useAICreditsReturn(openPurchase, refetchCredits);
  const hasMenu = useFeatureAccess('social_commerce');
  const tool = searchParams.get('tool');
  const initialTool = tool === 'images' ? 'images' : tool === 'social' ? 'social' : null;

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground max-w-xl">{t('admin.socialPlanner.create.intro')}</p>
          <AICreditsBadge variant="full" onUpgrade={openPurchase} />
        </div>

        <InlinePromoWizard onNeedCredits={openPurchase} />

        <AdvancedToolsGrid only={['social', 'images']} title={t('admin.socialPlanner.create.tools')} initialTool={initialTool} />

        {hasMenu && (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">{t('admin.socialPlanner.create.menu')}</h3>
            <ContentMenuTab />
          </section>
        )}

        <CreditPurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      </div>
    </FeatureGate>
  );
}

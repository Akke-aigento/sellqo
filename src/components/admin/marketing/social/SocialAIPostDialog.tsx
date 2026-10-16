// MARKETING-3 — "Post met AI" op Social. Vervangt de tab "Maken" (promo-wizard, toolraster,
// menukaart), die in de praktijk niet gebruikt werd. Eén knop, één dialoog, op de plek waar
// posts leven. Een gemaakte post gaat naar de planning ter goedkeuring (MARKETING-1).

import { useTranslation } from 'react-i18next';
import { FeatureGate } from '@/components/FeatureGate';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { AICreditsBadge } from '@/components/admin/marketing/AICreditsBadge';
import { SocialPostGenerator } from '@/components/admin/marketing/SocialPostGenerator';

interface SocialAIPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Product(en) om meteen mee te starten, bv. vanuit een coach-melding (?product=). */
  productIds?: string[];
  onNeedCredits: () => void;
}

export function SocialAIPostDialog({ open, onOpenChange, productIds, onNeedCredits }: SocialAIPostDialogProps) {
  const { t } = useTranslation();
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.socialPlanner.aiPost.title')}
      description={t('admin.socialPlanner.aiPost.description')}
      maxWidth="3xl"
    >
      <FeatureGate feature="ai_marketing">
        <div className="space-y-4">
          <div className="flex justify-end">
            <AICreditsBadge variant="full" onUpgrade={onNeedCredits} />
          </div>
          {open && (
            <SocialPostGenerator
              initialProductIds={productIds}
              initialContentType={productIds?.length ? 'product_highlight' : undefined}
              onAdded={() => onOpenChange(false)}
            />
          )}
        </div>
      </FeatureGate>
    </ResponsiveDialog>
  );
}

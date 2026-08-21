import { useTranslation } from 'react-i18next';
import { UtensilsCrossed } from 'lucide-react';

import { FeatureGate } from '@/components/FeatureGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBrandDna, EMPTY_BRAND_DNA } from '@/hooks/useBrandDna';
import type { TenantBrandDna, TenantBrandDnaInput } from '@/types/content-menu';

import { BrandDnaCard } from './BrandDnaCard';
import { MorningMenuCard } from './MorningMenuCard';

/**
 * Zet de opgeslagen rij om naar de vorm die het formulier schrijft. Bestaat
 * zodat elke kaart bij het opslaan een compleet record kan meesturen: de
 * upsert vervangt de hele rij, dus wie alleen zijn eigen velden stuurt, wist
 * die van de andere kaart.
 */
function toBrandDnaInput(row: TenantBrandDna | null): TenantBrandDnaInput {
  if (!row) return { ...EMPTY_BRAND_DNA };
  return {
    brand_mission: row.brand_mission,
    target_audience: row.target_audience,
    tone_keywords: row.tone_keywords ?? [],
    usps: row.usps ?? [],
    dos: row.dos,
    donts: row.donts,
    themes: row.themes ?? [],
    hashtag_sets: row.hashtag_sets ?? {},
    free_dna: row.free_dna,
    menu_counts: row.menu_counts ?? {},
    format_emphasis: row.format_emphasis ?? EMPTY_BRAND_DNA.format_emphasis,
  };
}

function ContentMenuBody() {
  const { t } = useTranslation();
  const {
    brandDna,
    categories,
    isLoading,
    isError,
    saveBrandDna,
    createCategory,
    updateCategory,
    deactivateCategory,
    deleteCategory,
  } = useBrandDna();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('content_menu.errors.load_failed')}</AlertDescription>
      </Alert>
    );
  }

  const saved = toBrandDnaInput(brandDna);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shrink-0">
          <UtensilsCrossed className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('content_menu.header.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('content_menu.header.description')}
          </p>
        </div>
      </div>

      <BrandDnaCard
        saved={saved}
        onSave={(fields) => saveBrandDna.mutate({ ...saved, ...fields })}
        isSaving={saveBrandDna.isPending}
      />

      <MorningMenuCard
        saved={saved}
        categories={categories}
        onSave={(fields) => saveBrandDna.mutate({ ...saved, ...fields })}
        isSaving={saveBrandDna.isPending}
        onCreateCategory={createCategory.mutateAsync}
        onUpdateCategory={updateCategory.mutateAsync}
        onDeactivateCategory={deactivateCategory.mutateAsync}
        onDeleteCategory={deleteCategory.mutateAsync}
      />
    </div>
  );
}

export function ContentMenuTab() {
  return (
    <FeatureGate feature="social_commerce">
      <ContentMenuBody />
    </FeatureGate>
  );
}

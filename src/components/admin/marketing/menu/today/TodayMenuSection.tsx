import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, UtensilsCrossed } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyMenu } from '@/hooks/useDailyMenu';
import { useAICredits } from '@/hooks/useAICredits';
import { CONTENT_MENU_CATEGORIES } from '@/config/contentMenuCategories';
import type { MenuCard } from '@/types/daily-menu';

import { MenuCardPreview } from './MenuCardPreview';
import { MenuCardActions } from './MenuCardActions';

/** Wat een menu kost. Spiegelt MENU_CREDITS in ai-generate-daily-menu. */
const MENU_CREDITS = 5;

const LABEL_KEY_BY_CATEGORY = new Map(
  CONTENT_MENU_CATEGORIES.map((c) => [c.key, c.labelKey]),
);

export function TodayMenuSection() {
  const { t } = useTranslation();
  const { cards, isLoading, generate, updateCard, discardCard, attachImage, markUsed } =
    useDailyMenu();
  const { hasCredits } = useAICredits();

  const errorCode = (generate.error as { code?: string } | null)?.code;
  const enoughCredits = hasCredits(MENU_CREDITS);

  /**
   * Vaste categorieën dragen een i18n-key, eigen categorieën hun eigen naam.
   * Vandaar deze splitsing in plaats van overal `t()` erop loslaten.
   */
  const labelFor = (card: MenuCard): string => {
    if (card.metadata?.is_custom) return card.metadata.category_label;
    const key = LABEL_KEY_BY_CATEGORY.get(card.metadata?.category_key);
    return key ? t(key) : (card.metadata?.category_label ?? '');
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-amber-500/5 via-background to-orange-500/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              {t('content_menu.today.title')}
            </CardTitle>
            <CardDescription>{t('content_menu.today.description')}</CardDescription>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !enoughCredits}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {generate.isPending
              ? t('content_menu.today.generating')
              : t('content_menu.today.generate', { credits: MENU_CREDITS })}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!enoughCredits && (
          <Alert>
            <AlertDescription>
              {t('content_menu.today.errors.insufficient_credits')}
            </AlertDescription>
          </Alert>
        )}

        {errorCode === 'brand_dna_missing' && (
          <Alert>
            <AlertDescription>{t('content_menu.today.errors.brand_dna_missing')}</AlertDescription>
          </Alert>
        )}

        {errorCode === 'menu_empty' && (
          <Alert>
            <AlertDescription>{t('content_menu.today.errors.menu_empty')}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {t('content_menu.today.empty')}
          </p>
        )}

        {cards.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <div key={card.id} className="rounded-lg border bg-background p-3 flex flex-col">
                <div className="flex-1">
                  <MenuCardPreview card={card} categoryLabel={labelFor(card)} />
                </div>
                <MenuCardActions
                  card={card}
                  onUpdate={updateCard.mutateAsync}
                  onDiscard={discardCard.mutateAsync}
                  onAttachImage={attachImage.mutateAsync}
                  onMarkUsed={markUsed.mutateAsync}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

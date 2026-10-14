import { useState, useEffect } from 'react';
import { Store, ArrowRight, Loader2, Check, X, ShoppingBag, UtensilsCrossed, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { OnboardingTooltip } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

const SECTORS = [
  { id: 'retail', icon: ShoppingBag },
  { id: 'horeca', icon: UtensilsCrossed },
  { id: 'events', icon: Ticket },
] as const;

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  generateSlug: (name: string) => string;
  checkSlugAvailable: (slug: string) => Promise<boolean>;
}

export function WelcomeStep({
  data,
  updateData,
  onNext,
  generateSlug,
  checkSlugAvailable,
}: WelcomeStepProps) {
  const { t } = useTranslation();
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Auto-generate slug when shop name changes
  useEffect(() => {
    if (data.shopName) {
      const slug = generateSlug(data.shopName);
      updateData({ shopSlug: slug });
    }
  }, [data.shopName, generateSlug, updateData]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!data.shopSlug) {
      setIsSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      setSlugError(null);
      
      try {
        const available = await checkSlugAvailable(data.shopSlug);
        setIsSlugAvailable(available);
        if (!available) {
          setSlugError(t('onboarding.welcome.slug_taken'));
        }
      } catch (error) {
        setSlugError(t('onboarding.welcome.slug_check_failed'));
      }
      
      setIsCheckingSlug(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [data.shopSlug, checkSlugAvailable, t]);

  const canContinue = data.shopName.trim().length >= 2 && isSlugAvailable === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{t('onboarding.welcome.title')}</h2>
        <p className="text-muted-foreground">{t('onboarding.welcome.subtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* MODULES-1 — wat verkoop je? Bepaalt welke sectormodule aangaat. */}
        <div className="space-y-2">
          <Label>{t('onboarding.welcome.sector_label')}</Label>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('onboarding.welcome.sector_label')}>
            {SECTORS.map(({ id, icon: Icon }) => {
              const active = (data.sector || 'retail') === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={active} onClick={() => updateData({ sector: id })}
                  className={cn('flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/40')}>
                  <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-sm font-medium">{t(`onboarding.welcome.sector_${id}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`onboarding.welcome.sector_${id}_hint`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="shopName">{t('onboarding.welcome.name_label')}</Label>
            <OnboardingTooltip
              title={t('onboarding.welcome.name_tip_title')}
              content={t('onboarding.welcome.name_tip')}
            />
          </div>
          <Input
            id="shopName"
            value={data.shopName}
            onChange={(e) => updateData({ shopName: e.target.value })}
            placeholder={t('onboarding.welcome.name_placeholder')}
            autoFocus
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="shopSlug">{t('onboarding.welcome.url_label')}</Label>
            <OnboardingTooltip
              title={t('onboarding.welcome.url_label')}
              content={t('onboarding.welcome.url_tip')}
            />
          </div>
          <div className="flex items-center">
            <div className="relative flex-1">
              <Input
                id="shopSlug"
                value={data.shopSlug}
                onChange={(e) => updateData({ shopSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder={t('onboarding.welcome.url_placeholder')}
                className={cn(
                  'rounded-r-none pr-10',
                  isSlugAvailable === true && 'border-green-500 focus-visible:ring-green-500',
                  isSlugAvailable === false && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingSlug && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isCheckingSlug && isSlugAvailable === true && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {!isCheckingSlug && isSlugAvailable === false && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            <div className="flex-shrink-0 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-r-md border border-l-0">
              .sellqo.shop
            </div>
          </div>
          {slugError && (
            <p className="text-sm text-destructive">{slugError}</p>
          )}
          {isSlugAvailable === true && (
            <p className="text-sm text-green-600">✓ {t('onboarding.welcome.slug_free', { url: `${data.shopSlug}.sellqo.shop` })}</p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!canContinue}
        >
          {t('onboarding.welcome.next')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// PRICE-2 — /pricing: dezelfde prijzen als op de homepage (één component, uit pricing_plans),
// met ?sector=horeca|events om meteen het juiste tabblad te openen.
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ForcedLightMode } from '@/components/ForcedLightMode';
import { PageMeta } from '@/components/seo/PageMeta';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { PricingSection, type PricingTab } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';

export default function PricingPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const raw = params.get('sector');
  const initialTab: PricingTab = raw === 'horeca' || raw === 'events' ? raw : 'retail';
  return (
    <ForcedLightMode>
      <PageMeta title={t('landing.pricing.meta_title')} description={t('landing.pricing.meta_desc')} path="/pricing" />
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-[calc(5rem+var(--safe-top))]">
          <div className="container mx-auto max-w-6xl px-4 pt-12 md:pt-16">
            <h1 className="max-w-2xl text-4xl font-bold text-foreground md:text-5xl">{t('landing.pricing.heading')}</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t('landing.pricing.subheading')}</p>
          </div>
          <PricingSection initialTab={initialTab} heading={false} />
          <FaqSection />
        </main>
        <LandingFooter />
      </div>
    </ForcedLightMode>
  );
}

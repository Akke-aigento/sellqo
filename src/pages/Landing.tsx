import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SolutionOverviewSection } from '@/components/landing/SolutionOverviewSection';
import { IntegrationsShowcaseSection } from '@/components/landing/IntegrationsShowcaseSection';
import { UniqueAdvantagesSection } from '@/components/landing/UniqueAdvantagesSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ForcedLightMode } from '@/components/ForcedLightMode';
import { PageMeta } from '@/components/seo/PageMeta';

export default function LandingPage() {
  return (
    <ForcedLightMode>
      <PageMeta
        title="Sellqo — Jouw webshop, bol.com & POS in één platform"
        description="Start je webshop, koppel bol.com en verkoop in de winkel met de POS. Eén abonnement, geen transactiekosten. 14 dagen gratis proberen."
        path="/"
      />
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main>
          <HeroSection />
          <SocialProofSection />
          <ProblemSection />
          <SolutionOverviewSection />
          <IntegrationsShowcaseSection />
          <UniqueAdvantagesSection />
          <FeaturesSection />
          <ComparisonSection />
          <TestimonialsSection />
          <PricingSection />
          <FaqSection />
          <FinalCtaSection />
        </main>
        <LandingFooter />
      </div>
    </ForcedLightMode>
  );
}

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

export default function LandingPage() {
  return (
    <ForcedLightMode>
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

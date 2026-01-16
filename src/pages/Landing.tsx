import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { WhySellqoSection } from '@/components/landing/WhySellqoSection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { DemoSection } from '@/components/landing/DemoSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <SocialProofSection />
        <ProblemSection />
        <FeaturesSection />
        <WhySellqoSection />
        <ComparisonSection />
        <PricingSection />
        <TestimonialsSection />
        <DemoSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

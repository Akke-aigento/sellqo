import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { IntegrationsShowcaseSection } from '@/components/landing/IntegrationsShowcaseSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { SectorsSection } from '@/components/landing/SectorsSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ForcedLightMode } from '@/components/ForcedLightMode';
import { PageMeta } from '@/components/seo/PageMeta';
import { useEffect } from 'react';

export default function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    // Wait for sections to render, then scroll
    const timer = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ForcedLightMode>
      <PageMeta
        title="SellQo — webshop, kassa en bestellingen voor winkels, horeca en events"
        description="Je eigen webshop op jouwzaak.sellqo.shop, een kassa, een bestelsite voor horeca en tickets voor events. Gebouwd in België, gratis te starten."
        path="/"
      />
      <div className="min-h-screen bg-background">
        <LandingNavbar tone="dark" />
        <main>
          <HeroSection />
          <SocialProofSection />
          <SectorsSection />
          <FeaturesSection />
          <IntegrationsShowcaseSection />
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

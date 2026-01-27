import { ReactNode } from 'react';
import { LandingNavbar } from './LandingNavbar';
import { LandingFooter } from './LandingFooter';
import { ForcedLightMode } from '@/components/ForcedLightMode';

interface PublicPageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function PublicPageLayout({ children, title, subtitle }: PublicPageLayoutProps) {
  return (
    <ForcedLightMode>
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main className="pt-20">
          {/* Hero Header */}
          <div className="bg-gradient-to-b from-secondary/50 to-background py-16 md:py-24">
            <div className="container mx-auto px-4 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {title}
              </h1>
              {subtitle && (
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {/* Content */}
          <div className="container mx-auto px-4 py-12 md:py-16">
            {children}
          </div>
        </main>
        <LandingFooter />
      </div>
    </ForcedLightMode>
  );
}

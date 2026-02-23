import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { HeroSection } from '@/components/storefront/sections/HeroSection';
import { FeaturedProductsSection } from '@/components/storefront/sections/FeaturedProductsSection';
import { CollectionSection } from '@/components/storefront/sections/CollectionSection';
import { TextImageSection } from '@/components/storefront/sections/TextImageSection';
import { NewsletterSection } from '@/components/storefront/sections/NewsletterSection';
import { TestimonialsSection } from '@/components/storefront/sections/TestimonialsSection';
import { VideoSection } from '@/components/storefront/sections/VideoSection';
import { ExternalReviewsSection } from '@/components/storefront/sections/ExternalReviewsSection';
import { AnnouncementSection } from '@/components/storefront/sections/AnnouncementSection';
import type { HomepageSection } from '@/types/storefront';
import { Helmet } from 'react-helmet-async';

export default function ShopHome() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, themeSettings, homepageSections } = usePublicStorefront(tenantSlug || '');

  const renderSection = (section: HomepageSection) => {
    const key = section.id;
    
    switch (section.section_type) {
      case 'hero':
        return <HeroSection key={key} section={section} tenantId={tenant?.id} />;
      case 'featured_products':
        return <FeaturedProductsSection key={key} section={section} tenantId={tenant?.id} />;
      case 'collection':
        return <CollectionSection key={key} section={section} tenantId={tenant?.id} />;
      case 'text_image':
        return <TextImageSection key={key} section={section} />;
      case 'newsletter':
        return <NewsletterSection key={key} section={section} tenantId={tenant?.id} />;
      case 'testimonials':
        return <TestimonialsSection key={key} section={section} />;
      case 'video':
        return <VideoSection key={key} section={section} />;
      case 'announcement':
        return <AnnouncementSection key={key} section={section} />;
      case 'external_reviews':
        return <ExternalReviewsSection key={key} section={section} tenantId={tenant?.id} />;
      default:
        return null;
    }
  };

  return (
    <ShopLayout>
      <Helmet>
        <title>{tenant?.name || 'Shop'}</title>
      </Helmet>
      
      {homepageSections.length > 0 ? (
        <div className="space-y-0">
          {homepageSections.map(renderSection)}
        </div>
      ) : (
        // Default homepage if no sections configured
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 
            className="text-4xl font-bold mb-4"
            style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
          >
            Welkom bij {tenant?.name}
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Ontdek onze producten
          </p>
          <a 
            href={`/shop/${tenantSlug}/products`}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: themeSettings?.primary_color || 'hsl(var(--primary))',
              color: '#ffffff'
            }}
          >
            Bekijk Producten
          </a>
        </div>
      )}
    </ShopLayout>
  );
}

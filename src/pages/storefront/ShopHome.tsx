import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { getSectionRenderer } from '@/components/storefront/sections/registry';
import type { HomepageSection } from '@/types/storefront';
import { Helmet } from 'react-helmet-async';

export default function ShopHome() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, themeSettings, homepageSections } = usePublicStorefront(tenantSlug || '');

  const basePath = `/shop/${tenantSlug}`;

  const renderSection = (section: HomepageSection) => {
    const Renderer = getSectionRenderer(section.section_type);
    if (!Renderer) return null;

    return (
      <Renderer
        key={section.id}
        section={section}
        tenantId={tenant?.id}
        basePath={basePath}
      />
    );
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
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:opacity-90"
          >
            Bekijk Producten
          </a>
        </div>
      )}
    </ShopLayout>
  );
}

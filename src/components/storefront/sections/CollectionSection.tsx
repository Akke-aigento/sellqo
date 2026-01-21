import { Link, useParams } from 'react-router-dom';
import { usePublicProducts } from '@/hooks/usePublicStorefront';
import type { HomepageSection, CollectionContent } from '@/types/storefront';
import { ProductCard } from '@/components/storefront/ProductCard';

interface CollectionSectionProps {
  section: HomepageSection;
  tenantId?: string;
}

export function CollectionSection({ section, tenantId }: CollectionSectionProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const content = section.content as CollectionContent;
  const settings = section.settings;
  
  const { data: products = [], isLoading } = usePublicProducts(tenantId, {
    categoryId: content.category_id,
    limit: content.max_products || 8,
  });

  if (isLoading) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted aspect-square rounded-lg mb-3" />
                <div className="bg-muted h-4 rounded w-3/4 mb-2" />
                <div className="bg-muted h-4 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="py-16"
      style={{
        backgroundColor: settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className={settings.full_width ? '' : 'container mx-auto px-4'}>
        {/* Section Header */}
        {(section.title || section.subtitle) && (
          <div className="text-center mb-10">
            {section.title && (
              <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
            )}
            {section.subtitle && (
              <p className="text-muted-foreground">{section.subtitle}</p>
            )}
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              basePath={`/shop/${tenantSlug}`}
            />
          ))}
        </div>

        {/* View All Link */}
        {content.show_view_all && content.category_id && (
          <div className="text-center mt-8">
            <Link
              to={`/shop/${tenantSlug}/products?category=${content.category_id}`}
              className="inline-flex items-center text-sm font-medium hover:underline"
            >
              Bekijk alle →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

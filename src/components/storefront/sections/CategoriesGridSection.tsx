import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { HomepageSection, CategoriesGridContent } from '@/types/storefront';

interface CategoriesGridSectionProps {
  section: HomepageSection;
  tenantId?: string;
}

export function CategoriesGridSection({ section, tenantId }: CategoriesGridSectionProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const content = section.content as CategoriesGridContent;
  const settings = section.settings;
  const columns = content.columns || 3;

  const { data: categories = [] } = useQuery({
    queryKey: ['public-categories-grid', tenantId, content.category_ids],
    queryFn: async () => {
      let query = supabase
        .from('categories')
        .select('id, name, slug, description, image_url')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .eq('hide_from_storefront', false)
        .order('sort_order', { ascending: true });

      if (content.category_ids && content.category_ids.length > 0) {
        query = query.in('id', content.category_ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch product counts per category
  const { data: productCounts = {} } = useQuery({
    queryKey: ['category-product-counts', tenantId, categories.map(c => c.id)],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const cat of categories) {
        const { count } = await supabase
          .from('product_categories')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id);
        counts[cat.id] = count || 0;
      }
      return counts;
    },
    enabled: !!tenantId && categories.length > 0 && content.show_product_count === true,
  });

  if (categories.length === 0) return null;

  return (
    <section
      className="py-12 md:py-16"
      style={{
        backgroundColor: settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        {(section.title || section.subtitle) && (
          <div className="text-center mb-8">
            {section.title && (
              <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
            )}
            {section.subtitle && (
              <p className="text-muted-foreground text-lg">{section.subtitle}</p>
            )}
          </div>
        )}

        <div
          className="grid gap-4 md:gap-6"
          style={{
            gridTemplateColumns: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))`,
          }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/shop/${tenantSlug}/products?category=${cat.slug}`}
              className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg"
            >
              {cat.image_url ? (
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                  <span className="text-4xl text-muted-foreground/30">📁</span>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg">{cat.name}</h3>
                {content.show_description && cat.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
                )}
                {content.show_product_count && productCounts[cat.id] !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {productCounts[cat.id]} producten
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .grid[style*="grid-template-columns"] {
            grid-template-columns: repeat(${columns}, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </section>
  );
}

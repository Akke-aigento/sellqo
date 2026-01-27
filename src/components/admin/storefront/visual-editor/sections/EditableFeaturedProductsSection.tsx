import { InlineTextEditor } from '../InlineTextEditor';
import type { HomepageSection, FeaturedProductsContent } from '@/types/storefront';

interface EditableFeaturedProductsSectionProps {
  section: HomepageSection;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function EditableFeaturedProductsSection({ section, onUpdate }: EditableFeaturedProductsSectionProps) {
  const content = section.content as FeaturedProductsContent;
  const settings = section.settings;

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
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <InlineTextEditor
            value={section.title || ''}
            onSave={(newValue) => onUpdate({ title: newValue })}
            as="h2"
            placeholder="Voeg een titel toe..."
            className="text-3xl font-bold mb-2"
          />
          <InlineTextEditor
            value={section.subtitle || ''}
            onSave={(newValue) => onUpdate({ subtitle: newValue })}
            as="p"
            placeholder="Voeg een subtitel toe..."
            className="text-lg text-muted-foreground"
          />
        </div>

        {/* Product placeholder grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-4">
              <div className="aspect-square rounded bg-muted mb-3 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Product {i}</span>
              </div>
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {content.product_ids?.length 
            ? `${content.product_ids.length} producten geselecteerd` 
            : 'Selecteer producten via de sectie instellingen'}
        </p>
      </div>
    </section>
  );
}

import type { HomepageSection } from '@/types/storefront';
import { InlineTextEditor } from '../InlineTextEditor';

interface EditableGenericSectionProps {
  section: HomepageSection;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function EditableGenericSection({ section, onUpdate }: EditableGenericSectionProps) {
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
        <div className="text-center">
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

        <div className="mt-8 p-8 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-center">
          <p className="text-muted-foreground capitalize">
            {section.section_type.replace('_', ' ')} sectie
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Configureer deze sectie via de instellingen
          </p>
        </div>
      </div>
    </section>
  );
}

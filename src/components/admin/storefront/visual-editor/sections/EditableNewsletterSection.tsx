import { InlineTextEditor } from '../InlineTextEditor';
import type { HomepageSection, NewsletterContent } from '@/types/storefront';

interface EditableNewsletterSectionProps {
  section: HomepageSection;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function EditableNewsletterSection({ section, onUpdate }: EditableNewsletterSectionProps) {
  const content = section.content as NewsletterContent;
  const settings = section.settings;

  return (
    <section 
      className="py-16"
      style={{
        backgroundColor: settings.background_color || 'var(--muted)',
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto text-center">
          <InlineTextEditor
            value={section.title || content.heading || ''}
            onSave={(newValue) => onUpdate({ title: newValue })}
            as="h2"
            placeholder="Nieuwsbrief titel..."
            className="text-3xl font-bold mb-4"
            showAIButton
            fieldType="title"
            sectionType="newsletter"
          />
          <InlineTextEditor
            value={section.subtitle || content.description || ''}
            onSave={(newValue) => onUpdate({ subtitle: newValue })}
            as="p"
            placeholder="Schrijf een korte beschrijving..."
            className="text-muted-foreground mb-6"
            showAIButton
            fieldType="subtitle"
            sectionType="newsletter"
          />
          
          {/* Form preview (non-functional in editor) */}
          <div className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder={content.placeholder || 'Uw e-mailadres'}
              className="flex-1 px-4 py-3 rounded-lg border bg-background"
              disabled
            />
            <button
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              disabled
            >
              {content.button_text || 'Aanmelden'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Formulier is niet actief in edit mode
          </p>
        </div>
      </div>
    </section>
  );
}

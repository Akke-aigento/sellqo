import { Link } from 'react-router-dom';
import { InlineTextEditor } from '../InlineTextEditor';
import { VisualMediaPicker } from '../VisualMediaPicker';
import type { HomepageSection, TextImageContent } from '@/types/storefront';

interface EditableTextImageSectionProps {
  section: HomepageSection;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function EditableTextImageSection({ section, onUpdate }: EditableTextImageSectionProps) {
  const content = section.content as TextImageContent;
  const settings = section.settings;
  const imagePosition = content.image_position || 'right';

  const updateContent = (key: keyof TextImageContent, value: unknown) => {
    onUpdate({
      content: { ...content, [key]: value },
    });
  };

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
        <div className={`grid md:grid-cols-2 gap-12 items-center ${
          imagePosition === 'left' ? 'md:flex-row-reverse' : ''
        }`}>
          {/* Text Content */}
          <div className={imagePosition === 'left' ? 'md:order-2' : ''}>
            <InlineTextEditor
              value={section.title || ''}
              onSave={(newValue) => onUpdate({ title: newValue })}
              as="h2"
              placeholder="Voeg een titel toe..."
              className="text-3xl font-bold mb-4"
              showAIButton
              fieldType="title"
              sectionType="text_image"
            />
            <InlineTextEditor
              value={section.subtitle || ''}
              onSave={(newValue) => onUpdate({ subtitle: newValue })}
              as="p"
              placeholder="Voeg een subtitel toe..."
              className="text-lg text-muted-foreground mb-4"
              showAIButton
              fieldType="subtitle"
              sectionType="text_image"
            />
            {content.text && (
              <div 
                className="prose prose-sm max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: content.text }}
              />
            )}
            {(content.button_text || content.button_link) && (
              <Link
                to={content.button_link || '#'}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {content.button_text || 'Lees meer'}
              </Link>
            )}
          </div>

          {/* Image */}
          <div className={imagePosition === 'left' ? 'md:order-1' : ''}>
            <VisualMediaPicker
              value={content.image_url}
              onSelect={(url) => updateContent('image_url', url)}
              aspectRatio="square"
              placeholder="Klik om afbeelding te kiezen"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

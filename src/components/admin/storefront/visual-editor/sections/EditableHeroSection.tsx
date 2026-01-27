import { Link } from 'react-router-dom';
import { InlineTextEditor } from '../InlineTextEditor';
import { VisualMediaPicker } from '../VisualMediaPicker';
import type { HomepageSection, HeroContent } from '@/types/storefront';

interface EditableHeroSectionProps {
  section: HomepageSection;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function EditableHeroSection({ section, onUpdate }: EditableHeroSectionProps) {
  const content = section.content as HeroContent;
  const settings = section.settings;
  
  const overlayOpacity = content.overlay_opacity ?? 0.4;
  const textAlign = content.text_alignment || 'center';

  const updateContent = (key: keyof HeroContent, value: unknown) => {
    onUpdate({
      content: { ...content, [key]: value },
    });
  };

  return (
    <section 
      className="relative min-h-[60vh] flex items-center"
      style={{
        paddingTop: settings.padding_top || '0',
        paddingBottom: settings.padding_bottom || '0',
      }}
    >
      {/* Background Image - clickable to change */}
      <div className="absolute inset-0">
        <VisualMediaPicker
          value={content.image_url}
          onSelect={(url) => updateContent('image_url', url)}
          aspectRatio="video"
          className="!absolute inset-0 !rounded-none"
          placeholder="Klik om hero afbeelding te kiezen"
        />
      </div>
      
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black pointer-events-none"
        style={{ opacity: overlayOpacity }}
      />
      
      {/* Content */}
      <div 
        className={`relative z-10 container mx-auto px-4 ${
          textAlign === 'center' ? 'text-center' : 
          textAlign === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`max-w-2xl ${
          textAlign === 'center' ? 'mx-auto' : 
          textAlign === 'right' ? 'ml-auto' : ''
        }`}>
          <InlineTextEditor
            value={section.title || ''}
            onSave={(newValue) => onUpdate({ title: newValue })}
            as="h1"
            placeholder="Voeg een titel toe..."
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4"
            showAIButton
            fieldType="title"
            sectionType="hero"
          />
          <InlineTextEditor
            value={section.subtitle || ''}
            onSave={(newValue) => onUpdate({ subtitle: newValue })}
            as="p"
            placeholder="Voeg een subtitel toe..."
            className="text-lg md:text-xl text-white/90 mb-8"
            showAIButton
            fieldType="subtitle"
            sectionType="hero"
          />
          {(content.button_text || content.button_link) && (
            <Link
              to={content.button_link || '#'}
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              {content.button_text || 'Klik hier'}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import type { HomepageSection, TextImageContent } from '@/types/storefront';

interface TextImageSectionProps {
  section: HomepageSection;
}

export function TextImageSection({ section }: TextImageSectionProps) {
  const content = section.content as TextImageContent;
  const settings = section.settings;
  const imagePosition = content.image_position || 'right';

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
            {section.title && (
              <h2 className="text-3xl font-bold mb-4">{section.title}</h2>
            )}
            {section.subtitle && (
              <p className="text-lg text-muted-foreground mb-4">{section.subtitle}</p>
            )}
            {content.text && (
              <div 
                className="prose prose-sm max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: content.text }}
              />
            )}
            {content.button_text && content.button_link && (
              <Link
                to={content.button_link}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {content.button_text}
              </Link>
            )}
          </div>

          {/* Image */}
          {content.image_url && (
            <div className={imagePosition === 'left' ? 'md:order-1' : ''}>
              <img 
                src={content.image_url} 
                alt={section.title || ''} 
                className="rounded-lg w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

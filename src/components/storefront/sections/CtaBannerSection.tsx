import { Link } from 'react-router-dom';
import type { HomepageSection, CtaBannerContent } from '@/types/storefront';

interface CtaBannerSectionProps {
  section: HomepageSection;
}

export function CtaBannerSection({ section }: CtaBannerSectionProps) {
  const content = section.content as CtaBannerContent;
  const settings = section.settings;

  return (
    <section
      className="relative py-16 md:py-24"
      style={{
        backgroundColor: content.background_color || settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      {content.background_image && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${content.background_image})` }}
        />
      )}
      {content.background_image && (
        <div className="absolute inset-0 bg-black/40" />
      )}

      <div className="relative z-10 container mx-auto px-4 text-center">
        {section.title && (
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${content.background_image ? 'text-white' : ''}`}>
            {section.title}
          </h2>
        )}
        {section.subtitle && (
          <p className={`text-lg md:text-xl mb-8 max-w-2xl mx-auto ${content.background_image ? 'text-white/90' : 'text-muted-foreground'}`}>
            {section.subtitle}
          </p>
        )}
        {content.button_text && content.button_link && (
          <Link
            to={content.button_link}
            className="inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-colors"
          >
            {content.button_text}
          </Link>
        )}
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import type { HomepageSection, HeroContent } from '@/types/storefront';

interface HeroSectionProps {
  section: HomepageSection;
  tenantId?: string;
}

export function HeroSection({ section }: HeroSectionProps) {
  const content = section.content as HeroContent;
  const settings = section.settings;
  
  const overlayOpacity = content.overlay_opacity ?? 0.4;
  const textAlign = content.text_alignment || 'center';

  return (
    <section 
      className="relative min-h-[60vh] flex items-center"
      style={{
        paddingTop: settings.padding_top || '0',
        paddingBottom: settings.padding_bottom || '0',
      }}
    >
      {/* Background Image */}
      {content.image_url && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${content.image_url})` }}
        />
      )}
      
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black"
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
          {section.title && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              {section.title}
            </h1>
          )}
          {section.subtitle && (
            <p className="text-lg md:text-xl text-white/90 mb-8">
              {section.subtitle}
            </p>
          )}
          {content.button_text && content.button_link && (
            <Link
              to={content.button_link}
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              {content.button_text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

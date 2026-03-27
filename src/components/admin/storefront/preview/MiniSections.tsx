import { Play, Star, Mail, Megaphone, Grid3X3, Shield, CheckCircle } from 'lucide-react';
import type { HomepageSection } from '@/types/storefront';

interface MiniSectionProps {
  section: HomepageSection;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  headingFont: string;
}

export function MiniHero({ section, primaryColor, textColor, headingFont }: MiniSectionProps) {
  return (
    <div
      className="px-3 py-4 text-center"
      style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}08)` }}
    >
      <h2 className="text-[11px] font-bold mb-1" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
        {section.title || 'Hero Banner'}
      </h2>
      {section.subtitle && <p className="text-[7px] mb-2 opacity-70">{section.subtitle}</p>}
      <div className="inline-block rounded-full px-3 py-0.5 text-[7px] font-medium text-white" style={{ backgroundColor: primaryColor }}>
        {(section.content as any)?.button_text || 'Shop Nu →'}
      </div>
    </div>
  );
}

export function MiniTextImage({ section, secondaryColor, textColor, headingFont }: MiniSectionProps) {
  const imagePos = (section.content as any)?.image_position || 'right';
  return (
    <div className={`px-3 py-2 flex gap-2 items-center ${imagePos === 'left' ? 'flex-row-reverse' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-bold truncate" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
          {section.title || 'Content'}
        </p>
        <div className="mt-1 space-y-0.5">
          <div className="h-1 w-full rounded bg-current opacity-10" />
          <div className="h-1 w-3/4 rounded bg-current opacity-10" />
        </div>
      </div>
      <div className="w-10 h-10 rounded shrink-0" style={{ backgroundColor: secondaryColor + '25' }} />
    </div>
  );
}

export function MiniFeaturedProducts({ section, secondaryColor, accentColor, primaryColor }: MiniSectionProps) {
  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-0.5">
            <div className="aspect-square rounded-sm relative" style={{ backgroundColor: secondaryColor + '20' }}>
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="w-1/2 h-1/2 rounded-full" style={{ backgroundColor: primaryColor }} />
              </div>
            </div>
            <div className="h-1 rounded" style={{ backgroundColor: accentColor }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniCollection({ section, secondaryColor, textColor, headingFont }: MiniSectionProps) {
  return (
    <div className="px-3 py-2">
      <p className="text-[8px] font-bold mb-1" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
        {section.title || 'Collectie'}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {[1, 2].map(i => (
          <div key={i} className="h-6 rounded flex items-center justify-center" style={{ backgroundColor: secondaryColor + '15' }}>
            <span className="text-[5px] opacity-50">Categorie {i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniNewsletter({ section, primaryColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-3 text-center" style={{ backgroundColor: primaryColor + '08' }}>
      <Mail className="h-3 w-3 mx-auto mb-1 opacity-40" />
      <p className="text-[7px] font-medium mb-1">{section.title || 'Nieuwsbrief'}</p>
      <div className="flex gap-1 max-w-[120px] mx-auto">
        <div className="flex-1 h-4 rounded border border-border bg-white" />
        <div className="h-4 px-2 rounded text-[5px] text-white flex items-center" style={{ backgroundColor: primaryColor }}>
          OK
        </div>
      </div>
    </div>
  );
}

export function MiniTestimonials({ section, textColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-2 text-center">
      <p className="text-[14px] opacity-20 leading-none">"</p>
      <p className="text-[6px] italic opacity-60 -mt-1">{section.title || 'Geweldige ervaring!'}</p>
      <div className="flex justify-center gap-0.5 mt-1">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className="h-2 w-2 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
    </div>
  );
}

export function MiniVideo({ section, secondaryColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-2">
      <div className="h-14 rounded flex items-center justify-center" style={{ backgroundColor: secondaryColor + '15' }}>
        <Play className="h-4 w-4 opacity-30" />
      </div>
    </div>
  );
}

export function MiniExternalReviews({ section, accentColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1 mb-1">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className="h-2 w-2 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <span className="text-[6px] opacity-50">4.8/5</span>
      </div>
      <div className="space-y-1">
        {[1, 2].map(i => (
          <div key={i} className="flex gap-1 items-start">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor + '20' }} />
            <div className="flex-1">
              <div className="h-1 w-2/3 rounded bg-current opacity-10" />
              <div className="h-1 w-1/2 rounded bg-current opacity-5 mt-0.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniAnnouncement({ section, primaryColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-2 text-center" style={{ backgroundColor: primaryColor + '15' }}>
      <Megaphone className="h-3 w-3 mx-auto mb-0.5 opacity-40" />
      <p className="text-[7px] font-medium">{section.title || (section.content as any)?.text || 'Aankondiging'}</p>
    </div>
  );
}

export function MiniCategoriesGrid({ section, secondaryColor, textColor, headingFont }: MiniSectionProps) {
  return (
    <div className="px-3 py-2">
      <p className="text-[8px] font-bold mb-1" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
        {section.title || 'Categorieën'}
      </p>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[4/3] rounded-sm flex items-center justify-center" style={{ backgroundColor: secondaryColor + '15' }}>
            <Grid3X3 className="h-2 w-2 opacity-30" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniUspBar({ section, primaryColor }: MiniSectionProps) {
  return (
    <div className="px-3 py-2 flex items-center justify-center gap-3 border-y" style={{ backgroundColor: primaryColor + '05' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-0.5">
          <CheckCircle className="h-2 w-2 opacity-30" />
          <div className="h-1 w-6 rounded bg-current opacity-10" />
        </div>
      ))}
    </div>
  );
}

export function MiniCtaBanner({ section, primaryColor, textColor, headingFont }: MiniSectionProps) {
  return (
    <div className="px-3 py-4 text-center" style={{ backgroundColor: primaryColor + '12' }}>
      <p className="text-[9px] font-bold mb-1" style={{ fontFamily: `"${headingFont}", serif`, color: textColor }}>
        {section.title || 'CTA Banner'}
      </p>
      <div className="inline-block rounded-full px-3 py-0.5 text-[6px] font-medium text-white" style={{ backgroundColor: primaryColor }}>
        Actie →
      </div>
    </div>
  );
}

export function renderMiniSection(section: HomepageSection, props: Omit<MiniSectionProps, 'section'>) {
  const sectionProps = { section, ...props };
  switch (section.section_type) {
    case 'hero': return <MiniHero key={section.id} {...sectionProps} />;
    case 'text_image': return <MiniTextImage key={section.id} {...sectionProps} />;
    case 'featured_products': return <MiniFeaturedProducts key={section.id} {...sectionProps} />;
    case 'collection': return <MiniCollection key={section.id} {...sectionProps} />;
    case 'newsletter': return <MiniNewsletter key={section.id} {...sectionProps} />;
    case 'testimonials': return <MiniTestimonials key={section.id} {...sectionProps} />;
    case 'video': return <MiniVideo key={section.id} {...sectionProps} />;
    case 'announcement': return <MiniAnnouncement key={section.id} {...sectionProps} />;
    case 'external_reviews': return <MiniExternalReviews key={section.id} {...sectionProps} />;
    case 'categories_grid': return <MiniCategoriesGrid key={section.id} {...sectionProps} />;
    case 'usp_bar': return <MiniUspBar key={section.id} {...sectionProps} />;
    case 'cta_banner': return <MiniCtaBanner key={section.id} {...sectionProps} />;
    default: return null;
  }
}

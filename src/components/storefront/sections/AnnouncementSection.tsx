import { Megaphone } from 'lucide-react';
import type { HomepageSection } from '@/types/storefront';

interface AnnouncementSectionProps {
  section: HomepageSection;
}

export function AnnouncementSection({ section }: AnnouncementSectionProps) {
  const content = section.content as Record<string, any>;
  const settings = section.settings;
  const text = content.text || section.title || '';
  const linkUrl = content.link_url || '';
  const linkText = content.link_text || '';

  if (!text) return null;

  const Wrapper = linkUrl ? 'a' : 'div';
  const wrapperProps = linkUrl ? { href: linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' } : {};

  return (
    <section
      className="py-4"
      style={{
        backgroundColor: settings.background_color || 'hsl(var(--primary))',
        color: settings.text_color || 'hsl(var(--primary-foreground))',
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        <Wrapper
          {...wrapperProps}
          className="flex items-center justify-center gap-3 text-center"
        >
          <Megaphone className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{text}</p>
          {linkUrl && linkText && (
            <span className="underline text-sm font-semibold whitespace-nowrap">{linkText}</span>
          )}
        </Wrapper>
      </div>
    </section>
  );
}

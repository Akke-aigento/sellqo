import type { ComponentType } from 'react';
import type { HomepageSection, HomepageSectionType } from '@/types/storefront';

import { HeroSection } from './HeroSection';
import { FeaturedProductsSection } from './FeaturedProductsSection';
import { CollectionSection } from './CollectionSection';
import { TextImageSection } from './TextImageSection';
import { NewsletterSection } from './NewsletterSection';
import { TestimonialsSection } from './TestimonialsSection';
import { VideoSection } from './VideoSection';
import { AnnouncementSection } from './AnnouncementSection';
import { ExternalReviewsSection } from './ExternalReviewsSection';
import { useTranslation } from 'react-i18next';

/**
 * Uniforme propvorm voor elke sectie-renderer.
 *
 * Niet elke renderer gebruikt alles: `announcement`, `testimonials`, `video` en
 * `text_image` hebben genoeg aan `section`. Ze krijgen de rest wel mee zodat er
 * één aanroepvorm bestaat — een renderer die later data of links nodig heeft,
 * hoeft dan alleen zijn eigen interface uit te breiden.
 */
export interface SectionRenderProps {
  section: HomepageSection;
  /** Voor secties die zelf data ophalen: producten, reviews, nieuwsbrief. */
  tenantId?: string;
  /** Winkelpad van de tenant, bijvoorbeeld `/shop/demo-bakkerij`. */
  basePath: string;
}

/**
 * Eén bron van waarheid voor "welk component rendert welk sectie-type".
 *
 * Voedt zowel de publieke winkel (`ShopHome`) als de editor. Vóór WEBSHOP-5A
 * stonden er twee losse `switch`-blokken — één in `ShopHome` en één in
 * `VisualEditorCanvas` — die uit de pas konden lopen, en dat ook deden.
 *
 * Het `Record`-type dwingt volledigheid af: een nieuw sectie-type in
 * `HomepageSectionType` zonder renderer is een compileerfout, geen stilzwijgend
 * lege sectie.
 */
export const SECTION_RENDERERS: Record<
  HomepageSectionType,
  ComponentType<SectionRenderProps>
> = {
  hero: HeroSection,
  featured_products: FeaturedProductsSection,
  collection: CollectionSection,
  text_image: TextImageSection,
  newsletter: NewsletterSection,
  testimonials: TestimonialsSection,
  video: VideoSection,
  announcement: AnnouncementSection,
  external_reviews: ExternalReviewsSection,
};

/**
 * Renderer voor een sectie-type, of `null` bij een onbekend type.
 *
 * Onbekende types komen voor wanneer de database een waarde bevat die de
 * frontend nog niet kent — bijvoorbeeld tijdens een uitrol. Die sectie wordt
 * overgeslagen in plaats van dat de pagina omvalt.
 */
export function getSectionRenderer(
  type: HomepageSectionType | string
): ComponentType<SectionRenderProps> | null {
  return SECTION_RENDERERS[type as HomepageSectionType] ?? null;
}

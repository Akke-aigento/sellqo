// Storefront Module Types

export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  is_premium: boolean;
  is_active: boolean;
  default_settings: ThemeSettings;
  created_at: string;
}

export interface ThemeSettings {
  header_style: 'standard' | 'centered' | 'minimal';
  product_card_style: 'standard' | 'minimal' | 'detailed';
  products_per_row: number;
  show_breadcrumbs: boolean;
  show_wishlist: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
}

export interface TenantThemeSettings {
  id: string;
  tenant_id: string;
  theme_id: string | null;
  
  // Custom Frontend
  use_custom_frontend: boolean;
  custom_frontend_url: string | null;
  
  // Branding
  logo_url: string | null;
  favicon_url: string | null;
  
  // Colors
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  text_color: string | null;
  
  // Typography
  heading_font: string;
  body_font: string;
  
  // Layout
  header_style: string;
  show_announcement_bar: boolean;
  announcement_text: string | null;
  announcement_link: string | null;
  show_breadcrumbs: boolean;
  show_wishlist: boolean;
  product_card_style: string;
  products_per_row: number;
  
  // Footer
  footer_text: string | null;
  social_links: SocialLinks;
  
  // Advanced
  custom_css: string | null;
  custom_head_scripts: string | null;
  
  // Publishing
  is_published: boolean;
  published_at: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  themes?: Theme;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
}

export interface StorefrontPage {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  content: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
  created_at: string;
  updated_at: string;
}

export type HomepageSectionType = 
  | 'hero'
  | 'featured_products'
  | 'collection'
  | 'text_image'
  | 'newsletter'
  | 'testimonials'
  | 'video'
  | 'announcement'
  | 'external_reviews';

export interface HomepageSection {
  id: string;
  tenant_id: string;
  section_type: HomepageSectionType;
  title: string | null;
  subtitle: string | null;
  content: HomepageSectionContent;
  settings: HomepageSectionSettings;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// Content types for different section types
export interface HeroContent {
  image_url?: string;
  button_text?: string;
  button_link?: string;
  overlay_opacity?: number;
  text_alignment?: 'left' | 'center' | 'right';
}

export interface FeaturedProductsContent {
  product_ids?: string[];
  show_prices?: boolean;
  max_products?: number;
}

export interface CollectionContent {
  category_id?: string;
  max_products?: number;
  show_view_all?: boolean;
}

export interface TextImageContent {
  text?: string;
  image_url?: string;
  image_position?: 'left' | 'right';
  button_text?: string;
  button_link?: string;
}

export interface NewsletterContent {
  heading?: string;
  description?: string;
  button_text?: string;
  placeholder?: string;
}

export interface TestimonialsContent {
  reviews?: Array<{
    name: string;
    text: string;
    rating?: number;
    avatar_url?: string;
  }>;
}

export interface VideoContent {
  video_url?: string;
  poster_url?: string;
  autoplay?: boolean;
  loop?: boolean;
}

export interface ExternalReviewsContent {
  display_style?: 'carousel' | 'grid' | 'list';
  max_reviews?: number;
  featured_only?: boolean;
  show_platform_badges?: boolean;
  show_aggregate_score?: boolean;
  platforms?: string[];
}

export type HomepageSectionContent = 
  | HeroContent 
  | FeaturedProductsContent 
  | CollectionContent 
  | TextImageContent 
  | NewsletterContent 
  | TestimonialsContent
  | VideoContent
  | ExternalReviewsContent
  | Record<string, unknown>;

export interface HomepageSectionSettings {
  background_color?: string;
  text_color?: string;
  padding_top?: string;
  padding_bottom?: string;
  full_width?: boolean;
}

// Form types
export interface ThemeSettingsFormData {
  theme_id: string | null;
  use_custom_frontend: boolean;
  custom_frontend_url: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  header_style: string;
  show_announcement_bar: boolean;
  announcement_text: string;
  show_breadcrumbs: boolean;
  show_wishlist: boolean;
  footer_text: string;
  social_links: SocialLinks;
  custom_css: string;
}

export interface StorefrontPageFormData {
  slug: string;
  title: string;
  content: string;
  meta_title: string;
  meta_description: string;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
}

// Constants
export const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Merriweather',
  'Source Sans Pro',
  'Raleway',
  'Nunito',
  'Ubuntu',
  'Work Sans',
  'DM Sans',
  'Space Grotesk',
] as const;

export const HEADER_STYLES = [
  { value: 'standard', label: 'Standaard', description: 'Logo links, menu rechts' },
  { value: 'centered', label: 'Gecentreerd', description: 'Logo en menu gecentreerd' },
  { value: 'minimal', label: 'Minimaal', description: 'Hamburger menu met overlay' },
] as const;

export const PRODUCT_CARD_STYLES = [
  { value: 'standard', label: 'Standaard', description: 'Foto, naam, prijs, rating' },
  { value: 'minimal', label: 'Minimaal', description: 'Alleen foto, naam en prijs' },
  { value: 'detailed', label: 'Gedetailleerd', description: 'Grote foto met beschrijving' },
] as const;

export const SECTION_TYPES: Array<{ type: HomepageSectionType; label: string; icon: string; description: string }> = [
  { type: 'hero', label: 'Hero Banner', icon: 'Image', description: 'Grote afbeelding met tekst en CTA' },
  { type: 'featured_products', label: 'Uitgelichte Producten', icon: 'Star', description: 'Selecteer specifieke producten' },
  { type: 'collection', label: 'Collectie', icon: 'Grid3X3', description: 'Producten uit een categorie' },
  { type: 'text_image', label: 'Tekst + Afbeelding', icon: 'LayoutList', description: 'Content blok met afbeelding' },
  { type: 'newsletter', label: 'Nieuwsbrief', icon: 'Mail', description: 'Email aanmeldformulier' },
  { type: 'testimonials', label: 'Testimonials', icon: 'MessageSquare', description: 'Klantreviews' },
  { type: 'video', label: 'Video', icon: 'Play', description: 'Video sectie' },
  { type: 'external_reviews', label: 'Externe Reviews', icon: 'StarHalf', description: 'Reviews van Google, Trustpilot, etc.' },
];

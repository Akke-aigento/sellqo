// Storefront Configuration Types - Separated for clarity

// Newsletter Module
export interface NewsletterConfig {
  enabled: boolean;
  provider: 'internal' | 'mailchimp' | 'klaviyo';
  popup_enabled: boolean;
  popup_delay_seconds: number;
  incentive_text: string | null;
}

// Checkout Preferences
export interface CheckoutConfig {
  guest_enabled: boolean;
  phone_required: boolean;
  company_field: 'hidden' | 'optional' | 'required';
  address_autocomplete: boolean;
}

// Product Display
export interface ProductDisplayConfig {
  image_zoom: 'hover' | 'click' | 'lightbox' | 'none';
  variant_style: 'dropdown' | 'swatches' | 'buttons';
  reviews_display: 'full' | 'stars_only' | 'hidden';
  stock_indicator: boolean;
  related_mode: 'auto' | 'manual' | 'off';
}

// Trust & Compliance
export interface TrustConfig {
  cookie_banner_enabled: boolean;
  cookie_banner_style: 'minimal' | 'detailed' | 'popup';
  trust_badges: string[];
}

// Navigation Preferences
export interface NavigationConfig {
  nav_style: 'simple' | 'mega_menu';
  header_sticky: boolean;
  search_display: 'visible' | 'icon' | 'hidden';
  mobile_bottom_nav: boolean;
}

// Multilingual Configuration
export interface MultilingualConfig {
  enabled: boolean;
  languages: string[];
  default_language: string;
  language_selector_style: 'dropdown' | 'flags' | 'text';
}

// Conversion Features
export interface ConversionConfig {
  show_stock_count: boolean;
  show_viewers_count: boolean;
  show_recent_purchases: boolean;
  exit_intent_popup: boolean;
}

// Combined Storefront Configuration
export interface StorefrontConfig {
  newsletter: NewsletterConfig;
  checkout: CheckoutConfig;
  product: ProductDisplayConfig;
  trust: TrustConfig;
  navigation: NavigationConfig;
  conversion: ConversionConfig;
  multilingual: MultilingualConfig;
}

// Default values
export const DEFAULT_NEWSLETTER_CONFIG: NewsletterConfig = {
  enabled: false,
  provider: 'internal',
  popup_enabled: false,
  popup_delay_seconds: 5,
  incentive_text: null,
};

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  guest_enabled: true,
  phone_required: false,
  company_field: 'optional',
  address_autocomplete: true,
};

export const DEFAULT_PRODUCT_CONFIG: ProductDisplayConfig = {
  image_zoom: 'hover',
  variant_style: 'buttons',
  reviews_display: 'full',
  stock_indicator: true,
  related_mode: 'auto',
};

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
  cookie_banner_enabled: true,
  cookie_banner_style: 'minimal',
  trust_badges: [],
};

export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  nav_style: 'simple',
  header_sticky: true,
  search_display: 'visible',
  mobile_bottom_nav: false,
};

export const DEFAULT_MULTILINGUAL_CONFIG: MultilingualConfig = {
  enabled: false,
  languages: ['nl'],
  default_language: 'nl',
  language_selector_style: 'dropdown',
};

export const DEFAULT_CONVERSION_CONFIG: ConversionConfig = {
  show_stock_count: false,
  show_viewers_count: false,
  show_recent_purchases: false,
  exit_intent_popup: false,
};

// Option lists for selects
export const NEWSLETTER_PROVIDERS = [
  { value: 'internal', label: 'Interne Nieuwsbrief', description: 'Beheer abonnees binnen Sellqo' },
  { value: 'mailchimp', label: 'Mailchimp', description: 'Synchroniseer met Mailchimp' },
  { value: 'klaviyo', label: 'Klaviyo', description: 'Synchroniseer met Klaviyo' },
] as const;

export const COMPANY_FIELD_OPTIONS = [
  { value: 'hidden', label: 'Verborgen', description: 'Bedrijfsveld niet tonen' },
  { value: 'optional', label: 'Optioneel', description: 'Klant kan bedrijfsnaam invullen' },
  { value: 'required', label: 'Verplicht', description: 'Bedrijfsnaam is verplicht' },
] as const;

export const IMAGE_ZOOM_OPTIONS = [
  { value: 'hover', label: 'Hover Zoom', description: 'Zoom bij mouse-over' },
  { value: 'click', label: 'Click Zoom', description: 'Zoom bij klikken' },
  { value: 'lightbox', label: 'Lightbox', description: 'Open in volledig scherm' },
  { value: 'none', label: 'Uitgeschakeld', description: 'Geen zoom functie' },
] as const;

export const VARIANT_STYLE_OPTIONS = [
  { value: 'dropdown', label: 'Dropdown', description: 'Selecteer via dropdown menu' },
  { value: 'swatches', label: 'Swatches', description: 'Kleur/maat knoppen' },
  { value: 'buttons', label: 'Buttons', description: 'Standaard knoppen' },
] as const;

export const REVIEWS_DISPLAY_OPTIONS = [
  { value: 'full', label: 'Volledig', description: 'Toon reviews met tekst' },
  { value: 'stars_only', label: 'Alleen Sterren', description: 'Toon alleen sterren rating' },
  { value: 'hidden', label: 'Verborgen', description: 'Geen reviews tonen' },
] as const;

export const RELATED_MODE_OPTIONS = [
  { value: 'auto', label: 'Automatisch', description: 'Op basis van categorie/tags' },
  { value: 'manual', label: 'Handmatig', description: 'Zelf gerelateerde producten kiezen' },
  { value: 'off', label: 'Uitgeschakeld', description: 'Geen gerelateerde producten' },
] as const;

export const COOKIE_BANNER_STYLES = [
  { value: 'minimal', label: 'Minimaal', description: 'Kleine balk onderaan' },
  { value: 'detailed', label: 'Gedetailleerd', description: 'Met cookie categorieën' },
  { value: 'popup', label: 'Popup', description: 'Modal in het midden' },
] as const;

export const NAV_STYLE_OPTIONS = [
  { value: 'simple', label: 'Eenvoudig', description: 'Standaard navigatie menu' },
  { value: 'mega_menu', label: 'Mega Menu', description: 'Uitklapbaar menu met categorieën' },
] as const;

export const SEARCH_DISPLAY_OPTIONS = [
  { value: 'visible', label: 'Altijd Zichtbaar', description: 'Zoekbalk altijd tonen' },
  { value: 'icon', label: 'Alleen Icoon', description: 'Zoek icoon dat uitklapt' },
  { value: 'hidden', label: 'Verborgen', description: 'Geen zoekbalk tonen' },
] as const;

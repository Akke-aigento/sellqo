export interface CustomFrontendConfig {
  frontend_url: string;
  webhook_url: string;
  api_key_hash: string;
  api_key_prefix: string;
  products: {
    enabled: boolean;
    include_unpublished: boolean;
    include_out_of_stock: boolean;
    include_images: boolean;
    include_seo: boolean;
    include_variants: boolean;
    realtime_inventory: boolean;
  };
  collections: {
    enabled: boolean;
    filter_mode: 'all' | 'with_products' | 'manual';
    selected_collections: string[];
    include_images: boolean;
    include_descriptions: boolean;
    include_product_counts: boolean;
  };
  cart: {
    enabled: boolean;
    session_duration: '24_hours' | '3_days' | '7_days' | '30_days';
    allow_discounts: boolean;
    auto_shipping: boolean;
  };
  checkout: {
    enabled: boolean;
    mode: 'hosted' | 'embedded';
    success_url: string;
    cancel_url: string;
    sync_settings: boolean;
  };
  gift_cards: {
    enabled: boolean;
    allow_purchase: boolean;
    allow_balance_check: boolean;
  };
  accounts: {
    enabled: boolean;
    registration: boolean;
    login: boolean;
    order_history: boolean;
    address_book: boolean;
  };
  newsletter: {
    enabled: boolean;
    double_optin: boolean;
    forward_popup_config: boolean;
  };
  reviews: {
    enabled: boolean;
    platforms: string[];
    per_product: boolean;
    general: boolean;
    sync_display_settings: boolean;
  };
  pages: {
    enabled: boolean;
    static_pages: string[];
    legal_pages: boolean;
    include_html: boolean;
  };
  navigation: {
    enabled: boolean;
    main_menu: boolean;
    footer_menu: boolean;
    announcement_bar: boolean;
  };
  social_media: {
    enabled: boolean;
  };
  trust_compliance: {
    enabled: boolean;
    cookie_banner: boolean;
    trust_badges: boolean;
    certifications: boolean;
  };
  conversion_boosters: {
    enabled: boolean;
    stock_urgency: boolean;
    stock_threshold: number;
    recent_purchases: boolean;
    free_shipping_bar: boolean;
    abandoned_cart_email: boolean;
  };
  multilingual: {
    enabled: boolean;
    default_locale: string;
    translate_products: boolean;
    translate_pages: boolean;
  };
  tracking: {
    enabled: boolean;
    forward_scripts: boolean;
    ecommerce_events: boolean;
  };
}

export const DEFAULT_CUSTOM_FRONTEND_CONFIG: CustomFrontendConfig = {
  frontend_url: '',
  webhook_url: '',
  api_key_hash: '',
  api_key_prefix: '',
  products: {
    enabled: true,
    include_unpublished: false,
    include_out_of_stock: true,
    include_images: true,
    include_seo: true,
    include_variants: true,
    realtime_inventory: true,
  },
  collections: {
    enabled: true,
    filter_mode: 'with_products',
    selected_collections: [],
    include_images: true,
    include_descriptions: true,
    include_product_counts: true,
  },
  cart: {
    enabled: true,
    session_duration: '7_days',
    allow_discounts: true,
    auto_shipping: true,
  },
  checkout: {
    enabled: true,
    mode: 'hosted',
    success_url: '',
    cancel_url: '',
    sync_settings: true,
  },
  gift_cards: {
    enabled: true,
    allow_purchase: true,
    allow_balance_check: true,
  },
  accounts: {
    enabled: false,
    registration: false,
    login: false,
    order_history: false,
    address_book: false,
  },
  newsletter: {
    enabled: true,
    double_optin: true,
    forward_popup_config: false,
  },
  reviews: {
    enabled: true,
    platforms: [],
    per_product: true,
    general: true,
    sync_display_settings: true,
  },
  pages: {
    enabled: true,
    static_pages: [],
    legal_pages: true,
    include_html: true,
  },
  navigation: {
    enabled: true,
    main_menu: true,
    footer_menu: true,
    announcement_bar: true,
  },
  social_media: {
    enabled: true,
  },
  trust_compliance: {
    enabled: true,
    cookie_banner: true,
    trust_badges: true,
    certifications: true,
  },
  conversion_boosters: {
    enabled: true,
    stock_urgency: true,
    stock_threshold: 5,
    recent_purchases: false,
    free_shipping_bar: true,
    abandoned_cart_email: false,
  },
  multilingual: {
    enabled: true,
    default_locale: 'nl',
    translate_products: true,
    translate_pages: true,
  },
  tracking: {
    enabled: false,
    forward_scripts: false,
    ecommerce_events: true,
  },
};

export const WEBHOOK_EVENTS = [
  { event: 'product.created', label: 'Nieuw product aangemaakt' },
  { event: 'product.updated', label: 'Product gewijzigd (prijs, titel, beschrijving, etc.)' },
  { event: 'product.deleted', label: 'Product verwijderd' },
  { event: 'product.inventory.updated', label: 'Voorraad gewijzigd' },
  { event: 'collection.updated', label: 'Collectie gewijzigd' },
  { event: 'order.created', label: 'Nieuwe bestelling ontvangen' },
  { event: 'order.paid', label: 'Bestelling betaald' },
  { event: 'order.fulfilled', label: 'Bestelling verzonden' },
  { event: 'page.updated', label: 'Pagina content gewijzigd' },
  { event: 'settings.updated', label: 'Webshop instellingen gewijzigd' },
  { event: 'review.created', label: 'Nieuwe review ontvangen' },
] as const;

export const SESSION_DURATION_OPTIONS = [
  { value: '24_hours', label: '24 uur' },
  { value: '3_days', label: '3 dagen' },
  { value: '7_days', label: '7 dagen' },
  { value: '30_days', label: '30 dagen' },
] as const;

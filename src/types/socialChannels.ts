export type SocialChannelType = 
  | 'google_shopping'
  | 'facebook_shop'
  | 'instagram_shop'
  | 'tiktok_shop'
  | 'pinterest_catalog'
  | 'whatsapp_business'
  | 'microsoft_shopping'
  | 'snapchat_catalog';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SocialChannelConnection {
  id: string;
  tenant_id: string;
  channel_type: SocialChannelType;
  channel_name: string | null;
  credentials: SocialChannelCredentials;
  feed_url: string | null;
  feed_format: 'xml' | 'json' | 'csv';
  last_feed_generated_at: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  products_synced: number;
  created_at: string;
  updated_at: string;
  // New fields for direct catalog sync
  catalog_id: string | null;
  business_id: string | null;
  page_id: string | null;
  sync_status: SyncStatus;
  last_full_sync_at: string | null;
  products_in_catalog: number;
  sync_errors: SyncError[];
}

export interface SyncError {
  product_id?: string;
  product_name?: string;
  error_code?: string;
  message: string;
  timestamp: string;
}

export interface SocialChannelCredentials {
  merchantId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  catalogId?: string;
  pageId?: string;
  businessAccountId?: string;
}

export interface MetaCatalog {
  id: string;
  name: string;
  product_count: number;
  vertical: string;
}

export interface MetaBusiness {
  id: string;
  name: string;
  catalogs?: MetaCatalog[];
}

export interface SocialChannelInfo {
  type: SocialChannelType;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  tooltip: string;
  features: { text: string; available: boolean }[];
  comingSoon?: boolean;
  feedBased?: boolean; // True for channels that use product feeds
}

export const SOCIAL_CHANNEL_INFO: Record<SocialChannelType, SocialChannelInfo> = {
  google_shopping: {
    type: 'google_shopping',
    name: 'Google Shopping',
    icon: 'Search',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Laat je producten zien in Google zoekresultaten',
    tooltip: 'Laat je producten zien in Google zoekresultaten en het Shopping-tabblad. Klanten kunnen direct vergelijken en doorklikken naar je webshop.',
    features: [
      { text: 'Product feed generatie', available: true },
      { text: 'Google Merchant Center', available: true },
      { text: 'Shopping Ads ready', available: true },
      { text: 'Automatische prijsupdates', available: true },
    ],
    feedBased: true,
  },
  facebook_shop: {
    type: 'facebook_shop',
    name: 'Facebook Shop',
    icon: 'Facebook',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Verkoop direct via je Facebook pagina',
    tooltip: 'Verkoop direct via je Facebook pagina. Klanten kunnen producten bekijken en kopen zonder Facebook te verlaten. Ook gekoppeld aan Instagram Shopping.',
    features: [
      { text: 'Facebook Commerce', available: true },
      { text: 'Instagram Shopping', available: true },
      { text: 'Catalog sync', available: true },
      { text: 'Checkout op Facebook', available: false },
    ],
    feedBased: false,
  },
  instagram_shop: {
    type: 'instagram_shop',
    name: 'Instagram Shop',
    icon: 'Instagram',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    description: 'Tag producten in je Instagram posts',
    tooltip: 'Tag producten in je Instagram posts en stories. Volgers kunnen direct doorklikken en kopen. Werkt via Facebook Shop koppeling.',
    features: [
      { text: 'Shoppable posts', available: true },
      { text: 'Product tags in stories', available: true },
      { text: 'Via Facebook Commerce', available: true },
    ],
    feedBased: false,
  },
  tiktok_shop: {
    type: 'tiktok_shop',
    name: 'TikTok Shop',
    icon: 'Music',
    color: 'text-gray-900',
    bgColor: 'bg-gray-100',
    description: 'Bereik Gen-Z met shoppable video\'s',
    tooltip: 'Bereik jongere doelgroepen met shoppable video\'s. Link producten aan je TikTok content en laat kijkers direct kopen.',
    features: [
      { text: 'Product showcase', available: true },
      { text: 'Live shopping', available: false },
      { text: 'Video shopping links', available: true },
    ],
    comingSoon: true,
  },
  pinterest_catalog: {
    type: 'pinterest_catalog',
    name: 'Pinterest',
    icon: 'Image',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Maak Product Pins voor inspiratie',
    tooltip: 'Maak Product Pins aan voor je hele assortiment. Ideaal voor home, fashion en lifestyle producten. Pinners kunnen direct naar je webshop.',
    features: [
      { text: 'Rich Product Pins', available: true },
      { text: 'RSS Feed sync', available: true },
      { text: 'Pinterest Analytics', available: true },
      { text: 'Shoppable Pins', available: true },
    ],
    feedBased: true,
  },
  whatsapp_business: {
    type: 'whatsapp_business',
    name: 'WhatsApp Business',
    icon: 'MessageCircle',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Toon je catalogus in WhatsApp chats',
    tooltip: 'Toon je catalogus direct in WhatsApp gesprekken. Klanten kunnen producten bekijken, vragen stellen en bestellingen plaatsen via chat.',
    features: [
      { text: 'Catalogus in chat', available: true },
      { text: 'Product delen', available: true },
      { text: 'Directe communicatie', available: true },
      { text: 'Betalen via WhatsApp', available: false },
    ],
    feedBased: false,
  },
  microsoft_shopping: {
    type: 'microsoft_shopping',
    name: 'Microsoft Shopping',
    icon: 'Globe',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    description: 'Bereik Bing en Edge gebruikers',
    tooltip: 'Bereik Microsoft-gebruikers via Bing zoekresultaten en Edge browser. Minder concurrentie dan Google, vaak lagere CPC.',
    features: [
      { text: 'Bing Shopping', available: true },
      { text: 'Microsoft Merchant Center', available: true },
      { text: 'Edge browser integratie', available: true },
      { text: 'Shopping Ads', available: true },
    ],
    feedBased: true,
  },
  snapchat_catalog: {
    type: 'snapchat_catalog',
    name: 'Snapchat',
    icon: 'Camera',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100',
    description: 'Dynamic Ads voor jonge doelgroepen',
    tooltip: 'Bereik jongere doelgroepen met Dynamic Product Ads op Snapchat. Automatisch gepersonaliseerde advertenties op basis van je catalogus.',
    features: [
      { text: 'Dynamic Product Ads', available: true },
      { text: 'Catalog sync', available: true },
      { text: 'Retargeting', available: true },
    ],
    comingSoon: true,
  },
};

// Product social channel selection stored in products.social_channels JSONB
export interface ProductSocialChannels {
  google_shopping?: boolean;
  facebook_shop?: boolean;
  instagram_shop?: boolean;
  tiktok_shop?: boolean;
  pinterest_catalog?: boolean;
  whatsapp_business?: boolean;
  microsoft_shopping?: boolean;
  snapchat_catalog?: boolean;
}

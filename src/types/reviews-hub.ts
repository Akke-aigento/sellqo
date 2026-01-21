// Universal Reviews Hub - Multi-Platform Reviews System Types

export type ReviewPlatform = 'google' | 'trustpilot' | 'kiyoh' | 'webwinkelkeur' | 'trusted_shops' | 'facebook';

export type SyncFrequency = 'hourly' | 'daily' | 'weekly' | 'manual';

export type SyncStatus = 'success' | 'failed' | 'pending' | 'syncing';

export interface ReviewPlatformConnection {
  id: string;
  tenant_id: string;
  platform: ReviewPlatform;
  is_enabled: boolean;
  api_key: string | null;
  api_secret: string | null;
  external_id: string | null;
  external_url: string | null;
  display_name: string | null;
  sync_frequency: SyncFrequency;
  last_synced_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  cached_rating: number | null;
  cached_review_count: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExternalReview {
  id: string;
  tenant_id: string;
  connection_id: string;
  platform: ReviewPlatform;
  external_review_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  rating: number;
  title: string | null;
  text: string | null;
  reply: string | null;
  reply_date: string | null;
  review_date: string | null;
  language: string;
  is_verified: boolean;
  is_visible: boolean;
  is_featured: boolean;
  metadata: Record<string, unknown>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformInfo {
  id: ReviewPlatform;
  name: string;
  logo: string;
  color: string;
  bgColor: string;
  description: string;
  apiKeyRequired: boolean;
  apiKeyUrl?: string;
  searchSupported: boolean;
}

export interface AggregateReviewData {
  average_rating: number;
  total_reviews: number;
  platforms: Array<{
    platform: ReviewPlatform;
    rating: number | null;
    count: number;
    name: string;
    logo: string;
  }>;
}

export interface ReviewsHubSettings {
  reviews_hub_enabled: boolean;
  reviews_display_platforms: ReviewPlatform[];
  reviews_aggregate_display: boolean;
  reviews_widget_position: 'footer' | 'floating' | 'none';
  reviews_floating_style: 'badge' | 'carousel' | 'expandable';
  reviews_min_rating_filter: number;
  reviews_homepage_section: boolean;
  reviews_trust_bar_enabled: boolean;
  reviews_auto_feature_threshold: number;
}

// Platform configuration data
export const REVIEW_PLATFORMS: PlatformInfo[] = [
  {
    id: 'google',
    name: 'Google Reviews',
    logo: 'https://www.google.com/favicon.ico',
    color: '#4285F4',
    bgColor: '#E8F0FE',
    description: 'Reviews van Google Mijn Bedrijf',
    apiKeyRequired: true,
    apiKeyUrl: 'https://console.cloud.google.com/apis/credentials',
    searchSupported: true,
  },
  {
    id: 'trustpilot',
    name: 'Trustpilot',
    logo: 'https://cdn.trustpilot.net/brand-assets/4.1.0/logo-black.svg',
    color: '#00B67A',
    bgColor: '#E6F7F1',
    description: 'Internationale review standaard',
    apiKeyRequired: true,
    apiKeyUrl: 'https://businessapp.b2b.trustpilot.com/',
    searchSupported: true,
  },
  {
    id: 'kiyoh',
    name: 'Kiyoh',
    logo: 'https://www.kiyoh.com/favicon.ico',
    color: '#FF6B00',
    bgColor: '#FFF3E6',
    description: 'Nederlands review platform',
    apiKeyRequired: true,
    apiKeyUrl: 'https://www.kiyoh.com/',
    searchSupported: false,
  },
  {
    id: 'webwinkelkeur',
    name: 'WebwinkelKeur',
    logo: 'https://www.webwinkelkeur.nl/favicon.ico',
    color: '#1E88E5',
    bgColor: '#E3F2FD',
    description: 'Nederlands keurmerk met reviews',
    apiKeyRequired: true,
    apiKeyUrl: 'https://dashboard.webwinkelkeur.nl/',
    searchSupported: false,
  },
  {
    id: 'trusted_shops',
    name: 'Trusted Shops',
    logo: 'https://www.trustedshops.com/favicon.ico',
    color: '#FFDC0F',
    bgColor: '#FFFCE6',
    description: 'Europees vertrouwenskeurmerk',
    apiKeyRequired: true,
    apiKeyUrl: 'https://www.trustedshops.com/',
    searchSupported: false,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    logo: 'https://www.facebook.com/favicon.ico',
    color: '#1877F2',
    bgColor: '#E7F0FF',
    description: 'Facebook pagina reviews',
    apiKeyRequired: true,
    apiKeyUrl: 'https://developers.facebook.com/',
    searchSupported: true,
  },
];

// Quick lookup object for platform info
export const PLATFORM_INFO: Record<ReviewPlatform, { name: string; logo: string; color: string; url: string }> = {
  google: { name: 'Google', logo: 'https://www.google.com/favicon.ico', color: '#4285F4', url: 'https://google.com' },
  trustpilot: { name: 'Trustpilot', logo: 'https://cdn.trustpilot.net/brand-assets/4.1.0/logo-black.svg', color: '#00B67A', url: 'https://trustpilot.com' },
  kiyoh: { name: 'Kiyoh', logo: 'https://www.kiyoh.com/favicon.ico', color: '#FF6B00', url: 'https://kiyoh.com' },
  webwinkelkeur: { name: 'WebwinkelKeur', logo: 'https://www.webwinkelkeur.nl/favicon.ico', color: '#1E88E5', url: 'https://webwinkelkeur.nl' },
  trusted_shops: { name: 'Trusted Shops', logo: 'https://www.trustedshops.com/favicon.ico', color: '#FFDC0F', url: 'https://trustedshops.com' },
  facebook: { name: 'Facebook', logo: 'https://www.facebook.com/favicon.ico', color: '#1877F2', url: 'https://facebook.com' },
};

export const getPlatformInfo = (platform: ReviewPlatform): PlatformInfo => {
  return REVIEW_PLATFORMS.find(p => p.id === platform) || REVIEW_PLATFORMS[0];
};

export const SYNC_FREQUENCY_OPTIONS = [
  { value: 'hourly', label: 'Elk uur' },
  { value: 'daily', label: 'Dagelijks' },
  { value: 'weekly', label: 'Wekelijks' },
  { value: 'manual', label: 'Handmatig' },
] as const;

export const WIDGET_POSITION_OPTIONS = [
  { value: 'none', label: 'Niet tonen' },
  { value: 'footer', label: 'In footer' },
  { value: 'floating', label: 'Zwevende widget' },
] as const;

export const FLOATING_STYLE_OPTIONS = [
  { value: 'badge', label: 'Compacte badge' },
  { value: 'carousel', label: 'Mini carousel' },
  { value: 'expandable', label: 'Uitklapbaar paneel' },
] as const;

export const MIN_RATING_OPTIONS = [
  { value: 1, label: 'Alle reviews' },
  { value: 3, label: '3+ sterren' },
  { value: 4, label: '4+ sterren' },
  { value: 5, label: 'Alleen 5 sterren' },
] as const;

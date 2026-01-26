// Ad Platform Types

export type AdPlatform = 'bol_ads' | 'meta_ads' | 'google_ads' | 'amazon_ads';

export type AdCampaignStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'ended' | 'rejected';

export type AudienceType = 'custom' | 'lookalike' | 'interest' | 'retargeting';

export type BidStrategy = 'auto' | 'manual_cpc' | 'target_roas';

export type CampaignType = 
  | 'sponsored_products' 
  | 'dynamic_product_ads' 
  | 'remarketing' 
  | 'prospecting'
  | 'shopping'
  | 'search'
  | 'display';

export interface AdPlatformConnection {
  id: string;
  tenant_id: string;
  platform: AdPlatform;
  account_id: string | null;
  account_name: string | null;
  currency: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCampaign {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  name: string;
  platform: AdPlatform;
  campaign_type: CampaignType;
  segment_id: string | null;
  audience_type: AudienceType | null;
  audience_config: Record<string, unknown>;
  product_ids: string[] | null;
  category_ids: string[] | null;
  budget_type: 'daily' | 'lifetime';
  budget_amount: number | null;
  bid_strategy: BidStrategy;
  target_roas: number | null;
  status: AdCampaignStatus;
  start_date: string | null;
  end_date: string | null;
  platform_campaign_id: string | null;
  platform_status: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  roas: number | null;
  ai_suggested: boolean;
  ai_suggestion_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  tenant_id: string;
  creative_type: 'image' | 'carousel' | 'video' | 'text';
  headline: string | null;
  description: string | null;
  call_to_action: string | null;
  image_urls: string[] | null;
  video_url: string | null;
  platform_creative_id: string | null;
  status: string;
  variant_label: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
}

export interface AdAudienceSync {
  id: string;
  tenant_id: string;
  connection_id: string;
  segment_id: string | null;
  platform: AdPlatform;
  platform_audience_id: string | null;
  audience_name: string | null;
  audience_size: number | null;
  sync_type: 'upload' | 'update' | 'delete' | null;
  sync_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  synced_at: string;
}

// Platform info for UI
export const AD_PLATFORMS: Record<AdPlatform, {
  name: string;
  icon: string;
  color: string;
  description: string;
}> = {
  bol_ads: {
    name: 'Bol.com',
    icon: '🛒',
    color: 'bg-blue-500',
    description: 'Sponsored Products op Bol.com'
  },
  meta_ads: {
    name: 'Meta (FB/IG)',
    icon: '📱',
    color: 'bg-indigo-500',
    description: 'Facebook & Instagram Ads'
  },
  google_ads: {
    name: 'Google Ads',
    icon: '🔍',
    color: 'bg-red-500',
    description: 'Shopping, Search & Display'
  },
  amazon_ads: {
    name: 'Amazon',
    icon: '📦',
    color: 'bg-orange-500',
    description: 'Sponsored Products & Brands'
  }
};

// Campaign type info
export const CAMPAIGN_TYPES: Record<CampaignType, {
  name: string;
  description: string;
  platforms: AdPlatform[];
}> = {
  sponsored_products: {
    name: 'Sponsored Products',
    description: 'Promoot individuele producten',
    platforms: ['bol_ads', 'amazon_ads']
  },
  dynamic_product_ads: {
    name: 'Dynamic Product Ads',
    description: 'Automatische productadvertenties',
    platforms: ['meta_ads', 'google_ads']
  },
  remarketing: {
    name: 'Remarketing',
    description: 'Bereik eerdere bezoekers',
    platforms: ['meta_ads', 'google_ads']
  },
  prospecting: {
    name: 'Prospecting',
    description: 'Vind nieuwe klanten',
    platforms: ['meta_ads', 'google_ads']
  },
  shopping: {
    name: 'Shopping',
    description: 'Google Shopping campagnes',
    platforms: ['google_ads']
  },
  search: {
    name: 'Search',
    description: 'Tekstadvertenties in zoekresultaten',
    platforms: ['google_ads']
  },
  display: {
    name: 'Display',
    description: 'Banner advertenties',
    platforms: ['google_ads']
  }
};

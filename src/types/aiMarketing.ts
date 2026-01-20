export interface AICredits {
  id: string;
  tenant_id: string;
  credits_total: number;
  credits_used: number;
  credits_purchased: number;
  credits_reset_at: string | null;
  available: number;
}

export interface AIUsageLog {
  id: string;
  tenant_id: string;
  feature: string;
  credits_used: number;
  model_used: string | null;
  created_at: string;
}

export interface AIGeneratedContent {
  id: string;
  tenant_id: string;
  content_type: 'social_post' | 'email_campaign' | 'visual' | 'campaign_suggestion';
  platform: string | null;
  title: string | null;
  content_text: string | null;
  html_content: string | null;
  image_urls: string[];
  product_ids: string[];
  segment_id: string | null;
  metadata: Record<string, any>;
  is_used: boolean;
  used_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

export interface CampaignSuggestion {
  type: string;
  title: string;
  description: string;
  targetAudience: string;
  estimatedReach: number;
  estimatedValue?: number;
  urgency: 'high' | 'medium' | 'low';
  suggestedTiming?: string;
  keyProducts?: string[];
  confidenceScore: number;
}

export interface SocialPostResult {
  content: string;
  alternatives: string[];
  platform: string;
  contentType: string;
  savedId: string;
  suggestedImages: string[];
}

export interface EmailContentResult {
  subjectLines: string[];
  previewText: string;
  greeting: string;
  body: string;
  cta: {
    text: string;
    url: string;
  };
  closing: string;
  htmlContent: string;
  campaignType: string;
  segmentName?: string;
  productCount: number;
}

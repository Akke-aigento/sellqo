// Email Template Types
export interface EmailTemplate {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  html_content: string;
  json_content?: Record<string, unknown>;
  category: 'general' | 'promotional' | 'transactional' | 'newsletter';
  thumbnail_url?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type EmailTemplateInsert = Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>;
export type EmailTemplateUpdate = Partial<EmailTemplateInsert>;

// Segment Filter Rules
export interface SegmentFilterRules {
  customer_type?: 'b2c' | 'b2b' | 'all';
  countries?: string[];
  min_orders?: number;
  max_orders?: number;
  min_total_spent?: number;
  max_total_spent?: number;
  last_order_days_ago?: number;
  no_order_since_days?: number;
  min_engagement_score?: number;
  email_subscribed?: boolean;
}

// Customer Segment Types
export interface CustomerSegment {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  filter_rules: SegmentFilterRules;
  is_dynamic: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export type CustomerSegmentInsert = Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at' | 'member_count'>;
export type CustomerSegmentUpdate = Partial<CustomerSegmentInsert>;

// Email Campaign Types
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

export interface EmailCampaign {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  preview_text?: string;
  html_content: string;
  template_id?: string;
  segment_id?: string;
  status: CampaignStatus;
  scheduled_at?: string;
  sent_at?: string;
  completed_at?: string;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  segment?: CustomerSegment;
  template?: EmailTemplate;
}

export type EmailCampaignInsert = Omit<EmailCampaign, 
  'id' | 'created_at' | 'updated_at' | 'total_recipients' | 'total_sent' | 
  'total_delivered' | 'total_opened' | 'total_clicked' | 'total_bounced' | 
  'total_unsubscribed' | 'segment' | 'template'
>;
export type EmailCampaignUpdate = Partial<EmailCampaignInsert>;

// Campaign Send Types
export type CampaignSendStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';

export interface CampaignSend {
  id: string;
  campaign_id: string;
  customer_id?: string;
  email: string;
  customer_name?: string;
  status: CampaignSendStatus;
  resend_id?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  error_message?: string;
  created_at: string;
}

// Email Unsubscribe Types
export interface EmailUnsubscribe {
  id: string;
  tenant_id: string;
  customer_id?: string;
  email: string;
  reason?: string;
  campaign_id?: string;
  unsubscribed_at: string;
}

// Email Automation Types
export type AutomationTrigger = 'welcome' | 'abandoned_cart' | 'post_purchase' | 'birthday' | 'reactivation';

export interface EmailAutomation {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: AutomationTrigger;
  trigger_config?: Record<string, unknown>;
  template_id?: string;
  delay_hours: number;
  is_active: boolean;
  total_sent: number;
  total_converted: number;
  created_at: string;
  updated_at: string;
}

// Marketing Stats
export interface MarketingStats {
  totalCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  avgOpenRate: number;
  avgClickRate: number;
  subscriberCount: number;
  subscriberGrowth: number;
  unsubscribeCount: number;
}

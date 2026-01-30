// AI Assistant Configuration Types

export interface AIAssistantConfig {
  id: string;
  tenant_id: string;
  
  // Chatbot Settings
  chatbot_enabled: boolean;
  chatbot_name: string;
  chatbot_avatar_url: string | null;
  chatbot_welcome_message: string;
  chatbot_position: 'bottom-right' | 'bottom-left';
  chatbot_theme_color: string | null;
  
  // Knowledge Base Settings
  knowledge_include_products: boolean;
  knowledge_include_categories: boolean;
  knowledge_include_pages: boolean;
  knowledge_include_legal: boolean;
  knowledge_include_shipping: boolean;
  knowledge_custom_instructions: string | null;
  knowledge_forbidden_topics: string | null;
  
  // Reply Suggestions Settings
  reply_suggestions_enabled: boolean;
  reply_suggestions_auto_generate: boolean; // If false, user must click AI button to generate (saves credits)
  reply_suggestions_auto_draft: boolean;
  reply_suggestions_tone: 'professional' | 'friendly' | 'formal';
  reply_suggestions_language: string;
  reply_suggestions_for_email: boolean;
  reply_suggestions_for_whatsapp: boolean;
  
  // Usage & Limits
  daily_limit: number;
  response_delay_ms: number;
  
  created_at: string;
  updated_at: string;
}

export interface AIKnowledgeIndex {
  id: string;
  tenant_id: string;
  source_type: 'product' | 'page' | 'category' | 'legal' | 'shipping' | 'custom';
  source_id: string | null;
  title: string;
  content_summary: string;
  content_hash: string;
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  products: number;
  categories: number;
  pages: number;
  legal: number;
  shipping: number;
  custom: number;
  lastUpdated: string | null;
}

export interface ContactPageConfig {
  show_email_button: boolean;
  show_whatsapp_button: boolean;
  show_phone_button: boolean;
  show_address: boolean;
  show_map: boolean;
  show_contact_form: boolean;
  whatsapp_prefill_message: string;
  opening_hours: string | null;
  custom_intro_text: string | null;
}

export interface FloatingWidgetConfig {
  whatsapp_enabled: boolean;
  whatsapp_position: 'bottom-right' | 'bottom-left';
  whatsapp_prefill_message: string;
  whatsapp_show_on_mobile: boolean;
  whatsapp_delay_seconds: number;
}

export const DEFAULT_CONTACT_CONFIG: ContactPageConfig = {
  show_email_button: true,
  show_whatsapp_button: false,
  show_phone_button: true,
  show_address: true,
  show_map: false,
  show_contact_form: true,
  whatsapp_prefill_message: 'Hallo, ik heb een vraag over...',
  opening_hours: null,
  custom_intro_text: null,
};

export const DEFAULT_FLOATING_WIDGET_CONFIG: FloatingWidgetConfig = {
  whatsapp_enabled: false,
  whatsapp_position: 'bottom-right',
  whatsapp_prefill_message: 'Hallo!',
  whatsapp_show_on_mobile: true,
  whatsapp_delay_seconds: 3,
};

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professioneel', description: 'Zakelijk en beleefd' },
  { value: 'friendly', label: 'Vriendelijk', description: 'Warm en toegankelijk' },
  { value: 'formal', label: 'Formeel', description: 'Zeer zakelijk en correct' },
] as const;

export const POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Rechtsonder' },
  { value: 'bottom-left', label: 'Linksonder' },
] as const;

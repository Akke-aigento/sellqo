import type { AIAssistantConfig } from '@/types/ai-assistant';

/**
 * APP-INBOX-CRASH-1 — de AI-config van een winkel, zoals de frontend hem leest.
 *
 * Een ontbrekende of onleesbare rij wordt hier géén write. Tot 18 sep 2026
 * deed `useAIAssistant` een INSERT vanuit de leesquery; voor een
 * platform-admin zonder rol in de winkel gaf dat bij elke refetch een 403
 * (RLS keek naar user_roles.tenant_id, dat NULL is voor platform_admin).
 * Nu: rij → rij, anders de kolom-defaults van `ai_assistant_config`, in het
 * geheugen. De rij ontstaat pas wanneer iemand in Instellingen opslaat.
 *
 * De waarden hieronder spiegelen de DB-defaults (information_schema, 18-09).
 */
export const DEFAULT_AI_ASSISTANT_CONFIG: Omit<AIAssistantConfig, 'tenant_id'> = {
  id: '',
  chatbot_enabled: false,
  chatbot_name: 'AI Assistent',
  chatbot_avatar_url: null,
  chatbot_welcome_message: 'Hallo! Hoe kan ik je helpen?',
  chatbot_position: 'bottom-right',
  chatbot_theme_color: null,
  knowledge_include_products: true,
  knowledge_include_categories: true,
  knowledge_include_pages: true,
  knowledge_include_legal: true,
  knowledge_include_shipping: true,
  knowledge_custom_instructions: null,
  knowledge_forbidden_topics: null,
  reply_suggestions_enabled: true,
  reply_suggestions_auto_generate: false,
  reply_suggestions_auto_draft: false,
  reply_suggestions_tone: 'professional',
  reply_suggestions_language: 'nl',
  reply_suggestions_for_email: true,
  reply_suggestions_for_whatsapp: true,
  daily_limit: 100,
  response_delay_ms: 500,
  created_at: '',
  updated_at: '',
};

/** Een config zonder `id` bestaat alleen in het geheugen. */
export const isPersistedConfig = (config: Pick<AIAssistantConfig, 'id'> | null | undefined) =>
  !!config?.id;

/**
 * Rij → rij. Geen rij of een fout → defaults voor deze winkel. Nooit een write.
 */
export function resolveAIConfig(
  tenantId: string,
  row: AIAssistantConfig | null | undefined,
  error: unknown,
): AIAssistantConfig {
  if (!error && row) return row;
  return { ...DEFAULT_AI_ASSISTANT_CONFIG, tenant_id: tenantId };
}

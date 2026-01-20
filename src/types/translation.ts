// Translation Hub Types

export type TranslationLanguage = 'nl' | 'en' | 'de' | 'fr';

export const TRANSLATION_LANGUAGES: { code: TranslationLanguage; label: string; flag: string }[] = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export type TranslatableEntityType = 'product' | 'category' | 'email_template' | 'page';

export type TranslatableField = 
  | 'name' 
  | 'description' 
  | 'short_description'
  | 'meta_title' 
  | 'meta_description'
  | 'subject'
  | 'content';

export interface ContentTranslation {
  id: string;
  tenant_id: string;
  entity_type: TranslatableEntityType;
  entity_id: string;
  field_name: TranslatableField;
  source_language: TranslationLanguage;
  target_language: TranslationLanguage;
  source_content: string | null;
  translated_content: string | null;
  is_auto_translated: boolean;
  is_locked: boolean;
  auto_sync_enabled: boolean;
  translation_quality_score: number | null;
  last_source_hash: string | null;
  translated_at: string | null;
  translated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranslationSettings {
  id: string;
  tenant_id: string;
  source_language: TranslationLanguage;
  target_languages: TranslationLanguage[];
  auto_translate_products: boolean;
  auto_translate_categories: boolean;
  auto_translate_seo: boolean;
  auto_translate_marketing: boolean;
  excluded_fields: string[];
  ai_model_preference: string;
  created_at: string;
  updated_at: string;
}

export interface TranslationJob {
  id: string;
  tenant_id: string;
  job_type: 'bulk_translate' | 'sync_updates' | 'export' | 'import';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  entity_types: TranslatableEntityType[];
  target_languages: TranslationLanguage[];
  total_items: number;
  processed_items: number;
  failed_items: number;
  credits_used: number;
  error_log: Array<{ entity_id: string; error: string }>;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

// Entity with translation status
export interface TranslatableEntity {
  id: string;
  name: string;
  entity_type: TranslatableEntityType;
  translations: {
    [lang in TranslationLanguage]?: {
      [field: string]: {
        content: string | null;
        is_locked: boolean;
        is_auto_translated: boolean;
        needs_update: boolean;
      };
    };
  };
  translation_coverage: number; // 0-100%
}

// Translation request for AI
export interface TranslationRequest {
  entity_type: TranslatableEntityType;
  entity_id: string;
  field_name: TranslatableField;
  source_language: TranslationLanguage;
  target_languages: TranslationLanguage[];
  source_content: string;
}

// Bulk translation request
export interface BulkTranslationRequest {
  entity_types: TranslatableEntityType[];
  target_languages: TranslationLanguage[];
  mode: 'all' | 'missing' | 'outdated';
}

// Field configurations per entity type
export const ENTITY_TRANSLATABLE_FIELDS: Record<TranslatableEntityType, TranslatableField[]> = {
  product: ['name', 'description', 'short_description', 'meta_title', 'meta_description'],
  category: ['name', 'description', 'meta_title', 'meta_description'],
  email_template: ['subject', 'content'],
  page: ['name', 'content', 'meta_title', 'meta_description'],
};

export const FIELD_LABELS: Record<TranslatableField, string> = {
  name: 'Naam',
  description: 'Beschrijving',
  short_description: 'Korte beschrijving',
  meta_title: 'Meta titel',
  meta_description: 'Meta beschrijving',
  subject: 'Onderwerp',
  content: 'Inhoud',
};

export const ENTITY_TYPE_LABELS: Record<TranslatableEntityType, string> = {
  product: 'Producten',
  category: 'Categorieën',
  email_template: 'E-mail templates',
  page: 'Pagina\'s',
};

// Translation status helpers
export function getTranslationCoverage(
  translations: ContentTranslation[],
  targetLanguages: TranslationLanguage[],
  fields: TranslatableField[]
): number {
  const totalNeeded = targetLanguages.length * fields.length;
  if (totalNeeded === 0) return 100;
  
  const completed = translations.filter(t => 
    t.translated_content && 
    targetLanguages.includes(t.target_language as TranslationLanguage)
  ).length;
  
  return Math.round((completed / totalNeeded) * 100);
}

export function needsTranslationUpdate(
  translation: ContentTranslation,
  currentSourceHash: string
): boolean {
  return translation.last_source_hash !== currentSourceHash && !translation.is_locked;
}

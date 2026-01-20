// SEO Module Types

export type SEOLanguage = 'nl' | 'en' | 'de' | 'fr';

export const SEO_LANGUAGES: { code: SEOLanguage; label: string; flag: string }[] = [
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export interface SEOKeyword {
  id: string;
  tenant_id: string;
  product_id?: string | null;
  category_id?: string | null;
  keyword: string;
  language: SEOLanguage;
  search_volume_estimate: 'high' | 'medium' | 'low' | null;
  difficulty_estimate: 'easy' | 'medium' | 'hard' | null;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational' | null;
  is_primary: boolean;
  position_tracking: any[];
  created_at: string;
  updated_at: string;
}

export interface SEOScore {
  id: string;
  tenant_id: string;
  entity_type: 'product' | 'category' | 'page' | 'tenant';
  entity_id?: string | null;
  overall_score: number | null;
  meta_score: number | null;
  content_score: number | null;
  technical_score: number | null;
  ai_search_score: number | null;
  issues: SEOIssue[];
  suggestions: SEOSuggestion[];
  last_analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export interface SEOIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  entity_id?: string;
  entity_name?: string;
}

export interface SEOSuggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  entity_id?: string;
  estimated_impact?: number;
}

export interface SEOAnalysisHistory {
  id: string;
  tenant_id: string;
  score_id?: string | null;
  overall_score: number | null;
  analyzed_at: string;
}

export interface SEOAnalysisResult {
  overall_score: number;
  meta_score: number;
  content_score: number;
  technical_score: number;
  ai_search_score: number;
  issues: SEOIssue[];
  suggestions: SEOSuggestion[];
  product_scores: Array<{
    product_id: string;
    product_name: string;
    score: number;
    issues: SEOIssue[];
  }>;
}

export interface SEOContentGeneration {
  type: 'meta_title' | 'meta_description' | 'product_description' | 'alt_text' | 'faq';
  entity_id: string;
  entity_type: 'product' | 'category' | 'page';
  generated_content: string;
  alternatives?: string[];
  keywords_used?: string[];
}

export interface ProductSEOData {
  id: string;
  name: string;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  slug?: string | null;
  images: string[];
  has_structured_data: boolean;
  seo_score?: number | null;
  issues_count: number;
}

export const SEO_SCORE_THRESHOLDS = {
  excellent: 90,
  good: 70,
  fair: 50,
  poor: 0,
} as const;

export const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-muted-foreground';
  if (score >= SEO_SCORE_THRESHOLDS.excellent) return 'text-green-500';
  if (score >= SEO_SCORE_THRESHOLDS.good) return 'text-blue-500';
  if (score >= SEO_SCORE_THRESHOLDS.fair) return 'text-yellow-500';
  return 'text-red-500';
};

export const getScoreLabel = (score: number | null): string => {
  if (score === null) return 'Niet geanalyseerd';
  if (score >= SEO_SCORE_THRESHOLDS.excellent) return 'Uitstekend';
  if (score >= SEO_SCORE_THRESHOLDS.good) return 'Goed';
  if (score >= SEO_SCORE_THRESHOLDS.fair) return 'Redelijk';
  return 'Verbeter nodig';
};

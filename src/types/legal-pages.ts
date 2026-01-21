// Legal Pages Types

export type LegalPageType = 
  | 'privacy' 
  | 'terms' 
  | 'refund' 
  | 'shipping' 
  | 'contact' 
  | 'legal_notice' 
  | 'cookie';

export interface LegalPage {
  id: string;
  tenant_id: string;
  page_type: LegalPageType;
  
  // Content per language
  title_nl: string | null;
  title_en: string | null;
  title_de: string | null;
  title_fr: string | null;
  content_nl: string | null;
  content_en: string | null;
  content_de: string | null;
  content_fr: string | null;
  
  // Meta
  is_published: boolean;
  is_auto_generated: boolean;
  last_auto_generated_at: string | null;
  
  // SEO per language
  meta_title_nl: string | null;
  meta_title_en: string | null;
  meta_title_de: string | null;
  meta_title_fr: string | null;
  meta_description_nl: string | null;
  meta_description_en: string | null;
  meta_description_de: string | null;
  meta_description_fr: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface LegalPageInfo {
  type: LegalPageType;
  slug: string;
  name_nl: string;
  name_en: string;
  description_nl: string;
  icon: string;
}

export const LEGAL_PAGE_TYPES: LegalPageInfo[] = [
  {
    type: 'privacy',
    slug: '/privacy',
    name_nl: 'Privacybeleid',
    name_en: 'Privacy Policy',
    description_nl: 'GDPR/AVG verplicht - Beschrijft hoe persoonsgegevens worden verwerkt',
    icon: 'Shield',
  },
  {
    type: 'terms',
    slug: '/terms',
    name_nl: 'Algemene Voorwaarden',
    name_en: 'Terms of Service',
    description_nl: 'Contractuele basis voor verkoop en dienstverlening',
    icon: 'FileText',
  },
  {
    type: 'refund',
    slug: '/refund',
    name_nl: 'Retourbeleid',
    name_en: 'Refund Policy',
    description_nl: 'Consumentenrecht - Beschrijft retour- en terugbetalingsvoorwaarden',
    icon: 'RotateCcw',
  },
  {
    type: 'shipping',
    slug: '/shipping',
    name_nl: 'Verzendbeleid',
    name_en: 'Shipping Policy',
    description_nl: 'Verzendmethodes, kosten en levertijden',
    icon: 'Truck',
  },
  {
    type: 'contact',
    slug: '/contact',
    name_nl: 'Contactgegevens',
    name_en: 'Contact Information',
    description_nl: 'Wettelijk verplicht - Bedrijfsgegevens en contactmogelijkheden',
    icon: 'Mail',
  },
  {
    type: 'legal_notice',
    slug: '/legal-notice',
    name_nl: 'Juridische Kennisgeving',
    name_en: 'Legal Notice',
    description_nl: 'Impressum (BE/DE) - Identificatie van de onderneming',
    icon: 'Scale',
  },
  {
    type: 'cookie',
    slug: '/cookies',
    name_nl: 'Cookiebeleid',
    name_en: 'Cookie Policy',
    description_nl: 'Cookie-wetgeving - Beschrijft gebruik van cookies en tracking',
    icon: 'Cookie',
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'Engels', flag: '🇬🇧' },
  { code: 'fr', name: 'Frans', flag: '🇫🇷' },
  { code: 'de', name: 'Duits', flag: '🇩🇪' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

export const LANGUAGE_SELECTOR_STYLES = [
  { value: 'dropdown', label: 'Dropdown', description: 'Selecteer taal via dropdown menu' },
  { value: 'flags', label: 'Vlaggen', description: 'Klikbare vlag-iconen' },
  { value: 'text', label: 'Tekstlinks', description: 'Taalcodes als links (NL | EN | FR)' },
] as const;

// Helper function to get content for a specific language
export function getLocalizedContent<T extends LegalPage>(
  page: T,
  field: 'title' | 'content' | 'meta_title' | 'meta_description',
  language: SupportedLanguage,
  fallbackLanguage: SupportedLanguage = 'nl'
): string | null {
  const key = `${field}_${language}` as keyof T;
  const fallbackKey = `${field}_${fallbackLanguage}` as keyof T;
  
  return (page[key] as string | null) || (page[fallbackKey] as string | null);
}

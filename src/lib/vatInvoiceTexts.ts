// VAT Invoice Texts - 4 language support (nl, en, fr, de)
// Based on EU VAT Directive 2006/112/EC

export type VatTextType = 'intracom_goods' | 'intracom_services' | 'export' | 'oss';
export type SupportedLanguage = 'nl' | 'en' | 'fr' | 'de';

export interface VatTextSet {
  nl: string;
  en: string;
  fr: string;
  de: string;
}

// Default VAT invoice texts per situation
export const DEFAULT_VAT_TEXTS: Record<VatTextType, VatTextSet> = {
  // Intra-Community supply of GOODS (B2B) - Article 138
  intracom_goods: {
    nl: 'Intracommunautaire levering vrijgesteld van BTW - art. 138 BTW-richtlijn 2006/112/EG',
    en: 'Intra-Community supply exempt from VAT - Art. 138 VAT Directive 2006/112/EC',
    fr: 'Livraison intracommunautaire exonérée de TVA - Art. 138 Directive TVA 2006/112/CE',
    de: 'Innergemeinschaftliche Lieferung umsatzsteuerfrei - Art. 138 MwSt-Richtlinie 2006/112/EG',
  },

  // Intra-Community SERVICES (B2B) - Article 196 (Reverse Charge)
  intracom_services: {
    nl: 'BTW verlegd naar afnemer - art. 196 BTW-richtlijn 2006/112/EG',
    en: 'VAT reverse charged to customer - Art. 196 VAT Directive 2006/112/EC',
    fr: 'TVA autoliquidée par le preneur - Art. 196 Directive TVA 2006/112/CE',
    de: 'Steuerschuldnerschaft des Leistungsempfängers - Art. 196 MwSt-Richtlinie 2006/112/EG',
  },

  // Export outside EU - Article 146
  export: {
    nl: 'Uitvoer vrijgesteld van BTW - art. 146 BTW-richtlijn 2006/112/EG',
    en: 'Export exempt from VAT - Art. 146 VAT Directive 2006/112/EC',
    fr: 'Exportation exonérée de TVA - Art. 146 Directive TVA 2006/112/CE',
    de: 'Ausfuhr umsatzsteuerfrei - Art. 146 MwSt-Richtlinie 2006/112/EG',
  },

  // OSS Scheme applied - destination country rate
  oss: {
    nl: 'BTW berekend volgens OSS-regeling (One-Stop-Shop) - bestemmingsland tarief',
    en: 'VAT calculated under OSS scheme (One-Stop-Shop) - destination country rate',
    fr: 'TVA calculée selon le régime OSS (guichet unique) - taux du pays de destination',
    de: 'MwSt berechnet nach OSS-Regelung (One-Stop-Shop) - Steuersatz des Bestimmungslandes',
  },
};

// Get VAT text in specific language
export function getVatText(type: VatTextType, language: SupportedLanguage): string {
  return DEFAULT_VAT_TEXTS[type][language] || DEFAULT_VAT_TEXTS[type].en;
}

// Get all VAT texts for a type (useful for displaying in UI)
export function getAllVatTexts(type: VatTextType): VatTextSet {
  return DEFAULT_VAT_TEXTS[type];
}

// UI Labels for VAT text types
export const VAT_TEXT_TYPE_LABELS: Record<VatTextType, VatTextSet> = {
  intracom_goods: {
    nl: 'Intracommunautaire levering goederen (B2B)',
    en: 'Intra-Community supply of goods (B2B)',
    fr: 'Livraison intracommunautaire de biens (B2B)',
    de: 'Innergemeinschaftliche Lieferung von Waren (B2B)',
  },
  intracom_services: {
    nl: 'Intracommunautaire diensten (B2B) - BTW verlegd',
    en: 'Intra-Community services (B2B) - Reverse Charge',
    fr: 'Services intracommunautaires (B2B) - Autoliquidation',
    de: 'Innergemeinschaftliche Dienstleistungen (B2B) - Steuerschuldumkehr',
  },
  export: {
    nl: 'Export buiten EU',
    en: 'Export outside EU',
    fr: 'Exportation hors UE',
    de: 'Ausfuhr außerhalb der EU',
  },
  oss: {
    nl: 'OSS-regeling (B2C EU)',
    en: 'OSS scheme (B2C EU)',
    fr: 'Régime OSS (B2C UE)',
    de: 'OSS-Regelung (B2C EU)',
  },
};

// UI Descriptions for VAT text types
export const VAT_TEXT_TYPE_DESCRIPTIONS: Record<VatTextType, VatTextSet> = {
  intracom_goods: {
    nl: 'Voor leveringen van goederen aan B2B klanten met geldig EU BTW-nummer in een ander EU-land',
    en: 'For deliveries of goods to B2B customers with valid EU VAT number in another EU country',
    fr: 'Pour les livraisons de biens aux clients B2B avec numéro de TVA UE valide dans un autre pays UE',
    de: 'Für Warenlieferungen an B2B-Kunden mit gültiger EU-USt-IdNr. in einem anderen EU-Land',
  },
  intracom_services: {
    nl: 'Voor diensten aan B2B klanten met geldig EU BTW-nummer in een ander EU-land',
    en: 'For services to B2B customers with valid EU VAT number in another EU country',
    fr: 'Pour les services aux clients B2B avec numéro de TVA UE valide dans un autre pays UE',
    de: 'Für Dienstleistungen an B2B-Kunden mit gültiger EU-USt-IdNr. in einem anderen EU-Land',
  },
  export: {
    nl: 'Voor leveringen aan klanten buiten de Europese Unie',
    en: 'For deliveries to customers outside the European Union',
    fr: 'Pour les livraisons aux clients en dehors de l\'Union européenne',
    de: 'Für Lieferungen an Kunden außerhalb der Europäischen Union',
  },
  oss: {
    nl: 'Voor B2C verkopen aan particulieren in andere EU-landen onder de OSS-regeling',
    en: 'For B2C sales to consumers in other EU countries under the OSS scheme',
    fr: 'Pour les ventes B2C aux consommateurs dans d\'autres pays de l\'UE sous le régime OSS',
    de: 'Für B2C-Verkäufe an Verbraucher in anderen EU-Ländern unter der OSS-Regelung',
  },
};

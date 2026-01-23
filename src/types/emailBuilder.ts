export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: EmailBlockContent;
  style: EmailBlockStyle;
}

export type EmailBlockType = 
  | 'header'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'columns'
  | 'product'
  | 'social'
  | 'footer';

export interface EmailBlockContent {
  // Header
  logoUrl?: string;
  headerText?: string;
  
  // Text
  text?: string;
  
  // Image
  imageUrl?: string;
  altText?: string;
  linkUrl?: string;
  
  // Button
  buttonText?: string;
  buttonUrl?: string;
  
  // Divider
  dividerStyle?: 'solid' | 'dashed' | 'dotted';
  
  // Spacer
  height?: number;
  
  // Columns
  columns?: EmailBlock[][];
  columnCount?: 2 | 3;
  
  // Product
  productId?: string;
  productName?: string;
  productPrice?: string;
  productImage?: string;
  productDescription?: string;
  
  // Social
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  
  // Footer
  companyName?: string;
  companyAddress?: string;
  unsubscribeText?: string;
  includePreferences?: boolean;
}

export interface EmailBlockStyle {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  width?: string;
  maxWidth?: number;
}

export interface EmailTemplateWithBlocks {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  html_content: string;
  json_content?: {
    blocks: EmailBlock[];
    globalStyles?: {
      backgroundColor?: string;
      fontFamily?: string;
      maxWidth?: number;
    };
  };
  category: 'general' | 'promotional' | 'transactional' | 'newsletter';
  thumbnail_url?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Block templates for the palette
export const BLOCK_TEMPLATES: Record<EmailBlockType, { name: string; icon: string; defaultContent: EmailBlockContent; defaultStyle: EmailBlockStyle }> = {
  header: {
    name: 'Header',
    icon: '🏷️',
    defaultContent: { headerText: 'Welkom!' },
    defaultStyle: { backgroundColor: '#ffffff', textAlign: 'center', paddingTop: 32, paddingBottom: 32 },
  },
  text: {
    name: 'Tekst',
    icon: '📝',
    defaultContent: { text: 'Voeg hier je tekst toe...' },
    defaultStyle: { textColor: '#333333', fontSize: 16, paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24 },
  },
  image: {
    name: 'Afbeelding',
    icon: '🖼️',
    defaultContent: { imageUrl: '', altText: 'Afbeelding' },
    defaultStyle: { textAlign: 'center', paddingTop: 16, paddingBottom: 16 },
  },
  button: {
    name: 'Knop',
    icon: '🔘',
    defaultContent: { buttonText: 'Klik hier', buttonUrl: '#' },
    defaultStyle: { backgroundColor: '#7c3aed', textColor: '#ffffff', textAlign: 'center', paddingTop: 24, paddingBottom: 24, borderRadius: 8 },
  },
  divider: {
    name: 'Scheidingslijn',
    icon: '➖',
    defaultContent: { dividerStyle: 'solid' },
    defaultStyle: { borderColor: '#e5e7eb', paddingTop: 16, paddingBottom: 16 },
  },
  spacer: {
    name: 'Ruimte',
    icon: '↕️',
    defaultContent: { height: 32 },
    defaultStyle: {},
  },
  columns: {
    name: 'Kolommen',
    icon: '◫',
    defaultContent: { columnCount: 2, columns: [[], []] },
    defaultStyle: { paddingTop: 16, paddingBottom: 16 },
  },
  product: {
    name: 'Product',
    icon: '📦',
    defaultContent: { productName: 'Product naam', productPrice: '€0,00' },
    defaultStyle: { backgroundColor: '#f8fafc', paddingTop: 24, paddingBottom: 24, borderRadius: 8 },
  },
  social: {
    name: 'Social Media',
    icon: '📱',
    defaultContent: {},
    defaultStyle: { textAlign: 'center', paddingTop: 24, paddingBottom: 24 },
  },
  footer: {
    name: 'Footer',
    icon: '📋',
    defaultContent: { 
      companyName: '{{company_name}}', 
      companyAddress: '{{company_address}}',
      unsubscribeText: 'Uitschrijven',
      includePreferences: true,
    },
    defaultStyle: { backgroundColor: '#f8fafc', textColor: '#666666', textAlign: 'center', fontSize: 12, paddingTop: 32, paddingBottom: 32 },
  },
};

// Generate unique ID for blocks
export const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Types for the unified Customer Communication Settings

export type CommunicationCategory = 'orders' | 'shipping' | 'invoices' | 'marketing';

export interface CommunicationTriggerDefinition {
  id: string;
  type: string;
  category: CommunicationCategory;
  label: string;
  description: string;
  supportsEmail: boolean;
  supportsWhatsApp: boolean;
  hasDelay?: boolean;
  delayUnit?: 'hours' | 'days';
  defaultEmailEnabled: boolean;
  defaultWhatsAppEnabled: boolean;
  defaultDelayHours?: number;
  defaultDelayDays?: number;
}

export interface CustomerCommunicationSetting {
  id: string;
  tenant_id: string;
  trigger_type: string;
  category: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  email_template_id: string | null;
  whatsapp_template_id: string | null;
  delay_hours: number;
  delay_days: number;
  extra_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CommunicationCategoryInfo {
  id: CommunicationCategory;
  label: string;
  icon: string;
}

export const COMMUNICATION_CATEGORIES: CommunicationCategoryInfo[] = [
  { id: 'orders', label: 'Bestellingen', icon: 'ShoppingCart' },
  { id: 'shipping', label: 'Verzending', icon: 'Package' },
  { id: 'invoices', label: 'Facturen & Offertes', icon: 'FileText' },
  { id: 'marketing', label: 'Winkelwagen & Marketing', icon: 'Megaphone' },
];

export const COMMUNICATION_TRIGGERS: CommunicationTriggerDefinition[] = [
  // Orders
  {
    id: 'order_confirmation',
    type: 'order_confirmation',
    category: 'orders',
    label: 'Bestelbevestiging',
    description: 'Automatisch na succesvolle betaling',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'payment_received',
    type: 'payment_received',
    category: 'orders',
    label: 'Betaling ontvangen',
    description: 'Bevestiging wanneer betaling binnenkomt',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
  },
  
  // Shipping
  {
    id: 'shipping_update',
    type: 'shipping_update',
    category: 'shipping',
    label: 'Pakket verzonden',
    description: 'Met Track & Trace link',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'out_for_delivery',
    type: 'out_for_delivery',
    category: 'shipping',
    label: 'Onderweg voor bezorging',
    description: 'Wanneer pakket dichtbij is',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'delivery_confirmation',
    type: 'delivery_confirmation',
    category: 'shipping',
    label: 'Pakket bezorgd',
    description: 'Bevestiging van succesvolle levering',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'shipping_exception',
    type: 'shipping_exception',
    category: 'shipping',
    label: 'Probleem met zending',
    description: 'Bij retour, douane issues, etc.',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  
  // Invoices
  {
    id: 'invoice_sent',
    type: 'invoice_sent',
    category: 'invoices',
    label: 'Factuur automatisch verzenden',
    description: 'Stuur factuur direct na aanmaken',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'payment_reminder',
    type: 'payment_reminder',
    category: 'invoices',
    label: 'Betalingsherinnering',
    description: 'Bij achterstallige facturen',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'quote_sent',
    type: 'quote_sent',
    category: 'invoices',
    label: 'Offerte verzonden',
    description: 'Wanneer een offerte wordt verzonden',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  
  // Marketing
  {
    id: 'abandoned_cart',
    type: 'abandoned_cart',
    category: 'marketing',
    label: 'Verlaten winkelwagen',
    description: 'Herinner klanten aan achtergelaten items',
    supportsEmail: true,
    supportsWhatsApp: true,
    hasDelay: true,
    delayUnit: 'hours',
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
    defaultDelayHours: 1,
  },
  {
    id: 'review_request',
    type: 'review_request',
    category: 'marketing',
    label: 'Review verzoek',
    description: 'Vraag om review na levering',
    supportsEmail: true,
    supportsWhatsApp: false,
    hasDelay: true,
    delayUnit: 'days',
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
    defaultDelayDays: 7,
  },
];

export function getTriggersByCategory(category: CommunicationCategory): CommunicationTriggerDefinition[] {
  return COMMUNICATION_TRIGGERS.filter(t => t.category === category);
}

export function getTriggerDefinition(triggerType: string): CommunicationTriggerDefinition | undefined {
  return COMMUNICATION_TRIGGERS.find(t => t.type === triggerType);
}

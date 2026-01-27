// AI Business Coach Types

export type CoachPersonality = 'friendly' | 'professional' | 'casual';
export type ProactiveLevel = 'aggressive' | 'balanced' | 'minimal';
export type AnalysisType = 
  | 'stock' 
  | 'sales' 
  | 'customers' 
  | 'invoices' 
  | 'quotes' 
  | 'subscriptions'
  | 'marketplace'
  | 'reviews'
  | 'storefront';

export interface AICoachSettings {
  id: string;
  tenant_id: string;
  coach_name: string;
  personality: CoachPersonality;
  proactive_level: ProactiveLevel;
  analysis_frequency_hours: number;
  enabled_analyses: AnalysisType[];
  muted_suggestion_types: string[];
  show_emoji: boolean;
  auto_dismiss_after_hours: number;
  created_at: string;
  updated_at: string;
}

// Analysis result from the edge function
export interface AnalysisResult {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  conversational_message: string;
  description: string;
  quick_actions: QuickAction[];
  action_data: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  analysis_context?: Record<string, unknown>;
  confidence_score: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  action_type: 'navigate' | 'execute' | 'dismiss' | 'snooze';
  action_url?: string;
  action_function?: string;
  action_params?: Record<string, unknown>;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
}

// Conversational templates
export const CONVERSATIONAL_TEMPLATES = {
  stock_alert: {
    emoji: '📦',
    greeting: 'Hey! Even een heads-up:',
    templates: [
      'Je "{product_name}" vliegt de deur uit! 🚀 Nog maar {current_stock} op voorraad - over {days_until_stockout} dagen is \'ie uitverkocht.',
      'Let op: "{product_name}" raakt op! Met {avg_daily_sales}/dag verkoop heb je nog {days_until_stockout} dagen voorraad.',
    ],
  },
  sales_spike: {
    emoji: '🎉',
    greeting: 'Wauw!',
    templates: [
      '"{product_name}" verkocht {sales_increase}x zoveel als normaal ({current} vs {average}). Perfect moment voor een boost!',
      'Je bestseller alert! "{product_name}" gaat door het dak - {current} verkopen terwijl je normaal {average} hebt.',
    ],
  },
  vip_inactive: {
    emoji: '👋',
    greeting: 'Even checken:',
    templates: [
      '{customer_name} - een van je beste klanten - is al {inactive_days} dagen niet actief. Tijd voor een persoonlijk berichtje?',
      'Je VIP klant {customer_name} hebben we al {inactive_days} dagen niet gezien. Zal ik een win-back campagne starten?',
    ],
  },
  invoice_overdue: {
    emoji: '💰',
    greeting: 'Factuur reminder:',
    templates: [
      'Factuur {invoice_number} van €{amount} is nu {days_overdue} dagen over datum. Zal ik een vriendelijke herinnering sturen?',
      'Openstaande factuur: {invoice_number} (€{amount}) is {days_overdue} dagen achterstallig. Actie nodig?',
    ],
  },
  abandoned_carts: {
    emoji: '🛒',
    greeting: 'Interessant:',
    templates: [
      '{cart_count} klanten hebben hun winkelwagen achtergelaten deze week. Samen goed voor €{potential_revenue}. Een klein duwtje kan helpen!',
      'Er staan {cart_count} verlaten winkelmandjes klaar met €{potential_revenue} potentiële omzet. Abandoned cart email sturen?',
    ],
  },
  quote_expiring: {
    emoji: '📝',
    greeting: 'Heads up:',
    templates: [
      'Offerte {quote_number} voor {customer_name} (€{amount}) verloopt over {days_until_expiry} dagen. Follow-up nodig?',
      'Je offerte {quote_number} aan {customer_name} is bijna verlopen. Zal ik een herinnering sturen?',
    ],
  },
  subscription_expiring: {
    emoji: '🔄',
    greeting: 'Abonnement update:',
    templates: [
      'Het abonnement van {customer_name} verloopt over {days_until_expiry} dagen. Tijd voor een renewal campagne?',
      '{customer_name}\'s abonnement eindigt binnenkort. Wil je een automatische verlenging aanbieden?',
    ],
  },
  review_negative: {
    emoji: '⭐',
    greeting: 'Aandacht nodig:',
    templates: [
      'Je hebt een nieuwe {rating}-sterren review ontvangen voor "{product_name}". Wil je reageren?',
      'Er is een kritische review binnengekomen. Snel reageren kan de klantrelatie redden!',
    ],
  },
  marketplace_alert: {
    emoji: '🏪',
    greeting: 'Marketplace update:',
    templates: [
      'Je hebt de Buy Box verloren voor "{product_name}" op {platform}. Concurrent prijs: €{competitor_price}.',
      'Prijsalert: {platform} concurrent heeft "{product_name}" voor €{competitor_price} - €{difference} onder jouw prijs.',
    ],
  },
} as const;

export type ConversationalTemplateKey = keyof typeof CONVERSATIONAL_TEMPLATES;

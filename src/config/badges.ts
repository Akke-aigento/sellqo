// Badge definitions for gamification system

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'orders' | 'revenue' | 'customers' | 'special';
  criteria?: string;
  displayOrder: number;
}

// All available badges (combines milestone badges + special badges)
export const ALL_BADGES: BadgeDefinition[] = [
  // Order badges
  { id: 'first_sale', name: 'First Sale', emoji: '🎉', description: 'Je eerste bestelling is binnen', category: 'orders', displayOrder: 1 },
  { id: 'getting_started', name: 'Getting Started', emoji: '🚀', description: 'Je eerste 10 bestellingen verwerkt', category: 'orders', displayOrder: 2 },
  { id: 'on_a_roll', name: 'On a Roll', emoji: '🔥', description: 'Een halve eeuw aan orders', category: 'orders', displayOrder: 3 },
  { id: 'century_seller', name: 'Century Seller', emoji: '🥇', description: 'De magische 100 bereikt', category: 'orders', displayOrder: 4 },
  { id: 'power_seller', name: 'Power Seller', emoji: '💎', description: 'Een echte power seller', category: 'orders', displayOrder: 5 },
  { id: 'superstar', name: 'Superstar', emoji: '⭐', description: 'Superstar status bereikt', category: 'orders', displayOrder: 6 },
  { id: 'legend', name: 'Legend', emoji: '🏆', description: 'Legendaire status', category: 'orders', displayOrder: 7 },
  
  // Revenue badges
  { id: 'first_thousand', name: 'First Thousand', emoji: '💵', description: 'Je eerste duizend euro', category: 'revenue', displayOrder: 10 },
  { id: 'five_k_club', name: 'Five K Club', emoji: '💰', description: 'Welkom in de 5K club', category: 'revenue', displayOrder: 11 },
  { id: 'ten_k_champion', name: 'Ten K Champion', emoji: '🎯', description: 'De 10K grens doorbroken', category: 'revenue', displayOrder: 12 },
  { id: 'quarter_master', name: 'Quarter Master', emoji: '💎', description: 'Een kwart ton omzet', category: 'revenue', displayOrder: 13 },
  { id: 'fifty_k_elite', name: 'Fifty K Elite', emoji: '🌟', description: 'Elite seller status', category: 'revenue', displayOrder: 14 },
  { id: 'six_figure_seller', name: 'Six Figure Seller', emoji: '👑', description: 'Zes cijfers bereikt', category: 'revenue', displayOrder: 15 },
  
  // Customer badges
  { id: 'small_community', name: 'Small Community', emoji: '👥', description: 'Je eerste community', category: 'customers', displayOrder: 20 },
  { id: 'growing_tribe', name: 'Growing Tribe', emoji: '🌱', description: 'Je tribe groeit', category: 'customers', displayOrder: 21 },
  { id: 'hundred_fans', name: '100 Fans', emoji: '💯', description: 'Honderd tevreden klanten', category: 'customers', displayOrder: 22 },
  { id: 'community_builder', name: 'Community Builder', emoji: '🏘️', description: 'Een hele community', category: 'customers', displayOrder: 23 },
  { id: 'thousand_strong', name: 'Thousand Strong', emoji: '🎪', description: 'Duizend sterke fanbase', category: 'customers', displayOrder: 24 },
  
  // Special badges (achievement-based)
  { id: 'speed_demon', name: 'Speed Demon', emoji: '⚡', description: '7 dagen alle orders <24u verzonden', category: 'special', criteria: 'fast_shipping_7d', displayOrder: 100 },
  { id: 'customer_champion', name: 'Customer Champion', emoji: '🏅', description: '0 negatieve reviews in 30 dagen', category: 'special', criteria: 'no_negative_30d', displayOrder: 101 },
  { id: 'inventory_master', name: 'Inventory Master', emoji: '📦', description: 'Nooit uitverkocht in 30 dagen', category: 'special', criteria: 'no_stockout_30d', displayOrder: 102 },
  { id: 'response_pro', name: 'Response Pro', emoji: '💬', description: 'Gemiddelde reactietijd <1u', category: 'special', criteria: 'fast_response_1h', displayOrder: 103 },
];

// Get badge by ID
export function getBadgeById(id: string): BadgeDefinition | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

// Get badges by category
export function getBadgesByCategory(category: BadgeDefinition['category']): BadgeDefinition[] {
  return ALL_BADGES.filter((b) => b.category === category).sort((a, b) => a.displayOrder - b.displayOrder);
}

// Get all badge IDs
export function getAllBadgeIds(): string[] {
  return ALL_BADGES.map((b) => b.id);
}

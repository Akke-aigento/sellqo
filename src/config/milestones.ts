// Milestone definitions for gamification system

export type MilestoneType = 'orders' | 'revenue' | 'customers';

export interface MilestoneDefinition {
  value: number;
  badgeId: string;
  badgeName: string;
  emoji: string;
  title: string;
  description: string;
  celebrationMessage: string;
}

// Order milestones
export const ORDER_MILESTONES: MilestoneDefinition[] = [
  {
    value: 1,
    badgeId: 'first_sale',
    badgeName: 'First Sale',
    emoji: '🎉',
    title: 'Eerste Verkoop!',
    description: 'Je eerste bestelling is binnen',
    celebrationMessage: 'Gefeliciteerd met je allereerste verkoop! Dit is het begin van iets moois.',
  },
  {
    value: 10,
    badgeId: 'getting_started',
    badgeName: 'Getting Started',
    emoji: '🚀',
    title: '10 Bestellingen!',
    description: 'Je eerste 10 bestellingen verwerkt',
    celebrationMessage: 'Je bent lekker op dreef! 10 tevreden klanten en counting.',
  },
  {
    value: 50,
    badgeId: 'on_a_roll',
    badgeName: 'On a Roll',
    emoji: '🔥',
    title: '50 Bestellingen!',
    description: 'Een halve eeuw aan orders',
    celebrationMessage: 'Je bent on fire! 50 bestellingen - je klanten zijn duidelijk fan.',
  },
  {
    value: 100,
    badgeId: 'century_seller',
    badgeName: 'Century Seller',
    emoji: '🥇',
    title: '100 Bestellingen!',
    description: 'De magische 100 bereikt',
    celebrationMessage: 'Van eerste order tot 100 - je bent echt aan het groeien! Trots op je!',
  },
  {
    value: 250,
    badgeId: 'power_seller',
    badgeName: 'Power Seller',
    emoji: '💎',
    title: '250 Bestellingen!',
    description: 'Een echte power seller',
    celebrationMessage: 'Wow, 250 bestellingen! Je bent een professionele verkoper geworden.',
  },
  {
    value: 500,
    badgeId: 'superstar',
    badgeName: 'Superstar',
    emoji: '⭐',
    title: '500 Bestellingen!',
    description: 'Superstar status bereikt',
    celebrationMessage: 'Een halve duizend orders! Je bent officieel een superstar.',
  },
  {
    value: 1000,
    badgeId: 'legend',
    badgeName: 'Legend',
    emoji: '🏆',
    title: '1000 Bestellingen!',
    description: 'Legendaire status',
    celebrationMessage: 'DUIZEND bestellingen! Je bent een absolute legende. Dit is episch!',
  },
];

// Revenue milestones (in cents for precision, display in euros)
export const REVENUE_MILESTONES: MilestoneDefinition[] = [
  {
    value: 1000,
    badgeId: 'first_thousand',
    badgeName: 'First Thousand',
    emoji: '💵',
    title: '€1.000 Omzet!',
    description: 'Je eerste duizend euro',
    celebrationMessage: 'Je eerste €1.000 omzet! De eerste stap naar succes.',
  },
  {
    value: 5000,
    badgeId: 'five_k_club',
    badgeName: 'Five K Club',
    emoji: '💰',
    title: '€5.000 Omzet!',
    description: 'Welkom in de 5K club',
    celebrationMessage: 'Vijfduizend euro omzet! Je business groeit gestaag.',
  },
  {
    value: 10000,
    badgeId: 'ten_k_champion',
    badgeName: 'Ten K Champion',
    emoji: '🎯',
    title: '€10.000 Omzet!',
    description: 'De 10K grens doorbroken',
    celebrationMessage: 'TIENDUIZEND euro! Je bent nu officieel een Ten K Champion.',
  },
  {
    value: 25000,
    badgeId: 'quarter_master',
    badgeName: 'Quarter Master',
    emoji: '💎',
    title: '€25.000 Omzet!',
    description: 'Een kwart ton omzet',
    celebrationMessage: 'Een kwart ton aan omzet! Dit is serieuze business.',
  },
  {
    value: 50000,
    badgeId: 'fifty_k_elite',
    badgeName: 'Fifty K Elite',
    emoji: '🌟',
    title: '€50.000 Omzet!',
    description: 'Elite seller status',
    celebrationMessage: 'Vijftigduizend euro! Je bent onderdeel van de elite.',
  },
  {
    value: 100000,
    badgeId: 'six_figure_seller',
    badgeName: 'Six Figure Seller',
    emoji: '👑',
    title: '€100.000 Omzet!',
    description: 'Zes cijfers bereikt',
    celebrationMessage: 'HONDERDDUIZEND EURO! Je bent nu een Six Figure Seller. Koningsstatus!',
  },
];

// Customer milestones
export const CUSTOMER_MILESTONES: MilestoneDefinition[] = [
  {
    value: 10,
    badgeId: 'small_community',
    badgeName: 'Small Community',
    emoji: '👥',
    title: '10 Klanten!',
    description: 'Je eerste community',
    celebrationMessage: 'Je hebt nu 10 klanten! Een kleine maar fijne community.',
  },
  {
    value: 50,
    badgeId: 'growing_tribe',
    badgeName: 'Growing Tribe',
    emoji: '🌱',
    title: '50 Klanten!',
    description: 'Je tribe groeit',
    celebrationMessage: '50 mensen vertrouwen op jouw producten. Geweldig!',
  },
  {
    value: 100,
    badgeId: 'hundred_fans',
    badgeName: '100 Fans',
    emoji: '💯',
    title: '100 Klanten!',
    description: 'Honderd tevreden klanten',
    celebrationMessage: 'Je hebt nu 100 klanten! Dat zijn 100 mensen die fan zijn van wat je doet.',
  },
  {
    value: 500,
    badgeId: 'community_builder',
    badgeName: 'Community Builder',
    emoji: '🏘️',
    title: '500 Klanten!',
    description: 'Een hele community',
    celebrationMessage: '500 klanten! Je hebt een echte community opgebouwd.',
  },
  {
    value: 1000,
    badgeId: 'thousand_strong',
    badgeName: 'Thousand Strong',
    emoji: '🎪',
    title: '1000 Klanten!',
    description: 'Duizend sterke fanbase',
    celebrationMessage: 'DUIZEND klanten! Je klantenbase is nu echt indrukwekkend.',
  },
];

// Get all milestones by type
export function getMilestonesByType(type: MilestoneType): MilestoneDefinition[] {
  switch (type) {
    case 'orders':
      return ORDER_MILESTONES;
    case 'revenue':
      return REVENUE_MILESTONES;
    case 'customers':
      return CUSTOMER_MILESTONES;
    default:
      return [];
  }
}

// Get milestone definition
export function getMilestoneDefinition(type: MilestoneType, value: number): MilestoneDefinition | undefined {
  const milestones = getMilestonesByType(type);
  return milestones.find((m) => m.value === value);
}

// Get next milestone
export function getNextMilestone(type: MilestoneType, currentValue: number): MilestoneDefinition | undefined {
  const milestones = getMilestonesByType(type);
  return milestones.find((m) => m.value > currentValue);
}

// Calculate progress to next milestone
export function getMilestoneProgress(type: MilestoneType, currentValue: number): { 
  current: number; 
  next: number | null; 
  percentage: number;
  previousMilestone: number;
} {
  const milestones = getMilestonesByType(type);
  const values = milestones.map((m) => m.value);
  
  // Find the previous milestone (highest milestone <= current value)
  const previousMilestone = [...values].reverse().find((v) => v <= currentValue) || 0;
  
  // Find the next milestone
  const nextMilestone = values.find((v) => v > currentValue);
  
  if (!nextMilestone) {
    return { current: currentValue, next: null, percentage: 100, previousMilestone };
  }
  
  // Calculate percentage from previous milestone to next
  const range = nextMilestone - previousMilestone;
  const progress = currentValue - previousMilestone;
  const percentage = Math.min(100, Math.round((progress / range) * 100));
  
  return { current: currentValue, next: nextMilestone, percentage, previousMilestone };
}

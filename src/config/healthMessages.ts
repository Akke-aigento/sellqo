import type { TFunction } from 'i18next';

// Health status types
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'attention';
export type HealthCategoryId = 'orders' | 'inventory' | 'customerService' | 'finance' | 'seo' | 'compliance';

// I18N-SHIP-HEALTH-1 — alle zichtbare tekst staat in de locale-bestanden onder
// admin.shopHealth.*. Dit bestand bevat alleen nog keys en vaste config.
const K = 'admin.shopHealth';

// Emotional messages per category and status (i18n-keys; placeholders {{count}}, {{amount}}, {{score}})
export const categoryMessages: Record<HealthCategoryId, Record<HealthStatus, string>> = {
  orders: {
    healthy: `${K}.messages.orders.healthy`,
    attention: `${K}.messages.orders.attention`,
    warning: `${K}.messages.orders.warning`,
    critical: `${K}.messages.orders.critical`,
  },
  inventory: {
    healthy: `${K}.messages.inventory.healthy`,
    attention: `${K}.messages.inventory.attention`,
    warning: `${K}.messages.inventory.warning`,
    critical: `${K}.messages.inventory.critical`,
  },
  customerService: {
    healthy: `${K}.messages.customerService.healthy`,
    attention: `${K}.messages.customerService.attention`,
    warning: `${K}.messages.customerService.warning`,
    critical: `${K}.messages.customerService.critical`,
  },
  finance: {
    healthy: `${K}.messages.finance.healthy`,
    attention: `${K}.messages.finance.attention`,
    warning: `${K}.messages.finance.warning`,
    critical: `${K}.messages.finance.critical`,
  },
  seo: {
    healthy: `${K}.messages.seo.healthy`,
    attention: `${K}.messages.seo.attention`,
    warning: `${K}.messages.seo.warning`,
    critical: `${K}.messages.seo.critical`,
  },
  compliance: {
    healthy: `${K}.messages.compliance.healthy`,
    attention: `${K}.messages.compliance.attention`,
    warning: `${K}.messages.compliance.warning`,
    critical: `${K}.messages.compliance.critical`,
  },
};

// Overall health messages based on score (i18n-keys, willekeurig gekozen)
export const overallHealthMessages = {
  excellent: [`${K}.overall.excellent_1`, `${K}.overall.excellent_2`, `${K}.overall.excellent_3`],
  healthy: [`${K}.overall.healthy_1`, `${K}.overall.healthy_2`, `${K}.overall.healthy_3`],
  attention: [`${K}.overall.attention_1`, `${K}.overall.attention_2`, `${K}.overall.attention_3`],
  warning: [`${K}.overall.warning_1`, `${K}.overall.warning_2`, `${K}.overall.warning_3`],
  critical: [`${K}.overall.critical_1`, `${K}.overall.critical_2`, `${K}.overall.critical_3`],
};

// Daily pulse messages based on time of day (i18n-keys, willekeurig gekozen)
export const dailyPulseMessages = {
  morning: [`${K}.pulse.morning_1`, `${K}.pulse.morning_2`, `${K}.pulse.morning_3`],
  afternoon: [`${K}.pulse.afternoon_1`, `${K}.pulse.afternoon_2`, `${K}.pulse.afternoon_3`],
  evening: [`${K}.pulse.evening_1`, `${K}.pulse.evening_2`, `${K}.pulse.evening_3`],
  night: [`${K}.pulse.night_1`, `${K}.pulse.night_2`],
};

// Category display info (nameKey = i18n-key)
export const categoryInfo: Record<HealthCategoryId, { nameKey: string; icon: string; maxScore: number }> = {
  orders: { nameKey: `${K}.categories.orders`, icon: 'ShoppingCart', maxScore: 25 },
  inventory: { nameKey: `${K}.categories.inventory`, icon: 'Package', maxScore: 20 },
  customerService: { nameKey: `${K}.categories.customerService`, icon: 'MessageCircle', maxScore: 15 },
  finance: { nameKey: `${K}.categories.finance`, icon: 'CreditCard', maxScore: 20 },
  seo: { nameKey: `${K}.categories.seo`, icon: 'Search', maxScore: 10 },
  compliance: { nameKey: `${K}.categories.compliance`, icon: 'Shield', maxScore: 10 },
};

// Action priority types and labels (labelKey = i18n-key)
export const actionPriorityLabels = {
  urgent: { labelKey: `${K}.priority.urgent`, className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  medium: { labelKey: `${K}.priority.medium`, className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  tip: { labelKey: `${K}.priority.tip`, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
};

// Helper to get the right pulse based on time
export function getDailyPulse(t: TFunction): string {
  const hour = new Date().getHours();
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  
  if (hour >= 5 && hour < 12) {
    timeOfDay = 'morning';
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }
  
  const messages = dailyPulseMessages[timeOfDay];
  return t(messages[Math.floor(Math.random() * messages.length)]);
}

// Helper to get overall message based on score
export function getOverallMessage(score: number, t: TFunction): string {
  let category: keyof typeof overallHealthMessages;
  
  if (score >= 90) {
    category = 'excellent';
  } else if (score >= 70) {
    category = 'healthy';
  } else if (score >= 50) {
    category = 'attention';
  } else if (score >= 30) {
    category = 'warning';
  } else {
    category = 'critical';
  }
  
  const messages = overallHealthMessages[category];
  return t(messages[Math.floor(Math.random() * messages.length)]);
}

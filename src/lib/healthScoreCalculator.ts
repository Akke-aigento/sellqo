import { formatMessage, categoryMessages, type HealthStatus, type HealthCategoryId } from '@/config/healthMessages';

export interface HealthItem {
  label: string;
  status: 'ok' | 'warning' | 'critical';
  value: string | number;
  action?: { label: string; url: string };
}

export interface HealthCategory {
  id: HealthCategoryId;
  name: string;
  icon: string;
  maxScore: number;
  currentScore: number;
  status: HealthStatus;
  items: HealthItem[];
  emotionalMessage: string;
  actionUrl?: string;
}

export interface ActionItem {
  id: string;
  priority: 'urgent' | 'medium' | 'tip';
  title: string;
  description: string;
  action: { label: string; url: string };
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  value?: string;
}

export interface TrendData {
  labels: string[];
  values: number[];
  change: number;
}

export interface HealthData {
  // Orders data
  pendingOrders: number;
  processingOrders: number;
  ordersOverdue48h: number;
  shippedToday: number;
  
  // Inventory data
  lowStockCount: number;
  outOfStockCount: number;
  activeProducts: number;
  productsWithoutImages: number;
  
  // Customer service data
  unreadMessages: number;
  oldestUnreadHours: number;
  pendingQuotes: number;
  
  // Finance data
  stripeConnected: boolean;
  overdueInvoicesAmount: number;
  overdueInvoicesCount: number;
  
  // SEO data
  seoScore: number | null;
  productsWithoutMeta: number;
  productsWithoutAlt: number;
  
  // Compliance data
  onboardingCompleted: boolean;
  missingLegalPages: number;
  companyInfoComplete: boolean;
  logoUploaded: boolean;
  
  // Analytics for achievements
  todayRevenue: number;
  weekRevenue: number;
  newCustomersThisWeek: number;
  packagesShippedThisWeek: number;
  dailyStats: { date: string; revenue: number; orders: number }[];
}

function getStatusFromScore(score: number, max: number): HealthStatus {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return 'healthy';
  if (percentage >= 60) return 'attention';
  if (percentage >= 40) return 'warning';
  return 'critical';
}

export function calculateOrdersHealth(data: HealthData): HealthCategory {
  const maxScore = 25;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // Empty shop detection — no products means no orders possible
  if (data.activeProducts === 0) {
    score = 15;
    items.push({
      label: 'Wachtend op eerste bestelling',
      status: 'ok',
      value: 'Start met producten',
      action: { label: 'Producten toevoegen', url: '/admin/products' },
    });
    
    return {
      id: 'orders',
      name: 'Bestellingen',
      icon: 'ShoppingCart',
      maxScore,
      currentScore: score,
      status: 'attention',
      items,
      emotionalMessage: 'Voeg producten toe om je eerste bestellingen te ontvangen! 🛒',
      actionUrl: '/admin/products',
    };
  }
  
  // Pending orders penalty (max -10 points)
  const pendingTotal = data.pendingOrders + data.processingOrders;
  if (pendingTotal > 0) {
    score -= Math.min(pendingTotal * 2, 10);
    items.push({
      label: 'Wachtend op verwerking',
      status: pendingTotal > 5 ? 'critical' : pendingTotal > 2 ? 'warning' : 'ok',
      value: pendingTotal,
      action: { label: 'Bekijk', url: '/admin/orders?status=pending' },
    });
  } else {
    items.push({ label: 'Wachtend op verwerking', status: 'ok', value: 0 });
  }
  
  // Overdue orders penalty (max -15 points)
  if (data.ordersOverdue48h > 0) {
    score -= Math.min(data.ordersOverdue48h * 5, 15);
    items.push({
      label: 'Overdue (48+ uur)',
      status: 'critical',
      value: data.ordersOverdue48h,
      action: { label: 'Verwerk nu', url: '/admin/orders?status=pending' },
    });
  }
  
  // Shipped today (bonus awareness)
  if (data.shippedToday > 0) {
    items.push({ label: 'Vandaag verzonden', status: 'ok', value: data.shippedToday });
  }
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  let message: string;
  if (status === 'healthy') {
    message = categoryMessages.orders.healthy;
  } else if (status === 'attention') {
    message = formatMessage(categoryMessages.orders.attention, { count: pendingTotal });
  } else if (status === 'warning') {
    message = formatMessage(categoryMessages.orders.warning, { count: pendingTotal });
  } else {
    message = formatMessage(categoryMessages.orders.critical, { count: data.ordersOverdue48h });
  }
  
  return {
    id: 'orders',
    name: 'Bestellingen',
    icon: 'ShoppingCart',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/orders',
  };
}

export function calculateInventoryHealth(data: HealthData): HealthCategory {
  const maxScore = 20;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // Out of stock penalty (max -10 points)
  if (data.outOfStockCount > 0) {
    score -= Math.min(data.outOfStockCount * 3, 10);
    items.push({
      label: 'Uitverkocht',
      status: 'critical',
      value: data.outOfStockCount,
      action: { label: 'Bijvullen', url: '/admin/products?stock=out' },
    });
  }
  
  // Low stock penalty (max -6 points)
  if (data.lowStockCount > 0) {
    score -= Math.min(data.lowStockCount * 1.5, 6);
    items.push({
      label: 'Lage voorraad',
      status: 'warning',
      value: data.lowStockCount,
      action: { label: 'Bekijk', url: '/admin/products?stock=low' },
    });
  }
  
  // Products without images penalty (max -4 points)
  if (data.productsWithoutImages > 0) {
    score -= Math.min(data.productsWithoutImages * 0.5, 4);
    items.push({
      label: 'Zonder afbeelding',
      status: 'warning',
      value: data.productsWithoutImages,
      action: { label: 'Toevoegen', url: '/admin/products' },
    });
  }
  
  // Active products info
  items.push({ label: 'Actieve producten', status: 'ok', value: data.activeProducts });
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  const problemCount = data.outOfStockCount + data.lowStockCount;
  let message: string;
  if (status === 'healthy') {
    message = categoryMessages.inventory.healthy;
  } else if (status === 'attention') {
    message = formatMessage(categoryMessages.inventory.attention, { count: data.lowStockCount });
  } else if (status === 'warning') {
    message = formatMessage(categoryMessages.inventory.warning, { count: problemCount });
  } else {
    message = categoryMessages.inventory.critical;
  }
  
  return {
    id: 'inventory',
    name: 'Voorraad',
    icon: 'Package',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/products',
  };
}

export function calculateCustomerServiceHealth(data: HealthData): HealthCategory {
  const maxScore = 15;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // Unread messages penalty
  if (data.unreadMessages > 0) {
    // Penalty increases with wait time
    if (data.oldestUnreadHours > 48) {
      score -= 10;
      items.push({
        label: 'Onbeantwoord (48+ uur)',
        status: 'critical',
        value: data.unreadMessages,
        action: { label: 'Beantwoorden', url: '/admin/messages' },
      });
    } else if (data.oldestUnreadHours > 24) {
      score -= 6;
      items.push({
        label: 'Onbeantwoord (24+ uur)',
        status: 'warning',
        value: data.unreadMessages,
        action: { label: 'Beantwoorden', url: '/admin/messages' },
      });
    } else {
      score -= Math.min(data.unreadMessages * 2, 5);
      items.push({
        label: 'Wachtend op antwoord',
        status: 'warning',
        value: data.unreadMessages,
        action: { label: 'Beantwoorden', url: '/admin/messages' },
      });
    }
  } else {
    items.push({ label: 'Alle berichten beantwoord', status: 'ok', value: '✓' });
  }
  
  // Pending quotes
  if (data.pendingQuotes > 0) {
    score -= Math.min(data.pendingQuotes * 1, 3);
    items.push({
      label: 'Openstaande offertes',
      status: 'warning',
      value: data.pendingQuotes,
      action: { label: 'Bekijk', url: '/admin/orders/quotes' },
    });
  }
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  let message: string;
  if (status === 'healthy') {
    message = categoryMessages.customerService.healthy;
  } else if (status === 'attention') {
    message = formatMessage(categoryMessages.customerService.attention, { count: data.unreadMessages });
  } else if (status === 'warning') {
    message = formatMessage(categoryMessages.customerService.warning, { count: data.unreadMessages });
  } else {
    message = formatMessage(categoryMessages.customerService.critical, { count: data.unreadMessages });
  }
  
  return {
    id: 'customerService',
    name: 'Klantservice',
    icon: 'MessageCircle',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/messages',
  };
}

export function calculateFinanceHealth(data: HealthData): HealthCategory {
  const maxScore = 20;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // Stripe not connected is critical
  if (!data.stripeConnected) {
    score -= 12;
    items.push({
      label: 'Stripe',
      status: 'critical',
      value: 'Niet gekoppeld',
      action: { label: 'Koppelen', url: '/admin/settings?tab=payments' },
    });
  } else {
    items.push({ label: 'Stripe', status: 'ok', value: 'Actief ✓' });
  }
  
  // Overdue invoices penalty
  if (data.overdueInvoicesCount > 0) {
    score -= Math.min(data.overdueInvoicesCount * 2, 8);
    items.push({
      label: 'Achterstallige facturen',
      status: data.overdueInvoicesAmount > 500 ? 'critical' : 'warning',
      value: `€${data.overdueInvoicesAmount.toFixed(2)}`,
      action: { label: 'Bekijk', url: '/admin/orders/invoices' },
    });
  } else {
    items.push({ label: 'Openstaand', status: 'ok', value: '€0' });
  }
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  let message: string;
  if (status === 'healthy') {
    message = categoryMessages.finance.healthy;
  } else if (!data.stripeConnected) {
    message = categoryMessages.finance.critical;
  } else if (status === 'attention' || status === 'warning') {
    message = formatMessage(categoryMessages.finance.attention, { amount: data.overdueInvoicesAmount.toFixed(2) });
  } else {
    message = formatMessage(categoryMessages.finance.warning, { amount: data.overdueInvoicesAmount.toFixed(2) });
  }
  
  return {
    id: 'finance',
    name: 'Betalingen',
    icon: 'CreditCard',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/orders/invoices',
  };
}

export function calculateSEOHealth(data: HealthData): HealthCategory {
  const maxScore = 10;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // SEO score contribution
  if (data.seoScore !== null) {
    const seoContribution = (data.seoScore / 100) * 6;
    score = Math.min(score, seoContribution + 4);
    items.push({
      label: 'SEO Score',
      status: data.seoScore >= 70 ? 'ok' : data.seoScore >= 40 ? 'warning' : 'critical',
      value: `${data.seoScore}/100`,
      action: { label: 'Verbeteren', url: '/admin/marketing/seo' },
    });
  } else {
    score -= 4;
    items.push({
      label: 'SEO Score',
      status: 'warning',
      value: 'Niet geanalyseerd',
      action: { label: 'Analyseer', url: '/admin/marketing/seo' },
    });
  }
  
  // Products without meta descriptions
  if (data.productsWithoutMeta > 0) {
    score -= Math.min(data.productsWithoutMeta * 0.3, 2);
    items.push({
      label: 'Zonder meta description',
      status: 'warning',
      value: data.productsWithoutMeta,
      action: { label: 'Aanvullen', url: '/admin/products' },
    });
  }
  
  // Products without alt texts
  if (data.productsWithoutAlt > 0) {
    score -= Math.min(data.productsWithoutAlt * 0.2, 2);
    items.push({
      label: 'Zonder alt-tekst',
      status: 'warning',
      value: data.productsWithoutAlt,
      action: { label: 'Toevoegen', url: '/admin/products' },
    });
  }
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  let message: string;
  if (status === 'healthy') {
    message = formatMessage(categoryMessages.seo.healthy, { score: data.seoScore ?? 0 });
  } else if (status === 'attention') {
    message = formatMessage(categoryMessages.seo.attention, { count: data.productsWithoutMeta });
  } else if (status === 'warning') {
    message = formatMessage(categoryMessages.seo.warning, { score: data.seoScore ?? 0 });
  } else {
    message = categoryMessages.seo.critical;
  }
  
  return {
    id: 'seo',
    name: 'SEO & Zichtbaarheid',
    icon: 'Search',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/marketing/seo',
  };
}

export function calculateComplianceHealth(data: HealthData): HealthCategory {
  const maxScore = 10;
  let score = maxScore;
  const items: HealthItem[] = [];
  
  // Onboarding not completed
  if (!data.onboardingCompleted) {
    score -= 3;
    items.push({
      label: 'Setup wizard',
      status: 'warning',
      value: 'Niet voltooid',
      action: { label: 'Voltooien', url: '/admin/settings' },
    });
  } else {
    items.push({ label: 'Setup wizard', status: 'ok', value: 'Voltooid ✓' });
  }
  
  // Missing legal pages
  if (data.missingLegalPages > 0) {
    const penalty = Math.min(data.missingLegalPages * 1.5, 5);
    score -= penalty;
    items.push({
      label: 'Juridische pagina\'s',
      status: data.missingLegalPages > 3 ? 'critical' : 'warning',
      value: `${7 - data.missingLegalPages}/7`,
      action: { label: 'Aanmaken', url: '/admin/storefront?tab=legal' },
    });
  } else {
    items.push({ label: 'Juridische pagina\'s', status: 'ok', value: '7/7 ✓' });
  }
  
  // Company info
  if (!data.companyInfoComplete) {
    score -= 1.5;
    items.push({
      label: 'Bedrijfsgegevens',
      status: 'warning',
      value: 'Onvolledig',
      action: { label: 'Aanvullen', url: '/admin/settings' },
    });
  }
  
  // Logo
  if (!data.logoUploaded) {
    score -= 0.5;
  }
  
  score = Math.max(0, score);
  const status = getStatusFromScore(score, maxScore);
  
  let message: string;
  if (status === 'healthy') {
    message = categoryMessages.compliance.healthy;
  } else if (status === 'attention') {
    message = formatMessage(categoryMessages.compliance.attention, { count: data.missingLegalPages });
  } else if (status === 'warning') {
    message = formatMessage(categoryMessages.compliance.warning, { count: data.missingLegalPages });
  } else {
    message = categoryMessages.compliance.critical;
  }
  
  return {
    id: 'compliance',
    name: 'Compliance',
    icon: 'Shield',
    maxScore,
    currentScore: score,
    status,
    items,
    emotionalMessage: message,
    actionUrl: '/admin/storefront?tab=legal',
  };
}

export function generateActionItems(categories: HealthCategory[]): ActionItem[] {
  const actions: ActionItem[] = [];
  
  categories.forEach((category) => {
    category.items.forEach((item, index) => {
      if (item.status !== 'ok' && item.action) {
        actions.push({
          id: `${category.id}-${index}`,
          priority: item.status === 'critical' ? 'urgent' : 'medium',
          title: item.label,
          description: `${category.name}: ${item.value}`,
          action: item.action,
        });
      }
    });
  });
  
  // Sort by priority
  return actions.sort((a, b) => {
    const priorityOrder = { urgent: 0, medium: 1, tip: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }).slice(0, 5); // Limit to 5 items
}

export function generateAchievements(data: HealthData): Achievement[] {
  const achievements: Achievement[] = [];
  
  // New customers this week
  if (data.newCustomersThisWeek > 0) {
    achievements.push({
      id: 'new-customers',
      emoji: '⭐',
      title: `${data.newCustomersThisWeek} nieuwe klanten deze week`,
    });
  }
  
  // Packages shipped
  if (data.packagesShippedThisWeek > 0) {
    achievements.push({
      id: 'packages-shipped',
      emoji: '📦',
      title: `${data.packagesShippedThisWeek} pakketten verzonden`,
    });
  }
  
  // Best day of the week
  if (data.dailyStats.length > 0) {
    const bestDay = data.dailyStats.reduce((best, day) => 
      day.revenue > best.revenue ? day : best
    );
    if (bestDay.revenue > 0) {
      achievements.push({
        id: 'best-day',
        emoji: '🎯',
        title: `Beste dag: ${bestDay.date}`,
        value: `€${bestDay.revenue.toFixed(2)}`,
      });
    }
  }
  
  // Today's revenue
  if (data.todayRevenue > 0) {
    achievements.push({
      id: 'today-revenue',
      emoji: '💰',
      title: 'Omzet vandaag',
      value: `€${data.todayRevenue.toFixed(2)}`,
    });
  }
  
  // Week revenue milestone
  if (data.weekRevenue >= 1000) {
    achievements.push({
      id: 'week-revenue',
      emoji: '🚀',
      title: 'Week omzet',
      value: `€${data.weekRevenue.toFixed(2)}`,
    });
  }
  
  return achievements.slice(0, 5);
}

export function calculateOverallScore(categories: HealthCategory[]): number {
  const totalScore = categories.reduce((sum, cat) => sum + cat.currentScore, 0);
  const maxTotal = categories.reduce((sum, cat) => sum + cat.maxScore, 0);
  return Math.round((totalScore / maxTotal) * 100);
}

export function getOverallStatus(score: number): HealthStatus {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'attention';
  if (score >= 40) return 'warning';
  return 'critical';
}

// Health status types
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'attention';
export type HealthCategoryId = 'orders' | 'inventory' | 'customerService' | 'finance' | 'seo' | 'compliance';

// Emotional messages per category and status
export const categoryMessages: Record<HealthCategoryId, Record<HealthStatus, string>> = {
  orders: {
    healthy: 'Alle pakketjes zijn onderweg! Je klanten zijn blij. 📦',
    attention: '{count} bestellingen wachten op jou - ze popelen om verzonden te worden!',
    warning: '{count} klanten wachten op hun bestelling. Tijd om actie te ondernemen!',
    critical: '{count} klanten wachten al 48+ uur. Directe actie vereist! 🚨',
  },
  inventory: {
    healthy: 'Voorraad is top! Alles ready to ship. ✅',
    attention: '{count} bestseller(s) raken op - tijd om bij te bestellen!',
    warning: '{count} producten hebben lage voorraad. Bestel snel bij!',
    critical: 'Je populairste producten zijn uitverkocht! 😱',
  },
  customerService: {
    healthy: 'Klanten voelen zich gehoord - alle berichten beantwoord! 💬',
    attention: '{count} klant(en) wachten op een antwoord',
    warning: '{count} klanten wachten al meer dan 24 uur op antwoord',
    critical: 'Klanten verliezen interesse - {count} berichten onbeantwoord! 📩',
  },
  finance: {
    healthy: 'Financiën op orde! €0 openstaand. 💰',
    attention: '€{amount} aan openstaande facturen - verstuur een herinnering?',
    warning: '€{amount} aan achterstallige facturen - actie vereist',
    critical: 'Betalingsproblemen detecteren! Controleer je Stripe status. 💳',
  },
  seo: {
    healthy: 'Google ziet je! SEO score: {score}/100 🔍',
    attention: '{count} producten missen meta descriptions - snel te fixen!',
    warning: 'Je SEO kan beter - score: {score}/100. Er zijn verbeterpunten.',
    critical: 'Je producten zijn onzichtbaar voor Google! SEO actie nodig.',
  },
  compliance: {
    healthy: 'Je winkel is 100% compliant en professioneel! ⚖️',
    attention: 'Nog {count} juridische pagina(s) nodig voor volledige compliance',
    warning: '{count} verplichte pagina\'s ontbreken - risico!',
    critical: 'Juridische pagina\'s ontbreken! Dit is verplicht. ⚠️',
  },
};

// Overall health messages based on score
export const overallHealthMessages = {
  excellent: [
    'Je winkel bruist van energie! 🔥',
    'Wauw, je winkel is in topvorm! 🏆',
    'Je bent on fire! Alles loopt perfect! 💪',
  ],
  healthy: [
    'Je winkel is gezond en draait goed! 💚',
    'Goed bezig! Je winkel staat er sterk voor.',
    'Solide prestaties! Je bent op de goede weg.',
  ],
  attention: [
    'Er zijn een paar aandachtspunten 🟡',
    'Bijna perfect! Nog een paar kleine verbeteringen mogelijk.',
    'Je winkel draait, maar er is ruimte voor verbetering.',
  ],
  warning: [
    'Je winkel heeft wat liefde nodig 🧡',
    'Er zijn problemen die aandacht vragen.',
    'Actie vereist om je winkel gezond te houden.',
  ],
  critical: [
    'Directe actie vereist! 🔴',
    'Je winkel heeft dringend hulp nodig!',
    'Kritieke problemen gedetecteerd - los deze snel op!',
  ],
};

// Daily pulse messages based on time of day and context
export const dailyPulseMessages = {
  morning: [
    'Goedemorgen! Nieuwe dag, nieuwe kansen ☀️',
    'Rise and shine! Tijd om te verkopen 🌅',
    'Goedemorgen! Je winkel wacht op je.',
  ],
  afternoon: [
    'Goedemiddag! Hoe gaat het verkopen? 🛍️',
    'Halverwege de dag - blijf gefocust! 💪',
    'Middag check-in: Je doet het goed!',
  ],
  evening: [
    'Goedeavond! Nog even de laatste zaken afhandelen? 🌙',
    'Tijd om de balans op te maken voor vandaag.',
    'Bijna klaar voor vandaag - morgen weer een nieuwe kans!',
  ],
  night: [
    'Nog laat aan het werk? Rust is ook belangrijk! 😴',
    'Nachtelijk bezoek! Je winkel is 24/7 open.',
  ],
};

// Achievement messages
export const achievementMessages = {
  orderStreak: '{days} dagen op rij alle orders op tijd verzonden! 🔥',
  revenueFirstK: 'Eerste €1.000 omzet bereikt! 🏆',
  revenueFirst5K: '€5.000 omzet milestone! Je groeit snel! 🚀',
  revenueFirst10K: '€10.000 omzet bereikt! Ongelooflijk! 💎',
  newCustomers: '{count} nieuwe klanten deze week! ⭐',
  perfectReviews: '{count} 5-sterren reviews - je bent een ster! 🌟',
  zeroReturns: 'Nul retouren deze maand - perfectie! 💎',
  responseTime: 'Je reageert 2x sneller dan gemiddeld! ⚡',
  packagesShipped: '{count} pakketten verzonden deze week! 📦',
  repeatCustomer: 'Terugkerende klant: {name} bestelde weer! 💝',
  bestDay: 'Beste dag ooit: {day} (€{amount})! 🎯',
};

// Category display info
export const categoryInfo: Record<HealthCategoryId, { name: string; icon: string; maxScore: number }> = {
  orders: { name: 'Bestellingen', icon: 'ShoppingCart', maxScore: 25 },
  inventory: { name: 'Voorraad', icon: 'Package', maxScore: 20 },
  customerService: { name: 'Klantservice', icon: 'MessageCircle', maxScore: 15 },
  finance: { name: 'Betalingen', icon: 'CreditCard', maxScore: 20 },
  seo: { name: 'SEO & Zichtbaarheid', icon: 'Search', maxScore: 10 },
  compliance: { name: 'Compliance', icon: 'Shield', maxScore: 10 },
};

// Action priority types and labels
export const actionPriorityLabels = {
  urgent: { label: 'URGENT', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  medium: { label: 'MEDIUM', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  tip: { label: 'TIP', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
};

// Helper to get the right pulse based on time
export function getDailyPulse(): string {
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
  return messages[Math.floor(Math.random() * messages.length)];
}

// Helper to get overall message based on score
export function getOverallMessage(score: number): string {
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
  return messages[Math.floor(Math.random() * messages.length)];
}

// Helper to format message with placeholders
export function formatMessage(template: string, values: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

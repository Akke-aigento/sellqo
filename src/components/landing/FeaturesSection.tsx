import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Store, Package, TrendingUp, FileText, Sparkles, Gift, Check, Search, MessageSquare, Paintbrush } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  features?: string[];
  gridSpan: 1 | 2;
}

const features: Feature[] = [
  {
    icon: Store,
    title: 'Verkoop Overal, Beheer Centraal',
    subtitle: 'Multi-Channel Verkoop',
    description: 'Koppel je Shopify, WooCommerce, Bol.com, Amazon én Odoo. Alle bestellingen, voorraad en klanten op één dashboard.',
    badge: '20+ integraties',
    gridSpan: 2,
  },
  {
    icon: Package,
    title: 'Nooit Meer Uitverkocht',
    subtitle: 'Real-Time Voorraadsync',
    description: 'Automatische sync tussen al je kanalen. Verkoop je iets op Amazon? Je Bol.com en webshop worden direct bijgewerkt.',
    gridSpan: 1,
  },
  {
    icon: Sparkles,
    title: 'Complete AI Marketing Suite',
    subtitle: 'Content, SEO & Campagnes',
    description: 'Genereer social posts, productbeschrijvingen, email content én afbeeldingen. Plan advertenties op Bol.com en Meta.',
    badge: 'AI-powered',
    features: [
      'AI Content Hub met agenda',
      'Automatisch posten naar social media',
      'Bol.com & Meta Ads manager',
    ],
    gridSpan: 2,
  },
  {
    icon: Search,
    title: 'AI SEO & Vertalingen',
    subtitle: 'Gevonden Worden',
    description: 'SEO Dashboard met Quick Wins, technische checks en AI Search optimalisatie. Bulk-vertaal naar EN/DE/FR met één klik.',
    badge: 'Exclusief',
    gridSpan: 1,
  },
  {
    icon: Gift,
    title: '8 Promotietypen',
    subtitle: 'Kortingen & Loyaliteit',
    description: 'Kortingscodes, BOGO, bundels, staffelkorting, cadeaubonnen, klantgroepen en een compleet loyaliteitsprogramma.',
    features: [
      'Cadeaubonnen met QR-codes',
      'Stapelbare kortingen met regels',
      'VIP tiers met punten multipliers',
    ],
    gridSpan: 2,
  },
  {
    icon: MessageSquare,
    title: 'Unified Inbox',
    subtitle: 'Alle Communicatie Op Één Plek',
    description: 'Email, WhatsApp, Facebook Messenger én Instagram DMs in één inbox. Marketplace berichten worden automatisch gerouteerd.',
    badge: 'Social Messaging',
    features: [
      'WhatsApp, Facebook & Instagram',
      'Bol.com & Amazon berichten',
      'AI-suggesties voor antwoorden',
    ],
    gridSpan: 2,
  },
  {
    icon: Paintbrush,
    title: 'Drag & Drop Webshop Builder',
    subtitle: 'Geen Code Nodig',
    description: 'Kies een theme, pas kleuren aan, bouw je homepage visueel. Reviews van Google, Trustpilot en meer op één plek.',
    features: [
      'WYSIWYG Visual Editor',
      'Multi-platform Reviews Hub',
      'AI Chatbot voor 24/7 support',
    ],
    gridSpan: 2,
  },
  {
    icon: FileText,
    title: 'Slimme Financiën',
    subtitle: 'Facturen & BTW',
    description: 'Factur-X PDF\'s in 4 talen, automatische BTW/OSS berekening, credit notes en Peppol e-invoicing voor B2B.',
    badge: 'Peppol 2026',
    gridSpan: 1,
  },
  {
    icon: TrendingUp,
    title: 'Groei-Insights & POS',
    subtitle: 'Data & Fysieke Verkoop',
    description: 'Real-time inzicht in omzet, winstmarges per product, best sellers. Plus een volledig POS kassasysteem voor je winkel.',
    badge: 'Omnichannel',
    gridSpan: 1,
  },
];

interface FeatureCardProps {
  feature: Feature;
  index: number;
  isIntersecting: boolean;
}

function FeatureCard({ feature, index, isIntersecting }: FeatureCardProps) {
  const Icon = feature.icon;
  
  return (
    <div
      className={cn(
        'group p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo',
        'hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300',
        'flex flex-col h-full',
        feature.gridSpan === 2 && 'lg:col-span-2',
        isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
      )}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{feature.subtitle}</p>
          <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
        </div>
      </div>
      
      <p className="text-muted-foreground mb-4 flex-grow">{feature.description}</p>
      
      {feature.features && (
        <ul className="space-y-2 mb-4">
          {feature.features.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
      
      {feature.badge && (
        <div className="mt-auto pt-2">
          <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
            {feature.badge}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function FeaturesSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section id="features" className="pt-12 pb-20 md:pt-16 md:pb-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Alles Wat Je Nodig Hebt, Op Één Plek
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Geen losse puzzelstukjes meer. SellQo is het complete platform voor jouw e-commerce business.
          </p>
        </div>

        {/* Bento Grid - Structured Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              feature={feature}
              index={index}
              isIntersecting={isIntersecting}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

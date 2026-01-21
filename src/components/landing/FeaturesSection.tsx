import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Store, Package, TrendingUp, FileText, Users, Zap, Check, Sparkles, Gift, Globe, Monitor } from 'lucide-react';
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
    description: 'Koppel je Shopify, WooCommerce, Bol.com en Amazon. Alle bestellingen, voorraad en klanten op één dashboard.',
    badge: '16+ integraties',
    gridSpan: 2,
  },
  {
    icon: Sparkles,
    title: 'AI Die Je Marketing Doet',
    subtitle: 'Sellqo AI',
    description: 'Genereer social posts, email content en complete productpromoties met één klik. A/B test automatisch je campagnes.',
    badge: 'Pro feature',
    gridSpan: 1,
  },
  {
    icon: Package,
    title: 'Nooit Meer Uitverkocht Door Fout',
    subtitle: 'Real-Time Voorraadsync',
    description: 'Automatische voorraadsynchronisatie tussen al je kanalen. Verkoop je iets op Bol? Je Shopify wordt direct bijgewerkt.',
    gridSpan: 1,
  },
  {
    icon: Gift,
    title: 'Klanten Die Terugkomen',
    subtitle: '8 Promotietypen + Loyaliteit',
    description: 'Kortingscodes, BOGO, bundels, staffelkorting, cadeaubonnen en een compleet loyaliteitsprogramma met punten en tiers.',
    features: [
      'Automatische cadeaubonnen met QR',
      'Klantgroepen met speciale prijzen',
      'Stapelbare kortingen met prioriteiten',
    ],
    gridSpan: 2,
  },
  {
    icon: Globe,
    title: 'Jouw Merk, Jouw Webshop',
    subtitle: 'Drag & Drop Builder',
    description: 'Bouw je eigen webshop met themes, homepage secties en custom domeinen. Geen code nodig.',
    badge: '3 premium themes',
    gridSpan: 1,
  },
  {
    icon: Monitor,
    title: 'Verkoop Ook In De Winkel',
    subtitle: 'Touch-Optimized POS',
    description: 'Complete kassa met barcode scanner, cadeaubon verkoop en Stripe Terminal integratie. Offline-first design.',
    badge: 'Add-on module',
    gridSpan: 1,
  },
  {
    icon: FileText,
    title: "Factur-X PDF's in 4 Talen",
    subtitle: 'Professionele Facturen',
    description: 'Automatische facturen die Odoo en andere boekhoudpakketten direct kunnen inlezen. Nederlands, Engels, Frans, Duits.',
    badge: 'Compliance guaranteed',
    gridSpan: 1,
  },
  {
    icon: TrendingUp,
    title: 'Weet Precies Waar Je Staat',
    subtitle: 'Slimme Financiën & Rapportage',
    description: 'Real-time inzicht in omzet, kosten, winstmarges en BTW. Exporteer alles naar je boekhouder in één klik.',
    features: [
      'Automatische BTW berekening (OSS compliant)',
      'Winstmarge per product en kanaal',
      'Peppol e-invoicing ready (verplicht vanaf 2026)',
    ],
    gridSpan: 2,
  },
  {
    icon: Users,
    title: 'Ken Je Klanten',
    subtitle: 'Klantenmanagement + SEO',
    description: 'Volledige klantprofielen, aankoopgeschiedenis, en geautomatiseerde follow-ups. Plus ingebouwde SEO tools voor je webshop.',
    gridSpan: 1,
  },
  {
    icon: Zap,
    title: 'Datagedreven Groeien',
    subtitle: 'Groei-Insights',
    description: 'Ontdek je best verkopende producten, optimale prijspunten en seizoenstrends met AI-gestuurde analyses.',
    gridSpan: 2,
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
    <section id="features" className="py-20 md:py-28 bg-secondary/20">
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

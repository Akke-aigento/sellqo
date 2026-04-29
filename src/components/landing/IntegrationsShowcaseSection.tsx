import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, 
  Store, 
  Megaphone, 
  Share2, 
  Truck, 
  CreditCard,
  Package,
  MessageCircle,
  Instagram,
  Globe,
  Mail,
  FileText
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface Integration {
  name: string;
  icon: LucideIcon;
  status: 'live' | 'coming-soon';
  badge?: string;
}

interface IntegrationCategory {
  title: string;
  icon: LucideIcon;
  integrations: Integration[];
}

const categories: IntegrationCategory[] = [
  {
    title: 'E-commerce & ERP',
    icon: Store,
    integrations: [
      { name: 'Bol.com', icon: ShoppingBag, status: 'live', badge: 'VVB Labels' },
      { name: 'Amazon', icon: Package, status: 'live' },
      { name: 'Shopify', icon: Store, status: 'live' },
      { name: 'WooCommerce', icon: Store, status: 'live' },
      { name: 'Odoo', icon: Globe, status: 'live', badge: 'Nieuw' },
      { name: 'eBay', icon: ShoppingBag, status: 'live' },
    ],
  },
  {
    title: 'Advertenties',
    icon: Megaphone,
    integrations: [
      { name: 'Bol.com Sponsored', icon: ShoppingBag, status: 'live' },
      { name: 'Meta Ads', icon: Share2, status: 'live' },
      { name: 'Google Ads', icon: Globe, status: 'coming-soon' },
      { name: 'Amazon Ads', icon: Package, status: 'coming-soon' },
    ],
  },
  {
    title: 'Social Commerce & Messaging',
    icon: Share2,
    integrations: [
      { name: 'Facebook Shop', icon: Share2, status: 'live' },
      { name: 'Instagram Shopping', icon: Instagram, status: 'live' },
      { name: 'Facebook Messenger', icon: MessageCircle, status: 'live', badge: 'Nieuw' },
      { name: 'Instagram DMs', icon: Instagram, status: 'live', badge: 'Nieuw' },
      { name: 'WhatsApp Business', icon: MessageCircle, status: 'live' },
      { name: 'Google Shopping', icon: Globe, status: 'live' },
    ],
  },
  {
    title: 'Operations & Payments',
    icon: Truck,
    integrations: [
      { name: 'PostNL', icon: Truck, status: 'live' },
      { name: 'DHL', icon: Truck, status: 'live' },
      { name: 'Sendcloud', icon: Package, status: 'live' },
      { name: 'Stripe', icon: CreditCard, status: 'live' },
      { name: 'Peppol', icon: FileText, status: 'coming-soon', badge: 'Coming Soon' },
      { name: 'Resend', icon: Mail, status: 'live' },
    ],
  },
];

function IntegrationChip({ integration }: { integration: Integration }) {
  const Icon = integration.icon;
  const isComingSoon = integration.status === 'coming-soon';
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
        isComingSoon 
          ? 'bg-muted/50 border-border/50 text-muted-foreground' 
          : 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
      )}
    >
      <Icon className={cn('w-4 h-4', isComingSoon ? 'text-muted-foreground' : 'text-primary')} />
      <span className={cn('text-sm font-medium', isComingSoon && 'text-muted-foreground')}>
        {integration.name}
      </span>
      {integration.badge && (
        <Badge 
          variant="secondary" 
          className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border-accent/20"
        >
          {integration.badge}
        </Badge>
      )}
      {isComingSoon && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 text-muted-foreground"
        >
          Binnenkort
        </Badge>
      )}
    </div>
  );
}

function CategoryRow({ category, index, isIntersecting }: { 
  category: IntegrationCategory; 
  index: number;
  isIntersecting: boolean;
}) {
  const CategoryIcon = category.icon;
  
  return (
    <div
      className={cn(
        'space-y-3',
        isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
      )}
      style={{ animationDelay: `${0.2 + index * 0.1}s` }}
    >
      <div className="flex items-center gap-2">
        <CategoryIcon className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{category.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {category.integrations.map((integration) => (
          <IntegrationChip key={integration.name} integration={integration} />
        ))}
      </div>
    </div>
  );
}

export function IntegrationsShowcaseSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
            SellQo Connect
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Verkoop Overal. Beheer Het Hier.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            SellQo Connect koppelt je webshop aan Bol.com, Amazon, eBay en sociale kanalen — vanuit één dashboard.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {categories.map((category, index) => (
            <CategoryRow 
              key={category.title} 
              category={category} 
              index={index}
              isIntersecting={isIntersecting}
            />
          ))}
        </div>

        <div
          className={cn(
            'text-center mt-10',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.6s' }}
        >
          <p className="text-sm text-muted-foreground">
            Mis je een integratie? <span className="text-primary font-medium">Laat het ons weten</span> - we bouwen het voor je.
          </p>
        </div>
      </div>
    </section>
  );
}

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
import { useTranslation } from 'react-i18next';

interface Integration {
  name: string;
  icon: LucideIcon;
  status: 'live' | 'coming-soon';
  badgeKey?: 'new' | 'vvb' | 'comingSoon' | 'viaOdoo';
}

interface IntegrationCategory {
  titleKey: 'ecommerce' | 'ads' | 'social' | 'ops';
  icon: LucideIcon;
  integrations: Integration[];
}

const categories: IntegrationCategory[] = [
  {
    titleKey: 'ecommerce',
    icon: Store,
    integrations: [
      { name: 'Bol.com', icon: ShoppingBag, status: 'live', badgeKey: 'vvb' },
      { name: 'Amazon', icon: Package, status: 'coming-soon' },
      { name: 'Shopify', icon: Store, status: 'coming-soon' },
      { name: 'WooCommerce', icon: Store, status: 'coming-soon' },
      { name: 'Odoo', icon: Globe, status: 'live', badgeKey: 'new' },
      { name: 'eBay', icon: ShoppingBag, status: 'coming-soon' },
    ],
  },
  {
    titleKey: 'ads',
    icon: Megaphone,
    integrations: [
      { name: 'Bol.com Sponsored', icon: ShoppingBag, status: 'coming-soon' },
      { name: 'Meta Ads', icon: Share2, status: 'coming-soon' },
      { name: 'Google Ads', icon: Globe, status: 'coming-soon' },
      { name: 'Amazon Ads', icon: Package, status: 'coming-soon' },
    ],
  },
  {
    titleKey: 'social',
    icon: Share2,
    integrations: [
      { name: 'Facebook Shop', icon: Share2, status: 'coming-soon' },
      { name: 'Instagram Shopping', icon: Instagram, status: 'coming-soon' },
      { name: 'Facebook Messenger', icon: MessageCircle, status: 'coming-soon' },
      { name: 'Instagram DMs', icon: Instagram, status: 'coming-soon' },
      { name: 'WhatsApp Business', icon: MessageCircle, status: 'coming-soon' },
      { name: 'Google Shopping', icon: Globe, status: 'coming-soon' },
    ],
  },
  {
    titleKey: 'ops',
    icon: Truck,
    integrations: [
      { name: 'PostNL', icon: Truck, status: 'coming-soon' },
      { name: 'DHL', icon: Truck, status: 'coming-soon' },
      { name: 'Sendcloud', icon: Package, status: 'coming-soon' },
      { name: 'Stripe', icon: CreditCard, status: 'live' },
      { name: 'Peppol', icon: FileText, status: 'live', badgeKey: 'viaOdoo' },
      { name: 'Resend', icon: Mail, status: 'live' },
    ],
  },
];

function IntegrationChip({ integration }: { integration: Integration }) {
  const Icon = integration.icon;
  const isComingSoon = integration.status === 'coming-soon';
  const { t } = useTranslation();
  
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
      {integration.badgeKey && (
        <Badge 
          variant="secondary" 
          className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border-accent/20"
        >
          {t(`landing.integrations.badges.${integration.badgeKey}`)}
        </Badge>
      )}
      {isComingSoon && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 text-muted-foreground"
        >
          {t('landing.integrations.comingSoon')}
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
  const { t } = useTranslation();
  
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
        <h3 className="font-semibold text-foreground">{t(`landing.integrations.cats.${category.titleKey}`)}</h3>
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
  const { t } = useTranslation();

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
            {t('landing.integrations.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.integrations.heading')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.integrations.subheading')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {categories.map((category, index) => (
            <CategoryRow 
              key={category.titleKey} 
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
            {t('landing.integrations.missing')} <span className="text-primary font-medium">{t('landing.integrations.missingCta')}</span>{t('landing.integrations.missingSuffix')}
          </p>
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ShoppingBag, CreditCard, Truck, MessageSquare, BarChart3, Globe, Search, Star, Zap, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Structural definitions only; localized text is read from i18n at render time.
const integrationCategories = [
  {
    id: 'marketplaces',
    icon: ShoppingBag,
    integrations: [
      { key: 'bolcom', name: 'Bol.com', status: 'live', difficulty: 'easy', popular: true },
      { key: 'amazon', name: 'Amazon', status: 'coming', difficulty: 'medium', popular: true },
      { key: 'ebay', name: 'eBay', status: 'coming', difficulty: 'medium', popular: false },
      { key: 'etsy', name: 'Etsy', status: 'planned', difficulty: 'easy', popular: false },
    ],
  },
  {
    id: 'payments',
    icon: CreditCard,
    integrations: [
      { key: 'stripe', name: 'Stripe', status: 'live', difficulty: 'easy', popular: true },
      { key: 'mollie', name: 'Mollie', status: 'planned', difficulty: 'easy', popular: true },
      { key: 'paypal', name: 'PayPal', status: 'planned', difficulty: 'easy', popular: false },
    ],
  },
  {
    id: 'shipping',
    icon: Truck,
    integrations: [
      { key: 'postnl', name: 'PostNL', status: 'coming', difficulty: 'easy', popular: false },
      { key: 'dhl', name: 'DHL', status: 'coming', difficulty: 'easy', popular: false },
      { key: 'sendcloud', name: 'Sendcloud', status: 'coming', difficulty: 'medium', popular: false },
      { key: 'bpost', name: 'Bpost', status: 'coming', difficulty: 'easy', popular: false },
    ],
  },
  {
    id: 'communication',
    icon: MessageSquare,
    integrations: [
      { key: 'resend', name: 'Resend', status: 'live', difficulty: 'easy', popular: false },
      { key: 'whatsapp', name: 'WhatsApp Business', status: 'coming', difficulty: 'medium', popular: false },
      { key: 'intercom', name: 'Intercom', status: 'planned', difficulty: 'medium', popular: false },
    ],
  },
  {
    id: 'marketing',
    icon: BarChart3,
    integrations: [
      { key: 'metaads', name: 'Meta Ads', status: 'coming', difficulty: 'medium', popular: false },
      { key: 'googleads', name: 'Google Ads', status: 'coming', difficulty: 'medium', popular: true },
      { key: 'bolsponsored', name: 'Bol.com Sponsored', status: 'coming', difficulty: 'easy', popular: false },
      { key: 'klaviyo', name: 'Klaviyo', status: 'planned', difficulty: 'medium', popular: true },
    ],
  },
  {
    id: 'platforms',
    icon: Globe,
    integrations: [
      { key: 'shopify', name: 'Shopify', status: 'coming', difficulty: 'easy', popular: true },
      { key: 'woocommerce', name: 'WooCommerce', status: 'coming', difficulty: 'medium', popular: true },
      { key: 'odoo', name: 'Odoo', status: 'live', difficulty: 'medium', popular: true },
      { key: 'lightspeed', name: 'Lightspeed', status: 'planned', difficulty: 'medium', popular: false },
      { key: 'peppol', name: 'Peppol', status: 'live', difficulty: 'easy', popular: false },
    ],
  },
] as const;

const statusClass = {
  live: 'bg-green-500/10 text-green-600 border-green-500/20',
  coming: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  planned: 'bg-secondary text-muted-foreground border-border',
} as const;

const difficultyStyle = {
  easy: { icon: Zap, color: 'text-green-500' },
  medium: { icon: Clock, color: 'text-amber-500' },
  advanced: { icon: CheckCircle, color: 'text-blue-500' },
} as const;

export default function Integrations() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  const catTitle = (id: string) => t(`public.integrations.categories.${id}`);
  const itemDesc = (key: string) => t(`public.integrations.items.${key}.description`);
  const itemFeatures = (key: string) => t(`public.integrations.items.${key}.features`, { returnObjects: true }) as string[];
  const statusLabel = (s: string) => t(`public.integrations.status.${s}`);
  const difficultyLabel = (d: string) => t(`public.integrations.difficulty.${d}`);

  // Get all integrations flat
  const allIntegrations = integrationCategories.flatMap((cat) =>
    cat.integrations.map((int) => ({ ...int, categoryTitle: catTitle(cat.id), categoryId: cat.id }))
  );

  // Filter by search
  const q = searchQuery.toLowerCase();
  const filteredCategories = searchQuery
    ? integrationCategories
        .map((cat) => ({
          ...cat,
          integrations: cat.integrations.filter(
            (int) => int.name.toLowerCase().includes(q) || itemDesc(int.key).toLowerCase().includes(q)
          ),
        }))
        .filter((cat) => cat.integrations.length > 0)
    : integrationCategories;

  const popularIntegrations = allIntegrations.filter((int) => int.popular && int.status === 'live');

  return (
    <PublicPageLayout 
      title={t('public.integrations.title')}
      subtitle={t('public.integrations.subtitle')}
    >
      {/* Search */}
      <section className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder={t('public.integrations.searchPlaceholder')}
            className="pl-12 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Popular Integrations */}
      {!searchQuery && (
        <section className="max-w-5xl mx-auto mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-foreground">{t('public.integrations.popular')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularIntegrations.slice(0, 4).map((integration, index) => (
              <button
                key={index}
                onClick={() => setSelectedIntegration(integration)}
                className="bg-gradient-to-br from-accent/10 to-primary/5 rounded-xl border border-accent/30 p-4 text-left hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{integration.name}</h3>
                  <Badge variant="outline" className={statusClass.live}>
                    {statusLabel('live')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{itemDesc(integration.key)}</p>
                <span className="text-xs text-accent">{t('public.integrations.viewDetails')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-8">
        <p className="text-lg text-muted-foreground">{t('public.integrations.intro')}</p>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto mb-16 space-y-12">
        {filteredCategories.map((category, index) => (
          <div key={index}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <category.icon className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{catTitle(category.id)}</h2>
              <span className="text-sm text-muted-foreground">
                ({t('public.integrations.countLabel', { count: category.integrations.length })})
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.integrations.map((integration, i) => {
                const status = statusClass[integration.status as keyof typeof statusClass];
                const difficulty = difficultyStyle[integration.difficulty as keyof typeof difficultyStyle];
                const DifficultyIcon = difficulty.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedIntegration({ ...integration, categoryTitle: catTitle(category.id), categoryId: category.id })}
                    className="bg-card rounded-xl border border-border p-4 hover:border-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{integration.name}</h3>
                        {integration.popular && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <Badge variant="outline" className={status}>
                        {statusLabel(integration.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{itemDesc(integration.key)}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <DifficultyIcon className={`w-3 h-3 ${difficulty.color}`} />
                      <span className={difficulty.color}>{difficultyLabel(integration.difficulty)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Integration Detail Modal */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">{selectedIntegration?.name}</DialogTitle>
              {selectedIntegration && (
                <Badge variant="outline" className={statusClass[selectedIntegration.status as keyof typeof statusClass]}>
                  {statusLabel(selectedIntegration.status)}
                </Badge>
              )}
            </div>
            <DialogDescription>{selectedIntegration ? itemDesc(selectedIntegration.key) : ''}</DialogDescription>
          </DialogHeader>
          
          {selectedIntegration && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{t('public.integrations.modal.category')}</p>
                <p className="text-sm text-muted-foreground">{selectedIntegration.categoryTitle}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{t('public.integrations.modal.setup')}</p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const diff = difficultyStyle[selectedIntegration.difficulty as keyof typeof difficultyStyle];
                    const Icon = diff.icon;
                    return (
                      <>
                        <Icon className={`w-4 h-4 ${diff.color}`} />
                        <span className={diff.color}>{difficultyLabel(selectedIntegration.difficulty)}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">{t('public.integrations.modal.features')}</p>
                <ul className="space-y-1">
                  {itemFeatures(selectedIntegration.key).map((feature: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedIntegration.status === 'live' ? (
                <Button className="w-full" asChild>
                  <Link to="/auth?mode=register">
                    {t('public.integrations.modal.startWith', { name: selectedIntegration.name })}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {selectedIntegration.status === 'coming'
                    ? t('public.integrations.modal.comingSoon')
                    : t('public.integrations.modal.planned')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API CTA */}
      <section className="max-w-2xl mx-auto text-center mb-12">
        <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-8">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('public.integrations.apiCta.title')}</h2>
          <p className="text-muted-foreground mb-6">{t('public.integrations.apiCta.description')}</p>
          <Button asChild variant="outline">
            <Link to="/api-docs">{t('public.integrations.apiCta.button')}</Link>
          </Button>
        </div>
      </section>

      {/* Request */}
      <section className="text-center">
        <p className="text-muted-foreground mb-4">{t('public.integrations.requestCta.text')}</p>
        <Button asChild variant="ghost">
          <Link to="/contact">{t('public.integrations.requestCta.button')}</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}

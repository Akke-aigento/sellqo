import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ShoppingBag, CreditCard, Truck, MessageSquare, BarChart3, Globe, Search, Star, Zap, Clock, CheckCircle, ExternalLink } from 'lucide-react';

const integrationCategories = [
  {
    id: 'marketplaces',
    title: 'Marketplaces',
    icon: ShoppingBag,
    integrations: [
      { name: 'Bol.com', status: 'live', description: 'Verkoop en beheer producten op Bol.com', difficulty: 'easy', popular: true, features: ['Product sync', 'Order import', 'Voorraad beheer', 'VVB verzending'] },
      { name: 'Amazon', status: 'coming', description: 'Sync met Amazon Seller Central', difficulty: 'medium', popular: true, features: ['Product listing', 'FBA support', 'Multi-country'] },
      { name: 'eBay', status: 'coming', description: 'eBay marketplace integratie', difficulty: 'medium', popular: false, features: ['Veilingen', 'Fixed price', 'Shipping profiles'] },
      { name: 'Etsy', status: 'planned', description: 'Handgemaakte producten verkopen', difficulty: 'easy', popular: false, features: ['Shop sync', 'Order management'] },
    ],
  },
  {
    id: 'payments',
    title: 'Betalingen',
    icon: CreditCard,
    integrations: [
      { name: 'Stripe', status: 'live', description: 'iDEAL, creditcards, Apple Pay en meer', difficulty: 'easy', popular: true, features: ['iDEAL', 'Bancontact', 'Creditcards', 'Apple/Google Pay', 'Subscriptions'] },
      { name: 'Mollie', status: 'planned', description: 'Nederlandse payment provider', difficulty: 'easy', popular: true, features: ['iDEAL', 'Bancontact', 'Klarna', 'PayPal'] },
      { name: 'PayPal', status: 'planned', description: 'Wereldwijde betalingen', difficulty: 'easy', popular: false, features: ['PayPal checkout', 'Pay Later'] },
    ],
  },
  {
    id: 'shipping',
    title: 'Verzending',
    icon: Truck,
    integrations: [
      { name: 'PostNL', status: 'live', description: 'Labels en track & trace', difficulty: 'easy', popular: true, features: ['Label printing', 'Track & trace', 'Afhaalpunten'] },
      { name: 'DHL', status: 'live', description: 'DHL verzendlabels', difficulty: 'easy', popular: true, features: ['Express', 'Parcel', 'ServicePoints'] },
      { name: 'Sendcloud', status: 'live', description: 'Multi-carrier platform', difficulty: 'medium', popular: true, features: ['Alle carriers', 'Automatische regels', 'Returns'] },
      { name: 'Bpost', status: 'coming', description: 'Belgische post', difficulty: 'easy', popular: false, features: ['Standaard', 'Bpack', 'Afhaalpunten'] },
    ],
  },
  {
    id: 'communication',
    title: 'Communicatie',
    icon: MessageSquare,
    integrations: [
      { name: 'Resend', status: 'live', description: 'Transactionele emails', difficulty: 'easy', popular: false, features: ['Orderbevestigingen', 'Verzendmeldingen', 'Custom templates'] },
      { name: 'WhatsApp Business', status: 'live', description: 'Klantcommunicatie via WhatsApp', difficulty: 'medium', popular: true, features: ['Berichten sturen', 'Templates', 'Quick replies'] },
      { name: 'Intercom', status: 'planned', description: 'Customer success platform', difficulty: 'medium', popular: false, features: ['Live chat', 'Help desk', 'Product tours'] },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: BarChart3,
    integrations: [
      { name: 'Meta Ads', status: 'live', description: 'Facebook & Instagram advertenties', difficulty: 'medium', popular: true, features: ['Pixel tracking', 'Catalog sync', 'CAPI'] },
      { name: 'Google Ads', status: 'coming', description: 'Search en Shopping campagnes', difficulty: 'medium', popular: true, features: ['Google Shopping', 'Conversion tracking', 'Remarketing'] },
      { name: 'Bol.com Sponsored', status: 'live', description: 'Gesponsorde producten op Bol', difficulty: 'easy', popular: false, features: ['Sponsored Products', 'Display ads'] },
      { name: 'Klaviyo', status: 'planned', description: 'Email marketing automation', difficulty: 'medium', popular: true, features: ['Email flows', 'Segmentatie', 'A/B testing'] },
    ],
  },
  {
    id: 'platforms',
    title: 'E-commerce Platforms',
    icon: Globe,
    integrations: [
      { name: 'Shopify', status: 'coming', description: 'Importeer vanuit Shopify', difficulty: 'easy', popular: true, features: ['Product import', 'Order sync', 'Customer migratie'] },
      { name: 'WooCommerce', status: 'coming', description: 'WordPress webshop migratie', difficulty: 'medium', popular: true, features: ['Volledige migratie', 'Product import'] },
      { name: 'Odoo', status: 'planned', description: 'ERP integratie', difficulty: 'advanced', popular: false, features: ['Inventory sync', 'Order flow', 'Accounting'] },
      { name: 'Lightspeed', status: 'planned', description: 'POS en e-commerce', difficulty: 'medium', popular: false, features: ['POS sync', 'Inventory', 'Products'] },
    ],
  },
];

const statusStyles = {
  live: { label: 'Live', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  coming: { label: 'Binnenkort', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  planned: { label: 'Gepland', className: 'bg-secondary text-muted-foreground border-border' },
};

const difficultyStyles = {
  easy: { label: 'Makkelijk', icon: Zap, color: 'text-green-500' },
  medium: { label: 'Gemiddeld', icon: Clock, color: 'text-amber-500' },
  advanced: { label: 'Geavanceerd', icon: CheckCircle, color: 'text-blue-500' },
};

export default function Integrations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  // Get all integrations flat
  const allIntegrations = integrationCategories.flatMap(cat => 
    cat.integrations.map(int => ({ ...int, category: cat.title, categoryId: cat.id }))
  );

  // Filter by search
  const filteredCategories = searchQuery 
    ? integrationCategories.map(cat => ({
        ...cat,
        integrations: cat.integrations.filter(int => 
          int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          int.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.integrations.length > 0)
    : integrationCategories;

  // Popular integrations
  const popularIntegrations = allIntegrations.filter(int => int.popular && int.status === 'live');

  return (
    <PublicPageLayout 
      title="Integraties" 
      subtitle="Verbind SellQo met je favoriete tools en platforms"
    >
      {/* Search */}
      <section className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Zoek integraties..." 
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
            <h2 className="text-xl font-bold text-foreground">Populaire Integraties</h2>
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
                  <Badge variant="outline" className={statusStyles.live.className}>
                    Live
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                <span className="text-xs text-accent">Bekijk details →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-8">
        <p className="text-lg text-muted-foreground">
          SellQo verbindt naadloos met tientallen platforms voor marketplaces, betalingen, 
          verzending en marketing. Alles vanuit één dashboard.
        </p>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto mb-16 space-y-12">
        {filteredCategories.map((category, index) => (
          <div key={index}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <category.icon className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{category.title}</h2>
              <span className="text-sm text-muted-foreground">
                ({category.integrations.length} integraties)
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.integrations.map((integration, i) => {
                const status = statusStyles[integration.status as keyof typeof statusStyles];
                const difficulty = difficultyStyles[integration.difficulty as keyof typeof difficultyStyles];
                const DifficultyIcon = difficulty.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedIntegration({ ...integration, category: category.title })}
                    className="bg-card rounded-xl border border-border p-4 hover:border-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{integration.name}</h3>
                        {integration.popular && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{integration.description}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <DifficultyIcon className={`w-3 h-3 ${difficulty.color}`} />
                      <span className={difficulty.color}>{difficulty.label}</span>
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
                <Badge variant="outline" className={statusStyles[selectedIntegration.status as keyof typeof statusStyles].className}>
                  {statusStyles[selectedIntegration.status as keyof typeof statusStyles].label}
                </Badge>
              )}
            </div>
            <DialogDescription>{selectedIntegration?.description}</DialogDescription>
          </DialogHeader>
          
          {selectedIntegration && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Categorie</p>
                <p className="text-sm text-muted-foreground">{selectedIntegration.category}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Setup moeilijkheid</p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const diff = difficultyStyles[selectedIntegration.difficulty as keyof typeof difficultyStyles];
                    const Icon = diff.icon;
                    return (
                      <>
                        <Icon className={`w-4 h-4 ${diff.color}`} />
                        <span className={diff.color}>{diff.label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Features</p>
                <ul className="space-y-1">
                  {selectedIntegration.features?.map((feature: string, i: number) => (
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
                    Start met {selectedIntegration.name}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {selectedIntegration.status === 'coming' ? 'Binnenkort beschikbaar' : 'Gepland voor later'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API CTA */}
      <section className="max-w-2xl mx-auto text-center mb-12">
        <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Bouw je eigen integratie
          </h2>
          <p className="text-muted-foreground mb-6">
            Met de SellQo API kun je custom integraties bouwen voor jouw specifieke workflow.
          </p>
          <Button asChild variant="outline">
            <Link to="/api-docs">Bekijk API Documentatie</Link>
          </Button>
        </div>
      </section>

      {/* Request */}
      <section className="text-center">
        <p className="text-muted-foreground mb-4">
          Mis je een integratie? Laat het ons weten!
        </p>
        <Button asChild variant="ghost">
          <Link to="/contact">Integratie Aanvragen</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}

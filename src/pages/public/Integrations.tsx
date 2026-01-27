import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, CreditCard, Truck, MessageSquare, BarChart3, Globe } from 'lucide-react';

const integrationCategories = [
  {
    title: 'Marketplaces',
    icon: ShoppingBag,
    integrations: [
      { name: 'Bol.com', status: 'live', description: 'Verkoop en beheer producten op Bol.com' },
      { name: 'Amazon', status: 'coming', description: 'Sync met Amazon Seller Central' },
      { name: 'eBay', status: 'coming', description: 'eBay marketplace integratie' },
      { name: 'Etsy', status: 'planned', description: 'Handgemaakte producten verkopen' },
    ],
  },
  {
    title: 'Betalingen',
    icon: CreditCard,
    integrations: [
      { name: 'Stripe', status: 'live', description: 'iDEAL, creditcards, Apple Pay en meer' },
      { name: 'Mollie', status: 'planned', description: 'Nederlandse payment provider' },
      { name: 'PayPal', status: 'planned', description: 'Wereldwijde betalingen' },
    ],
  },
  {
    title: 'Verzending',
    icon: Truck,
    integrations: [
      { name: 'PostNL', status: 'live', description: 'Labels en track & trace' },
      { name: 'DHL', status: 'live', description: 'DHL verzendlabels' },
      { name: 'Sendcloud', status: 'live', description: 'Multi-carrier platform' },
      { name: 'Bpost', status: 'coming', description: 'Belgische post' },
    ],
  },
  {
    title: 'Communicatie',
    icon: MessageSquare,
    integrations: [
      { name: 'Resend', status: 'live', description: 'Transactionele emails' },
      { name: 'WhatsApp Business', status: 'live', description: 'Klantcommunicatie via WhatsApp' },
      { name: 'Intercom', status: 'planned', description: 'Customer success platform' },
    ],
  },
  {
    title: 'Marketing',
    icon: BarChart3,
    integrations: [
      { name: 'Meta Ads', status: 'live', description: 'Facebook & Instagram advertenties' },
      { name: 'Google Ads', status: 'coming', description: 'Search en Shopping campagnes' },
      { name: 'Bol.com Sponsored', status: 'live', description: 'Gesponsorde producten op Bol' },
      { name: 'Klaviyo', status: 'planned', description: 'Email marketing automation' },
    ],
  },
  {
    title: 'E-commerce Platforms',
    icon: Globe,
    integrations: [
      { name: 'Shopify', status: 'coming', description: 'Importeer vanuit Shopify' },
      { name: 'WooCommerce', status: 'coming', description: 'WordPress webshop migratie' },
      { name: 'Odoo', status: 'planned', description: 'ERP integratie' },
      { name: 'Lightspeed', status: 'planned', description: 'POS en e-commerce' },
    ],
  },
];

const statusStyles = {
  live: { label: 'Live', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  coming: { label: 'Binnenkort', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  planned: { label: 'Gepland', className: 'bg-secondary text-muted-foreground border-border' },
};

export default function Integrations() {
  return (
    <PublicPageLayout 
      title="Integraties" 
      subtitle="Verbind SellQo met je favoriete tools en platforms"
    >
      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-12">
        <p className="text-lg text-muted-foreground">
          SellQo verbindt naadloos met tientallen platforms voor marketplaces, betalingen, 
          verzending en marketing. Alles vanuit één dashboard.
        </p>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto mb-16 space-y-12">
        {integrationCategories.map((category, index) => (
          <div key={index}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <category.icon className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{category.title}</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.integrations.map((integration, i) => {
                const status = statusStyles[integration.status as keyof typeof statusStyles];
                return (
                  <div 
                    key={i}
                    className="bg-card rounded-xl border border-border p-4 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{integration.name}</h3>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

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

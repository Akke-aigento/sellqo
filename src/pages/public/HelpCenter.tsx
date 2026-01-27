import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, ShoppingBag, CreditCard, Package, Users, Settings, MessageSquare } from 'lucide-react';

const categories = [
  { icon: BookOpen, title: 'Aan de slag', description: 'Eerste stappen en setup handleidingen', articles: 12 },
  { icon: ShoppingBag, title: 'Producten', description: 'Beheer je catalogus en voorraad', articles: 18 },
  { icon: Package, title: 'Bestellingen', description: 'Orders verwerken en verzenden', articles: 15 },
  { icon: CreditCard, title: 'Betalingen', description: 'Stripe, iDEAL en facturatie', articles: 10 },
  { icon: Users, title: 'Klanten', description: 'CRM en klantengroepen', articles: 8 },
  { icon: Settings, title: 'Instellingen', description: 'Account en configuratie', articles: 14 },
];

const popularArticles = [
  'Hoe start ik mijn eerste webshop?',
  'Stripe koppelen aan SellQo',
  'Producten importeren vanuit CSV',
  'Verzendmethodes instellen',
  'Kortingscodes aanmaken',
];

export default function HelpCenter() {
  return (
    <PublicPageLayout 
      title="Help Center" 
      subtitle="Vind antwoorden op al je vragen"
    >
      {/* Search */}
      <section className="max-w-2xl mx-auto mb-12">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Zoek in de kennisbank..." 
            className="pl-12 h-14 text-lg"
          />
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Categorieën</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <category.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{category.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                  <span className="text-xs text-muted-foreground">{category.articles} artikelen</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Articles */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Populaire Artikelen</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {popularArticles.map((article, index) => (
            <div 
              key={index}
              className="p-4 hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-between"
            >
              <span className="text-foreground">{article}</span>
              <span className="text-accent text-sm">Lees →</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Link */}
      <section className="max-w-2xl mx-auto mb-12 text-center">
        <div className="bg-secondary/30 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-2">Veelgestelde Vragen</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Bekijk onze uitgebreide FAQ voor snelle antwoorden.
          </p>
          <Button asChild variant="outline">
            <Link to="/#faq">Naar FAQ</Link>
          </Button>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-full px-4 py-2 mb-4">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="text-sm text-foreground">Hulp nodig?</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Kom je er niet uit?
        </h2>
        <p className="text-muted-foreground mb-6">
          Ons support team staat voor je klaar.
        </p>
        <Button asChild size="lg">
          <Link to="/contact">Neem Contact Op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}

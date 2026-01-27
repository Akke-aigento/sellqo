import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, ShoppingBag, CreditCard, Package, Users, Settings, MessageSquare, Play, ArrowRight, Zap, Clock, AlertCircle } from 'lucide-react';

const categories = [
  { id: 'getting-started', icon: BookOpen, title: 'Aan de slag', description: 'Eerste stappen en setup handleidingen', articles: 12, color: 'bg-green-500/10 text-green-600' },
  { id: 'products', icon: ShoppingBag, title: 'Producten', description: 'Beheer je catalogus en voorraad', articles: 18, color: 'bg-blue-500/10 text-blue-600' },
  { id: 'orders', icon: Package, title: 'Bestellingen', description: 'Orders verwerken en verzenden', articles: 15, color: 'bg-purple-500/10 text-purple-600' },
  { id: 'payments', icon: CreditCard, title: 'Betalingen', description: 'Stripe, iDEAL en facturatie', articles: 10, color: 'bg-amber-500/10 text-amber-600' },
  { id: 'customers', icon: Users, title: 'Klanten', description: 'CRM en klantengroepen', articles: 8, color: 'bg-pink-500/10 text-pink-600' },
  { id: 'settings', icon: Settings, title: 'Instellingen', description: 'Account en configuratie', articles: 14, color: 'bg-cyan-500/10 text-cyan-600' },
];

const allArticles = [
  { title: 'Hoe start ik mijn eerste webshop?', category: 'getting-started', views: 1250 },
  { title: 'Stripe koppelen aan SellQo', category: 'payments', views: 980 },
  { title: 'Producten importeren vanuit CSV', category: 'products', views: 875 },
  { title: 'Verzendmethodes instellen', category: 'orders', views: 720 },
  { title: 'Kortingscodes aanmaken', category: 'products', views: 650 },
  { title: 'Bol.com integratie activeren', category: 'getting-started', views: 600 },
  { title: 'Facturen automatisch versturen', category: 'payments', views: 550 },
  { title: 'Productvarianten toevoegen', category: 'products', views: 520 },
  { title: 'Klantgroepen aanmaken', category: 'customers', views: 480 },
  { title: 'API keys genereren', category: 'settings', views: 450 },
  { title: 'Voorraad synchroniseren', category: 'products', views: 420 },
  { title: 'Retourlabels printen', category: 'orders', views: 400 },
];

const videoTutorials = [
  { title: 'SellQo in 5 minuten', duration: '5:23', thumbnail: '🎬' },
  { title: 'Je eerste product toevoegen', duration: '3:45', thumbnail: '📦' },
  { title: 'Bol.com koppeling instellen', duration: '7:12', thumbnail: '🔗' },
  { title: 'Bestellingen verwerken', duration: '4:30', thumbnail: '📋' },
];

const quickLinks = [
  { title: 'Account aanmaken', href: '/auth?mode=register' },
  { title: 'Prijzen bekijken', href: '/pricing' },
  { title: 'API documentatie', href: '/api-docs' },
  { title: 'Systeem status', href: '/status' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Filter articles based on search and category
  const filteredArticles = allArticles.filter(article => {
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || article.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Get popular articles (sorted by views)
  const popularArticles = [...allArticles]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return (
    <PublicPageLayout 
      title="Help Center" 
      subtitle="Vind antwoorden op al je vragen"
    >
      {/* Search */}
      <section className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Zoek in de kennisbank..." 
            className="pl-12 h-14 text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Search Results */}
        {searchQuery && (
          <div className="mt-4 bg-card rounded-xl border border-border overflow-hidden">
            {filteredArticles.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredArticles.slice(0, 5).map((article, index) => (
                  <div 
                    key={index}
                    className="p-4 hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="text-foreground">{article.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {categories.find(c => c.id === article.category)?.title}
                    </Badge>
                  </div>
                ))}
                {filteredArticles.length > 5 && (
                  <div className="p-3 bg-secondary/30 text-center">
                    <span className="text-sm text-muted-foreground">
                      +{filteredArticles.length - 5} meer resultaten
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-muted-foreground">Geen resultaten gevonden voor "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className="max-w-2xl mx-auto mb-12">
        <div className="flex flex-wrap justify-center gap-2">
          {quickLinks.map((link, index) => (
            <Link
              key={index}
              to={link.href}
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <Zap className="w-3 h-3" />
              {link.title}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Categorieën</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <button
              key={index}
              onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
              className={`bg-card rounded-xl border p-6 text-left transition-all ${
                activeCategory === category.id 
                  ? 'border-accent ring-2 ring-accent/20' 
                  : 'border-border hover:border-accent/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center shrink-0`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{category.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                  <span className="text-xs text-muted-foreground">{category.articles} artikelen</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Filtered Articles by Category */}
        {activeCategory && (
          <div className="mt-8 bg-card rounded-xl border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {categories.find(c => c.id === activeCategory)?.title} artikelen
              </h3>
              <button 
                onClick={() => setActiveCategory(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sluiten ×
              </button>
            </div>
            <div className="divide-y divide-border">
              {filteredArticles.map((article, index) => (
                <div 
                  key={index}
                  className="p-4 hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span className="text-foreground">{article.title}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Video Tutorials */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Video Tutorials</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {videoTutorials.map((video, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border overflow-hidden hover:border-accent/50 transition-colors cursor-pointer group"
            >
              <div className="aspect-video bg-secondary/50 flex items-center justify-center text-4xl relative">
                {video.thumbnail}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-accent/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-accent-foreground fill-current ml-1" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-foreground text-sm mb-1">{video.title}</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Meer video's komen binnenkort...
        </p>
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
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                <span className="text-foreground">{article.title}</span>
              </div>
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

      {/* Contact CTA with urgency */}
      <section className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Hulp nodig?</h2>
              <p className="text-muted-foreground">
                Ons support team staat voor je klaar.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <button className="p-3 rounded-lg border border-border hover:border-accent/50 transition-colors text-left">
              <p className="font-medium text-foreground text-sm">Algemene vraag</p>
              <p className="text-xs text-muted-foreground">Binnen 24 uur</p>
            </button>
            <button className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left">
              <p className="font-medium text-foreground text-sm">Technisch probleem</p>
              <p className="text-xs text-amber-600">Binnen 4 uur</p>
            </button>
            <button className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors text-left">
              <p className="font-medium text-foreground text-sm flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-500" />
                Urgent
              </p>
              <p className="text-xs text-red-600">Prioriteit</p>
            </button>
          </div>

          <Button asChild className="w-full">
            <Link to="/contact">Neem Contact Op</Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}

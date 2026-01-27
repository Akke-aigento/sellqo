import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, Clock, User, Sparkles, TrendingUp, BookOpen, Rocket } from 'lucide-react';
import { toast } from 'sonner';

const categories = [
  { id: 'all', label: 'Alles', icon: Sparkles },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'tutorials', label: 'Tutorials', icon: BookOpen },
  { id: 'updates', label: 'Product Updates', icon: Rocket },
  { id: 'cases', label: 'Case Studies', icon: User },
];

const featuredPost = {
  title: 'E-commerce Trends voor 2025: Wat Je Moet Weten',
  excerpt: 'Van AI-gestuurde personalisatie tot sociale commerce - ontdek de belangrijkste trends die de e-commerce sector gaan vormgeven in het komende jaar en hoe je er als ondernemer op kunt inspelen.',
  date: 'Binnenkort',
  category: 'Trends',
  author: 'SellQo Team',
  readTime: '8 min',
  image: '🚀',
};

const blogPosts = [
  {
    title: 'Hoe AI je Webshop Kan Verbeteren',
    excerpt: 'Van productbeschrijvingen tot klantenservice - leer hoe AI je kan helpen groeien.',
    date: 'Binnenkort',
    category: 'Tutorials',
    author: 'Emma van den Berg',
    readTime: '5 min',
  },
  {
    title: 'Peppol E-Invoicing: Wat Je Moet Weten',
    excerpt: 'Alles over de nieuwe Belgische regelgeving voor B2B facturatie vanaf 2026.',
    date: 'Binnenkort',
    category: 'Trends',
    author: 'Jan Janssen',
    readTime: '6 min',
  },
  {
    title: '5 Tips Voor Betere Productfoto\'s',
    excerpt: 'Praktische tips om je producten beter te presenteren zonder dure apparatuur.',
    date: 'Binnenkort',
    category: 'Tutorials',
    author: 'Lisa de Vries',
    readTime: '4 min',
  },
  {
    title: 'Marketplace Fees Vergelijken: Bol vs Amazon',
    excerpt: 'Een uitgebreide vergelijking van de kosten voor verkopers op beide platforms.',
    date: 'Binnenkort',
    category: 'Trends',
    author: 'SellQo Team',
    readTime: '6 min',
  },
  {
    title: 'Hoe WebshopX 40% Groeide Met SellQo',
    excerpt: 'Een inspirerend verhaal van een ondernemer die zijn omzet wist te verdubbelen.',
    date: 'Binnenkort',
    category: 'Case Studies',
    author: 'Klant Spotlight',
    readTime: '5 min',
  },
  {
    title: 'Nieuwe Features: Visual Editor & AI Coach',
    excerpt: 'Ontdek de nieuwste toevoegingen aan het SellQo platform.',
    date: 'Binnenkort',
    category: 'Product Updates',
    author: 'Product Team',
    readTime: '3 min',
  },
  {
    title: 'SEO voor Webshops: Complete Gids 2025',
    excerpt: 'Alles wat je moet weten om hoger te scoren in Google met je webshop.',
    date: 'Binnenkort',
    category: 'Tutorials',
    author: 'Emma van den Berg',
    readTime: '10 min',
  },
  {
    title: 'Black Friday Voorbereiding Checklist',
    excerpt: 'Bereid je voor op het drukste verkoopseizoen van het jaar.',
    date: 'Binnenkort',
    category: 'Tutorials',
    author: 'SellQo Team',
    readTime: '7 min',
  },
];

const categoryColors: Record<string, string> = {
  'Trends': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Tutorials': 'bg-green-500/10 text-green-600 border-green-500/20',
  'Product Updates': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Case Studies': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const filteredPosts = activeCategory === 'all' 
    ? blogPosts 
    : blogPosts.filter(post => {
        if (activeCategory === 'trends') return post.category === 'Trends';
        if (activeCategory === 'tutorials') return post.category === 'Tutorials';
        if (activeCategory === 'updates') return post.category === 'Product Updates';
        if (activeCategory === 'cases') return post.category === 'Case Studies';
        return true;
      });

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubscribing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Bedankt voor je inschrijving! Je ontvangt binnenkort onze eerste nieuwsbrief.');
    setEmail('');
    setIsSubscribing(false);
  };

  return (
    <PublicPageLayout 
      title="Blog" 
      subtitle="Inzichten, tips en nieuws over e-commerce"
    >
      {/* Coming Soon Notice */}
      <div className="max-w-2xl mx-auto text-center mb-8">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
          <p className="text-foreground font-medium">
            🚧 Ons blog komt binnenkort online! Schrijf je in voor updates.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <category.icon className="w-4 h-4" />
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Post */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-6 md:p-8 opacity-70">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-48 h-32 md:h-auto bg-secondary/50 rounded-xl flex items-center justify-center text-6xl shrink-0">
              {featuredPost.image}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={categoryColors[featuredPost.category]}>
                  {featuredPost.category}
                </Badge>
                <span className="text-xs text-muted-foreground">Uitgelicht</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">{featuredPost.title}</h2>
              <p className="text-muted-foreground mb-4">{featuredPost.excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {featuredPost.author}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {featuredPost.readTime}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {featuredPost.date}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 mb-12">
        {filteredPosts.map((post, index) => (
          <div 
            key={index}
            className="bg-card rounded-xl border border-border p-6 opacity-60 hover:opacity-80 transition-opacity group"
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className={categoryColors[post.category] || 'bg-secondary'}>
                {post.category}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
              {post.title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">{post.excerpt}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                {post.author}
              </span>
              <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
                Lees meer <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Newsletter CTA */}
      <div className="max-w-xl mx-auto text-center bg-card rounded-2xl border border-border p-8">
        <h2 className="text-xl font-bold text-foreground mb-2">Blijf op de hoogte</h2>
        <p className="text-muted-foreground mb-6">
          Ontvang e-commerce tips en SellQo updates rechtstreeks in je inbox.
        </p>
        <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md mx-auto">
          <Input 
            type="email" 
            placeholder="Je e-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={isSubscribing}>
            {isSubscribing ? 'Bezig...' : 'Inschrijven'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4">
          Geen spam, alleen waardevolle content. Je kunt je altijd uitschrijven.
        </p>
      </div>
    </PublicPageLayout>
  );
}

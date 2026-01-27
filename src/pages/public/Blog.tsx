import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar } from 'lucide-react';

const placeholderPosts = [
  {
    title: 'E-commerce trends voor 2025',
    excerpt: 'Ontdek de belangrijkste trends die de e-commerce sector gaan vormgeven in het komende jaar.',
    date: 'Binnenkort',
    category: 'Trends',
  },
  {
    title: 'Hoe AI je webshop kan verbeteren',
    excerpt: 'Van productbeschrijvingen tot klantenservice - leer hoe AI je kan helpen groeien.',
    date: 'Binnenkort',
    category: 'AI & Automatisering',
  },
  {
    title: 'Peppol e-invoicing: wat je moet weten',
    excerpt: 'Alles over de nieuwe Belgische regelgeving voor B2B facturatie vanaf 2026.',
    date: 'Binnenkort',
    category: 'Compliance',
  },
];

export default function Blog() {
  return (
    <PublicPageLayout 
      title="Blog" 
      subtitle="Inzichten, tips en nieuws over e-commerce"
    >
      {/* Coming Soon Notice */}
      <div className="max-w-2xl mx-auto text-center mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6">
          <p className="text-foreground font-medium mb-2">
            Ons blog komt binnenkort online!
          </p>
          <p className="text-sm text-muted-foreground">
            Schrijf je in voor updates en ontvang als eerste onze nieuwste artikelen.
          </p>
        </div>
      </div>

      {/* Placeholder Posts */}
      <div className="max-w-4xl mx-auto grid gap-6">
        {placeholderPosts.map((post, index) => (
          <div 
            key={index}
            className="bg-card rounded-xl border border-border p-6 opacity-60 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                {post.category}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {post.date}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{post.title}</h3>
            <p className="text-muted-foreground mb-4">{post.excerpt}</p>
            <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
              Lees meer <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ))}
      </div>

      {/* Newsletter CTA */}
      <div className="max-w-xl mx-auto mt-12 text-center">
        <h2 className="text-xl font-bold text-foreground mb-4">Blijf op de hoogte</h2>
        <p className="text-muted-foreground mb-6">
          Ontvang e-commerce tips en SellQo updates rechtstreeks in je inbox.
        </p>
        <div className="flex gap-2 max-w-md mx-auto">
          <input 
            type="email" 
            placeholder="Je e-mailadres" 
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground"
          />
          <Button>Inschrijven</Button>
        </div>
      </div>
    </PublicPageLayout>
  );
}

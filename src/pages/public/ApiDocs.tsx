import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Code, Key, Book, Zap, Lock, Globe } from 'lucide-react';

const features = [
  { icon: Zap, title: 'RESTful API', description: 'Moderne, voorspelbare endpoints voor alle resources.' },
  { icon: Lock, title: 'OAuth 2.0', description: 'Veilige authenticatie met API keys en tokens.' },
  { icon: Globe, title: 'Webhooks', description: 'Real-time notificaties voor events in je shop.' },
  { icon: Book, title: 'SDKs', description: 'Client libraries voor populaire programmeertalen.' },
];

const endpoints = [
  { method: 'GET', path: '/products', description: 'Lijst alle producten op' },
  { method: 'POST', path: '/products', description: 'Maak een nieuw product aan' },
  { method: 'GET', path: '/orders', description: 'Haal bestellingen op' },
  { method: 'PUT', path: '/orders/:id/status', description: 'Update orderstatus' },
  { method: 'GET', path: '/customers', description: 'Klanten ophalen' },
  { method: 'POST', path: '/webhooks', description: 'Registreer een webhook' },
];

export default function ApiDocs() {
  return (
    <PublicPageLayout 
      title="API Documentatie" 
      subtitle="Bouw krachtige integraties met de SellQo API"
    >
      {/* Coming Soon Notice */}
      <section className="max-w-3xl mx-auto mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
          <Code className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Volledige documentatie komt binnenkort
          </h2>
          <p className="text-muted-foreground">
            We werken hard aan uitgebreide API documentatie met interactieve voorbeelden.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">API Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 text-center"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample Endpoints */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Voorbeeld Endpoints</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary/50 px-4 py-3 border-b border-border">
            <code className="text-sm text-muted-foreground">Base URL: https://api.sellqo.com/v1</code>
          </div>
          <div className="divide-y divide-border">
            {endpoints.map((endpoint, index) => (
              <div key={index} className="px-4 py-3 flex items-center gap-4">
                <span className={`text-xs font-mono px-2 py-1 rounded ${
                  endpoint.method === 'GET' ? 'bg-blue-500/10 text-blue-600' :
                  endpoint.method === 'POST' ? 'bg-green-500/10 text-green-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
                <span className="text-sm text-muted-foreground ml-auto hidden sm:block">{endpoint.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Authentication */}
      <section className="max-w-3xl mx-auto mb-16">
        <div className="bg-secondary/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Authenticatie</h3>
              <p className="text-sm text-muted-foreground mb-4">
                API keys kunnen gegenereerd worden in je SellQo admin panel onder 
                Instellingen → API & Integraties. Stuur je API key mee in de Authorization header.
              </p>
              <code className="text-xs bg-background px-3 py-2 rounded border border-border block">
                Authorization: Bearer sk_live_xxxxxxxxxxxxx
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-4">
          Hulp nodig met de API?
        </h2>
        <p className="text-muted-foreground mb-6">
          Ons developer team helpt je graag op weg.
        </p>
        <Button asChild size="lg">
          <Link to="/contact">Neem Contact Op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}

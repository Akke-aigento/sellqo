import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Book, Zap, Lock, Globe, Copy, Check, AlertTriangle, Clock, Webhook } from 'lucide-react';
import { toast } from 'sonner';

const features = [
  { icon: Zap, title: 'RESTful API', description: 'Moderne, voorspelbare endpoints voor alle resources.' },
  { icon: Lock, title: 'OAuth 2.0', description: 'Veilige authenticatie met API keys en tokens.' },
  { icon: Globe, title: 'Webhooks', description: 'Real-time notificaties voor events in je shop.' },
  { icon: Book, title: 'SDKs', description: 'Client libraries voor populaire programmeertalen.' },
];

const endpoints = [
  { method: 'GET', path: '/products', description: 'Lijst alle producten op' },
  { method: 'POST', path: '/products', description: 'Maak een nieuw product aan' },
  { method: 'GET', path: '/products/:id', description: 'Haal een specifiek product op' },
  { method: 'PUT', path: '/products/:id', description: 'Update een product' },
  { method: 'DELETE', path: '/products/:id', description: 'Verwijder een product' },
  { method: 'GET', path: '/orders', description: 'Haal bestellingen op' },
  { method: 'PUT', path: '/orders/:id/status', description: 'Update orderstatus' },
  { method: 'GET', path: '/customers', description: 'Klanten ophalen' },
  { method: 'POST', path: '/webhooks', description: 'Registreer een webhook' },
];

const codeExamples = {
  curl: `curl -X GET "https://api.sellqo.com/v1/products" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxx" \\
  -H "Content-Type: application/json"`,
  javascript: `const response = await fetch('https://api.sellqo.com/v1/products', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer sk_live_xxxxxxxxxxxxx',
    'Content-Type': 'application/json'
  }
});

const products = await response.json();
console.log(products);`,
  python: `import requests

response = requests.get(
    'https://api.sellqo.com/v1/products',
    headers={
        'Authorization': 'Bearer sk_live_xxxxxxxxxxxxx',
        'Content-Type': 'application/json'
    }
)

products = response.json()
print(products)`,
};

const rateLimits = [
  { plan: 'Free Trial', requests: '100/min', burst: '10/sec' },
  { plan: 'Starter', requests: '500/min', burst: '50/sec' },
  { plan: 'Professional', requests: '2.000/min', burst: '200/sec' },
  { plan: 'Enterprise', requests: 'Onbeperkt', burst: 'Custom' },
];

const webhookEvents = [
  { event: 'order.created', description: 'Nieuwe bestelling geplaatst' },
  { event: 'order.paid', description: 'Betaling ontvangen' },
  { event: 'order.shipped', description: 'Bestelling verzonden' },
  { event: 'order.delivered', description: 'Bestelling afgeleverd' },
  { event: 'order.cancelled', description: 'Bestelling geannuleerd' },
  { event: 'product.created', description: 'Nieuw product aangemaakt' },
  { event: 'product.updated', description: 'Product bijgewerkt' },
  { event: 'product.deleted', description: 'Product verwijderd' },
  { event: 'inventory.low', description: 'Voorraad onder minimum' },
  { event: 'customer.created', description: 'Nieuwe klant geregistreerd' },
];

const webhookPayload = `{
  "id": "evt_1234567890",
  "type": "order.created",
  "created": "2025-01-27T10:30:00Z",
  "data": {
    "order_id": "ord_abc123",
    "customer_email": "klant@voorbeeld.nl",
    "total": 99.99,
    "currency": "EUR",
    "items": [
      {
        "product_id": "prod_xyz789",
        "name": "Product Naam",
        "quantity": 2,
        "price": 49.99
      }
    ]
  }
}`;

export default function ApiDocs() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(label);
    toast.success('Gekopieerd naar klembord!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

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

      {/* Code Examples with Tabs */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Code Voorbeelden</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Tabs defaultValue="curl" className="w-full">
            <div className="bg-secondary/50 px-4 py-2 border-b border-border">
              <TabsList className="bg-transparent">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
            </div>
            
            {Object.entries(codeExamples).map(([lang, code]) => (
              <TabsContent key={lang} value={lang} className="m-0">
                <div className="relative">
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="text-foreground font-mono">{code}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(code, lang)}
                  >
                    {copiedCode === lang ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Sample Endpoints */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Endpoints</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-secondary/50 px-4 py-3 border-b border-border flex items-center justify-between">
            <code className="text-sm text-muted-foreground">Base URL: https://api.sellqo.com/v1</code>
            <Badge variant="outline">v1</Badge>
          </div>
          <div className="divide-y divide-border">
            {endpoints.map((endpoint, index) => (
              <div key={index} className="px-4 py-3 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
                <span className={`text-xs font-mono px-2 py-1 rounded w-16 text-center ${
                  endpoint.method === 'GET' ? 'bg-blue-500/10 text-blue-600' :
                  endpoint.method === 'POST' ? 'bg-green-500/10 text-green-600' :
                  endpoint.method === 'PUT' ? 'bg-amber-500/10 text-amber-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-foreground flex-1">{endpoint.path}</code>
                <span className="text-sm text-muted-foreground hidden sm:block">{endpoint.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Rate Limits</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-secondary/50 px-4 py-3 border-b border-border font-medium text-foreground text-sm">
            <span>Plan</span>
            <span>Requests</span>
            <span>Burst</span>
          </div>
          <div className="divide-y divide-border">
            {rateLimits.map((limit, index) => (
              <div key={index} className="grid grid-cols-3 px-4 py-3 text-sm">
                <span className="text-foreground font-medium">{limit.plan}</span>
                <span className="text-muted-foreground">{limit.requests}</span>
                <span className="text-muted-foreground">{limit.burst}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Rate limits worden per API key bijgehouden. Bij overschrijding krijg je een 429 response.
            Retry na de aangegeven <code className="text-foreground">Retry-After</code> header.
          </p>
        </div>
      </section>

      {/* Webhooks */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8 flex items-center justify-center gap-2">
          <Webhook className="w-6 h-6 text-accent" />
          Webhook Events
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Events List */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-secondary/50 px-4 py-3 border-b border-border">
              <span className="font-medium text-foreground text-sm">Beschikbare Events</span>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {webhookEvents.map((event, index) => (
                <div key={index} className="px-4 py-2 flex items-center justify-between">
                  <code className="text-xs font-mono text-accent">{event.event}</code>
                  <span className="text-xs text-muted-foreground">{event.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payload Example */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-secondary/50 px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-medium text-foreground text-sm">Voorbeeld Payload</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(webhookPayload, 'webhook')}
              >
                {copiedCode === 'webhook' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs max-h-80 overflow-y-auto">
              <code className="text-foreground font-mono">{webhookPayload}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Versioning */}
      <section className="max-w-3xl mx-auto mb-16">
        <div className="bg-secondary/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">API Versioning</h3>
              <p className="text-sm text-muted-foreground mb-4">
                De huidige versie is <code className="text-foreground bg-secondary px-1 rounded">v1</code>. 
                We gebruiken URL-based versioning en garanderen backward compatibility binnen major versions.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-500">
                  <Check className="w-4 h-4" />
                  v1 (Huidige - Stabiel)
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  v2 (Gepland Q3 2025)
                </span>
              </div>
            </div>
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
              <div className="relative">
                <code className="text-xs bg-background px-3 py-2 rounded border border-border block">
                  Authorization: Bearer sk_live_xxxxxxxxxxxxx
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1"
                  onClick={() => copyToClipboard('Authorization: Bearer sk_live_xxxxxxxxxxxxx', 'auth')}
                >
                  {copiedCode === 'auth' ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Test mode:</strong> Gebruik keys die beginnen met <code className="text-foreground">sk_test_</code> voor development.
              </p>
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
        <div className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link to="/integrations">Bekijk Integraties</Link>
          </Button>
          <Button asChild>
            <Link to="/contact">Neem Contact Op</Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}

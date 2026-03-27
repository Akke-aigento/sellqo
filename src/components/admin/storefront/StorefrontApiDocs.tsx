import { useState } from 'react';
import {
  BookOpen, Copy, Check, ExternalLink, ChevronRight,
  CheckCircle2, Circle, AlertTriangle, Server, Key, Globe2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

const API_ENDPOINTS = [
  { method: 'GET', endpoint: '/products', description: 'Alle producten ophalen', response: '{ products: [...], pagination: {...} }' },
  { method: 'GET', endpoint: '/products/:slug', description: 'Eén product ophalen', response: '{ product: {...} }' },
  { method: 'GET', endpoint: '/collections', description: 'Alle collecties ophalen', response: '[...]' },
  { method: 'GET', endpoint: '/collections/:slug', description: 'Eén collectie met producten', response: '{ collection: {...}, products: [...] }' },
  { method: 'POST', endpoint: '/cart', description: 'Nieuwe cart aanmaken', response: '{ id, items: [] }' },
  { method: 'GET', endpoint: '/cart/:id', description: 'Cart ophalen', response: '{ id, items: [...], totals: {...} }' },
  { method: 'POST', endpoint: '/cart/:id/items', description: 'Item aan cart toevoegen', response: '{ id, items: [...] }' },
  { method: 'POST', endpoint: '/checkout', description: 'Checkout starten', response: '{ checkout_url: "..." }' },
  { method: 'GET', endpoint: '/settings', description: 'Winkel instellingen', response: '{ social, trust, conversion, ... }' },
  { method: 'POST', endpoint: '/newsletter/subscribe', description: 'Nieuwsbrief aanmelding', response: '{ message: "..." }' },
  { method: 'GET', endpoint: '/reviews', description: 'Alle reviews', response: '{ reviews: [...] }' },
  { method: 'GET', endpoint: '/pages', description: "Statische pagina's", response: '{ pages: [...] }' },
  { method: 'GET', endpoint: '/pages/:slug', description: 'Eén pagina', response: '{ page: {...} }' },
  { method: 'GET', endpoint: '/navigation', description: 'Menu structuur', response: '{ main_menu: [...], footer: [...] }' },
  { method: 'POST', endpoint: '/gift-cards/balance', description: 'Cadeaubon saldo checken', response: '{ balance, currency }' },
];

const FAQ_ITEMS = [
  {
    q: 'Producten laden maar zonder titels',
    a: 'De API stuurt het veld "name" (niet "title") voor productnamen. Gebruik de mapProduct() functie uit de Integratie Code snippet — deze mapt "name" automatisch naar zowel "title" als "name" in je frontend data.',
  },
  {
    q: 'Afbeeldingen worden niet getoond',
    a: 'De API stuurt "images" als een array van URL strings (bijv. ["https://...jpg"]), niet als objecten met {url, alt}. De mapProduct() functie converteert deze automatisch naar het juiste format met url en alt velden.',
  },
  {
    q: '€0.00 als prijs wordt getoond',
    a: 'Producten met price: 0 zijn cadeaukaarten met variabel bedrag. Check het veld "is_gift_card" in de gemapte data en toon "Kies je bedrag" of "Vanaf €5" in plaats van de prijs.',
  },
  {
    q: 'Product detail pagina crasht',
    a: 'Zorg dat je React Router een route heeft voor /product/:slug en dat je component extractProduct() gebruikt met null-checks. De API response wraps het product in { success: true, data: { product: {...} } } — extractProduct() haalt dit correct uit.',
  },
  {
    q: '401 Unauthorized errors',
    a: 'De API key wordt niet meegestuurd of is ongeldig. Controleer dat:\n1. VITE_SELLQO_API_KEY correct is ingesteld (als environment variable of Cloud Secret)\n2. De X-API-Key header wordt meegestuurd bij elk request\n3. De key niet verlopen is (check in je SellQo admin)',
  },
  {
    q: 'CORS errors in de browser',
    a: 'Gebruik een proxy Edge Function in je Lovable/Supabase project om CORS te voorkomen. De Integratie Code bevat een voorbeeld. Alternatively, zorg dat je Frontend URL correct is ingevuld in de Custom Frontend instellingen — deze wordt gebruikt voor CORS whitelisting.',
  },
  {
    q: 'Collectie afbeeldingen laden niet',
    a: 'De API stuurt "image_url" (niet "image") voor collectie afbeeldingen. Gebruik de mapCollection() functie die dit automatisch converteert naar het "image" veld.',
  },
  {
    q: 'Paginering werkt niet',
    a: 'Gebruik extractProducts() om de response correct te parsen. De pagination zit in response.data.pagination met velden: total_count, page, per_page, total_pages. Stuur ?page=2&per_page=24 als query parameters mee.',
  },
];

const CHECKLIST_ITEMS = [
  { id: 'enabled', label: 'Custom Frontend ingeschakeld' },
  { id: 'url', label: 'Frontend URL ingevuld' },
  { id: 'key', label: 'API Key gegenereerd en gekopieerd' },
  { id: 'tenant', label: 'Tenant ID genoteerd' },
  { id: 'env', label: 'Environment variables ingesteld in frontend project' },
  { id: 'code', label: 'Integratie Code gekopieerd en geïmplementeerd' },
  { id: 'mappers', label: 'Product mapping functies (mapProduct, extractProducts) toegepast' },
  { id: 'shop', label: 'Shop pagina test: producten laden met titels en afbeeldingen' },
  { id: 'detail', label: 'Product detail test: individueel product laadt correct' },
  { id: 'cart', label: 'Cart test: items toevoegen werkt' },
  { id: 'checkout', label: 'Checkout test: redirect naar hosted checkout werkt' },
];

export function StorefrontApiDocs() {
  const { currentTenant } = useTenant();
  const [copied, setCopied] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiBaseUrl = `${supabaseUrl}/functions/v1/storefront-api`;
  const tenantSlug = currentTenant?.slug || 'your-tenant';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Gekopieerd');
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleChecked = (id: string) => {
    setCheckedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const methodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
      case 'POST': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'PUT': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      case 'DELETE': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* API Reference Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            API Referentie
          </CardTitle>
          <CardDescription>Alles wat je nodig hebt om de Storefront API te gebruiken</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Basis URL</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono truncate flex-1">{apiBaseUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(apiBaseUrl, 'base-url')}>
                  {copied === 'base-url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Tenant ID</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono">{tenantSlug}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(tenantSlug, 'tenant')}>
                  {copied === 'tenant' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <p className="text-xs text-muted-foreground">Authenticatie headers (verplicht bij elk request)</p>
            <div className="space-y-1 font-mono text-xs">
              <p><span className="text-muted-foreground">X-Tenant-ID:</span> {tenantSlug}</p>
              <p><span className="text-muted-foreground">X-API-Key:</span> sk_live_••••••••</p>
              <p><span className="text-muted-foreground">Accept-Language:</span> nl <span className="text-muted-foreground">(optioneel)</span></p>
              <p><span className="text-muted-foreground">Content-Type:</span> application/json</p>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">Response format</p>
            <p className="text-xs text-muted-foreground">
              Alle responses volgen het format: <code className="bg-muted px-1 rounded">{'{ success: boolean, data: ... }'}</code>
              <br />
              Gebruik de <strong>extractProducts()</strong>, <strong>extractProduct()</strong> en <strong>extractCollections()</strong> functies uit de Integratie Code om data correct te parsen.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-primary" />
            Endpoints Overzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[70px_1fr_1fr_1fr] gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 border-b">
              <span>Method</span>
              <span>Endpoint</span>
              <span>Beschrijving</span>
              <span>Response data</span>
            </div>
            <div className="divide-y">
              {API_ENDPOINTS.map((ep) => (
                <div key={`${ep.method}-${ep.endpoint}`} className="grid grid-cols-[70px_1fr_1fr_1fr] gap-0 px-3 py-2.5 text-xs items-center hover:bg-muted/30 transition-colors">
                  <Badge variant="secondary" className={`${methodColor(ep.method)} text-[10px] font-mono px-1.5 py-0 w-fit`}>
                    {ep.method}
                  </Badge>
                  <code className="font-mono text-foreground">{ep.endpoint}</code>
                  <span className="text-muted-foreground">{ep.description}</span>
                  <code className="font-mono text-muted-foreground text-[10px]">{ep.response}</code>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Mapping Referentie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Veldnaam Mapping
          </CardTitle>
          <CardDescription>
            De API gebruikt andere veldnamen dan je frontend mogelijk verwacht. De mapping functies in de Integratie Code lossen dit automatisch op.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 border-b">
              <span>API veld</span>
              <span>Frontend verwacht</span>
              <span>Opgelost door</span>
            </div>
            <div className="divide-y text-xs">
              {[
                ['name', 'title', 'mapProduct()'],
                ['images (string[])', 'images ({url, alt}[])', 'mapProduct()'],
                ['image_url', 'image', 'mapCollection()'],
                ['in_stock (boolean)', 'stock_status (string)', 'mapProduct()'],
                ['price: 0', 'is_gift_card: true', 'mapProduct()'],
                ['category: {id, name, slug}', 'collection (string)', 'mapProduct()'],
              ].map(([api, frontend, fn], i) => (
                <div key={i} className="grid grid-cols-3 gap-0 px-3 py-2 items-center">
                  <code className="font-mono text-orange-600 dark:text-orange-400">{api}</code>
                  <code className="font-mono text-emerald-600 dark:text-emerald-400">{frontend}</code>
                  <Badge variant="outline" className="w-fit font-mono text-[10px]">{fn}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Veelvoorkomende Problemen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-0">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm font-medium text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground whitespace-pre-line">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Koppelproces Checklist
          </CardTitle>
          <CardDescription>Volg deze stappen om je custom frontend te koppelen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item, i) => (
              <label
                key={item.id}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <Checkbox
                  checked={checkedItems.includes(item.id)}
                  onCheckedChange={() => toggleChecked(item.id)}
                  className="mt-0.5"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <span className={`text-sm ${checkedItems.includes(item.id) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              ✅ {checkedItems.length} / {CHECKLIST_ITEMS.length} stappen voltooid
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ClipboardCopy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenants } from '@/hooks/useTenants';

interface Config {
  tenantSlug: string;
  customDomain: string;
  supabaseProjectId: string;
  lovableProjectName: string;
}

function generatePrompts(c: Config) {
  return [
    {
      title: 'Prompt 1: SellQo Integratie Installeren',
      text: `Maak een volledige SellQo headless commerce integratie aan voor dit Lovable project. De SellQo API loopt via een Supabase edge function "sellqo-proxy" die als middleware fungeert.

ARCHITECTUUR:
Frontend (${c.lovableProjectName}) → sellqo-proxy (Supabase edge function) → SellQo storefront-api

MAAK AAN:

1. src/integrations/sellqo/client.ts
const SELLQO_PROXY_URL = 'https://${c.supabaseProjectId}.supabase.co/functions/v1/sellqo-proxy';
const TENANT_ID = '${c.tenantSlug}';

export async function sellqoFetch(endpoint: string, options?: RequestInit) {
  return fetch(\`\${SELLQO_PROXY_URL}\${endpoint}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
      ...options?.headers,
    },
  });
}

2. src/integrations/sellqo/types.ts
- Product: { id, name, slug, price, compare_at_price, images, category, variants, product_type, in_stock, description }
- CartItem: { id, product_id, variant_id?, quantity, unit_price, product_name, product_image, variant_title?, gift_card_metadata? }
- Cart: { id, items, item_count, subtotal, total, discount_code?, discount_amount? }
- Collection: { id, name, slug, product_count }

3. src/integrations/sellqo/api.ts
- productsAPI.getAll(params?) → GET /products
- productsAPI.getOne(slug) → GET /products/{slug}
- collectionsAPI.getAll() → GET /collections
- cartAPI.get(cartId) → GET /cart/{id}
- cartAPI.create() → POST /cart
- cartAPI.addItem(cartId, item) → POST /cart/{id}/items
- cartAPI.updateItem(cartId, itemId, qty) → PATCH /cart/{id}/items/{itemId}
- cartAPI.removeItem(cartId, itemId) → DELETE /cart/{id}/items/{itemId}
- cartAPI.applyDiscount(cartId, code) → POST /cart/{id}/discount
- cartAPI.removeDiscount(cartId) → DELETE /cart/{id}/discount
- cartAPI.checkout(cartId, successUrl, cancelUrl) → POST /checkout
- settingsAPI.get() → GET /settings
- legalAPI.get() → GET /legal

4. src/integrations/sellqo/hooks.ts
- useProducts(params?) — React Query hook
- useProduct(slug) — met prefetch bij hover
- useCollections()
- useCart() — laadt cart uit localStorage cart_id
- useAddToCart()
- useUpdateCartItem() — met optimistic update
- useRemoveCartItem() — met optimistic update
- useApplyDiscount()
- useSettings()
- useLegalPages()

5. src/integrations/sellqo/CartContext.tsx
- CartProvider met useCart hook
- cart state, addItem, updateItem, removeItem, clearCart
- cart_id persisteren in localStorage
- Validatie: cart_id nooit "undefined"/"null" opslaan

QueryClient config in App.tsx:
staleTime: 5 * 60 * 1000
gcTime: 30 * 60 * 1000
refetchOnWindowFocus: false
refetchOnMount: false`,
    },
    {
      title: 'Prompt 2: sellqo-proxy Edge Function',
      text: `Maak de sellqo-proxy edge function aan in supabase/functions/sellqo-proxy/index.ts

Deze fungeert als middleware tussen de frontend en de SellQo storefront-api.

De proxy moet:
1. CORS headers toevoegen (OPTIONS preflight + response headers)
2. Het pad na /sellqo-proxy/ doorsturen naar de storefront-api edge function
3. De X-Tenant-ID header doorsturen (standaard: '${c.tenantSlug}')
4. De Supabase service role key toevoegen als Authorization header
5. De response van storefront-api ongewijzigd doorsturen naar de frontend

Base URL storefront-api: Deno.env.get('SUPABASE_URL') + '/functions/v1/storefront-api'
Authorization: Bearer \${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}

Voorbeeld: Frontend stuurt GET naar /sellqo-proxy/products
→ Proxy stuurt GET naar {SUPABASE_URL}/functions/v1/storefront-api/products?tenant_id=${c.tenantSlug}`,
    },
    {
      title: 'Prompt 3: Checkout Flow + /bedankt pagina',
      text: `Implementeer de checkout flow voor ${c.lovableProjectName}:

CartDrawer "Afrekenen" knop:
Bij klikken, roep aan:
const response = await sellqoFetch('/checkout', {
  method: 'POST',
  body: JSON.stringify({
    cart_id: cartId,
    success_url: '${c.customDomain}/bedankt?cart_id=' + cartId,
    cancel_url: '${c.customDomain}/shop',
  }),
}).then(r => r.json());

const checkoutUrl = response?.data?.checkout_url;
window.location.href = checkoutUrl;

Maak een /bedankt pagina op route /bedankt:
- Lees cart_id uit URL search params
- Laad cart via sellqoFetch('/cart/' + cartId)
- Toon bestellingsoverzicht met producten, aantallen, prijzen
- clearCart() aanroepen om localStorage cart_id te verwijderen
- Toon een bedankbericht en link terug naar de shop

Route toevoegen in App.tsx:
<Route path="/bedankt" element={<ThankYouPage />} />`,
    },
    {
      title: 'Prompt 4: Footer met SellQo Data',
      text: `Maak een Footer component met dynamische SellQo data voor ${c.lovableProjectName}:

Juridische links:
sellqoFetch('/legal').then(r => r.json()).then(d => setLegalPages(d?.data || []))

Render elke pagina als:
<a href={\`\${page.url}?from=${encodeURIComponent(c.customDomain)}\`} target="_blank" rel="noopener noreferrer">
  {page.title}
</a>

Sociale media:
sellqoFetch('/settings').then(r => r.json()).then(d => setSocial(d?.data?.social || {}))

Toon alleen platforms waar de waarde niet null/leeg is:
- Instagram → social.instagram
- TikTok → social.tiktok
- Facebook → social.facebook
- Twitter/X → social.twitter
- YouTube → social.youtube

Gebruik lucide-react iconen voor de sociale media links.
Toon ook de shop naam uit settings.shop_name.`,
    },
    {
      title: 'Prompt 5: Contact Pagina',
      text: `Maak een Contact pagina op /contact voor ${c.lovableProjectName}:

Formulier met velden:
- Naam (verplicht)
- E-mail (verplicht)
- Onderwerp (verplicht)
- Bericht (verplicht, textarea)

handleSubmit stuurt naar:
sellqoFetch('/contact', {
  method: 'POST',
  body: JSON.stringify({ name, email, subject, message })
})

Na succesvol versturen:
- Toon succesbericht: "Bedankt voor je bericht! We nemen zo snel mogelijk contact met je op."
- Reset het formulier
- Bij fout: toon foutmelding via toast

Route toevoegen in App.tsx:
<Route path="/contact" element={<ContactPage />} />`,
    },
  ];
}

export default function CustomFrontendConfigurator() {
  const { tenants, isLoading: tenantsLoading } = useTenants();
  const [config, setConfig] = useState<Config>({
    tenantSlug: '',
    customDomain: '',
    supabaseProjectId: '',
    lovableProjectName: '',
  });
  const [generated, setGenerated] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const allFilled = Object.values(config).every((v) => v.trim() !== '');

  const handleTenantSelect = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (tenant) {
      setConfig((prev) => ({
        ...prev,
        tenantSlug: tenant.slug || '',
        customDomain: tenant.custom_domain || '',
        lovableProjectName: tenant.name || '',
      }));
      setGenerated(false);
    }
  };

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Gekopieerd naar klembord!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const update = (key: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((prev) => ({ ...prev, [key]: e.target.value }));

  const prompts = generated ? generatePrompts(config) : [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Custom Frontend Configurator</h1>
        <p className="text-muted-foreground mt-1">
          Vul de project-specifieke gegevens in en genereer kant-en-klare prompts voor een SellQo headless frontend.
        </p>
      </div>

      {/* Step 1: Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stap 1 — Project gegevens</CardTitle>
          <CardDescription>Vul alle velden in om de prompts te genereren.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Selecteer een tenant</Label>
            <Select onValueChange={handleTenantSelect}>
              <SelectTrigger>
                <SelectValue placeholder={tenantsLoading ? 'Laden...' : 'Kies een tenant om velden in te vullen'} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Selecteer een tenant om slug, domein en naam automatisch in te vullen.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenantSlug">Tenant Slug</Label>
            <Input id="tenantSlug" placeholder="bv. loveke" value={config.tenantSlug} onChange={update('tenantSlug')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customDomain">Custom Domein</Label>
            <Input id="customDomain" placeholder="https://loveke.be" value={config.customDomain} onChange={update('customDomain')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supabaseProjectId">Supabase Project ID</Label>
            <Input id="supabaseProjectId" placeholder="bv. ncumndxdxjscghiytxsl" value={config.supabaseProjectId} onChange={update('supabaseProjectId')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lovableProjectName">Lovable Project Naam</Label>
            <Input id="lovableProjectName" placeholder="bv. Loveke Streetwear" value={config.lovableProjectName} onChange={update('lovableProjectName')} />
          </div>
          <div className="sm:col-span-2">
            <Button
              className="w-full sm:w-auto"
              disabled={!allFilled}
              onClick={() => setGenerated(true)}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Genereer Prompts →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Generated Prompts */}
      {generated && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Stap 2 — Kopieer de prompts</h2>
          {prompts.map((p, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <Button
                    size="sm"
                    variant={copiedIdx === i ? 'secondary' : 'outline'}
                    onClick={() => handleCopy(p.text, i)}
                  >
                    {copiedIdx === i ? (
                      <>
                        <Check className="mr-1 h-4 w-4 text-green-600" />
                        Gekopieerd!
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="mr-1 h-4 w-4" />
                        Kopieer
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-md border overflow-x-auto max-h-96 overflow-y-auto font-mono">
                  {p.text}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

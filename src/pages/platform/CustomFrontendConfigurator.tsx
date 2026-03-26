import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ClipboardCopy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTenants } from '@/hooks/useTenants';
import { supabase } from '@/integrations/supabase/client';

interface Config {
  tenantId: string;
  frontendUrl: string;
  apiBaseUrl: string;
  storefrontApiKey: string;
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
const TENANT_ID = '${c.tenantId}';

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
3. De X-Tenant-ID header doorsturen (standaard: '${c.tenantId}')
4. De Supabase service role key toevoegen als Authorization header
5. De response van storefront-api ongewijzigd doorsturen naar de frontend

Base URL storefront-api: Deno.env.get('SUPABASE_URL') + '/functions/v1/storefront-api'
Authorization: Bearer \${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}

Voorbeeld: Frontend stuurt GET naar /sellqo-proxy/products
→ Proxy stuurt GET naar {SUPABASE_URL}/functions/v1/storefront-api/products?tenant_id=${c.tenantId}`,
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
    success_url: '${c.frontendUrl}/bedankt?cart_id=' + cartId,
    cancel_url: '${c.frontendUrl}/shop',
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
<a href={\`\${page.url}?from=${encodeURIComponent(c.frontendUrl)}\`} target="_blank" rel="noopener noreferrer">
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
    {
      title: 'Prompt 6: Klantaccounts — Registratie, Login & E-mailverificatie',
      text: `Implementeer klantaccounts voor ${c.lovableProjectName} via de storefront-customer-api edge function.

ARCHITECTUUR:
- Klantaccounts zijn NIET Supabase Auth — ze gebruiken een custom JWT systeem
- Alle calls gaan via de SellQo proxy: sellqo-proxy → storefront-customer-api
- Token wordt opgeslagen in localStorage en meegestuurd als x-storefront-token header

1. src/integrations/sellqo/customerApi.ts

const CUSTOMER_API_URL = 'https://${c.supabaseProjectId}.supabase.co/functions/v1/sellqo-proxy';

async function customerApiCall(action: string, params: Record<string, unknown> = {}, token?: string) {
  // BELANGRIJK: De storefront-customer-api gebruikt een POST body met { action, tenant_id, params }
  // De proxy moet dit doorsturen naar de storefront-customer-api edge function
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-storefront-token'] = token;
  
  const res = await fetch(CUSTOMER_API_URL + '/customer-api', {
    method: 'POST',
    headers: { ...headers, 'X-Tenant-ID': '${c.tenantId}' },
    body: JSON.stringify({ action, tenant_id: '${c.tenantId}', params }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data.data;
}

BELANGRIJK: Update de sellqo-proxy edge function zodat requests naar /customer-api worden doorgestuurd naar de storefront-customer-api edge function (niet storefront-api). Voorbeeld:
- Frontend: POST /sellqo-proxy/customer-api → Proxy: POST {SUPABASE_URL}/functions/v1/storefront-customer-api
- De proxy moet x-storefront-token header doorsturen

2. src/integrations/sellqo/CustomerAuthContext.tsx

interface CustomerProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  vat_verified?: boolean;
  newsletter_opt_in?: boolean;
  email_verified?: boolean;
}

interface CustomerAuthContextType {
  customer: CustomerProfile | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ requiresVerification: boolean }>;
  logout: () => void;
  updateProfile: (data: Partial<CustomerProfile>) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name?: string;   // B2B veld
  vat_number?: string;     // BTW-nummer (wordt server-side via VIES gevalideerd)
  newsletter_opt_in?: boolean;
}

REGISTRATIE FLOW:
- register action stuurt: { email, password, first_name, last_name, phone, company_name, vat_number, newsletter_opt_in }
- API retourneert GEEN token — alleen { message: "Verificatiemail verstuurd", requires_verification: true }
- Toon na registratie: "Check je e-mail om je account te bevestigen"
- Als het e-mailadres al bestaat MET wachtwoord → error "Account bestaat al, log in"
- Als het e-mailadres bestaat ZONDER wachtwoord (gemigreerde klant) → account wordt geclaimed, verificatiemail verstuurd

LOGIN FLOW:
- login action stuurt: { email, password }
- Bij succes: retourneert { token, customer } → sla token op in localStorage
- Bij EMAIL_NOT_VERIFIED error: toon melding + "Verificatiemail opnieuw versturen" link
- Bij foute credentials: toon "Onjuist e-mailadres of wachtwoord"

E-MAIL VERIFICATIE:
- Route /verify-email?token=...&email=...
- Bij mount: roep verify_email action aan met { token, email }
- Bij succes: toon "Account bevestigd!" + redirect naar login na 3 seconden
- Bij fout (verlopen/ongeldig): toon foutmelding + "Nieuwe verificatiemail aanvragen" knop

RESEND VERIFICATIE:
- resend_verification action met { email }

3. Routes toevoegen:
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/verify-email" element={<VerifyEmailPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />

WACHTWOORD RESET:
- request_password_reset action: { email } → stuurt reset-email
- reset_password action: { email, reset_token, new_password } → zet nieuw wachtwoord
- Reset link in e-mail wijst naar: ${c.frontendUrl}/reset-password?token=...&email=...`,
    },
    {
      title: 'Prompt 7: Klantdashboard — Profiel, Bestellingen, Adressen & Wishlist',
      text: `Maak een klantdashboard voor ${c.lovableProjectName} op /account met tabs.

Alle API calls via customerApiCall() uit Prompt 6.
Token wordt meegestuurd als x-storefront-token header.
Bescherm alle /account routes: als !isLoggedIn → redirect naar /login.

TAB 1: PROFIEL
- Toon: first_name, last_name, email (readonly), phone, company_name, vat_number
- vat_number: als vat_verified === true, toon ✓ badge "Geverifieerd"
- newsletter_opt_in: toggle switch
- "Opslaan" knop → update_profile action met gewijzigde velden
- Wachtwoord wijzigen sectie: current_password + new_password + confirm → change_password action

TAB 2: BESTELLINGEN
- get_orders action → retourneert lijst met:
  { id, order_number, status, total, currency, created_at, items: [...] }
- Toon als tabel/kaarten met: datum, ordernummer, status badge, totaal
- Klik op order → detail view via get_order action met { order_id }
- Detail: alle items met naam, afbeelding, hoeveelheid, prijs, status tracking

TAB 3: ADRESSEN
- get_addresses action → lijst van adressen
- Adres type: { id, first_name, last_name, street, house_number, postal_code, city, country, phone, is_default }
- "Nieuw adres" knop → formulier → add_address action
- Bewerken → update_address action met { address_id, address: {...} }
- Verwijderen → delete_address action met { address_id }
- "Standaard maken" knop → update_address met { is_default: true }

TAB 4: FAVORIETEN / WISHLIST
- wishlist_get action → retourneert lijst met product data
- Per item: afbeelding, naam, prijs, "Verwijder" knop, "Voeg toe aan winkelwagen" knop
- wishlist_add action: { product_id }
- wishlist_remove action: { product_id }
- Integreer hartje-icoon op productkaarten en productpagina:
  - Niet ingelogd: klik → redirect naar /login
  - Ingelogd: toggle wishlist status

Routes:
<Route path="/account" element={<AccountPage />} />
<Route path="/account/orders/:orderId" element={<OrderDetailPage />} />`,
    },
    {
      title: 'Prompt 8: Bundel Producten, Reviews & Zoeken',
      text: `Voeg bundel-weergave, reviews en zoekfunctionaliteit toe aan ${c.lovableProjectName}.

1. BUNDEL PRODUCTEN

Wanneer een product product_type === 'bundle' heeft, bevat de API response:
{
  product_type: 'bundle',
  bundle_items: [
    { product_id, product_name, product_slug, product_image, quantity, price, is_required }
  ],
  bundle_individual_total: 45.97,  // som van individuele prijzen
  price: 39.99,                     // bundelprijs
}

Maak een BundleContents component voor de productpagina:
- Groene besparingsbanner bovenaan: "Bespaar €X,XX met deze bundel!"
- Per bundel-item: grote afbeelding (80x80), naam (klikbaar → /product/{slug}), hoeveelheid badge, individuele prijs doorgestreept
- Onderaan: prijsvergelijking (individueel vs. bundel)
- "Voeg complete bundel toe aan winkelwagen" knop → voegt ALLE items als aparte cart items toe
- Bundelkorting wordt automatisch berekend door de promotie-engine wanneer alle items in de cart zitten

Op productkaarten in het overzicht: toon "Bundel" badge als product_type === 'bundle'

2. REVIEWS

Product reviews via REST:
GET /sellqo-proxy/products/{slug}/reviews → { reviews: [...], average_rating, total_count }

Algemene reviews:
GET /sellqo-proxy/reviews → { reviews: [...], average_rating, total_count }
GET /sellqo-proxy/reviews/summary → { average_rating, total_count }

Review object: { id, reviewer_name, rating (1-5), review_text, created_at, platform, is_verified }

Op productpagina:
- Sterren weergave (gemiddelde) + "(X reviews)" link
- Reviews sectie onderaan met individuele reviews
- Reviewer naam, sterren, datum, tekst, platform badge

Optioneel: algemene reviews pagina op /reviews

3. ZOEKEN

GET /sellqo-proxy/search?q=zoekterm&limit=20
Response: { products: [...], total_count }

Autocomplete:
GET /sellqo-proxy/search?q=zoekterm&autocomplete=true&limit=5
Response: { products: [...] } — snel, minder velden

Implementeer:
- Zoekbalk in header/navigatie
- Bij typen (debounce 300ms): autocomplete dropdown met productvoorstellen
- Enter of klik op zoekicoon → /search?q=... resultaatpagina
- Resultaatpagina: productgrid met filters (hergebruik bestaande ProductCard)`,
    },
    {
      title: 'Prompt 9: Navigatie, Nieuwsbrief & Gift Cards',
      text: `Voeg dynamische navigatie, nieuwsbrief en gift card functionaliteit toe aan ${c.lovableProjectName}.

1. NAVIGATIE

GET /sellqo-proxy/navigation
Response: {
  main_menu: [
    { id, title, url, type, children: [...] }
  ],
  footer_menu: [
    { id, title, url, type, children: [...] }
  ]
}

type kan zijn: 'link', 'collection', 'page', 'product'
url bevat het relatieve pad (bv. /collections/zomer, /products/t-shirt)

Implementeer:
- Header: render main_menu items als navigatie-links
  - Items met children → dropdown/mega-menu
  - Map urls naar interne routes waar mogelijk
- Footer: render footer_menu items als link-secties
- Cache navigatie data (staleTime: 5 minuten)

2. NIEUWSBRIEF

POST /sellqo-proxy/newsletter/subscribe
Body: { email, first_name? }
Response: { success: true, message: "..." }

Implementeer een Newsletter component:
- E-mail input + optioneel naam veld + "Inschrijven" knop
- Na succes: toon bevestigingsbericht
- Bij fout (duplicate): toon "Je bent al ingeschreven"
- Plaats in footer of als standalone sectie op homepage

BELANGRIJK: Gebruik NIET een externe redirect. Alle nieuwsbrief inschrijvingen gaan via de SellQo API zodat subscribers centraal beheerd worden.

3. GIFT CARDS

Gift card denominaties:
GET /sellqo-proxy/gift-cards
Response: { denominations: [{ id, value, currency }], custom_amount_allowed: boolean, min_amount, max_amount }

Saldo checken:
POST /sellqo-proxy/gift-cards/balance
Body: { code: "ABC-123-DEF" }
Response: { balance, currency, is_active, expires_at }

Implementeer een /gift-cards pagina:
- Toon beschikbare waarden als knoppen (€10, €25, €50, etc.)
- Als custom_amount_allowed: toon input voor eigen bedrag
- "Koop cadeaukaart" → voeg toe aan cart als gift_card product
- Saldo checker: input voor code + "Check saldo" knop → toon resultaat

Route: <Route path="/gift-cards" element={<GiftCardsPage />} />`,
    },
    {
      title: 'Prompt 10: SEO, Sitemap & Meertaligheid',
      text: `Voeg SEO optimalisatie, sitemap data en meertaligheid toe aan ${c.lovableProjectName}.

1. SEO META TAGS

GET /sellqo-proxy/seo?page_type=homepage
GET /sellqo-proxy/seo?page_type=product&slug=product-slug
GET /sellqo-proxy/seo?page_type=collection&slug=collection-slug

Response: {
  title, description, og_title, og_description, og_image,
  canonical_url, structured_data (JSON-LD)
}

Implementeer een useSeo(pageType, slug?) hook:
- Fetch SEO data per pagina
- Gebruik react-helmet-async om <title>, <meta>, <link rel="canonical">, en JSON-LD in te stellen
- Fallback naar standaard site titel als geen data beschikbaar

Per pagina:
- Homepage: page_type='homepage'
- Productpagina: page_type='product', slug=productSlug
- Collectiepagina: page_type='collection', slug=collectionSlug
- Statische pagina: page_type='page', slug=pageSlug

2. SITEMAP DATA

GET /sellqo-proxy/sitemap
Response: {
  products: [{ slug, updated_at }],
  collections: [{ slug, updated_at }],
  pages: [{ slug, updated_at }]
}

Dit is nuttig voor SSR/SSG frameworks. Bij een Lovable SPA kun je dit gebruiken om een sitemap.xml te genereren via een build script of edge function.

3. MEERTALIGHEID

De SellQo API ondersteunt vertalingen via de Accept-Language header.

Stuur bij ELKE API call de gewenste taal mee:
sellqoFetch('/products', {
  headers: { 'Accept-Language': currentLocale }  // 'nl', 'en', 'fr', 'de'
})

Beschikbare talen ophalen:
GET /sellqo-proxy/settings/languages
Response: { default_locale: 'nl', available_locales: ['nl', 'en', 'fr', 'de'] }

Implementeer:
- Taalwissel component (dropdown/buttons) in header
- Sla geselecteerde taal op in localStorage
- Bij taalwissel: invalideer alle React Query caches
- Update sellqoFetch om automatisch Accept-Language mee te sturen

4. EXTRA SETTINGS ENDPOINTS

GET /sellqo-proxy/settings → volledige shop config (naam, logo, etc.)
GET /sellqo-proxy/settings/social → sociale media links
GET /sellqo-proxy/settings/trust → trust badges, certificeringen
GET /sellqo-proxy/settings/conversion → stock urgency, free shipping drempel
GET /sellqo-proxy/settings/checkout → checkout configuratie`,
    },
    {
      title: 'Prompt 11: Promoties, Verzending & Servicepunten',
      text: `Voeg promotie-berekeningen, verzendopties en servicepunten toe aan ${c.lovableProjectName}.

1. CART PROMOTIES

Na elke cart-wijziging (add/update/remove item), bereken promoties:

POST naar storefront-api (via proxy) met action calculate_promotions:
sellqoFetch('/calculate-promotions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'calculate_promotions',
    tenant_id: '${c.tenantId}',
    params: {
      items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, price: i.unit_price, category_id: i.category_id })),
      subtotal: cart.subtotal,
      discount_code: appliedDiscountCode || null,
    }
  })
})

OF via REST:
De cart endpoints retourneren al discount_amount en discount_code info.
Gebruik cart_apply_discount en cart_remove_discount voor kortingscodes:
POST /sellqo-proxy/cart/{id}/discount  body: { code: "KORTING10" }
DELETE /sellqo-proxy/cart/{id}/discount

Response van calculate_promotions:
{
  original_subtotal, discounted_subtotal, total_discount,
  applied_discounts: [{ type, name, value, description }],
  gifts: [{ product_id, product_name, quantity, product_image }],
  free_shipping: boolean, free_shipping_reason?: string,
  loyalty_points_earned?: number
}

In de CartDrawer/CartPage:
- Toon originele subtotaal doorgestreept als er korting is
- Lijst van applied_discounts met naam + waarde
- Als gifts[] niet leeg: toon "Gratis cadeau bij je bestelling!" met product info
- Als free_shipping: toon "Gratis verzending!" badge
- Kortingscode input: tekstveld + "Toepassen" knop
  - Bij succes: toon code met "X" verwijderknop
  - Bij fout: toon foutmelding (ongeldig/verlopen/minimum niet bereikt)

2. VERZENDMETHODEN

GET /sellqo-proxy/shipping → standaard verzendmethoden (niet via checkout)
Bij checkout flow (als je eigen checkout bouwt):
- checkout_start → retourneert beschikbare verzendmethoden op basis van adres
- checkout_get_shipping_options → gefilterd op adres

Verzendmethode object:
{ id, name, description, price, estimated_delivery, carrier, type }

type kan zijn: 'standard', 'express', 'pickup', 'service_point'

3. SERVICEPUNTEN (PostNL, DHL, DPD)

Wanneer type === 'service_point', toon servicepunt selector:

Via legacy POST:
action: 'get_service_points', params: { postal_code: '1234AB', carrier: 'postnl', country: 'NL' }

Response: [
  { id, name, carrier, type, address: { street, house_number, city, postal_code, country }, distance, latitude, longitude, opening_hours }
]

Implementeer ServicePointSelector component:
- Toon na selectie van servicepunt-verzendmethode
- Postcode input → laad servicepunten
- Toon als lijst met naam, adres, afstand
- Optioneel: toon op kaart (Google Maps/Leaflet)
- Geselecteerd servicepunt meesturen bij checkout

4. GRATIS VERZENDING DREMPEL

Uit settings/conversion:
{ free_shipping_bar: true, free_shipping_threshold?: number }

Toon in cart: "Nog €X,XX voor gratis verzending!" voortgangsbalk
Als subtotal >= threshold: "Je hebt gratis verzending! 🎉"`,
    },
  ];
}

export default function CustomFrontendConfigurator() {
  const { tenants, isLoading: tenantsLoading } = useTenants();
  const API_BASE_URL = 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/storefront-api';
  const [config, setConfig] = useState<Config>({
    tenantId: '',
    frontendUrl: '',
    apiBaseUrl: API_BASE_URL,
    storefrontApiKey: '',
    supabaseProjectId: '',
    lovableProjectName: '',
  });
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const allFilled = config.tenantId.trim() !== '' && config.supabaseProjectId.trim() !== '' && config.lovableProjectName.trim() !== '';
  const prompts = allFilled ? generatePrompts(config) : [];

  const handleTenantSelect = async (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (tenant) {
      // Fetch storefront API key prefix
      const { data: apiKeyData } = await supabase
        .from('storefront_api_keys')
        .select('key_prefix')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setConfig((prev) => ({
        ...prev,
        tenantId: tenant.slug || '',
        frontendUrl: tenant.custom_domain || '',
        apiBaseUrl: API_BASE_URL,
        storefrontApiKey: apiKeyData?.key_prefix ? `${apiKeyData.key_prefix}••••••••••••` : '(geen key gevonden)',
        lovableProjectName: tenant.name || '',
      }));
      setShowApiKey(false);
    }
  };

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Gekopieerd naar klembord!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const update = (key: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, [key]: e.target.value }));
  };

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
            <p className="text-xs text-muted-foreground">Selecteer een tenant om de SellQo gegevens automatisch in te vullen.</p>
          </div>

          {/* Sectie A: SellQo gegevens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SellQo gegevens</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant ID</Label>
                <Input id="tenantId" placeholder="bv. loveke" value={config.tenantId} onChange={update('tenantId')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frontendUrl">Frontend URL</Label>
                <Input id="frontendUrl" placeholder="https://loveke.be" value={config.frontendUrl} onChange={update('frontendUrl')} />
                <p className="text-xs text-muted-foreground">Optioneel — het custom domein van de webshop.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="apiBaseUrl">API Base URL</Label>
                <Input id="apiBaseUrl" value={config.apiBaseUrl} readOnly className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">Altijd hetzelfde — wordt automatisch ingevuld.</p>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="storefrontApiKey">Storefront API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="storefrontApiKey"
                    value={showApiKey ? config.storefrontApiKey : config.storefrontApiKey.replace(/[^(sk_live_)]/g, '•').substring(0, 20)}
                    readOnly
                    className="bg-muted cursor-not-allowed font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="shrink-0"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gebruik in de <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> header. Wordt opgehaald uit de database (alleen prefix zichtbaar).
                </p>
              </div>
            </div>
          </div>
          </div>

          {/* Sectie B: Lovable project gegevens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lovable project gegevens</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supabaseProjectId">Lovable Cloud Project ID</Label>
                <Input id="supabaseProjectId" placeholder="bv. jpnacppdutjnasmuikgp" value={config.supabaseProjectId} onChange={update('supabaseProjectId')} />
                <p className="text-xs text-muted-foreground">Te vinden in je Lovable project → Instellingen. Voorbeeld: jpnacppdutjnasmuikgp</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lovableProjectName">Project Naam</Label>
                <Input id="lovableProjectName" placeholder="bv. Loveke Streetwear" value={config.lovableProjectName} onChange={update('lovableProjectName')} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Generated Prompts */}
      {allFilled && (
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

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, FolderOpen, ShoppingCart, CreditCard, Gift, User, Mail,
  Star, FileText, Navigation2, Share2, Shield, Rocket, Globe, BarChart3,
  Copy, Check, Eye, EyeOff, RefreshCw, AlertTriangle, Zap, Link as LinkIcon,
  ExternalLink, Download, Code, Send, CheckCircle, BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CustomFrontendConfig,
  DEFAULT_CUSTOM_FRONTEND_CONFIG,
  WEBHOOK_EVENTS,
  SESSION_DURATION_OPTIONS,
} from '@/types/custom-frontend-config';

// Feature module definition
interface FeatureModule {
  id: keyof CustomFrontendConfig;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  apiBadges: string[];
}

const FEATURE_MODULES: FeatureModule[] = [
  { id: 'products', icon: ShoppingBag, iconColor: 'text-orange-600 bg-orange-500/10', title: 'Producten & Catalogus', subtitle: 'Producten, varianten, afbeeldingen en voorraad via de API', apiBadges: ['GET /products', 'GET /products/:slug'] },
  { id: 'collections', icon: FolderOpen, iconColor: 'text-violet-600 bg-violet-500/10', title: 'Categorieën & Collecties', subtitle: 'Productcategorieën en collectie-overzichten', apiBadges: ['GET /collections', 'GET /collections/:slug'] },
  { id: 'cart', icon: ShoppingCart, iconColor: 'text-green-600 bg-green-500/10', title: 'Winkelwagen', subtitle: 'Cart management via de API', apiBadges: ['POST /cart', 'PUT /cart', 'DELETE /cart'] },
  { id: 'checkout', icon: CreditCard, iconColor: 'text-blue-600 bg-blue-500/10', title: 'Checkout & Betalingen', subtitle: 'Bestelproces en betalingsconfiguratie', apiBadges: ['POST /checkout'] },
  { id: 'gift_cards', icon: Gift, iconColor: 'text-pink-600 bg-pink-500/10', title: 'Cadeaubonnen', subtitle: 'Cadeaukaarten verkopen en inwisselen via de API', apiBadges: ['GET /gift-cards', 'POST /gift-cards/purchase'] },
  { id: 'accounts', icon: User, iconColor: 'text-indigo-600 bg-indigo-500/10', title: 'Klantaccounts', subtitle: 'Registratie, login en bestelgeschiedenis', apiBadges: ['POST /auth/register', 'POST /auth/login'] },
  { id: 'newsletter', icon: Mail, iconColor: 'text-amber-600 bg-amber-500/10', title: 'Nieuwsbrief', subtitle: 'Email aanmeldingen via de API', apiBadges: ['POST /newsletter/subscribe'] },
  { id: 'reviews', icon: Star, iconColor: 'text-yellow-600 bg-yellow-500/10', title: 'Reviews', subtitle: 'Klantbeoordelingen en review platforms', apiBadges: ['GET /reviews', 'GET /products/:slug/reviews'] },
  { id: 'pages', icon: FileText, iconColor: 'text-slate-600 bg-slate-500/10', title: "Pagina's & Content", subtitle: "Statische pagina's, juridische pagina's en FAQ", apiBadges: ['GET /pages', 'GET /pages/:slug'] },
  { id: 'navigation', icon: Navigation2, iconColor: 'text-teal-600 bg-teal-500/10', title: 'Navigatie', subtitle: 'Menu structuur en header configuratie', apiBadges: ['GET /navigation'] },
  { id: 'social_media', icon: Share2, iconColor: 'text-cyan-600 bg-cyan-500/10', title: 'Social Media Links', subtitle: "Social media URL's voor footer en sharing", apiBadges: ['GET /settings/social'] },
  { id: 'trust_compliance', icon: Shield, iconColor: 'text-emerald-600 bg-emerald-500/10', title: 'Trust & Compliance', subtitle: 'Cookie banner, vertrouwenssignalen en keurmerken', apiBadges: ['GET /settings/trust'] },
  { id: 'conversion_boosters', icon: Rocket, iconColor: 'text-red-600 bg-red-500/10', title: 'Conversie Boosters', subtitle: 'Urgentie, social proof en conversie-optimalisatie', apiBadges: ['GET /settings/conversion'] },
  { id: 'multilingual', icon: Globe, iconColor: 'text-sky-600 bg-sky-500/10', title: 'Meertalige Webshop', subtitle: 'Talen en vertalingen voor je custom frontend', apiBadges: ['Accept-Language header'] },
  { id: 'tracking', icon: BarChart3, iconColor: 'text-purple-600 bg-purple-500/10', title: 'Tracking & Analytics', subtitle: 'Analytics events en tracking configuratie', apiBadges: ['GET /settings/tracking'] },
];

interface CustomFrontendConfigPanelProps {
  config: CustomFrontendConfig;
  onChange: (config: CustomFrontendConfig) => void;
}

export function CustomFrontendConfigPanel({ config, onChange }: CustomFrontendConfigPanelProps) {
  const { currentTenant } = useTenant();
  const [copied, setCopied] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  // plainKey holds the unhashed key — only available right after generation
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const hasExistingKey = !!config.api_key_prefix;

  const tenantSlug = currentTenant?.slug || 'your-tenant';
  const tenantId = currentTenant?.id || '';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiBaseUrl = `${supabaseUrl}/functions/v1/storefront-api`;

  // Displayed key value
  const getDisplayKey = (): string => {
    if (plainKey) {
      return showApiKey ? plainKey : `${plainKey.substring(0, 12)}${'•'.repeat(28)}`;
    }
    if (hasExistingKey) {
      return `${config.api_key_prefix}${'•'.repeat(28)}`;
    }
    return 'Nog geen key gegenereerd';
  };

  // The key to copy
  const getCopyKey = (): string => {
    if (plainKey) return plainKey;
    if (hasExistingKey) return `${config.api_key_prefix}••••••••`;
    return '';
  };

  // Generate API key + SHA-256 hash
  const generateApiKey = async () => {
    const raw = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const key = `sk_live_${raw}`;
    const prefix = key.substring(0, 12);
    
    // Hash with SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    setPlainKey(key);
    setShowApiKey(true);
    onChange({
      ...config,
      api_key_hash: hashHex,
      api_key_prefix: prefix,
    });
    toast.success('API key gegenereerd! Kopieer hem nu — hij wordt maar één keer getoond.');
  };

  const handleValidateAndActivate = async () => {
    const url = config.frontend_url.trim();
    if (!url) {
      toast.error('Voer eerst een Frontend URL in');
      return;
    }
    try {
      new URL(url);
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        throw new Error('invalid');
      }
    } catch {
      toast.error('Voer een geldige URL in (bijv. https://mijn-shop.nl)');
      return;
    }
    await generateApiKey();
  };

  const handleRegenerate = async () => {
    await generateApiKey();
    setShowRegenerateConfirm(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Gekopieerd naar klembord');
    setTimeout(() => setCopied(null), 2000);
  };

  const updateConfig = useCallback(<K extends keyof CustomFrontendConfig>(
    section: K,
    value: CustomFrontendConfig[K]
  ) => {
    onChange({ ...config, [section]: value });
  }, [config, onChange]);

  const updateNestedConfig = useCallback(<K extends keyof CustomFrontendConfig>(
    section: K,
    field: string,
    value: any
  ) => {
    const sectionData = config[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      onChange({
        ...config,
        [section]: { ...sectionData, [field]: value },
      });
    }
  }, [config, onChange]);

  const toggleModuleEnabled = useCallback((moduleId: keyof CustomFrontendConfig) => {
    const sectionData = config[moduleId];
    if (typeof sectionData === 'object' && sectionData !== null && 'enabled' in sectionData) {
      updateNestedConfig(moduleId, 'enabled', !(sectionData as any).enabled);
    }
  }, [config, updateNestedConfig]);

  const isModuleEnabled = (moduleId: keyof CustomFrontendConfig): boolean => {
    const sectionData = config[moduleId];
    if (typeof sectionData === 'object' && sectionData !== null && 'enabled' in sectionData) {
      return (sectionData as any).enabled;
    }
    return false;
  };

  // Render sub-settings for each module
  const renderModuleSettings = (moduleId: keyof CustomFrontendConfig) => {
    switch (moduleId) {
      case 'products':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Inclusief niet-gepubliceerde producten" description="Toon ook producten met status 'concept' via de API" checked={config.products.include_unpublished} onChange={(v) => updateNestedConfig('products', 'include_unpublished', v)} />
            <ToggleSetting label="Inclusief uitverkochte producten" description="Toon producten die niet op voorraad zijn" checked={config.products.include_out_of_stock} onChange={(v) => updateNestedConfig('products', 'include_out_of_stock', v)} />
            <ToggleSetting label="Productafbeeldingen meesturen" description="Inclusief alle product foto's in het API response" checked={config.products.include_images} onChange={(v) => updateNestedConfig('products', 'include_images', v)} />
            <ToggleSetting label="SEO metadata meesturen" description="Meta title, description, en Open Graph data per product" checked={config.products.include_seo} onChange={(v) => updateNestedConfig('products', 'include_seo', v)} />
            <ToggleSetting label="Varianten & opties meesturen" description="Maten, kleuren en andere productopties" checked={config.products.include_variants} onChange={(v) => updateNestedConfig('products', 'include_variants', v)} />
            <ToggleSetting label="Realtime voorraad" description="Voorraadaantallen worden live bijgewerkt via webhooks" checked={config.products.realtime_inventory} onChange={(v) => updateNestedConfig('products', 'realtime_inventory', v)} />
            {config.products.realtime_inventory && (
              <div className="ml-6">
                <Badge variant="outline" className="font-mono text-xs">Webhook event: product.inventory.updated</Badge>
              </div>
            )}
          </div>
        );

      case 'collections':
        return (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Welke categorieën tonen</Label>
              <RadioGroup value={config.collections.filter_mode} onValueChange={(v) => updateNestedConfig('collections', 'filter_mode', v)} className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="all" /> Alle categorieën</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="with_products" /> Alleen categorieën met producten <Badge variant="secondary" className="text-xs">Aanbevolen</Badge></label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="manual" /> Selecteer handmatig</label>
              </RadioGroup>
            </div>
            <ToggleSetting label="Categorie afbeeldingen meesturen" checked={config.collections.include_images} onChange={(v) => updateNestedConfig('collections', 'include_images', v)} />
            <ToggleSetting label="Categorie beschrijvingen meesturen" checked={config.collections.include_descriptions} onChange={(v) => updateNestedConfig('collections', 'include_descriptions', v)} />
            <ToggleSetting label="Productaantallen per categorie" description="Toon hoeveel producten er in elke categorie zitten" checked={config.collections.include_product_counts} onChange={(v) => updateNestedConfig('collections', 'include_product_counts', v)} />
          </div>
        );

      case 'cart':
        return (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cart sessieduur</Label>
              <Select value={config.cart.session_duration} onValueChange={(v) => updateNestedConfig('cart', 'session_duration', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_DURATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hoe lang blijft een verlaten winkelwagen bewaard?</p>
            </div>
            <ToggleSetting label="Kortingscodes toestaan" description="Klanten kunnen kortingscodes invoeren via de API" checked={config.cart.allow_discounts} onChange={(v) => updateNestedConfig('cart', 'allow_discounts', v)} />
            <ToggleSetting label="Automatische verzendkosten berekening" description="Verzendkosten worden automatisch berekend op basis van adres en gewicht" checked={config.cart.auto_shipping} onChange={(v) => updateNestedConfig('cart', 'auto_shipping', v)} />
          </div>
        );

      case 'checkout':
        return (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Checkout modus</Label>
              <RadioGroup value={config.checkout.mode} onValueChange={(v) => updateNestedConfig('checkout', 'mode', v)} className="grid gap-3">
                <label className={cn("flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors", config.checkout.mode === 'hosted' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                  <RadioGroupItem value="hosted" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Hosted Checkout</span>
                      <Badge variant="secondary" className="text-xs">Aanbevolen</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Klant wordt doorgestuurd naar een veilige SellQo checkout pagina. PCI-compliant, geen extra werk nodig.</p>
                  </div>
                </label>
                <label className={cn("flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors", config.checkout.mode === 'embedded' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                  <RadioGroupItem value="embedded" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Embedded Checkout</span>
                      <Badge variant="outline" className="text-xs">Enterprise</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Integreer het checkout formulier direct in je frontend. Vereist Stripe Connect integratie.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
            {config.checkout.mode === 'hosted' && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <div className="space-y-1.5">
                  <Label className="text-sm">Redirect na betaling</Label>
                  <Input value={config.checkout.success_url} onChange={(e) => updateNestedConfig('checkout', 'success_url', e.target.value)} placeholder="https://jouw-site.nl/bedankt" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Redirect bij annulering</Label>
                  <Input value={config.checkout.cancel_url} onChange={(e) => updateNestedConfig('checkout', 'cancel_url', e.target.value)} placeholder="https://jouw-site.nl/shop" />
                </div>
              </div>
            )}
            <ToggleSetting label="Checkout instellingen overnemen" description="Gebruik dezelfde checkout instellingen als je SellQo webshop" checked={config.checkout.sync_settings} onChange={(v) => updateNestedConfig('checkout', 'sync_settings', v)} />
          </div>
        );

      case 'gift_cards':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Cadeaubon aankoop toestaan" description="Klanten kunnen cadeaubonnen kopen via je custom frontend" checked={config.gift_cards.allow_purchase} onChange={(v) => updateNestedConfig('gift_cards', 'allow_purchase', v)} />
            <ToggleSetting label="Saldo check toestaan" description="Klanten kunnen hun cadeaubon saldo controleren" checked={config.gift_cards.allow_balance_check} onChange={(v) => updateNestedConfig('gift_cards', 'allow_balance_check', v)} />
          </div>
        );

      case 'accounts':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Klantregistratie" checked={config.accounts.registration} onChange={(v) => updateNestedConfig('accounts', 'registration', v)} />
            <ToggleSetting label="Klant login" checked={config.accounts.login} onChange={(v) => updateNestedConfig('accounts', 'login', v)} />
            <ToggleSetting label="Bestelgeschiedenis" description="Klanten kunnen hun eerdere bestellingen inzien" checked={config.accounts.order_history} onChange={(v) => updateNestedConfig('accounts', 'order_history', v)} />
            <ToggleSetting label="Adresboek" checked={config.accounts.address_book} onChange={(v) => updateNestedConfig('accounts', 'address_book', v)} />
          </div>
        );

      case 'newsletter':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Double opt-in" description="GDPR-compliant dubbele bevestiging" checked={config.newsletter.double_optin} onChange={(v) => updateNestedConfig('newsletter', 'double_optin', v)} />
            <ToggleSetting label="Popup configuratie doorsturen" description="Stuur popup timing en frequentie instellingen mee via de API" checked={config.newsletter.forward_popup_config} onChange={(v) => updateNestedConfig('newsletter', 'forward_popup_config', v)} />
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Reviews per product" description="Toon product-specifieke reviews op productpagina's" checked={config.reviews.per_product} onChange={(v) => updateNestedConfig('reviews', 'per_product', v)} />
            <ToggleSetting label="Algemene reviews" description="Toon winkel-brede reviews (voor homepage, trust secties)" checked={config.reviews.general} onChange={(v) => updateNestedConfig('reviews', 'general', v)} />
            <ToggleSetting label="Review weergave instellingen overnemen" description="Gebruik dezelfde weergave-instellingen als je SellQo webshop" checked={config.reviews.sync_display_settings} onChange={(v) => updateNestedConfig('reviews', 'sync_display_settings', v)} />
          </div>
        );

      case 'pages':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Statische pagina's meesturen" checked={config.pages.enabled} onChange={(v) => updateNestedConfig('pages', 'enabled', v)} />
            <ToggleSetting label="Juridische pagina's meesturen" description="Wettelijk verplichte pagina's: Algemene Voorwaarden, Privacy, Retourneren, etc." checked={config.pages.legal_pages} onChange={(v) => updateNestedConfig('pages', 'legal_pages', v)} />
            <ToggleSetting label="HTML content meesturen" description="Stuur de volledige HTML content mee (anders alleen plain text)" checked={config.pages.include_html} onChange={(v) => updateNestedConfig('pages', 'include_html', v)} />
          </div>
        );

      case 'navigation':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Navigatie menu meesturen" description="Je frontend ontvangt het volledige navigatiemenu zoals geconfigureerd in SellQo" checked={config.navigation.main_menu} onChange={(v) => updateNestedConfig('navigation', 'main_menu', v)} />
            <ToggleSetting label="Footer navigatie meesturen" checked={config.navigation.footer_menu} onChange={(v) => updateNestedConfig('navigation', 'footer_menu', v)} />
            <ToggleSetting label="Aankondigingsbalk meesturen" description="De tekst en link van de announcement bar bovenaan je webshop" checked={config.navigation.announcement_bar} onChange={(v) => updateNestedConfig('navigation', 'announcement_bar', v)} />
          </div>
        );

      case 'social_media':
        return (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">Social media links worden automatisch meegestuurd wanneer deze module is ingeschakeld. Configureer je links bij <a href="/admin/storefront" className="text-primary hover:underline">Social Media</a>.</p>
          </div>
        );

      case 'trust_compliance':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Cookie banner configuratie meesturen" description="Je frontend ontvangt de cookie banner tekst en instellingen" checked={config.trust_compliance.cookie_banner} onChange={(v) => updateNestedConfig('trust_compliance', 'cookie_banner', v)} />
            <ToggleSetting label="Vertrouwenssignalen meesturen" description="Keurmerken, garantie-badges, USP's" checked={config.trust_compliance.trust_badges} onChange={(v) => updateNestedConfig('trust_compliance', 'trust_badges', v)} />
            <ToggleSetting label="Certificeringen meesturen" description="Trusted Shop / BeCommerce badge" checked={config.trust_compliance.certifications} onChange={(v) => updateNestedConfig('trust_compliance', 'certifications', v)} />
          </div>
        );

      case 'conversion_boosters':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Voorraad urgentie" description="Toon 'Nog maar X op voorraad' meldingen" checked={config.conversion_boosters.stock_urgency} onChange={(v) => updateNestedConfig('conversion_boosters', 'stock_urgency', v)} />
            {config.conversion_boosters.stock_urgency && (
              <div className="ml-6 space-y-1.5">
                <Label className="text-sm">Toon wanneer voorraad onder:</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={config.conversion_boosters.stock_threshold} onChange={(e) => updateNestedConfig('conversion_boosters', 'stock_threshold', parseInt(e.target.value) || 5)} className="w-20" min={1} />
                  <span className="text-sm text-muted-foreground">stuks</span>
                </div>
              </div>
            )}
            <ToggleSetting label="Recent gekocht notificaties" description="Toon 'X uit Y kocht dit product' popups" checked={config.conversion_boosters.recent_purchases} onChange={(v) => updateNestedConfig('conversion_boosters', 'recent_purchases', v)} />
            <ToggleSetting label="Gratis verzending drempel" description="Toon 'Nog €X voor gratis verzending' balk" checked={config.conversion_boosters.free_shipping_bar} onChange={(v) => updateNestedConfig('conversion_boosters', 'free_shipping_bar', v)} />
            <ToggleSetting label="Verlaten winkelwagen herinnering" description="Stuur email herinneringen voor verlaten winkelwagens" checked={config.conversion_boosters.abandoned_cart_email} onChange={(v) => updateNestedConfig('conversion_boosters', 'abandoned_cart_email', v)} />
          </div>
        );

      case 'multilingual':
        return (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Talen worden bepaald door je gekoppelde domeinen. Beheer bij <a href="/admin/settings?tab=domains" className="text-primary hover:underline">Instellingen &gt; Domeinen</a>.</p>
            <ToggleSetting label="Productteksten vertalen" description="Stuur vertaalde producttitels en beschrijvingen mee" checked={config.multilingual.translate_products} onChange={(v) => updateNestedConfig('multilingual', 'translate_products', v)} />
            <ToggleSetting label="Pagina's vertalen" checked={config.multilingual.translate_pages} onChange={(v) => updateNestedConfig('multilingual', 'translate_pages', v)} />
          </div>
        );

      case 'tracking':
        return (
          <div className="space-y-3 pt-2">
            <ToggleSetting label="Tracking scripts doorsturen" description="Stuur je Google Analytics, Facebook Pixel en andere tracking codes mee via de API" checked={config.tracking.forward_scripts} onChange={(v) => updateNestedConfig('tracking', 'forward_scripts', v)} />
            {config.tracking.forward_scripts && (
              <Alert>
                <AlertDescription className="text-xs">ℹ️ Je custom frontend is zelf verantwoordelijk voor het laden van de scripts</AlertDescription>
              </Alert>
            )}
            <ToggleSetting label="E-commerce events" description="SellQo stuurt standaard e-commerce events (add_to_cart, purchase, etc.)" checked={config.tracking.ecommerce_events} onChange={(v) => updateNestedConfig('tracking', 'ecommerce_events', v)} />
          </div>
        );

      default:
        return null;
    }
  };

  // Generate code snippet
  const generateCodeSnippet = (framework: string): string => {
    const endpoints: string[] = [];
    
    if (isModuleEnabled('products')) {
      endpoints.push(`// Products & Catalog ✅\nexport const getProducts = (params?: string) => sellqoFetch(\`/products\${params ? \`?\${params}\` : ''}\`);\nexport const getProduct = (slug: string) => sellqoFetch(\`/products/\${slug}\`);`);
    }
    if (isModuleEnabled('collections')) {
      endpoints.push(`// Collections ✅\nexport const getCollections = () => sellqoFetch('/collections');\nexport const getCollection = (slug: string) => sellqoFetch(\`/collections/\${slug}\`);`);
    }
    if (isModuleEnabled('cart')) {
      endpoints.push(`// Cart ✅\nexport const createCart = () => sellqoFetch('/cart', { method: 'POST' });\nexport const getCart = (cartId: string) => sellqoFetch(\`/cart/\${cartId}\`);\nexport const addToCart = (cartId: string, item: any) => sellqoFetch(\`/cart/\${cartId}/items\`, { method: 'POST', body: JSON.stringify(item) });`);
    }
    if (isModuleEnabled('checkout')) {
      endpoints.push(`// Checkout ✅\nexport const createCheckout = (cartId: string) => sellqoFetch('/checkout', { method: 'POST', body: JSON.stringify({ cart_id: cartId }) });`);
    }
    if (isModuleEnabled('gift_cards')) {
      endpoints.push(`// Gift Cards ✅\nexport const checkGiftCardBalance = (code: string) => sellqoFetch('/gift-cards/balance', { method: 'POST', body: JSON.stringify({ code }) });`);
    }
    if (isModuleEnabled('newsletter')) {
      endpoints.push(`// Newsletter ✅\nexport const subscribe = (email: string, locale: string) => sellqoFetch('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email, locale }) });`);
    }
    if (isModuleEnabled('reviews')) {
      endpoints.push(`// Reviews ✅\nexport const getReviews = () => sellqoFetch('/reviews');\nexport const getProductReviews = (slug: string) => sellqoFetch(\`/products/\${slug}/reviews\`);`);
    }
    if (isModuleEnabled('pages')) {
      endpoints.push(`// Pages ✅\nexport const getPages = () => sellqoFetch('/pages');\nexport const getPage = (slug: string) => sellqoFetch(\`/pages/\${slug}\`);`);
    }
    if (isModuleEnabled('navigation')) {
      endpoints.push(`// Navigation ✅\nexport const getNavigation = () => sellqoFetch('/navigation');`);
    }

    // Build mapper functions based on enabled modules
    const mappers: string[] = [];

    if (isModuleEnabled('products')) {
      mappers.push(`// ============================================
// DATA MAPPERS — Vertaalt API responses naar frontend format
// ============================================

// Product mapping: API stuurt "name", frontends verwachten vaak "title"
// API stuurt images als string[], frontends verwachten vaak { url, alt }[]
export function mapProduct(raw: any) {
  if (!raw) return null;

  const isGiftCard = raw.price === 0 ||
    raw.name?.toLowerCase().includes('cadeaukaart') ||
    raw.name?.toLowerCase().includes('gift card');

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.name || raw.title || '',
    name: raw.name || raw.title || '',
    description: raw.description || '',
    price: raw.price || 0,
    compare_at_price: raw.compare_at_price,
    currency: 'EUR',
    images: (raw.images || []).map((img: any, i: number) =>
      typeof img === 'string'
        ? { id: String(i), url: img, alt: raw.name || '', position: i }
        : img
    ),
    thumbnail: typeof raw.images?.[0] === 'string'
      ? raw.images[0]
      : raw.images?.[0]?.url || '',
    variants: raw.variants || [],
    category: raw.category,
    collection: raw.category?.slug,
    tags: raw.tags || [],
    stock_status: raw.in_stock === false ? 'out_of_stock' : 'in_stock',
    in_stock: raw.in_stock !== false,
    has_variants: raw.has_variants || false,
    price_range: raw.price_range,
    is_gift_card: isGiftCard,
    display_price: isGiftCard ? 'Vanaf €5' : undefined,
  };
}

// Products response: API wraps in { success, data: { products: [...], pagination: {...} } }
export function extractProducts(response: any) {
  const raw = response?.data?.products || response?.data?.data?.products || response?.data || [];
  const products = Array.isArray(raw) ? raw : [];
  const pagination = response?.data?.pagination || response?.pagination || {};
  return {
    products: products.map(mapProduct).filter(Boolean),
    total: pagination.total_count || pagination.total || products.length,
    page: pagination.page || 1,
    per_page: pagination.per_page || 24,
    total_pages: pagination.total_pages || 1,
  };
}

// Single product: API wraps in { success, data: { product: {...} } }
export function extractProduct(response: any) {
  const raw = response?.data?.product || response?.data?.data || response?.data || response;
  return mapProduct(raw);
}`);
    }

    if (isModuleEnabled('collections')) {
      mappers.push(`// Collection mapping: API stuurt "name" + "image_url"
export function mapCollection(raw: any) {
  if (!raw) return null;
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.name || raw.title || '',
    name: raw.name || raw.title || '',
    description: raw.description || '',
    image: raw.image_url || raw.image || '',
    product_count: raw.product_count || 0,
  };
}

// Collections response: API wraps in { success, data: [...] }
export function extractCollections(response: any) {
  const raw = response?.data?.data || response?.data || [];
  return Array.isArray(raw) ? raw.map(mapCollection).filter(Boolean) : [];
}`);
    }

    const apiRefComment = `// ============================================
// SellQo Storefront API — Response Reference
// ============================================
//
// PRODUCTS (GET /products):
//   Response: { success: true, data: { products: [...], pagination: {...} } }
//   Product velden: id, name, slug, description, price, compare_at_price,
//     images (string[]), in_stock, stock, sku, tags, is_featured,
//     category: { id, name, slug }, has_variants, price_range
//
// COLLECTIONS (GET /collections):
//   Response: { success: true, data: [...] }
//   Collection velden: id, name, slug, description, image_url, parent_id, product_count
//
// BELANGRIJK:
//   - "name" (niet "title") voor product/collectie namen
//   - "images" is een array van URL strings (niet objecten)
//   - "image_url" (niet "image") voor collectie afbeeldingen
//   - "in_stock" is boolean (niet string enum)
//   - Producten met price: 0 zijn cadeaukaarten
//   - description bevat HTML
//
// Gebruik de mapProduct() en mapCollection() functies hieronder
// om API data correct te mappen naar je frontend componenten.
// ============================================`;

    // Build usage examples based on enabled modules
    const usageExamples: string[] = [];
    if (isModuleEnabled('products')) {
      usageExamples.push(`// Producten ophalen:
//   const response = await sellqoFetch('/products?sort=newest');
//   const { products, total, page } = extractProducts(response);
//   products.forEach(p => console.log(p.title, p.thumbnail, p.price));`);
      usageExamples.push(`// Eén product ophalen:
//   const response = await sellqoFetch('/products/sweater-oversized');
//   const product = extractProduct(response);
//   if (product) console.log(product.title, product.images, product.is_gift_card);`);
    }
    if (isModuleEnabled('collections')) {
      usageExamples.push(`// Collecties ophalen:
//   const response = await sellqoFetch('/collections');
//   const collections = extractCollections(response);
//   collections.forEach(c => console.log(c.title, c.image, c.product_count));`);
    }
    if (isModuleEnabled('cart')) {
      usageExamples.push(`// Cart aanmaken en item toevoegen:
//   const cart = await createCart();
//   await addToCart(cart.data.id, { product_id: '...', quantity: 1 });`);
    }
    if (isModuleEnabled('checkout')) {
      usageExamples.push(`// Checkout starten:
//   const result = await createCheckout(cartId);
//   window.location.href = result.data.checkout_url;`);
    }

    const baseCode = `${apiRefComment}

// sellqo-client.ts — Auto-generated by SellQo
const SELLQO_API_BASE = '${apiBaseUrl}';
const SELLQO_TENANT_ID = '${tenantSlug}';
const SELLQO_API_KEY = '${plainKey ? plainKey : hasExistingKey ? `${config.api_key_prefix}••••••••••••••••••••••••••••` : 'GENEREER_EERST_EEN_KEY'}';
${plainKey ? '// ⚠️ Bewaar deze key veilig — hij wordt maar één keer getoond!' : hasExistingKey ? '// Key is gemaskeerd — genereer opnieuw als je de volledige key nodig hebt' : '// Klik op "Valideer & Activeer" om een key te genereren'}

let currentLocale = '${config.multilingual.default_locale || 'nl'}';

export function setSellqoLocale(locale: string) {
  currentLocale = locale;
}

export async function sellqoFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(\`\${SELLQO_API_BASE}\${endpoint}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': SELLQO_TENANT_ID,
      'X-API-Key': SELLQO_API_KEY,
      'Accept-Language': currentLocale,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(\`SellQo API error: \${res.status}\`);
  return res.json();
}

// === ENABLED ENDPOINTS ===

${endpoints.join('\n\n')}

${mappers.length > 0 ? '\n' + mappers.join('\n\n') : ''}
${usageExamples.length > 0 ? `\n// === VOORBEELD GEBRUIK ===\n//\n${usageExamples.join('\n//\n')}` : ''}
`;
    return baseCode;
  };

  return (
    <div className="space-y-6">
      {/* 1. Connection Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Verbinding & API
          </CardTitle>
          <CardDescription>API configuratie voor je custom frontend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Frontend URL + Validate Button */}
          <div className="space-y-1.5">
            <Label>Frontend URL</Label>
            <div className="flex gap-2">
              <Input
                value={config.frontend_url}
                onChange={(e) => onChange({ ...config, frontend_url: e.target.value })}
                placeholder="https://mijn-shop.nl"
                className="flex-1"
              />
              {!hasExistingKey && (
                <Button
                  onClick={handleValidateAndActivate}
                  className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white shrink-0"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Valideer & Activeer
                </Button>
              )}
            </div>
          <p className="text-xs text-muted-foreground">Het domein van je custom frontend. Wordt gebruikt voor CORS en webhook verificatie.</p>
          </div>

          {/* API Base URL */}
          <div className="space-y-1.5">
            <Label>API Base URL</Label>
            <div className="flex gap-2">
              <Input value={apiBaseUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiBaseUrl, 'api-base-url')}>
                {copied === 'api-base-url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">De basis URL voor alle API requests. Gebruik als <code className="bg-muted px-1 rounded">VITE_SELLQO_API_URL</code></p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label>Storefront API Key</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input value={getDisplayKey()} readOnly className="font-mono text-sm pr-10" />
                {(plainKey || hasExistingKey) && (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(getCopyKey(), 'api-key')}
                disabled={!hasExistingKey && !plainKey}
              >
                {copied === 'api-key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {plainKey && (
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Kopieer deze key nu — hij wordt maar één keer getoond. Na het verlaten van deze pagina is alleen het prefix zichtbaar.
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">Gebruik deze key in de <code className="bg-muted px-1 rounded">X-API-Key</code> header</p>
            {hasExistingKey && (
              <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
                <AlertDialogTrigger asChild>
                  <button type="button" className="text-xs text-destructive hover:underline flex items-center gap-1 mt-1">
                    <RefreshCw className="h-3 w-3" />
                    Opnieuw genereren
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Nieuwe API key genereren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je een nieuwe key wilt genereren? Je huidige frontend verliest direct toegang met de oude key.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Nieuwe key genereren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Tenant ID */}
          <div className="space-y-1.5">
            <Label>Tenant ID</Label>
            <div className="flex gap-2">
              <Input value={tenantSlug} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(tenantSlug, 'tenant-id')}>
                {copied === 'tenant-id' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Gebruik in de <code className="bg-muted px-1 rounded">X-Tenant-ID</code> header</p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label>Webhook URL <span className="text-muted-foreground font-normal">(optioneel)</span></Label>
            <div className="flex gap-2">
              <Input
                value={config.webhook_url}
                onChange={(e) => onChange({ ...config, webhook_url: e.target.value })}
                placeholder="https://mijn-shop.nl/api/webhooks/sellqo"
              />
              {config.webhook_url && (
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-1" />
                  Test
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Ontvang real-time notificaties wanneer producten, bestellingen of instellingen wijzigen</p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div className={cn(
              "h-2.5 w-2.5 rounded-full",
              hasExistingKey ? 'bg-green-500' : config.frontend_url ? 'bg-amber-400' : 'bg-muted-foreground/30'
            )} />
            <span className="text-sm font-medium">
              {hasExistingKey ? 'Wacht op eerste API-verzoek' : config.frontend_url ? 'Klik op "Valideer & Activeer"' : 'Wacht op configuratie'}
            </span>
          </div>

          {/* Link to API Docs */}
          <a href="/admin/storefront" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('storefront-nav', { detail: 'api-docs' })); }} className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
            <BookOpen className="h-4 w-4" />
            📖 Bekijk API Documentatie
          </a>
        </CardContent>
      </Card>

      {/* 2. Feature Modules */}
      <Card>
        <CardHeader>
          <CardTitle>API Modules</CardTitle>
          <CardDescription>Selecteer welke data en functies beschikbaar zijn via de API</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" className="divide-y">
            {FEATURE_MODULES.map((module) => {
              const enabled = isModuleEnabled(module.id);
              return (
                <AccordionItem key={module.id} value={module.id} className="border-0 px-6">
                  <div className="flex items-center gap-3 py-3">
                    <AccordionTrigger className="hover:no-underline flex-1 py-0 [&>svg]:ml-auto">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", module.iconColor.split(' ')[1])}>
                          <module.icon className={cn("h-4 w-4", module.iconColor.split(' ')[0])} />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{module.title}</h4>
                            {!enabled && <Badge variant="secondary" className="text-xs">Uit</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{module.subtitle}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleModuleEnabled(module.id)}
                      className="ml-2"
                    />
                  </div>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {module.apiBadges.map(badge => (
                        <Badge key={badge} variant="outline" className="font-mono text-xs">{badge}</Badge>
                      ))}
                    </div>
                    {enabled ? (
                      renderModuleSettings(module.id)
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Schakel deze module in om de instellingen te configureren</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* 3. Integration Code Snippet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Integratie Code
          </CardTitle>
          <CardDescription>Auto-gegenereerd op basis van je ingeschakelde modules</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList className="mb-3">
              <TabsTrigger value="react">React / Lovable</TabsTrigger>
              <TabsTrigger value="nextjs">Next.js</TabsTrigger>
              <TabsTrigger value="vanilla">Vanilla JS</TabsTrigger>
            </TabsList>
            <TabsContent value="react">
              <div className="relative">
                <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px]">
                  <code>{generateCodeSnippet('react')}</code>
                </pre>
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(generateCodeSnippet('react'), 'code')}>
                    {copied === 'code' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    Kopieer
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="nextjs">
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px]">
                <code>{generateCodeSnippet('nextjs')}</code>
              </pre>
            </TabsContent>
            <TabsContent value="vanilla">
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px]">
                <code>{generateCodeSnippet('vanilla')}</code>
              </pre>
            </TabsContent>
          </Tabs>
          <div className="mt-3 flex justify-center">
            <a href="/admin/storefront" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('storefront-nav', { detail: 'api-docs' })); }} className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
              <BookOpen className="h-4 w-4" />
              📖 Volledige API referentie & troubleshooting
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 4. Webhook Events */}
      {config.webhook_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Webhook Events
            </CardTitle>
            <CardDescription>Selecteer welke events naar je webhook URL worden gestuurd</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {WEBHOOK_EVENTS.map((we) => (
                <div key={we.event} className="flex items-center justify-between py-2.5">
                  <div>
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{we.event}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{we.label}</p>
                  </div>
                  <Switch
                    checked={webhookEvents.includes(we.event)}
                    onCheckedChange={(checked) => {
                      setWebhookEvents(prev => checked ? [...prev, we.event] : prev.filter(e => e !== we.event));
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Reusable toggle setting component
function ToggleSetting({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

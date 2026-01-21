import { useState, useEffect } from 'react';
import { 
  Mail, 
  ShoppingCart, 
  Package, 
  Shield, 
  Navigation, 
  TrendingUp,
  ChevronDown,
  Info,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStorefront } from '@/hooks/useStorefront';
import { toast } from 'sonner';
import {
  NEWSLETTER_PROVIDERS,
  COMPANY_FIELD_OPTIONS,
  IMAGE_ZOOM_OPTIONS,
  VARIANT_STYLE_OPTIONS,
  REVIEWS_DISPLAY_OPTIONS,
  RELATED_MODE_OPTIONS,
  COOKIE_BANNER_STYLES,
  NAV_STYLE_OPTIONS,
  SEARCH_DISPLAY_OPTIONS,
  DEFAULT_NEWSLETTER_CONFIG,
  DEFAULT_CHECKOUT_CONFIG,
  DEFAULT_PRODUCT_CONFIG,
  DEFAULT_TRUST_CONFIG,
  DEFAULT_NAVIGATION_CONFIG,
  DEFAULT_CONVERSION_CONFIG,
  DEFAULT_MULTILINGUAL_CONFIG,
} from '@/types/storefront-config';
import { SUPPORTED_LANGUAGES, LANGUAGE_SELECTOR_STYLES } from '@/types/legal-pages';
import { Checkbox } from '@/components/ui/checkbox';

export function StorefrontFeaturesSettings() {
  const { themeSettings, saveThemeSettings } = useStorefront();
  
  const [formData, setFormData] = useState({
    // Newsletter
    newsletter_enabled: DEFAULT_NEWSLETTER_CONFIG.enabled,
    newsletter_provider: DEFAULT_NEWSLETTER_CONFIG.provider,
    newsletter_popup_enabled: DEFAULT_NEWSLETTER_CONFIG.popup_enabled,
    newsletter_popup_delay_seconds: DEFAULT_NEWSLETTER_CONFIG.popup_delay_seconds,
    newsletter_incentive_text: DEFAULT_NEWSLETTER_CONFIG.incentive_text || '',
    
    // Checkout
    checkout_guest_enabled: DEFAULT_CHECKOUT_CONFIG.guest_enabled,
    checkout_phone_required: DEFAULT_CHECKOUT_CONFIG.phone_required,
    checkout_company_field: DEFAULT_CHECKOUT_CONFIG.company_field,
    checkout_address_autocomplete: DEFAULT_CHECKOUT_CONFIG.address_autocomplete,
    
    // Product
    product_image_zoom: DEFAULT_PRODUCT_CONFIG.image_zoom,
    product_variant_style: DEFAULT_PRODUCT_CONFIG.variant_style,
    product_reviews_display: DEFAULT_PRODUCT_CONFIG.reviews_display,
    product_stock_indicator: DEFAULT_PRODUCT_CONFIG.stock_indicator,
    product_related_mode: DEFAULT_PRODUCT_CONFIG.related_mode,
    
    // Trust
    cookie_banner_enabled: DEFAULT_TRUST_CONFIG.cookie_banner_enabled,
    cookie_banner_style: DEFAULT_TRUST_CONFIG.cookie_banner_style,
    
    // Navigation
    nav_style: DEFAULT_NAVIGATION_CONFIG.nav_style,
    header_sticky: DEFAULT_NAVIGATION_CONFIG.header_sticky,
    search_display: DEFAULT_NAVIGATION_CONFIG.search_display,
    mobile_bottom_nav: DEFAULT_NAVIGATION_CONFIG.mobile_bottom_nav,
    
    // Conversion
    show_stock_count: DEFAULT_CONVERSION_CONFIG.show_stock_count,
    show_viewers_count: DEFAULT_CONVERSION_CONFIG.show_viewers_count,
    show_recent_purchases: DEFAULT_CONVERSION_CONFIG.show_recent_purchases,
    exit_intent_popup: DEFAULT_CONVERSION_CONFIG.exit_intent_popup,
    
    // Multilingual
    storefront_multilingual_enabled: DEFAULT_MULTILINGUAL_CONFIG.enabled,
    storefront_languages: DEFAULT_MULTILINGUAL_CONFIG.languages as string[],
    storefront_default_language: DEFAULT_MULTILINGUAL_CONFIG.default_language,
    storefront_language_selector_style: DEFAULT_MULTILINGUAL_CONFIG.language_selector_style,
  });

  // Load settings from themeSettings
  useEffect(() => {
    if (themeSettings) {
      const settings = themeSettings as any;
      setFormData(prev => ({
        ...prev,
        newsletter_enabled: settings.newsletter_enabled ?? prev.newsletter_enabled,
        newsletter_provider: settings.newsletter_provider ?? prev.newsletter_provider,
        newsletter_popup_enabled: settings.newsletter_popup_enabled ?? prev.newsletter_popup_enabled,
        newsletter_popup_delay_seconds: settings.newsletter_popup_delay_seconds ?? prev.newsletter_popup_delay_seconds,
        newsletter_incentive_text: settings.newsletter_incentive_text ?? prev.newsletter_incentive_text,
        checkout_guest_enabled: settings.checkout_guest_enabled ?? prev.checkout_guest_enabled,
        checkout_phone_required: settings.checkout_phone_required ?? prev.checkout_phone_required,
        checkout_company_field: settings.checkout_company_field ?? prev.checkout_company_field,
        checkout_address_autocomplete: settings.checkout_address_autocomplete ?? prev.checkout_address_autocomplete,
        product_image_zoom: settings.product_image_zoom ?? prev.product_image_zoom,
        product_variant_style: settings.product_variant_style ?? prev.product_variant_style,
        product_reviews_display: settings.product_reviews_display ?? prev.product_reviews_display,
        product_stock_indicator: settings.product_stock_indicator ?? prev.product_stock_indicator,
        product_related_mode: settings.product_related_mode ?? prev.product_related_mode,
        cookie_banner_enabled: settings.cookie_banner_enabled ?? prev.cookie_banner_enabled,
        cookie_banner_style: settings.cookie_banner_style ?? prev.cookie_banner_style,
        nav_style: settings.nav_style ?? prev.nav_style,
        header_sticky: settings.header_sticky ?? prev.header_sticky,
        search_display: settings.search_display ?? prev.search_display,
        mobile_bottom_nav: settings.mobile_bottom_nav ?? prev.mobile_bottom_nav,
        show_stock_count: settings.show_stock_count ?? prev.show_stock_count,
        show_viewers_count: settings.show_viewers_count ?? prev.show_viewers_count,
        show_recent_purchases: settings.show_recent_purchases ?? prev.show_recent_purchases,
        exit_intent_popup: settings.exit_intent_popup ?? prev.exit_intent_popup,
        storefront_multilingual_enabled: settings.storefront_multilingual_enabled ?? prev.storefront_multilingual_enabled,
        storefront_languages: settings.storefront_languages ?? prev.storefront_languages,
        storefront_default_language: settings.storefront_default_language ?? prev.storefront_default_language,
        storefront_language_selector_style: settings.storefront_language_selector_style ?? prev.storefront_language_selector_style,
      }));
    }
  }, [themeSettings]);

  const handleSave = () => {
    saveThemeSettings.mutate(formData as any, {
      onSuccess: () => {
        toast.success('Storefront instellingen opgeslagen');
      },
    });
  };

  const updateField = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleLanguage = (langCode: string) => {
    setFormData(prev => {
      const currentLangs = prev.storefront_languages;
      if (currentLangs.includes(langCode)) {
        // Don't remove if it's the only language or the default
        if (currentLangs.length === 1 || langCode === prev.storefront_default_language) {
          return prev;
        }
        return { ...prev, storefront_languages: currentLangs.filter(l => l !== langCode) };
      } else {
        return { ...prev, storefront_languages: [...currentLangs, langCode] };
      }
    });
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Functies & Gedrag</h2>
        <p className="text-muted-foreground">
          Configureer hoe je storefront zich gedraagt en welke features actief zijn
        </p>
      </div>

      <Accordion type="multiple" defaultValue={['newsletter', 'checkout']} className="space-y-4">
        {/* Newsletter Section */}
        <AccordionItem value="newsletter" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Nieuwsbrief</h3>
                <p className="text-sm text-muted-foreground">Email aanmeldingen en popup configuratie</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="newsletter_enabled">Nieuwsbrief inschakelen</Label>
                <InfoTooltip text="Activeer nieuwsbrief functionaliteit op je storefront" />
              </div>
              <Switch
                id="newsletter_enabled"
                checked={formData.newsletter_enabled}
                onCheckedChange={(checked) => updateField('newsletter_enabled', checked)}
              />
            </div>

            {formData.newsletter_enabled && (
              <>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={formData.newsletter_provider}
                    onValueChange={(value) => updateField('newsletter_provider', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEWSLETTER_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          <div>
                            <div className="font-medium">{provider.label}</div>
                            <div className="text-xs text-muted-foreground">{provider.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="newsletter_popup">Popup tonen</Label>
                    <InfoTooltip text="Toon een popup om bezoekers te vragen zich aan te melden" />
                  </div>
                  <Switch
                    id="newsletter_popup"
                    checked={formData.newsletter_popup_enabled}
                    onCheckedChange={(checked) => updateField('newsletter_popup_enabled', checked)}
                  />
                </div>

                {formData.newsletter_popup_enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Vertraging: {formData.newsletter_popup_delay_seconds}s</Label>
                      </div>
                      <Slider
                        value={[formData.newsletter_popup_delay_seconds]}
                        onValueChange={([value]) => updateField('newsletter_popup_delay_seconds', value)}
                        min={0}
                        max={30}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        Seconden voordat de popup verschijnt (0 = direct)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="incentive">Incentive tekst</Label>
                      <Input
                        id="incentive"
                        value={formData.newsletter_incentive_text}
                        onChange={(e) => updateField('newsletter_incentive_text', e.target.value)}
                        placeholder="bijv. Ontvang 10% korting op je eerste bestelling!"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Checkout Section */}
        <AccordionItem value="checkout" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Checkout Ervaring</h3>
                <p className="text-sm text-muted-foreground">Bestelproces en formulier instellingen</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="guest_checkout">Gastbestelling toestaan</Label>
                <InfoTooltip text="Laat klanten bestellen zonder account aan te maken" />
              </div>
              <Switch
                id="guest_checkout"
                checked={formData.checkout_guest_enabled}
                onCheckedChange={(checked) => updateField('checkout_guest_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="phone_required">Telefoonnummer verplicht</Label>
                <InfoTooltip text="Vereist telefoonnummer bij checkout" />
              </div>
              <Switch
                id="phone_required"
                checked={formData.checkout_phone_required}
                onCheckedChange={(checked) => updateField('checkout_phone_required', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Bedrijfsveld</Label>
              <Select
                value={formData.checkout_company_field}
                onValueChange={(value) => updateField('checkout_company_field', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_FIELD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="address_autocomplete">Adres autocomplete</Label>
                <InfoTooltip text="Automatisch adres aanvullen via Google/PostcodeAPI" />
              </div>
              <Switch
                id="address_autocomplete"
                checked={formData.checkout_address_autocomplete}
                onCheckedChange={(checked) => updateField('checkout_address_autocomplete', checked)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Product Display Section */}
        <AccordionItem value="product" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Product Weergave</h3>
                <p className="text-sm text-muted-foreground">Zoom, varianten en reviews configuratie</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Afbeelding zoom</Label>
              <Select
                value={formData.product_image_zoom}
                onValueChange={(value) => updateField('product_image_zoom', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_ZOOM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Variant weergave</Label>
              <Select
                value={formData.product_variant_style}
                onValueChange={(value) => updateField('product_variant_style', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reviews weergave</Label>
              <Select
                value={formData.product_reviews_display}
                onValueChange={(value) => updateField('product_reviews_display', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEWS_DISPLAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="stock_indicator">Voorraad indicator</Label>
                <InfoTooltip text="Toon of een product op voorraad is" />
              </div>
              <Switch
                id="stock_indicator"
                checked={formData.product_stock_indicator}
                onCheckedChange={(checked) => updateField('product_stock_indicator', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Gerelateerde producten</Label>
              <Select
                value={formData.product_related_mode}
                onValueChange={(value) => updateField('product_related_mode', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATED_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Trust & Compliance Section */}
        <AccordionItem value="trust" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Trust & Compliance</h3>
                <p className="text-sm text-muted-foreground">Cookie banner en vertrouwenssignalen</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="cookie_banner">Cookie banner</Label>
                <InfoTooltip text="GDPR-compliant cookie toestemming banner" />
              </div>
              <Switch
                id="cookie_banner"
                checked={formData.cookie_banner_enabled}
                onCheckedChange={(checked) => updateField('cookie_banner_enabled', checked)}
              />
            </div>

            {formData.cookie_banner_enabled && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label>Banner stijl</Label>
                <Select
                  value={formData.cookie_banner_style}
                  onValueChange={(value) => updateField('cookie_banner_style', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COOKIE_BANNER_STYLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Navigation Section */}
        <AccordionItem value="navigation" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Navigation className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Navigatie</h3>
                <p className="text-sm text-muted-foreground">Menu stijl en header instellingen</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Navigatie stijl</Label>
              <Select
                value={formData.nav_style}
                onValueChange={(value) => updateField('nav_style', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAV_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="sticky_header">Sticky header</Label>
                <InfoTooltip text="Header blijft zichtbaar tijdens scrollen" />
              </div>
              <Switch
                id="sticky_header"
                checked={formData.header_sticky}
                onCheckedChange={(checked) => updateField('header_sticky', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Zoekbalk</Label>
              <Select
                value={formData.search_display}
                onValueChange={(value) => updateField('search_display', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_DISPLAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="mobile_bottom_nav">Mobiele bottom navigation</Label>
                <InfoTooltip text="Vaste navigatie onderaan op mobiel" />
              </div>
              <Switch
                id="mobile_bottom_nav"
                checked={formData.mobile_bottom_nav}
                onCheckedChange={(checked) => updateField('mobile_bottom_nav', checked)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Conversion Features Section */}
        <AccordionItem value="conversion" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <TrendingUp className="h-5 w-5 text-rose-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Conversie Boosters</h3>
                <p className="text-sm text-muted-foreground">Urgentie en social proof features</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="stock_count">Voorraad aantallen tonen</Label>
                <InfoTooltip text="Toon exact aantal op voorraad (bijv. 'Nog 3 op voorraad')" />
              </div>
              <Switch
                id="stock_count"
                checked={formData.show_stock_count}
                onCheckedChange={(checked) => updateField('show_stock_count', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="viewers_count">Kijkers tonen</Label>
                <InfoTooltip text="Toon aantal mensen dat dit product bekijkt" />
              </div>
              <Switch
                id="viewers_count"
                checked={formData.show_viewers_count}
                onCheckedChange={(checked) => updateField('show_viewers_count', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="recent_purchases">Recente aankopen popup</Label>
                <InfoTooltip text="Toon notificaties van recente aankopen door anderen" />
              </div>
              <Switch
                id="recent_purchases"
                checked={formData.show_recent_purchases}
                onCheckedChange={(checked) => updateField('show_recent_purchases', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="exit_intent">Exit-intent popup</Label>
                <InfoTooltip text="Toon popup wanneer bezoeker pagina wil verlaten" />
              </div>
              <Switch
                id="exit_intent"
                checked={formData.exit_intent_popup}
                onCheckedChange={(checked) => updateField('exit_intent_popup', checked)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Multilingual Section */}
        <AccordionItem value="multilingual" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <Globe className="h-5 w-5 text-sky-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Meertalige Webshop</h3>
                <p className="text-sm text-muted-foreground">Bied je webshop aan in meerdere talen</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="multilingual_enabled">Meertalige webshop activeren</Label>
                <InfoTooltip text="Schakel meertalige ondersteuning in zodat klanten hun voorkeurstaal kunnen kiezen" />
              </div>
              <Switch
                id="multilingual_enabled"
                checked={formData.storefront_multilingual_enabled}
                onCheckedChange={(checked) => updateField('storefront_multilingual_enabled', checked)}
              />
            </div>

            {formData.storefront_multilingual_enabled && (
              <>
                <div className="space-y-3">
                  <Label>Beschikbare talen</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <div
                        key={lang.code}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.storefront_languages.includes(lang.code)
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                        onClick={() => toggleLanguage(lang.code)}
                      >
                        <Checkbox
                          checked={formData.storefront_languages.includes(lang.code)}
                          disabled={
                            formData.storefront_languages.includes(lang.code) && 
                            (formData.storefront_languages.length === 1 || lang.code === formData.storefront_default_language)
                          }
                        />
                        <span className="text-xl">{lang.flag}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{lang.name}</p>
                          <p className="text-xs text-muted-foreground">{lang.code.toUpperCase()}</p>
                        </div>
                        {lang.code === formData.storefront_default_language && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Standaard</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Standaardtaal</Label>
                  <Select
                    value={formData.storefront_default_language}
                    onValueChange={(value) => {
                      // Ensure the default language is in the selected languages
                      if (!formData.storefront_languages.includes(value)) {
                        setFormData(prev => ({
                          ...prev,
                          storefront_languages: [...prev.storefront_languages, value],
                          storefront_default_language: value,
                        }));
                      } else {
                        updateField('storefront_default_language', value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.filter(l => formData.storefront_languages.includes(l.code)).map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <div className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    De taal die wordt gebruikt wanneer een bezoeker nog geen voorkeur heeft gekozen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Taalwisselaar stijl</Label>
                  <Select
                    value={formData.storefront_language_selector_style}
                    onValueChange={(value) => updateField('storefront_language_selector_style', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_SELECTOR_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          <div>
                            <div className="font-medium">{style.label}</div>
                            <div className="text-xs text-muted-foreground">{style.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saveThemeSettings.isPending}
          size="lg"
        >
          {saveThemeSettings.isPending ? 'Opslaan...' : 'Instellingen Opslaan'}
        </Button>
      </div>
    </div>
  );
}

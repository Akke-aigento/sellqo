import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, Search, X, Heart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { usePublicReviews } from '@/hooks/useReviewsHub';
import { usePublicProducts } from '@/hooks/usePublicStorefront';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { ReviewsFloatingWidget } from '@/components/storefront/reviews/ReviewsFloatingWidget';
import { ReviewsTrustBar } from '@/components/storefront/reviews/ReviewsTrustBar';
import { ReviewsStructuredData } from '@/components/storefront/reviews/ReviewsStructuredData';
import { MegaMenu } from '@/components/storefront/MegaMenu';
import { MobileBottomNav } from '@/components/storefront/MobileBottomNav';
import { CookieBanner } from '@/components/storefront/CookieBanner';
import { NewsletterPopup } from '@/components/storefront/NewsletterPopup';
import { TrustBadges } from '@/components/storefront/TrustBadges';
import { PaymentMethodIcons } from '@/components/storefront/PaymentMethodIcons';
import { StorefrontLanguageSelector } from '@/components/storefront/StorefrontLanguageSelector';
import { ExitIntentPopup } from '@/components/storefront/ExitIntentPopup';
import { RecentPurchaseToast } from '@/components/storefront/RecentPurchaseToast';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { SearchModal } from '@/components/storefront/SearchModal';
import { StorefrontOfflinePage } from '@/components/storefront/StorefrontOfflinePage';
import { StorefrontPasswordGate } from '@/components/storefront/StorefrontPasswordGate';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { relativeLuminance } from '@/lib/color-utils';
import { generateThemePalette as genPalette, generateThemePaletteLegacy } from '@/lib/theme-palette';
import type { ThemeMode, ThemeStyle } from '@/lib/theme-palette';

// Sanitize CSS to prevent XSS via style injection
function sanitizeCSS(css: string): string {
  let cleaned = css;
  // Remove any HTML tags (e.g. <script>, </style>, etc.)
  cleaned = cleaned.replace(/<[^>]*>/gi, '');
  // Remove javascript: protocol in any context
  cleaned = cleaned.replace(/javascript\s*:/gi, '');
  // Remove expression() (IE CSS expression attack)
  cleaned = cleaned.replace(/expression\s*\(/gi, '');
  // Remove -moz-binding (Firefox XBL binding attack)
  cleaned = cleaned.replace(/-moz-binding\s*:/gi, '');
  // Remove behavior: (IE .htc behavior attack)
  cleaned = cleaned.replace(/behavior\s*:/gi, '');
  // Remove @import with javascript or data URIs
  cleaned = cleaned.replace(/@import\s+(?:url\s*\()?\s*['"]?\s*(?:javascript|data)\s*:/gi, '');
  return cleaned;
}
import type { ReviewPlatform } from '@/types/reviews-hub';
import { supabase } from '@/integrations/supabase/client';

interface ShopLayoutProps {
  children: ReactNode;
  hideChrome?: boolean;
}

export function ShopLayout({ children, hideChrome: hideChromeFromProp }: ShopLayoutProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  // Global hideChrome detection: from prop, query param, referrer, or sessionStorage
  const hideChrome = (() => {
    if (hideChromeFromProp) return true;

    const persisted = sessionStorage.getItem('hide_chrome') === '1';

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    const cancelUrl = params.get('cancel_url');
    const referrer = document.referrer;

    const detected =
      (fromParam && !fromParam.includes('sellqo.app')) ||
      (cancelUrl && !cancelUrl.includes('sellqo.app')) ||
      (referrer && referrer.length > 0 && !referrer.includes('sellqo.app') && !referrer.includes('sellqo.lovable.app') && !referrer.includes('lovable.app'));

    if (detected) {
      sessionStorage.setItem('hide_chrome', '1');
      return true;
    }

    return persisted;
  })();
  const { tenant, themeSettings, navPages, categories, legalPages, isLoading, error } = usePublicStorefront(tenantSlug || '');
  const { aggregate, reviews, connections } = usePublicReviews(tenant?.id);
  const { getCartCount, setTenantSlug, isDrawerOpen, closeDrawer } = useCart();
  const { getWishlistCount } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [storefrontLanguage, setStorefrontLanguage] = useState(() => {
    return localStorage.getItem('storefront_language') || 'nl';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  
  const cartCount = getCartCount();
  const wishlistCount = getWishlistCount();

  // Fetch product names for RecentPurchaseToast
  const { data: allProducts } = usePublicProducts(tenant?.id, { limit: 20 });
  const productNames = (allProducts || []).map((p: any) => p.name);

  // Read storefront config settings
  const ts = themeSettings as any;
  const navStyle = ts?.nav_style || 'simple';
  const headerSticky = ts?.header_sticky !== false; // default true
  const searchDisplay = ts?.search_display || 'icon';
  const mobileBottomNav = ts?.mobile_bottom_nav || false;
  const cookieBannerEnabled = ts?.cookie_banner_enabled || false;
  const cookieBannerStyle = ts?.cookie_banner_style || 'minimal';
  const showStockCount = ts?.show_stock_count || false;
  const showViewersCount = ts?.show_viewers_count || false;
  const showRecentPurchases = ts?.show_recent_purchases || false;
  const exitIntentPopup = ts?.exit_intent_popup || false;
  const newsletterPopupEnabled = ts?.newsletter_popup_enabled || false;
  const newsletterEnabled = ts?.newsletter_enabled !== false; // global toggle, default true
  const newsletterPopupDelay = ts?.newsletter_popup_delay_seconds || 5;
  const newsletterIncentiveText = ts?.newsletter_incentive_text || null;
  const trustBadges = (ts?.trust_badges as string[]) || [];
  const multilingualEnabled = ts?.storefront_multilingual_enabled || false;
  const storefrontLanguages = (ts?.storefront_languages as string[]) || ['nl'];
  const defaultLanguage = ts?.storefront_default_language || 'nl';
  const languageSelectorStyle = ts?.storefront_language_selector_style || 'dropdown';

  const handleLanguageChange = (lang: string) => {
    setStorefrontLanguage(lang);
    localStorage.setItem('storefront_language', lang);
  };

  // Set tenant slug for cart context
  useEffect(() => {
    if (tenantSlug) {
      setTenantSlug(tenantSlug);
    }
  }, [tenantSlug, setTenantSlug]);

  // Inject custom_head_scripts from tenant theme settings
  useEffect(() => {
    if (!themeSettings?.custom_head_scripts) return;
    const scripts = themeSettings.custom_head_scripts;
    // Create a container element to parse the scripts
    const container = document.createElement('div');
    container.innerHTML = scripts;
    const addedNodes: Node[] = [];
    // Append each child node (script tags, meta tags, etc.) to the document head
    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'SCRIPT') {
          // Re-create script elements so the browser executes them
          const script = document.createElement('script');
          Array.from(el.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
          script.textContent = el.textContent;
          document.head.appendChild(script);
          addedNodes.push(script);
        } else {
          const cloned = el.cloneNode(true);
          document.head.appendChild(cloned);
          addedNodes.push(cloned);
        }
      }
    });
    return () => {
      addedNodes.forEach(n => n.parentNode?.removeChild(n));
    };
  }, [themeSettings?.custom_head_scripts]);

  // Global favicon from themeSettings
  useEffect(() => {
    if (themeSettings?.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = themeSettings.favicon_url;
    }
  }, [themeSettings?.favicon_url]);

  // Redirect logic
  useEffect(() => {
    if (!tenant?.id || !themeSettings || redirecting) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'true') return;

    const checkRedirect = async () => {
      // Skip redirect when hideChrome is active (e.g. checkout opened from custom frontend)
      if (hideChrome) return;
      if (ts?.use_custom_frontend && ts?.custom_frontend_url) {
        setRedirecting(true);
        window.location.href = ts.custom_frontend_url;
        return;
      }
      const { data: canonicalDomain } = await supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .eq('is_canonical', true)
        .eq('dns_verified', true)
        .maybeSingle();
      if (canonicalDomain?.domain) {
        setRedirecting(true);
        window.location.href = `https://${canonicalDomain.domain}`;
      }
    };
    checkRedirect();
  }, [tenant?.id, themeSettings, redirecting]);
  
  const enabledPlatforms = connections?.map(c => c.platform as ReviewPlatform) || [];

  // Build theme CSS variables: intelligent palette (brand_color) or legacy path
  const palette = (() => {
    if (!themeSettings) return { cssVariables: {} as Record<string, string>, headingFont: '', bodyFont: '' };
    const brandColor = (themeSettings as any).brand_color as string | undefined;
    if (brandColor) {
      const mode = ((themeSettings as any).theme_mode || 'light') as ThemeMode;
      const style = ((themeSettings as any).theme_style || 'modern') as ThemeStyle;
      return genPalette(brandColor, mode, style);
    }
    // Legacy path – existing 5-color tenants
    return {
      cssVariables: generateThemePaletteLegacy(
        themeSettings.background_color,
        themeSettings.primary_color,
        themeSettings.secondary_color,
        themeSettings.accent_color,
        themeSettings.text_color,
      ),
      headingFont: themeSettings.heading_font || '',
      bodyFont: themeSettings.body_font || '',
    };
  })();

  // Resolved fonts: tenant overrides win (the wizard saves the chosen style fonts
  // to heading_font/body_font, so this always reflects the user's latest choice).
  // Fall back to palette fonts for tenants without stored font settings.
  const resolvedHeadingFont = themeSettings?.heading_font || palette.headingFont || 'Inter';
  const resolvedBodyFont = themeSettings?.body_font || palette.bodyFont || 'Inter';

  // Load Google Fonts (with cleanup) – include weights 400-700, deduplicate
  useEffect(() => {
    const uniqueFonts = [...new Set([resolvedHeadingFont, resolvedBodyFont].filter(Boolean))];
    if (uniqueFonts.length === 0) return;
    const link = document.createElement('link');
    const families = uniqueFonts.map(f => `family=${f!.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { link.parentNode?.removeChild(link); };
  }, [resolvedHeadingFont, resolvedBodyFont]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop/${tenantSlug}/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Storefront visibility guard
  const storefrontStatus = (ts?.storefront_status as string) || 'online';
  const storefrontPassword = (ts?.storefront_password as string) || '';
  const [passwordGranted, setPasswordGranted] = useState(() => {
    if (!tenantSlug) return false;
    return sessionStorage.getItem(`storefront_access_${tenantSlug}`) === 'granted';
  });

  const handlePasswordSuccess = useCallback(() => {
    setPasswordGranted(true);
  }, []);

  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Shop niet gevonden</h1>
        <p className="text-muted-foreground">De gevraagde webshop bestaat niet.</p>
        <Button asChild>
          <Link to="/">Terug naar home</Link>
        </Button>
      </div>
    );
  }

  // Storefront offline
  if (storefrontStatus === 'offline') {
    return <StorefrontOfflinePage logoUrl={ts?.logo_url || tenant.logo_url} shopName={tenant.name} />;
  }

  // Storefront password protected
  if (storefrontStatus === 'password' && !passwordGranted) {
    return (
      <StorefrontPasswordGate
        logoUrl={ts?.logo_url || tenant.logo_url}
        shopName={tenant.name}
        correctPassword={storefrontPassword}
        tenantSlug={tenantSlug || ''}
        onSuccess={handlePasswordSuccess}
      />
    );
  }

  const basePath = `/shop/${tenantSlug}`;
  const headerStyle = themeSettings?.header_style || 'standard';
  const showAnnouncement = themeSettings?.show_announcement_bar && themeSettings?.announcement_text;
  const announcementTexts = showAnnouncement ? String(themeSettings.announcement_text).split('|').map((t: string) => t.trim()).filter(Boolean) : [];
  const logoUrl = ts?.logo_url || tenant.logo_url;
  const socialLinks = themeSettings?.social_links || {};
  const filledSocialLinks = Object.entries(socialLinks).filter(([, value]) => value && String(value).trim() !== '');

  return (
    <div 
      className={cn("min-h-screen flex flex-col bg-background", !hideChrome && mobileBottomNav && "pb-14 md:pb-0")}
      style={{
        fontFamily: resolvedBodyFont ? `"${resolvedBodyFont}", sans-serif` : undefined,
        ...palette.cssVariables,
      } as React.CSSProperties}
    >
      {!hideChrome && (
        <>
          {/* Announcement Bar Carousel */}
          {showAnnouncement && announcementTexts.length > 0 && (
            <AnnouncementCarousel
              texts={announcementTexts}
              link={themeSettings?.announcement_link}
              bgColor={themeSettings?.primary_color || 'hsl(var(--primary))'}
              textColor={themeSettings?.primary_color ? (relativeLuminance(themeSettings.primary_color) > 0.179 ? '#000000' : '#ffffff') : '#ffffff'}
            />
          )}

          {/* Header - conditionally sticky */}
          <header className={cn(
            "z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
            headerSticky && "sticky top-0"
          )}>
            <div className="container mx-auto px-4">
              {headerStyle === 'centered' ? (
                <CenteredHeader
                  tenant={tenant} basePath={basePath} categories={categories}
                  navPages={navPages} themeSettings={themeSettings} logoUrl={logoUrl}
                  cartCount={cartCount} mobileMenuOpen={mobileMenuOpen}
                  setMobileMenuOpen={setMobileMenuOpen} navStyle={navStyle}
                  multilingualEnabled={multilingualEnabled} storefrontLanguages={storefrontLanguages}
                  storefrontLanguage={storefrontLanguage} onLanguageChange={handleLanguageChange}
                  languageSelectorStyle={languageSelectorStyle}
                  resolvedHeadingFont={resolvedHeadingFont}
                />
              ) : headerStyle === 'minimal' ? (
                <MinimalHeader
                  tenant={tenant} basePath={basePath} categories={categories}
                  navPages={navPages} themeSettings={themeSettings} logoUrl={logoUrl}
                  mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}
                  cartCount={cartCount}
                  multilingualEnabled={multilingualEnabled} storefrontLanguages={storefrontLanguages}
                  storefrontLanguage={storefrontLanguage} onLanguageChange={handleLanguageChange}
                  languageSelectorStyle={languageSelectorStyle}
                  resolvedHeadingFont={resolvedHeadingFont}
                />
              ) : (
                <StandardHeader
                  tenant={tenant} basePath={basePath} categories={categories}
                  navPages={navPages} themeSettings={themeSettings} logoUrl={logoUrl}
                  searchOpen={searchOpen} setSearchOpen={setSearchOpen}
                  searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                  onSearch={handleSearch} cartCount={cartCount}
                  mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}
                  navStyle={navStyle} searchDisplay={searchDisplay}
                  wishlistCount={wishlistCount}
                  onCartClick={() => { if (cartCount > 0) { /* drawer opens via context */ } }}
                  onSearchModalOpen={() => setSearchModalOpen(true)}
                  multilingualEnabled={multilingualEnabled} storefrontLanguages={storefrontLanguages}
                  storefrontLanguage={storefrontLanguage} onLanguageChange={handleLanguageChange}
                  languageSelectorStyle={languageSelectorStyle}
                  resolvedHeadingFont={resolvedHeadingFont}
                />
              )}
            </div>
          </header>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {!hideChrome && (
        <>
          {/* Footer */}
          <footer className="bg-muted/30 border-t mt-auto">
            <div className="container mx-auto px-4 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-1">
                  {logoUrl ? (
                    <img src={logoUrl} alt={tenant.name} className="h-10 mb-4" />
                  ) : (
                    <h3 className="text-xl font-bold mb-4" style={{ fontFamily: resolvedHeadingFont ? `"${resolvedHeadingFont}", serif` : undefined }}>
                      {tenant.name}
                    </h3>
                  )}
                  {themeSettings?.footer_text && (
                    <p className="text-muted-foreground text-sm max-w-md">{themeSettings.footer_text}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Snelle Links</h4>
                  <ul className="space-y-2 text-sm">
                    <li><Link to={basePath} className="text-muted-foreground hover:text-foreground">Home</Link></li>
                    <li><Link to={`${basePath}/products`} className="text-muted-foreground hover:text-foreground">Producten</Link></li>
                    {navPages.slice(0, 4).map((page: any) => (
                      <li key={page.id}>
                        <Link to={`${basePath}/page/${page.slug}`} className="text-muted-foreground hover:text-foreground">{page.title}</Link>
                      </li>
                    ))}
                    <li><Link to={`${basePath}/contact`} className="text-muted-foreground hover:text-foreground">Contact</Link></li>
                  </ul>
                </div>

                {legalPages.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-4">Juridisch</h4>
                    <ul className="space-y-2 text-sm">
                      {legalPages.map((page: any) => (
                        <li key={page.id}>
                          <Link to={`${basePath}/legal/${page.page_type}`} className="text-muted-foreground hover:text-foreground">{page.title_nl}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {filledSocialLinks.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-4">Volg Ons</h4>
                    <div className="flex gap-4">
                      {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>}
                      {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>}
                      {socialLinks.twitter && <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>}
                      {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>}
                    </div>
                  </div>
                )}
              </div>

              {/* Trust Bar */}
              {ts?.reviews_hub_enabled && ts?.reviews_trust_bar_enabled && aggregate && aggregate.total_reviews > 0 && (
                <div className="mt-8 pt-8 border-t flex justify-center">
                  <ReviewsTrustBar averageRating={aggregate.average_rating} totalReviews={aggregate.total_reviews} platforms={enabledPlatforms} variant="light" />
                </div>
              )}

              {/* Trust Badges */}
              {trustBadges.length > 0 && (
                <div className="mt-8 pt-8 border-t">
                  <TrustBadges badges={trustBadges} variant="footer" />
                </div>
              )}

              {/* Payment Method Icons Trust Bar */}
              <div className="mt-8 pt-8 border-t">
                <PaymentMethodIcons variant="footer" />
              </div>

              <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} {tenant.name}. Alle rechten voorbehouden.</p>
              </div>
            </div>
          </footer>

          {/* Floating Reviews Widget */}
          {ts?.reviews_hub_enabled && ts?.reviews_widget_position === 'floating' && aggregate && aggregate.total_reviews > 0 && (
            <ReviewsFloatingWidget 
              averageRating={aggregate.average_rating} totalReviews={aggregate.total_reviews}
              reviews={reviews || []} platforms={enabledPlatforms}
              position={ts?.reviews_floating_position || 'bottom-right'}
              style={ts?.reviews_floating_style || 'badge'}
            />
          )}

          {/* Reviews Structured Data */}
          {ts?.reviews_hub_enabled && aggregate && aggregate.total_reviews > 0 && (
            <ReviewsStructuredData aggregate={aggregate} businessName={tenant.name} />
          )}

          {/* Cookie Banner */}
          {cookieBannerEnabled && tenantSlug && (
            <CookieBanner style={cookieBannerStyle} tenantSlug={tenantSlug} />
          )}

          {/* Newsletter Popup - only if both global and popup toggles are enabled */}
          {newsletterEnabled && newsletterPopupEnabled && tenantSlug && (
            <NewsletterPopup tenantSlug={tenantSlug} tenantId={tenant?.id} delaySeconds={newsletterPopupDelay} incentiveText={newsletterIncentiveText} />
          )}

          {/* Exit Intent Popup */}
          {exitIntentPopup && tenantSlug && (
            <ExitIntentPopup tenantSlug={tenantSlug} incentiveText={newsletterIncentiveText} />
          )}

          {/* Recent Purchases Toast */}
          {showRecentPurchases && tenantSlug && productNames.length > 0 && (
            <RecentPurchaseToast tenantSlug={tenantSlug} productNames={productNames} />
          )}

          {/* Mobile Bottom Nav */}
          {mobileBottomNav && (
            <MobileBottomNav basePath={basePath} cartCount={cartCount} onSearchClick={() => setSearchModalOpen(true)} />
          )}

          {/* Cart Drawer */}
          <CartDrawer open={isDrawerOpen} onOpenChange={closeDrawer} basePath={basePath} currency={tenant?.currency || 'EUR'} tenantId={tenant?.id} />

          {/* Search Modal */}
          <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} tenantId={tenant?.id} basePath={basePath} currency={tenant?.currency || 'EUR'} />
        </>
      )}

      {/* Custom CSS (sanitized to prevent XSS) */}
      {themeSettings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: sanitizeCSS(themeSettings.custom_css) }} />
      )}
    </div>
  );
}

// Account Header Button
function AccountHeaderButton({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  let auth: { isAuthenticated: boolean; customer: any; logout: () => void } | null = null;
  try { auth = useStorefrontAuth(); } catch { /* not in provider */ }

  if (!auth) {
    return (
      <Button variant="ghost" size="icon" asChild className="hidden md:flex">
        <Link to={`${basePath}/login`}><User className="h-5 w-5" /></Link>
      </Button>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Button variant="ghost" size="icon" asChild className="hidden md:flex">
        <Link to={`${basePath}/login`}><User className="h-5 w-5" /></Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="hidden md:flex">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm font-medium">
          {auth.customer?.first_name} {auth.customer?.last_name}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`${basePath}/account`)}>
          Mijn account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`${basePath}/account?tab=orders`)}>
          Bestellingen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { auth!.logout(); navigate(basePath); }}>
          Uitloggen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Announcement Carousel
function AnnouncementCarousel({ texts, link, bgColor, textColor }: { texts: string[]; link?: string; bgColor: string; textColor?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (texts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % texts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [texts.length]);

  const content = texts[currentIndex] || texts[0];

  return (
    <div 
      className="py-2 px-4 text-center text-sm overflow-hidden relative min-h-[2rem] flex items-center justify-center"
      style={{ backgroundColor: bgColor, color: textColor || '#ffffff' }}
    >
      <div key={currentIndex} className="animate-fade-in leading-tight">
        {link ? (
          <a href={link} className="hover:underline">{content}</a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

// Standard Header Component
function StandardHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, searchOpen, setSearchOpen, searchQuery, setSearchQuery, onSearch, cartCount, mobileMenuOpen, setMobileMenuOpen, navStyle, searchDisplay, wishlistCount, onCartClick, onSearchModalOpen, multilingualEnabled, storefrontLanguages, storefrontLanguage, onLanguageChange, languageSelectorStyle, resolvedHeadingFont }: any) {
  const { openDrawer } = useCart();
  
  return (
    <>
      <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <Link to={basePath} className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="h-8" />
          ) : (
            <span className="font-bold text-xl" style={{ fontFamily: resolvedHeadingFont ? `"${resolvedHeadingFont}", serif` : undefined }}>
              {tenant.name}
            </span>
          )}
        </Link>

        {/* Navigation - Desktop */}
        {navStyle === 'mega_menu' ? (
          <MegaMenu categories={categories} basePath={basePath} />
        ) : (
          <nav className="hidden md:flex items-center gap-6">
            <Link to={basePath} className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
            <Link to={`${basePath}/products`} className="text-sm font-medium hover:text-primary transition-colors">Alle Producten</Link>
            {categories.slice(0, 5).map((cat: any) => (
              <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{cat.name}</Link>
            ))}
            {navPages.slice(0, 3).map((page: any) => (
              <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{page.title}</Link>
            ))}
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Inline search (visible mode) */}
          {searchDisplay === 'visible' && (
            <form onSubmit={onSearch} className="hidden md:flex items-center gap-1">
              <Input value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} placeholder="Zoeken..." className="w-48 h-9" />
              <Button type="submit" size="icon" variant="ghost" className="h-9 w-9">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          )}
          {/* Icon search (icon mode) - opens search modal */}
          {searchDisplay === 'icon' && (
            <Button variant="ghost" size="icon" onClick={onSearchModalOpen} className="hidden md:flex">
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Language Selector */}
          {multilingualEnabled && storefrontLanguages.length > 1 && (
            <div className="hidden md:flex">
              <StorefrontLanguageSelector
                languages={storefrontLanguages}
                currentLanguage={storefrontLanguage}
                onLanguageChange={onLanguageChange}
                style={languageSelectorStyle}
              />
            </div>
          )}

          {/* Wishlist */}
          <Button variant="ghost" size="icon" asChild className="relative hidden md:flex">
            <Link to={`${basePath}/wishlist`}>
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Account */}
          <AccountHeaderButton basePath={basePath} />

          {/* Cart - opens drawer */}
          <Button variant="ghost" size="icon" className="relative" onClick={openDrawer}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-scale-in">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Button>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <nav className="flex flex-col gap-4 mt-8">
                <Link to={basePath} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                <Link to={`${basePath}/products`} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Alle Producten</Link>
                <Link to={`${basePath}/wishlist`} className="text-lg font-medium flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <Heart className="h-5 w-5" /> Verlanglijst {wishlistCount > 0 && `(${wishlistCount})`}
                </Link>
                <div className="border-t my-2" />
                {categories.map((cat: any) => (
                  <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{cat.name}</Link>
                ))}
                <div className="border-t my-2" />
                {navPages.map((page: any) => (
                  <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{page.title}</Link>
                ))}
                <div className="border-t my-2" />
                <form onSubmit={(e) => { onSearch(e); setMobileMenuOpen(false); }} className="flex gap-2">
                  <Input value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} placeholder="Zoeken..." className="flex-1" />
                  <Button type="submit" size="icon" variant="outline"><Search className="h-4 w-4" /></Button>
                </form>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}

// Centered Header Component
function CenteredHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, cartCount, mobileMenuOpen, setMobileMenuOpen, navStyle, multilingualEnabled, storefrontLanguages, storefrontLanguage, onLanguageChange, languageSelectorStyle, resolvedHeadingFont }: any) {
  const { openDrawer } = useCart();
  const { getWishlistCount } = useWishlist();
  const wishlistCount = getWishlistCount();
  const showWishlist = (themeSettings as any)?.show_wishlist !== false;

  return (
    <div className="py-4">
      <div className="flex justify-between items-center md:justify-center mb-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <nav className="flex flex-col gap-4 mt-8">
              <Link to={basePath} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link to={`${basePath}/products`} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
              {showWishlist && (
                <Link to={`${basePath}/wishlist`} className="text-lg font-medium flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <Heart className="h-5 w-5" /> Verlanglijst {wishlistCount > 0 && `(${wishlistCount})`}
                </Link>
              )}
              <div className="border-t my-2" />
              {categories.map((cat: any) => (
                <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{cat.name}</Link>
              ))}
              <div className="border-t my-2" />
              {navPages.map((page: any) => (
                <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{page.title}</Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to={basePath}>
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="h-12" />
          ) : (
            <span className="font-bold text-2xl" style={{ fontFamily: resolvedHeadingFont ? `"${resolvedHeadingFont}", serif` : undefined }}>{tenant.name}</span>
          )}
        </Link>

        {/* Mobile cart */}
        <Button variant="ghost" size="icon" className="relative md:hidden" onClick={openDrawer}>
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </Button>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center justify-center gap-8 border-t pt-4">
        <Link to={basePath} className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
        <Link to={`${basePath}/products`} className="text-sm font-medium hover:text-primary transition-colors">Shop</Link>
        {categories.slice(0, 4).map((cat: any) => (
          <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{cat.name}</Link>
        ))}
        {navPages.slice(0, 2).map((page: any) => (
          <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{page.title}</Link>
        ))}
        
        {/* Action icons */}
        <div className="flex items-center gap-1 ml-4 border-l pl-4">
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <Search className="h-4 w-4" />
          </Button>
          {multilingualEnabled && storefrontLanguages.length > 1 && (
            <StorefrontLanguageSelector
              languages={storefrontLanguages}
              currentLanguage={storefrontLanguage}
              onLanguageChange={onLanguageChange}
              style={languageSelectorStyle}
            />
          )}
          {showWishlist && (
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link to={`${basePath}/wishlist`}>
                <Heart className="h-4 w-4" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{wishlistCount > 9 ? '9+' : wishlistCount}</span>
                )}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="relative" onClick={openDrawer}>
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </Button>
        </div>
      </nav>
    </div>
  );
}

// Minimal Header Component
function MinimalHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, mobileMenuOpen, setMobileMenuOpen, cartCount, multilingualEnabled, storefrontLanguages, storefrontLanguage, onLanguageChange, languageSelectorStyle, resolvedHeadingFont }: any) {
  const { openDrawer } = useCart();
  const { getWishlistCount } = useWishlist();
  const wishlistCount = getWishlistCount();
  const showWishlist = (themeSettings as any)?.show_wishlist !== false;

  return (
    <div className="flex items-center justify-between h-16">
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <nav className="flex flex-col gap-4 mt-8">
            <Link to={basePath} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link to={`${basePath}/products`} className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Alle Producten</Link>
            {showWishlist && (
              <Link to={`${basePath}/wishlist`} className="text-lg font-medium flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Heart className="h-5 w-5" /> Verlanglijst {wishlistCount > 0 && `(${wishlistCount})`}
              </Link>
            )}
            <div className="border-t my-2" />
            {categories.map((cat: any) => (
              <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{cat.name}</Link>
            ))}
            <div className="border-t my-2" />
            {navPages.map((page: any) => (
              <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{page.title}</Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <Link to={basePath} className="absolute left-1/2 -translate-x-1/2">
        {logoUrl ? (
          <img src={logoUrl} alt={tenant.name} className="h-8" />
        ) : (
          <span className="font-bold text-xl" style={{ fontFamily: resolvedHeadingFont ? `"${resolvedHeadingFont}", serif` : undefined }}>{tenant.name}</span>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => {}}>
          <Search className="h-5 w-5" />
        </Button>
        {multilingualEnabled && storefrontLanguages.length > 1 && (
          <StorefrontLanguageSelector
            languages={storefrontLanguages}
            currentLanguage={storefrontLanguage}
            onLanguageChange={onLanguageChange}
            style={languageSelectorStyle}
          />
        )}
        {showWishlist && (
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to={`${basePath}/wishlist`}>
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{wishlistCount > 9 ? '9+' : wishlistCount}</span>
              )}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="relative" onClick={openDrawer}>
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </Button>
      </div>
    </div>
  );
}

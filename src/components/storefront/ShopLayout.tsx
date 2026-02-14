import { ReactNode, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, Search, X, Heart } from 'lucide-react';
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
import { ExitIntentPopup } from '@/components/storefront/ExitIntentPopup';
import { RecentPurchaseToast } from '@/components/storefront/RecentPurchaseToast';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { SearchModal } from '@/components/storefront/SearchModal';
import { cn } from '@/lib/utils';
import type { ReviewPlatform } from '@/types/reviews-hub';
import { supabase } from '@/integrations/supabase/client';

interface ShopLayoutProps {
  children: ReactNode;
}

export function ShopLayout({ children }: ShopLayoutProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { tenant, themeSettings, navPages, categories, legalPages, isLoading, error } = usePublicStorefront(tenantSlug || '');
  const { aggregate, reviews, connections } = usePublicReviews(tenant?.id);
  const { getCartCount, setTenantSlug, isDrawerOpen, closeDrawer } = useCart();
  const { getWishlistCount } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
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
  const newsletterPopupDelay = ts?.newsletter_popup_delay_seconds || 5;
  const newsletterIncentiveText = ts?.newsletter_incentive_text || null;

  // Set tenant slug for cart context
  useEffect(() => {
    if (tenantSlug) {
      setTenantSlug(tenantSlug);
    }
  }, [tenantSlug, setTenantSlug]);

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

  // Apply theme colors as CSS variables
  useEffect(() => {
    if (themeSettings) {
      const root = document.documentElement;
      if (themeSettings.primary_color) root.style.setProperty('--shop-primary', themeSettings.primary_color);
      if (themeSettings.secondary_color) root.style.setProperty('--shop-secondary', themeSettings.secondary_color);
      if (themeSettings.accent_color) root.style.setProperty('--shop-accent', themeSettings.accent_color);
      if (themeSettings.background_color) root.style.setProperty('--shop-background', themeSettings.background_color);
      if (themeSettings.text_color) root.style.setProperty('--shop-text', themeSettings.text_color);

      const fonts = [themeSettings.heading_font, themeSettings.body_font].filter(Boolean);
      if (fonts.length > 0) {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fonts.map(f => f.replace(' ', '+')).join('&family=')}&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--shop-primary');
      root.style.removeProperty('--shop-secondary');
      root.style.removeProperty('--shop-accent');
      root.style.removeProperty('--shop-background');
      root.style.removeProperty('--shop-text');
    };
  }, [themeSettings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop/${tenantSlug}/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

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

  const basePath = `/shop/${tenantSlug}`;
  const headerStyle = themeSettings?.header_style || 'standard';
  const showAnnouncement = themeSettings?.show_announcement_bar && themeSettings?.announcement_text;
  const announcementTexts = showAnnouncement ? String(themeSettings.announcement_text).split('|').map((t: string) => t.trim()).filter(Boolean) : [];
  const logoUrl = ts?.logo_url || tenant.logo_url;
  const socialLinks = themeSettings?.social_links || {};
  const filledSocialLinks = Object.entries(socialLinks).filter(([, value]) => value && String(value).trim() !== '');

  return (
    <div 
      className={cn("min-h-screen flex flex-col", mobileBottomNav && "pb-14 md:pb-0")}
      style={{
        fontFamily: themeSettings?.body_font ? `"${themeSettings.body_font}", sans-serif` : undefined,
        backgroundColor: themeSettings?.background_color || undefined,
        color: themeSettings?.text_color || undefined,
      }}
    >
      {/* Announcement Bar Carousel */}
      {showAnnouncement && announcementTexts.length > 0 && (
        <AnnouncementCarousel 
          texts={announcementTexts} 
          link={themeSettings?.announcement_link}
          bgColor={themeSettings?.primary_color || 'hsl(var(--primary))'}
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
            />
          ) : headerStyle === 'minimal' ? (
            <MinimalHeader 
              tenant={tenant} basePath={basePath} categories={categories}
              navPages={navPages} themeSettings={themeSettings} logoUrl={logoUrl}
              mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}
              cartCount={cartCount}
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
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-muted/30 border-t mt-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              {logoUrl ? (
                <img src={logoUrl} alt={tenant.name} className="h-10 mb-4" />
              ) : (
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}>
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
                <div className="flex gap-3">
                  {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>}
                  {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>}
                  {socialLinks.twitter && <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>}
                  {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>}
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

          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
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

      {/* Newsletter Popup */}
      {newsletterPopupEnabled && tenantSlug && (
        <NewsletterPopup tenantSlug={tenantSlug} delaySeconds={newsletterPopupDelay} incentiveText={newsletterIncentiveText} />
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
      <CartDrawer open={isDrawerOpen} onOpenChange={closeDrawer} basePath={basePath} currency={tenant?.currency || 'EUR'} />

      {/* Search Modal */}
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} tenantId={tenant?.id} basePath={basePath} currency={tenant?.currency || 'EUR'} />

      {/* Custom CSS */}
      {themeSettings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: themeSettings.custom_css }} />
      )}
    </div>
  );
}

// Announcement Carousel
function AnnouncementCarousel({ texts, link, bgColor }: { texts: string[]; link?: string; bgColor: string }) {
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
      className="py-2 px-4 text-center text-sm overflow-hidden relative h-8 flex items-center justify-center"
      style={{ backgroundColor: bgColor, color: '#ffffff' }}
    >
      <div key={currentIndex} className="animate-fade-in">
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
function StandardHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, searchOpen, setSearchOpen, searchQuery, setSearchQuery, onSearch, cartCount, mobileMenuOpen, setMobileMenuOpen, navStyle, searchDisplay, wishlistCount, onCartClick, onSearchModalOpen }: any) {
  const { openDrawer } = useCart();
  
  return (
    <>
      <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <Link to={basePath} className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="h-8" />
          ) : (
            <span className="font-bold text-xl" style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}>
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
function CenteredHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, cartCount, mobileMenuOpen, setMobileMenuOpen, navStyle }: any) {
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
            <span className="font-bold text-2xl" style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}>{tenant.name}</span>
          )}
        </Link>

        <Button variant="ghost" size="icon" asChild className="relative md:hidden">
          <Link to={`${basePath}/cart`}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </Link>
        </Button>
      </div>

      {/* Desktop nav */}
      {navStyle === 'mega_menu' ? (
        <div className="hidden md:flex justify-center border-t pt-4">
          <MegaMenu categories={categories} basePath={basePath} />
          <Link to={`${basePath}/cart`} className="relative text-sm font-medium hover:text-primary transition-colors ml-6">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </Link>
        </div>
      ) : (
        <nav className="hidden md:flex items-center justify-center gap-8 border-t pt-4">
          <Link to={basePath} className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
          <Link to={`${basePath}/products`} className="text-sm font-medium hover:text-primary transition-colors">Shop</Link>
          {categories.slice(0, 4).map((cat: any) => (
            <Link key={cat.id} to={`${basePath}/products?category=${cat.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{cat.name}</Link>
          ))}
          {navPages.slice(0, 2).map((page: any) => (
            <Link key={page.id} to={`${basePath}/page/${page.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{page.title}</Link>
          ))}
          <Link to={`${basePath}/cart`} className="relative text-sm font-medium hover:text-primary transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </Link>
        </nav>
      )}
    </div>
  );
}

// Minimal Header Component
function MinimalHeader({ tenant, basePath, categories, navPages, themeSettings, logoUrl, mobileMenuOpen, setMobileMenuOpen, cartCount }: any) {
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
          <span className="font-bold text-xl" style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}>{tenant.name}</span>
        )}
      </Link>

      <Button variant="ghost" size="icon" asChild className="relative">
        <Link to={`${basePath}/cart`}>
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </Link>
      </Button>
    </div>
  );
}

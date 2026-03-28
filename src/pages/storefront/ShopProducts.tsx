import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePublicStorefront, usePublicProducts } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { QuickViewModal } from '@/components/storefront/QuickViewModal';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { Helmet } from 'react-helmet-async';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export default function ShopProducts() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant, themeSettings, categories } = usePublicStorefront(tenantSlug || '');
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openDrawer } = useCart();
  
  const categorySlug = searchParams.get('category');
  const searchQuery = searchParams.get('q') || '';
  
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);

  const selectedCategory = categories.find(c => c.slug === categorySlug);

  const { data: products = [], isLoading } = usePublicProducts(tenant?.id, {
    categoryId: selectedCategory?.id,
    search: searchQuery,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (localSearch) {
      params.set('q', localSearch);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setLocalSearch('');
  };

  const hasActiveFilters = categorySlug || searchQuery;
  const basePath = `/shop/${tenantSlug}`;

  const handleQuickView = (product: any) => {
    setQuickViewProduct(product);
  };

  const handleToggleWishlist = (product: any) => {
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      slug: product.slug,
    });
  };

  return (
    <ShopLayout>
      <Helmet>
        <title>{selectedCategory ? `${selectedCategory.name} | ` : ''}Producten | {tenant?.name || 'Shop'}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {(themeSettings as any)?.show_breadcrumbs !== false && (
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={basePath}>Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {selectedCategory ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`${basePath}/products`}>Producten</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedCategory.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>Producten</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 
              className="text-3xl font-bold"
              style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
            >
              {selectedCategory?.name || 'Alle Producten'}
            </h1>
            {selectedCategory?.description && (
              <p className="text-muted-foreground mt-1">{selectedCategory.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {products.length} {products.length === 1 ? 'product' : 'producten'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative">
              <Input
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Zoeken..."
                className="w-full sm:w-64 pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </form>

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <CategoryFilters 
                    categories={categories} 
                    selectedSlug={categorySlug}
                    onSelect={(slug) => {
                      const params = new URLSearchParams(searchParams);
                      if (slug) params.set('category', slug);
                      else params.delete('category');
                      setSearchParams(params);
                      setFiltersOpen(false);
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Actieve filters:</span>
            {selectedCategory && (
              <Button variant="secondary" size="sm" onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('category');
                setSearchParams(params);
              }}>
                {selectedCategory.name}<X className="h-3 w-3 ml-1" />
              </Button>
            )}
            {searchQuery && (
              <Button variant="secondary" size="sm" onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('q');
                setSearchParams(params);
                setLocalSearch('');
              }}>
                "{searchQuery}"<X className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>Alles wissen</Button>
          </div>
        )}

        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          <aside className="hidden md:block">
            <h3 className="font-semibold mb-4">Categorieën</h3>
            <CategoryFilters 
              categories={categories} 
              selectedSlug={categorySlug}
              onSelect={(slug) => {
                const params = new URLSearchParams(searchParams);
                if (slug) params.set('category', slug);
                else params.delete('category');
                setSearchParams(params);
              }}
            />
          </aside>

          <div>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 product-grid-responsive" style={{ '--cols-lg': (themeSettings as any)?.products_per_row || 3 } as React.CSSProperties}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted aspect-square rounded-lg mb-3" />
                    <div className="bg-muted h-4 rounded w-3/4 mb-2" />
                    <div className="bg-muted h-4 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">Geen producten gevonden</p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>Filters wissen</Button>
                )}
              </div>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6"
                style={{ gridTemplateColumns: undefined } as React.CSSProperties}
              >
                {products.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    basePath={basePath}
                    currency={tenant?.currency || 'EUR'}
                    cardStyle={(themeSettings as any)?.product_card_style || 'standard'}
                    onQuickView={handleQuickView}
                    isWishlisted={(themeSettings as any)?.show_wishlist !== false ? isInWishlist(product.id) : undefined}
                    onToggleWishlist={(themeSettings as any)?.show_wishlist !== false ? handleToggleWishlist : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal 
        product={quickViewProduct}
        open={!!quickViewProduct}
        onOpenChange={(open) => { if (!open) setQuickViewProduct(null); }}
        basePath={basePath}
        currency={tenant?.currency || 'EUR'}
        onCartOpen={openDrawer}
      />
    </ShopLayout>
  );
}

function CategoryFilters({ 
  categories, 
  selectedSlug, 
  onSelect 
}: { 
  categories: { id: string; name: string; slug: string; parent_id: string | null }[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const rootCategories = categories.filter(c => !c.parent_id);
  
  return (
    <ul className="space-y-2">
      <li>
        <button
          onClick={() => onSelect(null)}
          className={`text-sm hover:text-primary transition-colors ${!selectedSlug ? 'font-medium text-primary' : 'text-muted-foreground'}`}
        >
          Alle producten
        </button>
      </li>
      {rootCategories.map(category => (
        <li key={category.id}>
          <button
            onClick={() => onSelect(category.slug)}
            className={`text-sm hover:text-primary transition-colors ${selectedSlug === category.slug ? 'font-medium text-primary' : 'text-muted-foreground'}`}
          >
            {category.name}
          </button>
          {categories.filter(c => c.parent_id === category.id).length > 0 && (
            <ul className="ml-4 mt-1 space-y-1">
              {categories.filter(c => c.parent_id === category.id).map(sub => (
                <li key={sub.id}>
                  <button
                    onClick={() => onSelect(sub.slug)}
                    className={`text-sm hover:text-primary transition-colors ${selectedSlug === sub.slug ? 'font-medium text-primary' : 'text-muted-foreground'}`}
                  >
                    {sub.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

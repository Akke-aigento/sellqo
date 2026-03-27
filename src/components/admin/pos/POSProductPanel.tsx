import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, ShoppingCart, Grid3X3, Gift, ChevronRight, ArrowLeft, Star, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import type { Product, Category } from '@/types/product';
import type { POSQuickButton } from '@/types/pos';
import type { POSCartItem } from '@/types/pos';

type POSView = 'super' | 'sub' | 'items' | 'search';

interface POSProductPanelProps {
  products: Product[];
  quickButtons: POSQuickButton[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddToCart: (product: Product) => void;
  onConfigureQuickButtons: () => void;
  onSellGiftCard: () => void;
  activeSession: boolean;
  cart?: POSCartItem[];
  onUpdateQuantity?: (itemId: string, delta: number) => void;
}

export function POSProductPanel({
  products,
  quickButtons,
  searchQuery,
  onSearchChange,
  onAddToCart,
  onConfigureQuickButtons,
  onSellGiftCard,
  activeSession,
  cart = [],
  onUpdateQuantity,
}: POSProductPanelProps) {
  const { categories } = useCategories();
  const [view, setView] = useState<POSView>('super');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  // Build category hierarchy
  const topLevelCategories = useMemo(() => {
    return categories
      .filter(c => !c.parent_id && c.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories]);

  // Count products per category (including children)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
    }
    // For parent categories, also sum children
    for (const cat of topLevelCategories) {
      const childIds = categories.filter(c => c.parent_id === cat.id).map(c => c.id);
      let total = counts[cat.id] || 0;
      for (const cid of childIds) total += counts[cid] || 0;
      counts[`parent_${cat.id}`] = total;
    }
    return counts;
  }, [products, categories, topLevelCategories]);

  const subcategories = useMemo(() => {
    if (!selectedCategoryId) return [];
    return categories
      .filter(c => c.parent_id === selectedCategoryId && c.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories, selectedCategoryId]);

  // Products for current category
  const categoryProducts = useMemo(() => {
    const activeCategory = selectedSubcategoryId || selectedCategoryId;
    if (!activeCategory) return [];
    const childCategoryIds = categories
      .filter(c => c.parent_id === activeCategory)
      .map(c => c.id);
    const allCategoryIds = [activeCategory, ...childCategoryIds];
    return products.filter(p => p.category_id && allCategoryIds.includes(p.category_id));
  }, [products, categories, selectedCategoryId, selectedSubcategoryId]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [products, searchQuery]);

  // Cart quantity lookup
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, { qty: number; itemId: string }>();
    for (const item of cart) {
      map.set(item.product_id, { qty: item.quantity, itemId: item.id });
    }
    return map;
  }, [cart]);

  const getCartQty = useCallback((productId: string) => {
    return cartQuantityMap.get(productId)?.qty || 0;
  }, [cartQuantityMap]);

  const getCartItemId = useCallback((productId: string) => {
    return cartQuantityMap.get(productId)?.itemId;
  }, [cartQuantityMap]);

  // Navigation handlers
  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(null);
    // Check if category has subcategories
    const subs = categories.filter(c => c.parent_id === categoryId && c.is_active);
    if (subs.length > 0) {
      setView('sub');
    } else {
      setView('items');
    }
  }, [categories]);

  const handleSubcategoryClick = useCallback((subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId);
    setView('items');
  }, []);

  const handleBack = useCallback(() => {
    if (view === 'items' && selectedSubcategoryId) {
      setSelectedSubcategoryId(null);
      setView('sub');
    } else if (view === 'items' || view === 'sub') {
      setSelectedCategoryId(null);
      setSelectedSubcategoryId(null);
      setView('super');
    } else if (view === 'search') {
      onSearchChange('');
      setView('super');
    }
  }, [view, selectedSubcategoryId, onSearchChange]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedSubcategory = categories.find(c => c.id === selectedSubcategoryId);

  // Render a product card (touch-optimized)
  const renderProductCard = (product: Product) => {
    const qty = getCartQty(product.id);
    const cartItemId = getCartItemId(product.id);
    const imageUrl = (product as unknown as { image_url?: string }).image_url;

    return (
      <div
        key={product.id}
        role="button"
        tabIndex={0}
        onClick={() => onAddToCart(product)}
        className={cn(
          "relative flex flex-col items-center justify-between p-2 md:p-3 rounded-xl border-2 transition-all min-h-[100px] md:min-h-[110px] cursor-pointer select-none active:scale-95",
          qty > 0 && "border-primary bg-primary/10",
          qty === 0 && "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        {/* Quantity badge */}
        {qty > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow z-10">
            {qty}
          </div>
        )}

        {/* Image or fallback */}
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" />
        ) : (
          <Package className="w-6 h-6 text-muted-foreground mt-1" />
        )}

        {/* Name */}
        <span className="font-medium text-xs sm:text-sm text-center line-clamp-2 break-words leading-tight">
          {product.name}
        </span>

        {/* Price */}
        <span className="text-primary font-semibold text-xs sm:text-sm">
          {formatCurrency(product.price)}
        </span>

        {/* Plus indicator */}
        <div className="absolute bottom-0.5 right-0.5 text-muted-foreground/50 text-sm">+</div>

        {/* Minus button when in cart */}
        {qty > 0 && cartItemId && onUpdateQuantity && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateQuantity(cartItemId, -1);
            }}
            className="absolute bottom-0.5 left-0.5 w-6 h-6 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-xs font-bold transition-colors"
          >
            −
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* View Header */}
      {view !== 'super' && (
        <div className="flex items-center gap-3 p-3 border-b bg-muted/30 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Terug
          </Button>
          {view === 'sub' && selectedCategory && (
            <span className="font-semibold text-lg">{selectedCategory.name}</span>
          )}
          {view === 'items' && (
            <span className="font-semibold text-lg">
              {selectedSubcategory?.name || selectedCategory?.name}
            </span>
          )}
          {view === 'search' && (
            <span className="font-semibold text-lg">Zoeken</span>
          )}
        </div>
      )}

      {/* Search bar - always visible */}
      {view === 'search' ? (
        <div className="p-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek product of scan barcode..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {/* SUPER VIEW: Category tiles */}
        {view === 'super' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Quick Buttons tile */}
            {quickButtons.length > 0 && (
              <button
                onClick={() => {/* Could show quick buttons as a separate view */}}
                className="flex flex-col items-center justify-center gap-2 p-4 min-h-[100px] rounded-xl border-2 border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-all active:scale-95"
              >
                <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-foreground">Snelknoppen</span>
                <span className="text-xs text-muted-foreground">{quickButtons.length} items</span>
              </button>
            )}

            {/* Gift Card tile */}
            <button
              onClick={onSellGiftCard}
              disabled={!activeSession}
              className="flex flex-col items-center justify-center gap-2 p-4 min-h-[100px] rounded-xl border-2 border-primary/50 bg-primary/5 hover:bg-primary/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <Gift className="w-8 h-8 text-primary" />
              <span className="font-semibold text-foreground">Cadeaukaart</span>
              <span className="text-xs text-muted-foreground">Verkopen</span>
            </button>

            {/* Category tiles */}
            {topLevelCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className="flex flex-col items-center justify-center gap-2 p-4 min-h-[100px] rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <span className="text-3xl">{cat.image_url ? '📦' : '📁'}</span>
                <span className="font-semibold text-foreground text-sm text-center line-clamp-2">{cat.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({categoryCounts[`parent_${cat.id}`] || 0})
                </span>
              </button>
            ))}

            {/* Search tile */}
            <button
              onClick={() => { setView('search'); }}
              className="flex flex-col items-center justify-center gap-2 p-4 min-h-[100px] rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
            >
              <Search className="w-8 h-8 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">Zoeken</span>
              <span className="text-xs text-muted-foreground">Product of barcode</span>
            </button>

            {/* Configure quick buttons tile */}
            <button
              onClick={onConfigureQuickButtons}
              className="flex flex-col items-center justify-center gap-2 p-4 min-h-[100px] rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
            >
              <Grid3X3 className="w-8 h-8 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">Configureren</span>
              <span className="text-xs text-muted-foreground">Snelknoppen</span>
            </button>
          </div>
        )}

        {/* SUB VIEW: Subcategory tiles */}
        {view === 'sub' && selectedCategoryId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* "All in category" tile */}
            <button
              onClick={() => {
                setSelectedSubcategoryId(null);
                setView('items');
              }}
              className="flex flex-col items-center justify-center gap-2 p-4 min-h-[90px] rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all active:scale-95"
            >
              <Package className="w-6 h-6 text-primary" />
              <span className="font-medium text-foreground text-sm text-center">Alles</span>
              <span className="text-xs text-muted-foreground">
                ({categoryCounts[`parent_${selectedCategoryId}`] || 0})
              </span>
            </button>

            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleSubcategoryClick(sub.id)}
                className="flex flex-col items-center justify-center gap-2 p-4 min-h-[90px] rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <span className="text-2xl">📁</span>
                <span className="font-medium text-foreground text-sm text-center line-clamp-2">{sub.name}</span>
                <span className="text-xs text-muted-foreground">({categoryCounts[sub.id] || 0})</span>
              </button>
            ))}
          </div>
        )}

        {/* ITEMS VIEW: Product grid */}
        {view === 'items' && (
          <>
            {categoryProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Geen producten in deze categorie</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {categoryProducts.map(renderProductCard)}
              </div>
            )}
          </>
        )}

        {/* SEARCH VIEW: Search results */}
        {view === 'search' && (
          <>
            {!searchQuery.trim() ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Search className="w-12 h-12 opacity-30" />
                <span>Typ een productnaam, SKU of barcode</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                Geen resultaten voor "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {searchResults.map(renderProductCard)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick buttons row at bottom (super view, if any exist) */}
      {view === 'super' && quickButtons.length > 0 && (
        <div className="border-t p-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {quickButtons.map((button) => (
              <button
                key={button.id}
                className="shrink-0 flex flex-col items-center justify-center p-2 rounded-xl border-2 min-w-[70px] min-h-[60px] hover:bg-primary/5 active:scale-95 transition-all"
                style={{ borderColor: button.color || 'hsl(var(--border))' }}
                onClick={() => button.product && onAddToCart(button.product as unknown as Product)}
              >
                <span className="text-xs font-medium text-center line-clamp-1">{button.label}</span>
                {button.product && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(button.product.price)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

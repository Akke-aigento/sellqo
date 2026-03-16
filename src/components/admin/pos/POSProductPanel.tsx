import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, ShoppingCart, Grid3X3, Gift, ChevronRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import type { Product, Category } from '@/types/product';
import type { POSQuickButton } from '@/types/pos';

interface POSProductPanelProps {
  products: Product[];
  quickButtons: POSQuickButton[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddToCart: (product: Product) => void;
  onConfigureQuickButtons: () => void;
  onSellGiftCard: () => void;
  activeSession: boolean;
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
}: POSProductPanelProps) {
  const { categories } = useCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [showCategoryView, setShowCategoryView] = useState(false);

  // Build category hierarchy
  const topLevelCategories = useMemo(() => {
    return categories
      .filter(c => !c.parent_id && c.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories]);

  const subcategories = useMemo(() => {
    if (!selectedCategoryId) return [];
    return categories
      .filter(c => c.parent_id === selectedCategoryId && c.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories, selectedCategoryId]);

  // Get product category assignments - use product.category_id
  const categoryProducts = useMemo(() => {
    const activeCategory = selectedSubcategoryId || selectedCategoryId;
    if (!activeCategory) return [];

    // If it's a parent category, also include products from child categories
    const childCategoryIds = categories
      .filter(c => c.parent_id === activeCategory)
      .map(c => c.id);
    const allCategoryIds = [activeCategory, ...childCategoryIds];

    return products.filter(p => p.category_id && allCategoryIds.includes(p.category_id));
  }, [products, categories, selectedCategoryId, selectedSubcategoryId]);

  // Search results
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(null);
    setShowCategoryView(true);
  }, []);

  const handleBackToCategories = useCallback(() => {
    if (selectedSubcategoryId) {
      setSelectedSubcategoryId(null);
    } else {
      setSelectedCategoryId(null);
      setShowCategoryView(false);
    }
  }, [selectedSubcategoryId]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedSubcategory = categories.find(c => c.id === selectedSubcategoryId);

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek product of scan barcode..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* Search Results Dropdown */}
        {filteredProducts.length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg">
            <CardContent className="p-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left"
                  onClick={() => {
                    onAddToCart(product);
                    onSearchChange('');
                  }}
                >
                  {(product as unknown as { image_url?: string }).image_url ? (
                    <img
                      src={(product as unknown as { image_url?: string }).image_url!}
                      alt={product.name}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{product.sku}</p>
                  </div>
                  <p className="font-semibold shrink-0 whitespace-nowrap">{formatCurrency(product.price)}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Buttons */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Snelknoppen</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onConfigureQuickButtons}
            className="h-7 text-xs"
          >
            <Grid3X3 className="mr-1 h-3 w-3" />
            Configureren
          </Button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {quickButtons.map((button) => (
            <button
              key={button.id}
              className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors"
              style={{ borderColor: button.color || 'hsl(var(--border))' }}
              onClick={() => button.product && onAddToCart(button.product as unknown as Product)}
            >
              <span className="text-xs font-medium text-center line-clamp-2">
                {button.label}
              </span>
              {button.product && (
                <span className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(button.product.price)}
                </span>
              )}
            </button>
          ))}
          {/* Gift Card Sell Button */}
          <button
            className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors"
            style={{ borderColor: 'hsl(var(--primary))' }}
            onClick={onSellGiftCard}
            disabled={!activeSession}
          >
            <Gift className="h-5 w-5 mb-1 text-primary" />
            <span className="text-xs font-medium text-center">Cadeaukaart</span>
            <span className="text-[10px] text-muted-foreground">Verkopen</span>
          </button>
          {quickButtons.length === 0 && (
            <button
              className="col-span-2 aspect-[2/1] rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 hover:bg-muted transition-colors text-muted-foreground"
              onClick={onConfigureQuickButtons}
            >
              <Plus className="h-4 w-4 mb-1" />
              <span className="text-xs">Snelknop toevoegen</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation + Product Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Category Chips / Breadcrumb */}
        {!showCategoryView ? (
          <>
            {topLevelCategories.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">Categorieën</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topLevelCategories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleCategoryClick(cat.id)}
                    >
                      {cat.name}
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 mb-2 text-sm">
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => { setSelectedCategoryId(null); setSelectedSubcategoryId(null); setShowCategoryView(false); }}
              >
                Alle
              </button>
              {selectedCategory && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <button
                    className={`hover:underline font-medium ${selectedSubcategoryId ? 'text-primary' : 'text-foreground'}`}
                    onClick={() => setSelectedSubcategoryId(null)}
                  >
                    {selectedCategory.name}
                  </button>
                </>
              )}
              {selectedSubcategory && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">{selectedSubcategory.name}</span>
                </>
              )}
            </div>

            {/* Subcategory chips if parent is selected and has children */}
            {selectedCategoryId && !selectedSubcategoryId && subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedSubcategoryId(null)}
                >
                  Alles in {selectedCategory?.name}
                </Button>
                {subcategories.map((sub) => (
                  <Button
                    key={sub.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedSubcategoryId(sub.id)}
                  >
                    {sub.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Product Grid */}
        {showCategoryView && (
          <ScrollArea className="flex-1">
            {categoryProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Geen producten in deze categorie</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pb-4">
                {categoryProducts.map((product) => (
                  <button
                    key={product.id}
                    className="flex flex-col items-center p-2 rounded-lg border hover:bg-muted transition-colors text-center group"
                    onClick={() => onAddToCart(product)}
                  >
                    {(product as unknown as { image_url?: string }).image_url ? (
                      <img
                        src={(product as unknown as { image_url?: string }).image_url!}
                        alt={product.name}
                        className="w-16 h-16 rounded object-cover mb-1"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center mb-1">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">{product.name}</p>
                    <p className="text-xs text-muted-foreground font-semibold mt-auto">{formatCurrency(product.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {!showCategoryView && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Zoek een product, scan een barcode,</p>
              <p className="text-sm">of selecteer een categorie</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

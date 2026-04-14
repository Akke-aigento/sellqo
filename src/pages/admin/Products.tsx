import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff,
  Star,
  Package,
  Filter,
  Download,
  Settings2,
  List,
  Grid3X3,
  Sparkles,
  XCircle,
  X,
  ImageIcon,
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useTenant } from '@/hooks/useTenant';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { ProductBulkEditDialog } from '@/components/admin/products/ProductBulkEditDialog';
import { BulkAIGenerateDialog } from '@/components/admin/products/BulkAIGenerateDialog';
import { ProductGridView } from '@/components/admin/products/grid/ProductGridView';
import type { BulkEditState } from '@/components/admin/products/bulk/BulkEditTypes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Product, ProductStatus, StockStatus, VisibilityStatus } from '@/types/product';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductPhotosManager } from '@/components/admin/products/ProductPhotosManager';

export default function ProductsPage() {
  const { currentTenant } = useTenant();
  const { isOverLimit, isTrialing } = useUsageLimits();
  const isMobile = useIsMobile();
  const { 
    products, 
    isLoading, 
    deleteProduct, 
    bulkUpdateProducts, 
    bulkDeleteProducts,
    bulkAdjustPrices,
    bulkAdjustStock,
    bulkUpdateTags,
    bulkUpdateSocialChannels,
  } = useProducts();
  const { categories } = useCategories();
  
  // Persist filters in sessionStorage so they survive navigation to product detail and back
  const FILTER_KEY = 'admin-products-filters';
  
  const loadFilters = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(FILTER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  }, []);

  const saveFilters = useCallback((filters: Record<string, string>) => {
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch {}
  }, []);

  const initial = loadFilters();
  const [search, setSearchRaw] = useState(initial.search || '');
  const [statusFilter, setStatusFilterRaw] = useState<ProductStatus>(initial.statusFilter || 'all');
  const [visibilityFilter, setVisibilityFilterRaw] = useState<VisibilityStatus>(initial.visibilityFilter || 'all');
  const [stockFilter, setStockFilterRaw] = useState<StockStatus>(initial.stockFilter || 'all');
  const [categoryFilter, setCategoryFilterRaw] = useState<string>(initial.categoryFilter || 'all');
  const [viewMode, setViewModeRaw] = useState<'list' | 'grid'>(initial.viewMode || 'list');

  const updateFilter = useCallback((key: string, value: string) => {
    const current = loadFilters();
    saveFilters({ ...current, [key]: value });
  }, [loadFilters, saveFilters]);

  const setSearch = useCallback((v: string) => { setSearchRaw(v); updateFilter('search', v); }, [updateFilter]);
  const setStatusFilter = useCallback((v: ProductStatus) => { setStatusFilterRaw(v); updateFilter('statusFilter', v); }, [updateFilter]);
  const setVisibilityFilter = useCallback((v: VisibilityStatus) => { setVisibilityFilterRaw(v); updateFilter('visibilityFilter', v); }, [updateFilter]);
  const setStockFilter = useCallback((v: StockStatus) => { setStockFilterRaw(v); updateFilter('stockFilter', v); }, [updateFilter]);
  const setCategoryFilter = useCallback((v: string) => { setCategoryFilterRaw(v); updateFilter('categoryFilter', v); }, [updateFilter]);
  const setViewMode = useCallback((v: 'list' | 'grid') => { setViewModeRaw(v); updateFilter('viewMode', v); }, [updateFilter]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkAIDialogOpen, setBulkAIDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState('catalog');

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(searchLower) ||
          product.sku?.toLowerCase().includes(searchLower) ||
          product.barcode?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter === 'active' && !product.is_active) return false;
      if (statusFilter === 'inactive' && product.is_active) return false;

      // Visibility filter
      const hideFromStorefront = (product as any).hide_from_storefront || false;
      if (visibilityFilter === 'online' && (hideFromStorefront || !product.is_active)) return false;
      if (visibilityFilter === 'store_only' && (!hideFromStorefront || !product.is_active)) return false;
      if (visibilityFilter === 'hidden' && product.is_active) return false;

      // Stock filter (variant-aware)
      const activeVariants = product.product_variants?.filter(v => v.is_active) || [];
      const effectiveStock = activeVariants.length > 0
        ? activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : product.stock;
      if (stockFilter === 'out_of_stock' && effectiveStock > 0) return false;
      if (stockFilter === 'low_stock' && (effectiveStock === 0 || effectiveStock > product.low_stock_threshold)) return false;
      if (stockFilter === 'in_stock' && effectiveStock <= 0) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        const allCategoryIds = (product as any).product_categories?.map((pc: any) => pc.category_id) || [];
        if (!allCategoryIds.includes(categoryFilter) && product.category_id !== categoryFilter) return false;
      }

      return true;
    });
  }, [products, search, statusFilter, visibilityFilter, stockFilter, categoryFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk actions
  const handleBulkActivate = () => {
    bulkUpdateProducts.mutate({ ids: Array.from(selectedIds), data: { is_active: true } });
    setSelectedIds(new Set());
  };

  const handleBulkDeactivate = () => {
    bulkUpdateProducts.mutate({ ids: Array.from(selectedIds), data: { is_active: false } });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    bulkDeleteProducts.mutate(Array.from(selectedIds));
    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
  };

  const handleBulkEdit = async (state: BulkEditState, enabledFields: Set<string>) => {
    const ids = Array.from(selectedIds);
    
    // Process each enabled field
    if (enabledFields.has('price_adjustment') && state.price_adjustment) {
      await bulkAdjustPrices.mutateAsync({
        ids,
        adjustmentType: state.price_adjustment.type,
        adjustmentValue: state.price_adjustment.value,
      });
    }
    
    if (enabledFields.has('compare_at_price') && state.compare_at_price_action) {
      await bulkAdjustPrices.mutateAsync({
        ids,
        adjustmentType: state.compare_at_price_action,
        adjustmentValue: state.compare_at_price_value || 0,
        priceField: 'compare_at_price',
      });
    }
    
    if (enabledFields.has('cost_price') && state.cost_price_action) {
      await bulkAdjustPrices.mutateAsync({
        ids,
        adjustmentType: state.cost_price_action,
        adjustmentValue: state.cost_price || 0,
        priceField: 'cost_price',
      });
    }
    
    if (enabledFields.has('stock_adjustment') && state.stock_adjustment) {
      // Filter out products that have active variants — stock is managed at variant level
      const productsWithoutVariants = ids.filter(id => {
        const product = products?.find(p => p.id === id);
        const hasActiveVariants = product?.product_variants?.some(v => v.is_active);
        return !hasActiveVariants;
      });
      const skippedCount = ids.length - productsWithoutVariants.length;
      
      if (productsWithoutVariants.length > 0) {
        await bulkAdjustStock.mutateAsync({
          ids: productsWithoutVariants,
          adjustmentType: state.stock_adjustment.type,
          adjustmentValue: state.stock_adjustment.value,
        });
      }
      
      if (skippedCount > 0) {
        toast({
          title: 'Let op',
          description: `${skippedCount} product(en) overgeslagen — voorraad wordt per variant beheerd.`,
        });
      }
    }
    
    if (enabledFields.has('tags_to_add') || enabledFields.has('tags_to_remove')) {
      await bulkUpdateTags.mutateAsync({
        ids,
        tagsToAdd: state.tags_to_add || [],
        tagsToRemove: state.tags_to_remove || [],
      });
    }
    
    if (enabledFields.has('tags_replace_all') && state.tags_replace_all) {
      await bulkUpdateTags.mutateAsync({
        ids,
        replaceAll: true,
        replacementTags: state.tags_replace_all,
      });
    }
    
    if (enabledFields.has('social_channels') && state.social_channels) {
      await bulkUpdateSocialChannels.mutateAsync({
        ids,
        socialChannels: state.social_channels,
      });
    }
    
    // Simple field updates via bulkUpdateProducts
    const simpleUpdates: Record<string, any> = {};
    if (enabledFields.has('category_id')) simpleUpdates.category_id = state.category_id;
    if (enabledFields.has('vat_rate_id')) simpleUpdates.vat_rate_id = state.vat_rate_id;
    if (enabledFields.has('product_type')) simpleUpdates.product_type = state.product_type;
    if (enabledFields.has('is_active')) simpleUpdates.is_active = state.is_active;
    if (enabledFields.has('hide_from_storefront')) simpleUpdates.hide_from_storefront = state.hide_from_storefront;
    if (enabledFields.has('is_featured')) simpleUpdates.is_featured = state.is_featured;
    if (enabledFields.has('requires_shipping')) simpleUpdates.requires_shipping = state.requires_shipping;
    if (enabledFields.has('track_inventory')) simpleUpdates.track_inventory = state.track_inventory;
    if (enabledFields.has('allow_backorder')) simpleUpdates.allow_backorder = state.allow_backorder;
    if (enabledFields.has('low_stock_threshold')) simpleUpdates.low_stock_threshold = state.low_stock_threshold;
    
    if (Object.keys(simpleUpdates).length > 0) {
      await bulkUpdateProducts.mutateAsync({ ids, data: simpleUpdates });
    }
    
    setSelectedIds(new Set());
  };

  const handleDeleteProduct = () => {
    if (productToDelete) {
      deleteProduct.mutate(productToDelete.id);
      setProductToDelete(null);
    }
  };

  // Calculate effective stock (variant-aware)
  const getEffectiveStock = (product: Product): number => {
    const activeVariants = product.product_variants?.filter(v => v.is_active) || [];
    if (activeVariants.length > 0) {
      return activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    return product.stock;
  };

  // Stock badge color
  const getStockBadge = (product: Product) => {
    const activeVariants = product.product_variants?.filter(v => v.is_active) || [];
    const hasVariants = activeVariants.length > 0;
    const effectiveStock = getEffectiveStock(product);

    if (effectiveStock === 0) {
      return <Badge variant="destructive">Uitverkocht</Badge>;
    }
    if (effectiveStock <= product.low_stock_threshold) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600">
          {effectiveStock} stuks{hasVariants ? ` (${activeVariants.length} var.)` : ''}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        {effectiveStock} stuks{hasVariants ? ` (${activeVariants.length} var.)` : ''}
      </Badge>
    );
  };

  // Visibility badge
  const getVisibilityBadge = (product: Product) => {
    const hideFromStorefront = (product as any).hide_from_storefront || false;
    if (!product.is_active) {
      return <Badge variant="secondary">Inactief</Badge>;
    }
    if (hideFromStorefront) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Alleen winkel</Badge>;
    }
    return <Badge variant="default">Online</Badge>;
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(price);
  };

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecteer eerst een winkel</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${selectedIds.size > 0 ? 'pb-20' : ''}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Producten</h1>
          <p className="text-muted-foreground">
            Beheer je productcatalogus
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as 'list' | 'grid')}
            className="border rounded-md"
          >
            <ToggleGroupItem value="list" aria-label="Lijstweergave" className="px-3">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Rasterweergave" className="px-3">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          {isOverLimit('products') && !isTrialing ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>
                    <Plus className="mr-2 h-4 w-4" />
                    Nieuw product
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Limiet bereikt — upgrade je plan</TooltipContent>
            </Tooltip>
          ) : (
            <Button asChild>
              <Link to="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Nieuw product
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalog">
            <Package className="mr-1.5 h-4 w-4" />
            Catalogus
          </TabsTrigger>
          <TabsTrigger value="photos">
            <ImageIcon className="mr-1.5 h-4 w-4" />
            Foto's
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6 mt-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, SKU of barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProductStatus)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="active">Actief</SelectItem>
              <SelectItem value="inactive">Inactief</SelectItem>
            </SelectContent>
          </Select>
          <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as VisibilityStatus)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Zichtbaarheid" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle zichtbaarheid</SelectItem>
              <SelectItem value="online">Online zichtbaar</SelectItem>
              <SelectItem value="store_only">Alleen winkel</SelectItem>
              <SelectItem value="hidden">Verborgen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockStatus)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Voorraad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle voorraad</SelectItem>
              <SelectItem value="in_stock">Op voorraad</SelectItem>
              <SelectItem value="low_stock">Laag</SelectItem>
              <SelectItem value="out_of_stock">Uitverkocht</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle categorieën</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Floating Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 border-t bg-background shadow-lg animate-in slide-in-from-bottom-2 lg:left-[var(--sidebar-width,280px)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedIds(new Set())}
            className="absolute top-1 right-1 h-7 w-7 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 pr-10 max-w-screen-xl mx-auto">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} geselecteerd
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setBulkEditDialogOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Bewerken
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                <Eye className="mr-2 h-4 w-4" />
                Activeren
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
                <EyeOff className="mr-2 h-4 w-4" />
                Deactiveren
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAIDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                AI Genereer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="min-h-[400px]">
          <ProductGridView products={filteredProducts} />
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                {products.length === 0 ? 'Nog geen producten.' : 'Geen producten gevonden met deze filters'}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                    />
                  </div>
                  {product.featured_image ? (
                    <img src={product.featured_image} alt={product.name} className="h-12 w-12 rounded object-cover shrink-0" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/admin/products/${product.id}/edit`} className="font-medium text-sm truncate hover:underline">
                        {product.name}
                      </Link>
                      <span className="font-medium text-sm shrink-0">{formatPrice(product.price)}</span>
                    </div>
                    {product.sku && <div className="text-xs text-muted-foreground mt-0.5">{product.sku}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {getStockBadge(product)}
                      {getVisibilityBadge(product)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/products/${product.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Bewerken
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setProductToDelete(product)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-16">Afbeelding</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">SKU</TableHead>
                <TableHead className="hidden lg:table-cell">Categorie</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
                <TableHead>Voorraad</TableHead>
                <TableHead className="hidden sm:table-cell">Zichtbaarheid</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  </TableRow>
                ))
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {products.length === 0 
                          ? 'Nog geen producten. Voeg je eerste product toe!'
                          : 'Geen producten gevonden met deze filters'}
                      </p>
                      {products.length === 0 && (
                        <Button asChild size="sm">
                          <Link to="/admin/products/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Product toevoegen
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {product.featured_image ? (
                        <img
                          src={product.featured_image}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <Link 
                            to={`/admin/products/${product.id}/edit`}
                            className="font-medium hover:underline"
                          >
                            {product.name}
                          </Link>
                          {product.is_featured && (
                            <Star className="ml-1 inline h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {product.sku || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {(product as any).product_categories?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(product as any).product_categories
                            .slice(0, 3)
                            .map((pc: any) => {
                              const cat = categories.find(c => c.id === pc.category_id);
                              return cat ? (
                                <Badge key={cat.id} variant="outline" className="text-xs">{cat.name}</Badge>
                              ) : null;
                            })}
                          {(product as any).product_categories.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(product as any).product_categories.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : product.category ? (
                        <Badge variant="outline">{product.category.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {product.product_type === 'bundle' && product.bundle_pricing_model === 'dynamic' ? (
                        <span className="text-muted-foreground text-xs italic">Dynamisch</span>
                      ) : (
                        <>
                          {formatPrice(product.price)}
                          {product.compare_at_price && (
                            <span className="ml-2 text-sm text-muted-foreground line-through">
                              {formatPrice(product.compare_at_price)}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>{getStockBadge(product)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{getVisibilityBadge(product)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/products/${product.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bewerken
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setProductToDelete(product)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

        </TabsContent>

        <TabsContent value="photos" className="mt-6">
          <ProductPhotosManager />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Producten verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedIds.size} product(en) wilt verwijderen? 
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductBulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onApply={handleBulkEdit}
      />

      <BulkAIGenerateDialog
        open={bulkAIDialogOpen}
        onOpenChange={setBulkAIDialogOpen}
        products={filteredProducts.filter(p => selectedIds.has(p.id))}
        categories={categories}
        onComplete={() => {
          setSelectedIds(new Set());
        }}
      />

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Product verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{productToDelete?.name}" wilt verwijderen? 
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

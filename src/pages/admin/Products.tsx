import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useTenant } from '@/hooks/useTenant';
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

export default function ProductsPage() {
  const { currentTenant } = useTenant();
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
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityStatus>('all');
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkAIDialogOpen, setBulkAIDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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

      // Stock filter
      if (stockFilter === 'out_of_stock' && product.stock > 0) return false;
      if (stockFilter === 'low_stock' && (product.stock === 0 || product.stock > product.low_stock_threshold)) return false;
      if (stockFilter === 'in_stock' && product.stock <= 0) return false;

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
      await bulkAdjustStock.mutateAsync({
        ids,
        adjustmentType: state.stock_adjustment.type,
        adjustmentValue: state.stock_adjustment.value,
      });
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

  // Stock badge color
  const getStockBadge = (product: Product) => {
    if (product.stock === 0) {
      return <Badge variant="destructive">Uitverkocht</Badge>;
    }
    if (product.stock <= product.low_stock_threshold) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">{product.stock} stuks</Badge>;
    }
    return <Badge variant="secondary">{product.stock} stuks</Badge>;
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
    <div className="space-y-6">
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
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Nieuw product
            </Link>
          </Button>
        </div>
      </div>

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

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
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
      )}

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="min-h-[400px]">
          <ProductGridView products={filteredProducts} />
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

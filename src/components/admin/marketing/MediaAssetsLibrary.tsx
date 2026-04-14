import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Search, FolderOpen, Star, Image as ImageIcon, Sparkles, MoreHorizontal, Trash2, Heart, Download, Copy, Grid, List, Package, Wand2, X, Eraser, Loader2, FolderTree } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Checkbox } from '@/components/ui/checkbox';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { useAIImages } from '@/hooks/useAIImages';
import { useAICredits } from '@/hooks/useAICredits';
import { ImageEditorDialog } from '@/components/admin/products/ImageEditorDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const folderConfig = [
  { id: 'all', label: 'Alles', icon: FolderOpen },
  { id: 'products', label: 'Producten', icon: Package },
  { id: 'categories', label: 'Categorieën', icon: FolderTree },
  { id: 'campaigns', label: 'Campagnes', icon: Sparkles },
  { id: 'social', label: 'Social', icon: ImageIcon },
  { id: 'favorites', label: 'Favorieten', icon: Star },
];

interface VirtualAsset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  title: string | null;
  tags: string[];
  is_ai_generated: boolean;
  is_favorite: boolean;
  source: 'upload' | 'product' | 'category';
  productId?: string;
  productName?: string;
  categoryName?: string;
}

function AssetCard({ asset, onToggleFavorite, onDelete, onEdit, selected, onSelect, selectionActive }: { 
  asset: VirtualAsset; 
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  selected: boolean;
  onSelect: () => void;
  selectionActive: boolean;
}) {
  const isProduct = asset.source === 'product';
  const isCategory = asset.source === 'category';

  const handleClick = () => {
    if (selectionActive) {
      onSelect();
    }
  };

  return (
    <Card 
      className={cn(
        "group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer",
        selected && "ring-2 ring-primary"
      )}
      onClick={handleClick}
    >
      <AspectRatio ratio={1}>
        <div className="relative w-full h-full bg-muted">
          {asset.file_type.startsWith('image/') || isProduct || isCategory ? (
            <img 
              src={asset.file_url} 
              alt={asset.title || asset.file_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Checkbox overlay */}
          <div 
            className={cn(
              "absolute top-2 right-2 z-10 transition-opacity",
              selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onSelect()}
              className="h-5 w-5 bg-background/80 backdrop-blur-sm border-2"
            />
          </div>

          {/* Overlay - hide when selection is active */}
          {!selectionActive && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onEdit && (
                <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Wand2 className="h-4 w-4" />
                </Button>
              )}
              {!isProduct && onToggleFavorite && (
                <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                  <Heart className={cn('h-4 w-4', asset.is_favorite && 'fill-red-500 text-red-500')} />
                </Button>
              )}
              <Button 
                size="icon" variant="secondary" className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(asset.file_url); toast.success('URL gekopieerd'); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {!isProduct && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a href={asset.file_url} download={asset.file_name} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-2" />Downloaden
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />Verwijderen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {isProduct && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">
                <Package className="h-2.5 w-2.5 mr-0.5" />
                Product
              </Badge>
            )}
            {isCategory && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                <FolderTree className="h-2.5 w-2.5 mr-0.5" />
                Categorie
              </Badge>
            )}
            {asset.is_ai_generated && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
              </Badge>
            )}
            {asset.is_favorite && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                <Star className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
        </div>
      </AspectRatio>
      <CardContent className="p-2">
        <p className="text-xs font-medium truncate">{asset.title || asset.file_name}</p>
        {isProduct && asset.productName && (
          <p className="text-[10px] text-muted-foreground truncate">{asset.productName}</p>
        )}
        {isCategory && asset.categoryName && (
          <p className="text-[10px] text-muted-foreground truncate">{asset.categoryName}</p>
        )}
        {asset.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {asset.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MediaAssetsLibrary() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<VirtualAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  
  const { assets, isLoading, createAsset, toggleFavorite, deleteAsset } = useMediaAssets(folder);
  const { uploadImage, uploading } = useImageUpload();
  const { products: productsList, isLoading: productsLoading } = useProducts();
  const { categories } = useCategories();
  const { generateImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('image_enhancement');

  // Convert product images to virtual assets
  const productAssets = useMemo<VirtualAsset[]>(() => {
    if (folder !== 'all' && folder !== 'products') return [];
    return productsList.flatMap(product => 
      (product.images || []).map((url, idx) => ({
        id: `product-${product.id}-${idx}`,
        file_name: `${product.name}-${idx + 1}.jpg`,
        file_url: url,
        file_type: 'image/jpeg',
        file_size: null,
        title: product.name,
        tags: [],
        is_ai_generated: false,
        is_favorite: false,
        source: 'product' as const,
        productId: product.id,
        productName: product.name,
      }))
    );
  }, [productsList, folder]);

  // Convert category images to virtual assets
  const categoryAssets = useMemo<VirtualAsset[]>(() => {
    if (folder !== 'all' && folder !== 'categories') return [];
    return (categories || [])
      .filter(cat => cat.image_url)
      .map(cat => ({
        id: `category-${cat.id}`,
        file_name: `${cat.name}.jpg`,
        file_url: cat.image_url!,
        file_type: 'image/jpeg',
        file_size: null,
        title: cat.name,
        tags: [],
        is_ai_generated: false,
        is_favorite: false,
        source: 'category' as const,
        categoryName: cat.name,
      }));
  }, [categories, folder]);

  // Convert media assets to virtual assets
  const mediaVirtualAssets = useMemo<VirtualAsset[]>(() => {
    return assets.map(a => ({
      id: a.id,
      file_name: a.file_name,
      file_url: a.file_url,
      file_type: a.file_type,
      file_size: a.file_size,
      title: a.title,
      tags: a.tags,
      is_ai_generated: a.is_ai_generated,
      is_favorite: a.is_favorite,
      source: 'upload' as const,
    }));
  }, [assets]);

  // Merge and filter
  const allAssets = useMemo(() => {
    let combined: VirtualAsset[];
    if (folder === 'products') combined = productAssets;
    else if (folder === 'categories') combined = categoryAssets;
    else combined = [...mediaVirtualAssets, ...productAssets, ...categoryAssets];
    if (!search) return combined;
    const q = search.toLowerCase();
    return combined.filter(a =>
      a.file_name.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.productName?.toLowerCase().includes(q) ||
      a.categoryName?.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [mediaVirtualAssets, productAssets, categoryAssets, folder, search]);

  const selectionActive = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === allAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allAssets.map(a => a.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedAssets = useMemo(() => 
    allAssets.filter(a => selectedIds.has(a.id)),
    [allAssets, selectedIds]
  );

  const handleBulkDelete = async () => {
    const deletable = selectedAssets.filter(a => a.source === 'upload');
    if (deletable.length === 0) {
      toast.error('Geen verwijderbare assets geselecteerd');
      return;
    }
    let success = 0;
    for (const asset of deletable) {
      try {
        await deleteAsset.mutateAsync(asset.id);
        success++;
      } catch {
        // continue
      }
    }
    toast.success(`${success} van ${deletable.length} assets verwijderd`);
    clearSelection();
  };

  const handleBulkDownload = () => {
    for (const asset of selectedAssets) {
      window.open(asset.file_url, '_blank');
    }
  };

  const handleBulkRemoveBackground = async () => {
    const totalCredits = selectedAssets.length * creditCost;
    if (!hasCredits(totalCredits)) {
      toast.error('Onvoldoende AI credits');
      return;
    }

    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: selectedAssets.length });
    let success = 0;

    for (const asset of selectedAssets) {
      try {
        await generateImage.mutateAsync({
          prompt: 'Remove the background completely, make it transparent',
          sourceImageUrl: asset.file_url,
          enhancementType: 'background_remove',
          settingPreset: 'transparent',
        });
        success++;
      } catch {
        // continue
      }
      setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    setBulkProcessing(false);
    toast.success(`${success} van ${selectedAssets.length} achtergronden verwijderd`);
    clearSelection();
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!currentTenant?.id) return;
    for (const file of acceptedFiles) {
      const url = await uploadImage(file, 'marketing-assets');
      if (url) {
        await createAsset.mutateAsync({
          tenant_id: currentTenant.id,
          file_name: file.name,
          file_url: url,
          file_type: file.type,
          file_size: file.size,
          source: 'upload',
          folder: folder === 'all' || folder === 'favorites' || folder === 'products' ? 'general' : folder,
          tags: [],
          is_ai_generated: false,
          is_favorite: false,
        });
      }
    }
  }, [currentTenant?.id, folder, uploadImage, createAsset]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    disabled: uploading,
  });

  const handleEditProductImage = (asset: VirtualAsset) => {
    setEditingAsset(asset);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {allAssets.length > 0 && (
            <Checkbox
              checked={selectedIds.size === allAssets.length && allAssets.length > 0}
              onCheckedChange={selectAll}
              className="h-5 w-5"
            />
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Zoeken in assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[250px]" />
          </div>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList className="h-8">
            <TabsTrigger value="grid" className="px-2"><Grid className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="list" className="px-2"><List className="h-4 w-4" /></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Folder Tabs */}
      <Tabs value={folder} onValueChange={(v) => { setFolder(v); clearSelection(); }}>
        <TabsList>
          {folderConfig.map(f => (
            <TabsTrigger key={f.id} value={f.id} className="gap-1.5">
              <f.icon className="h-3.5 w-3.5" />{f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm">Drop de bestanden hier...</p>
        ) : uploading ? (
          <p className="text-sm">Uploaden...</p>
        ) : (
          <>
            <p className="text-sm font-medium">Sleep bestanden hierheen of klik om te uploaden</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP, GIF tot 10MB</p>
          </>
        )}
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : allAssets.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Geen assets gevonden</p>
          <p className="text-sm mt-1">Upload je eerste asset om te beginnen</p>
        </div>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
            : 'space-y-2'
        )}>
          {allAssets.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset}
              selected={selectedIds.has(asset.id)}
              onSelect={() => toggleSelect(asset.id)}
              selectionActive={selectionActive}
              onToggleFavorite={asset.source === 'upload' ? () => toggleFavorite.mutate({ id: asset.id, is_favorite: !asset.is_favorite }) : undefined}
              onDelete={asset.source === 'upload' ? () => deleteAsset.mutate(asset.id) : undefined}
              onEdit={asset.file_type.startsWith('image/') ? () => handleEditProductImage(asset) : undefined}
            />
          ))}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectionActive && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-[95vw]">
          {bulkProcessing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {bulkProgress.current} van {bulkProgress.total} verwerkt...
              </span>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium whitespace-nowrap">
                {selectedIds.size} geselecteerd
              </span>
              <div className="h-6 w-px bg-border" />
              <Button size="sm" variant="outline" onClick={handleBulkRemoveBackground} className="gap-1.5">
                <Eraser className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Achtergrond verwijderen</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Downloaden</span>
              </Button>
              {selectedAssets.some(a => a.source === 'upload') && (
                <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Verwijderen</span>
                </Button>
              )}
              <div className="h-6 w-px bg-border" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Image Editor for product photos */}
      {editingAsset && (
        <ImageEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={editingAsset.file_url}
          productName={editingAsset.productName || editingAsset.categoryName || editingAsset.file_name}
          onApply={async (newUrl) => {
            try {
              if (editingAsset.source === 'product' && editingAsset.id) {
                // Update product_images table
                const { error } = await supabase
                  .from('product_images')
                  .update({ image_url: newUrl })
                  .eq('id', editingAsset.id);
                if (error) throw error;
              } else if (editingAsset.source === 'upload' && editingAsset.id) {
                // Update media_assets table
                const { error } = await supabase
                  .from('media_assets')
                  .update({ file_url: newUrl })
                  .eq('id', editingAsset.id);
                if (error) throw error;
              } else if (editingAsset.source === 'category' && editingAsset.id) {
                // Update categories table
                const { error } = await supabase
                  .from('categories')
                  .update({ image_url: newUrl })
                  .eq('id', editingAsset.id);
                if (error) throw error;
              }
              queryClient.invalidateQueries({ queryKey: ['media-assets'] });
              queryClient.invalidateQueries({ queryKey: ['products'] });
              queryClient.invalidateQueries({ queryKey: ['categories'] });
              toast.success('Afbeelding opgeslagen!');
            } catch (err: any) {
              console.error('Failed to save edited image:', err);
              toast.error('Kon de bewerkte afbeelding niet opslaan');
            }
            setEditorOpen(false);
            setEditingAsset(null);
          }}
        />
      )}
    </div>
  );
}

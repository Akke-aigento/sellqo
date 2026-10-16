import { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Search, FolderOpen, Star, Image as ImageIcon, Sparkles, MoreHorizontal, Trash2, Heart, Download, Copy, Grid, List, Package, Wand2, X, Eraser, Loader2, FolderTree, Palette, Info, Megaphone, Tag } from 'lucide-react';
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
import { ExternalImagesBanner } from '@/components/admin/marketing/ExternalImagesBanner';
import { buildUsageMap, type ProductImageRef } from '@/lib/mediaLibrary';
import { recordMediaDimensions, type MediaClientLike } from '@/lib/mediaRegistry';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { SocialContentRequestDialog } from '@/components/admin/marketing/SocialContentRequestDialog';
import { useSocialPipeline } from '@/hooks/useSocialPipeline';
import { collectTags, matchesTags, pickRequestAssetIds, SOCIAL_CONTENT_MAX_ASSETS } from '@/lib/socialContent';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

const folderConfig = [
  { id: 'all', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.alles', icon: FolderOpen },
  { id: 'products', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.producten', icon: Package },
  { id: 'categories', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.categorie_n', icon: FolderTree },
  // MEDIA-2: 'campaigns' was overal leeg (geen enkele rij had die map); AI-beelden krijgen hun eigen tab.
  { id: 'ai', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.ai_beelden', icon: Sparkles },
  { id: 'social', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.social', icon: ImageIcon },
  // MEDIA-3: merkmateriaal en reisbeelden (map 'brand'); mogen op een externe URL staan.
  { id: 'brand', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.merk', icon: Palette },
  { id: 'favorites', labelKey: 'admin.marketing.mediaAssetsLibrary.folders.favorieten', icon: Star },
];

interface VirtualAsset {
  id: string;
  /** media_assets-id; ontbreekt bij een productfoto die (nog) niet in de bibliotheek staat. */
  mediaId?: string;
  width?: number | null;
  height?: number | null;
  /** Andere producten die dezelfde foto gebruiken (buiten productName). */
  usedByCount?: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  title: string | null;
  /** MEDIA-3: omschrijving uit media_assets (enkel bij bibliotheekrijen). */
  description?: string | null;
  tags: string[];
  is_ai_generated: boolean;
  is_favorite: boolean;
  source: 'upload' | 'product' | 'category';
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
}

function AssetCard({ asset, onToggleFavorite, onDelete, onEdit, selected, onSelect, selectionActive, onMeasured, onDetails, onRequestPost }: { 
  asset: VirtualAsset; 
  onMeasured?: (width: number, height: number) => void;
  onDetails?: () => void;
  onRequestPost?: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  selected: boolean;
  onSelect: () => void;
  selectionActive: boolean;
}) {
  const { t } = useTranslation();
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
              loading="lazy"
              className="w-full h-full object-cover"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (onMeasured && !asset.width && img.naturalWidth > 0) onMeasured(img.naturalWidth, img.naturalHeight);
              }}
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
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-2 p-2">
              {onDetails && (
                <Button size="icon" variant="secondary" className="h-8 w-8" aria-label={t('admin.marketing.mediaAssetsLibrary.details.open')} onClick={(e) => { e.stopPropagation(); onDetails(); }}>
                  <Info className="h-4 w-4" />
                </Button>
              )}
              {onRequestPost && (
                <Button size="icon" variant="secondary" className="h-8 w-8" aria-label={t('admin.socialContent.action')} onClick={(e) => { e.stopPropagation(); onRequestPost(); }}>
                  <Megaphone className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Wand2 className="h-4 w-4" />
                </Button>
              )}
              {onToggleFavorite && (
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
              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a href={asset.file_url} download={asset.file_name} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-2" />{t('admin.marketing.mediaAssetsLibrary.downloaden')}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />{t('admin.marketing.mediaAssetsLibrary.verwijderen')}
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
                {t('admin.stockReport.colName')}
              </Badge>
            )}
            {isCategory && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                <FolderTree className="h-2.5 w-2.5 mr-0.5" />
                {t('admin.marketing.templateDialog.categorie')}
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
          <p className="text-[10px] text-muted-foreground truncate">
            {asset.productName}
            {asset.usedByCount ? ` ${t('admin.marketing.mediaAssetsLibrary.en_meer', { count: asset.usedByCount })}` : ''}
          </p>
        )}
        {asset.width && asset.height ? (
          <p className="text-[10px] text-muted-foreground tabular-nums">{asset.width} × {asset.height}</p>
        ) : null}
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
  const { t } = useTranslation();
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
  // MEDIA-3: tagfilter, detailweergave en contentverzoek.
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [detailAsset, setDetailAsset] = useState<VirtualAsset | null>(null);
  const [requestAssets, setRequestAssets] = useState<VirtualAsset[]>([]);
  const { hasPipeline } = useSocialPipeline();
  
  const { assets, isLoading, toggleFavorite, deleteAsset } = useMediaAssets(folder);
  const { uploadImage, uploading } = useImageUpload();
  const { products: productsList, isLoading: productsLoading } = useProducts();
  const { categories } = useCategories();
  const { generateImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('image_enhancement');

  // MEDIA-1: media_assets is de bron. Productfoto's staan er sinds de migratie zelf in
  // (trigger + backfill); hier koppelen we elke rij aan het product of de categorie die
  // hem gebruikt. Foto's die nog geen rij hebben (bv. vóór de migratie live staat) tonen
  // we als virtuele kaart, zodat de bibliotheek nooit leger oogt dan vroeger.
  const productUsage = useMemo(() => buildUsageMap(productsList as unknown as ProductImageRef[]), [productsList]);
  const categoryUsage = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const c of categories || []) if (c.image_url) m.set(c.image_url, { id: c.id, name: c.name });
    return m;
  }, [categories]);

  const mediaVirtualAssets = useMemo<VirtualAsset[]>(() => {
    return assets.map(a => {
      const usedBy = productUsage.get(a.file_url);
      const cat = categoryUsage.get(a.file_url);
      const base: VirtualAsset = {
        id: a.id,
        mediaId: a.id,
        file_name: a.file_name,
        file_url: a.file_url,
        file_type: a.file_type || 'image/jpeg',
        file_size: a.file_size,
        width: a.width,
        height: a.height,
        title: a.title,
        description: a.description,
        tags: a.tags || [],
        is_ai_generated: a.is_ai_generated,
        is_favorite: a.is_favorite,
        source: 'upload',
      };
      if (usedBy && usedBy.length > 0) {
        return { ...base, source: 'product', productId: usedBy[0].id, productName: usedBy[0].name, usedByCount: usedBy.length - 1 };
      }
      if (cat) return { ...base, source: 'category', categoryId: cat.id, categoryName: cat.name };
      return base;
    });
  }, [assets, productUsage, categoryUsage]);

  const knownUrls = useMemo(() => new Set(assets.map(a => a.file_url)), [assets]);

  // Productfoto's zonder bibliotheekrij (vangnet).
  const productAssets = useMemo<VirtualAsset[]>(() => {
    if (folder !== 'all' && folder !== 'products') return [];
    const out: VirtualAsset[] = [];
    for (const [url, usedBy] of productUsage) {
      if (knownUrls.has(url)) continue;
      out.push({
        id: `product-${usedBy[0].id}-${url}`,
        file_name: url.split('?')[0].split('/').pop() || usedBy[0].name,
        file_url: url,
        file_type: 'image/jpeg',
        file_size: null,
        title: usedBy[0].name,
        tags: [],
        is_ai_generated: false,
        is_favorite: false,
        source: 'product' as const,
        productId: usedBy[0].id,
        productName: usedBy[0].name,
        usedByCount: usedBy.length - 1,
      });
    }
    return out;
  }, [productUsage, knownUrls, folder]);

  // Categoriefoto's zonder bibliotheekrij (vangnet).
  const categoryAssets = useMemo<VirtualAsset[]>(() => {
    if (folder !== 'all' && folder !== 'categories') return [];
    return (categories || [])
      .filter(cat => cat.image_url && !knownUrls.has(cat.image_url))
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
        categoryId: cat.id,
        categoryName: cat.name,
      }));
  }, [categories, knownUrls, folder]);

  // Merge and filter
  const searchedAssets = useMemo(() => {
    let combined: VirtualAsset[];
    if (folder === 'products') combined = [...mediaVirtualAssets, ...productAssets];
    else if (folder === 'categories') combined = [...mediaVirtualAssets, ...categoryAssets];
    else if (folder === 'favorites' || folder === 'brand' || folder === 'ai' || folder === 'social') combined = mediaVirtualAssets;
    else combined = [...mediaVirtualAssets, ...productAssets, ...categoryAssets];
    if (!search) return combined;
    const q = search.toLowerCase();
    return combined.filter(a =>
      a.file_name.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.productName?.toLowerCase().includes(q) ||
      a.categoryName?.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [mediaVirtualAssets, productAssets, categoryAssets, folder, search]);

  // MEDIA-3: chips uit de tags van wat er getoond wordt; meerdere chips = alle tags vereist.
  const tagChips = useMemo(() => collectTags(searchedAssets), [searchedAssets]);
  const allAssets = useMemo(
    () => searchedAssets.filter(a => matchesTags(a.tags, selectedTags)),
    [searchedAssets, selectedTags],
  );
  const toggleTag = (tag: string) => setSelectedTags(prev =>
    prev.some(t => t.toLowerCase() === tag.toLowerCase()) ? prev.filter(t => t.toLowerCase() !== tag.toLowerCase()) : [...prev, tag]);

  /** MEDIA-3: enkel echte bibliotheekrijen kunnen mee in een contentverzoek. */
  const canRequestPost = (a: VirtualAsset) => hasPipeline && !!a.mediaId && a.file_type.startsWith('image/');
  const openRequest = (list: VirtualAsset[]) => {
    const usable = list.filter(canRequestPost);
    if (usable.length === 0) return;
    if (usable.length > SOCIAL_CONTENT_MAX_ASSETS) {
      toast.info(t('admin.socialContent.tooMany', { count: SOCIAL_CONTENT_MAX_ASSETS }));
    }
    const ids = pickRequestAssetIds(usable.map(a => a.mediaId));
    setRequestAssets(usable.filter(a => ids.includes(a.mediaId!)));
  };

  // Afmetingen die nog ontbreken, aanvullen zodra het beeld geladen is (één keer per rij).
  const measuredRef = useRef(new Set<string>());
  const handleMeasured = useCallback((mediaId: string, width: number, height: number) => {
    if (measuredRef.current.has(mediaId)) return;
    measuredRef.current.add(mediaId);
    void recordMediaDimensions(supabase as unknown as MediaClientLike, mediaId, width, height);
  }, []);

  /** Uit de bibliotheek verwijderen mag alleen als de foto nergens gebruikt wordt. */
  const isDeletable = (a: VirtualAsset) => !!a.mediaId && a.source === 'upload';

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
    const deletable = selectedAssets.filter(isDeletable);
    if (deletable.length === 0) {
      toast.error('Geen verwijderbare assets geselecteerd');
      return;
    }
    let success = 0;
    for (const asset of deletable) {
      try {
        await deleteAsset.mutateAsync(asset.mediaId!);
        success++;
      } catch {
        // continue
      }
    }
    toast.success(t('admin.marketing.mediaAssetsLibrary.assets_verwijderd', { success, total: deletable.length }));
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
    toast.success(t('admin.marketing.mediaAssetsLibrary.achtergronden_verwijderd', { success, total: selectedAssets.length }));
    clearSelection();
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!currentTenant?.id) return;
    for (const file of acceptedFiles) {
      // MEDIA-1: useImageUpload zet de foto zelf in de bibliotheek.
      await uploadImage(file, 'marketing-assets', undefined, {
        folder: folder === 'all' || folder === 'favorites' || folder === 'ai' ? 'general' : folder,
      });
    }
  }, [currentTenant?.id, folder, uploadImage]);

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
            <Input placeholder={t('admin.marketing.mediaAssetsLibrary.zoeken_in_assets')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[250px]" />
          </div>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList className="h-8">
            <TabsTrigger value="grid" className="px-2"><Grid className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="list" className="px-2"><List className="h-4 w-4" /></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* MEDIA-1: externe foto's (bv. Shopify-CDN) naar eigen opslag */}
      <ExternalImagesBanner />

      {/* Folder Tabs */}
      <Tabs value={folder} onValueChange={(v) => { setFolder(v); clearSelection(); setSelectedTags([]); }}>
        <TabsList>
          {folderConfig.map(f => (
            <TabsTrigger key={f.id} value={f.id} className="gap-1.5">
              <f.icon className="h-3.5 w-3.5" />{t(f.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* MEDIA-3: tagfilter */}
      {tagChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground mr-1">{t('admin.marketing.mediaAssetsLibrary.tags.filter')}</span>
          {tagChips.map(({ tag, count }) => {
            const active = selectedTags.some(s => s.toLowerCase() === tag.toLowerCase());
            return (
              <Button
                key={tag}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-7 rounded-full px-2.5 text-xs"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
              >
                {tag}<span className="ml-1 opacity-60 tabular-nums">{count}</span>
              </Button>
            );
          })}
          {selectedTags.length > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedTags([])}>
              {t('admin.marketing.mediaAssetsLibrary.tags.clear')}
            </Button>
          )}
        </div>
      )}

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
          <p className="text-sm">{t('admin.marketing.mediaAssetsLibrary.drop_de_bestanden_hier')}</p>
        ) : uploading ? (
          <p className="text-sm">{t('admin.marketing.mediaAssetsLibrary.uploaden')}</p>
        ) : (
          <>
            <p className="text-sm font-medium">{t('admin.marketing.mediaAssetsLibrary.sleep_bestanden_hierheen_of_klik_om')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.marketing.mediaAssetsLibrary.jpg_png_webp_gif_tot_10mb')}</p>
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
          <p>{t('admin.marketing.mediaAssetsLibrary.geen_assets_gevonden')}</p>
          <p className="text-sm mt-1">{t('admin.marketing.mediaAssetsLibrary.upload_je_eerste_asset_om_te')}</p>
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
              onToggleFavorite={asset.mediaId ? () => toggleFavorite.mutate({ id: asset.mediaId!, is_favorite: !asset.is_favorite }) : undefined}
              onDelete={isDeletable(asset) ? () => deleteAsset.mutate(asset.mediaId!) : undefined}
              onMeasured={asset.mediaId ? (w, h) => handleMeasured(asset.mediaId!, w, h) : undefined}
              onEdit={asset.file_type.startsWith('image/') ? () => handleEditProductImage(asset) : undefined}
              onDetails={() => setDetailAsset(asset)}
              onRequestPost={canRequestPost(asset) ? () => openRequest([asset]) : undefined}
            />
          ))}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectionActive && (
        <div className="fixed bottom-[var(--admin-nav-offset)] left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-[95vw]">
          {bulkProcessing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {t('admin.marketing.mediaAssetsLibrary.bulk.processed', { current: bulkProgress.current, total: bulkProgress.total })}
              </span>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium whitespace-nowrap">
                {t('admin.marketing.mediaAssetsLibrary.bulk.selected', { count: selectedIds.size })}
              </span>
              <div className="h-6 w-px bg-border" />
              {selectedAssets.some(canRequestPost) && (
                <Button size="sm" variant="outline" onClick={() => openRequest(selectedAssets)} className="gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('admin.socialContent.action')}</span>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleBulkRemoveBackground} className="gap-1.5">
                <Eraser className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('admin.marketing.mediaAssetsLibrary.achtergrond_verwijderen')}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('admin.marketing.mediaAssetsLibrary.downloaden')}</span>
              </Button>
              {selectedAssets.some(isDeletable) && (
                <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('common.delete')}</span>
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

      {/* MEDIA-3: detailweergave met titel, omschrijving en tags */}
      <ResponsiveDialog
        open={!!detailAsset}
        onOpenChange={(o) => !o && setDetailAsset(null)}
        title={detailAsset?.title || detailAsset?.file_name || ''}
        footer={detailAsset && canRequestPost(detailAsset) ? (
          <div className="flex w-full sm:justify-end">
            <Button className="flex-1 sm:flex-none gap-1.5" onClick={() => { const a = detailAsset; setDetailAsset(null); openRequest([a]); }}>
              <Megaphone className="h-4 w-4" />{t('admin.socialContent.action')}
            </Button>
          </div>
        ) : undefined}
      >
        {detailAsset && (
          <div className="space-y-3">
            <img src={detailAsset.file_url} alt={detailAsset.title || detailAsset.file_name} className="w-full max-h-[50vh] object-contain rounded bg-muted" />
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.details.title')}</dt>
              <dd className="break-words">{detailAsset.title || '—'}</dd>
              <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.details.description')}</dt>
              <dd className="break-words whitespace-pre-line">{detailAsset.description || '—'}</dd>
              <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.details.tags')}</dt>
              <dd className="flex flex-wrap gap-1">
                {detailAsset.tags.length > 0
                  ? detailAsset.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)
                  : '—'}
              </dd>
              {detailAsset.width && detailAsset.height ? (
                <>
                  <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.details.size')}</dt>
                  <dd className="tabular-nums">{detailAsset.width} × {detailAsset.height}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.details.file')}</dt>
              <dd className="break-all text-xs">{detailAsset.file_name}</dd>
            </dl>
          </div>
        )}
      </ResponsiveDialog>

      <SocialContentRequestDialog
        assetIds={requestAssets.map(a => a.mediaId!).filter(Boolean)}
        previews={requestAssets.map(a => ({ id: a.id, url: a.file_url, title: a.title || a.file_name }))}
        onClose={() => setRequestAssets([])}
        onDone={clearSelection}
      />

      {/* Image Editor for product photos */}
      {editingAsset && (
        <ImageEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={editingAsset.file_url}
          productName={editingAsset.productName || editingAsset.categoryName || editingAsset.file_name}
          onApply={async (newUrl) => {
            try {
              if (editingAsset.source === 'product' && editingAsset.productId) {
                // Productfoto's staan in products.images (array) en featured_image;
                // een tabel product_images bestaat niet. Vers ophalen en alleen deze
                // foto vervangen, zodat we niets overschrijven.
                const oldUrl = editingAsset.file_url;
                const { data: product, error: readErr } = await supabase
                  .from('products')
                  .select('images, featured_image')
                  .eq('id', editingAsset.productId)
                  .single();
                if (readErr) throw readErr;
                const images = ((product?.images as string[] | null) || []).map((u) => (u === oldUrl ? newUrl : u));
                const update: { images: string[]; featured_image?: string } = { images };
                if (product?.featured_image === oldUrl) update.featured_image = newUrl;
                const { error } = await supabase
                  .from('products')
                  .update(update)
                  .eq('id', editingAsset.productId);
                if (error) throw error;
              } else if (editingAsset.source === 'upload' && editingAsset.mediaId) {
                const { error } = await (supabase as any)
                  .from('media_assets')
                  .update({ file_url: newUrl, width: null, height: null })
                  .eq('id', editingAsset.mediaId);
                if (error) throw error;
              } else if (editingAsset.source === 'category' && editingAsset.categoryId) {
                // De asset-id is 'category-<uuid>'; de echte id staat in categoryId.
                const { error } = await (supabase as any)
                  .from('categories')
                  .update({ image_url: newUrl })
                  .eq('id', editingAsset.categoryId);
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

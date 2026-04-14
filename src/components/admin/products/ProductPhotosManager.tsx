import { useState, useMemo } from 'react';
import { Search, Wand2, Eraser, ImageIcon, Loader2, CheckSquare, Square } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useAIImages } from '@/hooks/useAIImages';
import { useAICredits } from '@/hooks/useAICredits';
import { ImageEditorDialog } from './ImageEditorDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PhotoItem {
  productId: string;
  productName: string;
  imageUrl: string;
  imageIndex: number;
  isFeatured: boolean;
}

export function ProductPhotosManager() {
  const { products } = useProducts();
  const { categories } = useCategories();
  const { generateImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with' | 'without'>('all');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Build flat list of all product photos
  const allPhotos = useMemo<PhotoItem[]>(() => {
    const photos: PhotoItem[] = [];
    products.forEach(product => {
      const images = product.images || [];
      images.forEach((url, index) => {
        photos.push({
          productId: product.id,
          productName: product.name,
          imageUrl: url,
          imageIndex: index,
          isFeatured: product.featured_image === url || (index === 0 && !product.featured_image),
        });
      });
    });
    return photos;
  }, [products]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter(photo => {
      if (search) {
        if (!photo.productName.toLowerCase().includes(search.toLowerCase())) return false;
      }
      if (categoryFilter !== 'all') {
        const product = products.find(p => p.id === photo.productId);
        const catIds = (product as any)?.product_categories?.map((pc: any) => pc.category_id) || [];
        if (!catIds.includes(categoryFilter) && product?.category_id !== categoryFilter) return false;
      }
      return true;
    });
  }, [allPhotos, search, categoryFilter, products]);

  // Products without photos
  const productsWithoutPhotos = useMemo(() => {
    return products.filter(p => !p.images || p.images.length === 0);
  }, [products]);

  const displayItems = photoFilter === 'without' ? [] : filteredPhotos;

  const photoKey = (p: PhotoItem) => `${p.productId}::${p.imageIndex}`;

  const toggleSelect = (photo: PhotoItem) => {
    const key = photoKey(photo);
    const next = new Set(selectedPhotos);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedPhotos(next);
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.size === displayItems.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(displayItems.map(photoKey)));
    }
  };

  const handleEditPhoto = (photo: PhotoItem) => {
    setEditingPhoto(photo);
    setEditorOpen(true);
  };

  const handleApplyEdit = async (newImageUrl: string) => {
    if (!editingPhoto) return;
    const product = products.find(p => p.id === editingPhoto.productId);
    if (!product) return;

    const newImages = [...(product.images || [])];
    newImages[editingPhoto.imageIndex] = newImageUrl;

    const updates: Record<string, any> = { images: newImages };
    if (product.featured_image === editingPhoto.imageUrl) {
      updates.featured_image = newImageUrl;
    }

    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', editingPhoto.productId);

    if (error) {
      toast.error('Kon foto niet bijwerken');
    } else {
      toast.success('Foto bijgewerkt!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  };

  const handleBulkRemoveBackground = async () => {
    const selected = displayItems.filter(p => selectedPhotos.has(photoKey(p)));
    if (selected.length === 0) return;

    const cost = getCreditCost('image_enhancement') * selected.length;
    if (!hasCredits(cost)) {
      toast.error('Onvoldoende credits', {
        description: `Je hebt ${cost} credits nodig voor ${selected.length} foto's.`
      });
      return;
    }

    setBulkProcessing(true);
    let success = 0;
    let failed = 0;

    for (const photo of selected) {
      try {
        const result = await generateImage.mutateAsync({
          prompt: 'Remove the background completely, make it transparent',
          sourceImageUrl: photo.imageUrl,
          enhancementType: 'background_remove',
        });

        if (result?.imageUrl) {
          const product = products.find(p => p.id === photo.productId);
          if (product) {
            const newImages = [...(product.images || [])];
            newImages[photo.imageIndex] = result.imageUrl;
            const updates: Record<string, any> = { images: newImages };
            if (product.featured_image === photo.imageUrl) {
              updates.featured_image = result.imageUrl;
            }
            await supabase.from('products').update(updates).eq('id', photo.productId);
            success++;
          }
        }
      } catch {
        failed++;
      }
    }

    setBulkProcessing(false);
    setSelectedPhotos(new Set());
    queryClient.invalidateQueries({ queryKey: ['products'] });

    if (success > 0) {
      toast.success(`${success} foto('s) bewerkt`, {
        description: failed > 0 ? `${failed} mislukt` : undefined,
      });
    } else if (failed > 0) {
      toast.error(`Alle ${failed} bewerkingen mislukt`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Fotobeheer
          </CardTitle>
          <CardDescription>
            Bekijk en bewerk alle productfoto's op één plek
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op productnaam..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={photoFilter} onValueChange={(v) => setPhotoFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle foto's</SelectItem>
                <SelectItem value="with">Met foto</SelectItem>
                <SelectItem value="without">Zonder foto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk actions */}
          {selectedPhotos.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Badge variant="secondary">{selectedPhotos.size} geselecteerd</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkRemoveBackground}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eraser className="mr-2 h-4 w-4" />
                )}
                Achtergrond verwijderen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPhotos(new Set())}>
                Deselecteren
              </Button>
            </div>
          )}

          {/* Select all */}
          {displayItems.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedPhotos.size === displayItems.length && displayItems.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                Selecteer alles ({displayItems.length} foto's)
              </span>
            </div>
          )}

          {/* Photo grid */}
          {photoFilter === 'without' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{productsWithoutPhotos.length} producten zonder foto</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {productsWithoutPhotos.map(p => (
                  <div key={p.id} className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/20">
                    <div className="text-center p-2">
                      <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1" />
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{p.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Geen foto's gevonden</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {displayItems.map((photo) => {
                const key = photoKey(photo);
                const isSelected = selectedPhotos.has(key);
                return (
                  <div
                    key={key}
                    className={cn(
                      "group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                      isSelected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <img src={photo.imageUrl} alt={photo.productName} className="w-full h-full object-cover" />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full max-w-[140px]"
                        onClick={(e) => { e.stopPropagation(); handleEditPhoto(photo); }}
                      >
                        <Wand2 className="mr-1 h-3 w-3" />
                        Bewerken
                      </Button>
                    </div>

                    {/* Checkbox */}
                    <div className="absolute top-2 left-2" onClick={(e) => { e.stopPropagation(); toggleSelect(photo); }}>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-muted-foreground/50"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </div>

                    {/* Product name */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">{photo.productName}</p>
                      {photo.isFeatured && (
                        <Badge className="text-[10px] px-1 py-0 mt-0.5 bg-primary/80">Hoofd</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor dialog */}
      {editingPhoto && (
        <ImageEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          imageUrl={editingPhoto.imageUrl}
          productName={editingPhoto.productName}
          onApply={handleApplyEdit}
        />
      )}
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

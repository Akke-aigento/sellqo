import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Image as ImageIcon,
  Wand2,
  Check,
  AlertCircle,
  Search,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImage {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string;
  altText: string | null;
  index: number;
}

interface ImageAltTextPanelProps {
  products: Array<{
    id: string;
    name: string;
    images: string[];
  }>;
  isLoading?: boolean;
  onGenerateAltText: (productIds: string[]) => void;
  isGenerating?: boolean;
}

export function ImageAltTextPanel({
  products,
  isLoading,
  onGenerateAltText,
  isGenerating,
}: ImageAltTextPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'missing' | 'complete'>('all');

  // Flatten all images from products
  const allImages: ProductImage[] = products.flatMap((product) =>
    (product.images || []).map((imageUrl, index) => ({
      id: `${product.id}-${index}`,
      productId: product.id,
      productName: product.name,
      imageUrl,
      altText: null, // Would come from product metadata in real implementation
      index,
    }))
  );

  // Filter images
  const filteredImages = allImages.filter((img) => {
    const matchesSearch = img.productName.toLowerCase().includes(search.toLowerCase());
    if (filter === 'missing') return matchesSearch && !img.altText;
    if (filter === 'complete') return matchesSearch && !!img.altText;
    return matchesSearch;
  });

  // Stats
  const totalImages = allImages.length;
  const imagesWithAlt = allImages.filter((img) => img.altText).length;
  const imagesMissing = totalImages - imagesWithAlt;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredImages.map((img) => img.id)));
    }
  };

  const handleGenerateSelected = () => {
    // Get unique product IDs from selected images
    const productIds = [...new Set(
      filteredImages
        .filter((img) => selectedIds.has(img.id))
        .map((img) => img.productId)
    )];
    onGenerateAltText(productIds);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Afbeelding Alt-Teksten
            </CardTitle>
            <CardDescription>
              Optimaliseer alt-teksten voor betere SEO en toegankelijkheid
            </CardDescription>
          </div>
          {selectedIds.size > 0 && (
            <Button onClick={handleGenerateSelected} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Genereren...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Genereer Alt ({selectedIds.size})
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Bar */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">{imagesWithAlt} met alt-tekst</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm">{imagesMissing} ontbrekend</span>
          </div>
          <div className="ml-auto">
            <Badge variant={imagesMissing === 0 ? 'default' : 'secondary'}>
              {Math.round((imagesWithAlt / Math.max(totalImages, 1)) * 100)}% compleet
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op productnaam..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Alle ({totalImages})
            </Button>
            <Button
              variant={filter === 'missing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('missing')}
            >
              Ontbrekend ({imagesMissing})
            </Button>
            <Button
              variant={filter === 'complete' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('complete')}
            >
              Compleet ({imagesWithAlt})
            </Button>
          </div>
        </div>

        {/* Select All */}
        {filteredImages.length > 0 && (
          <div className="flex items-center gap-2 py-2 border-b">
            <Checkbox
              checked={selectedIds.size === filteredImages.length && filteredImages.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              Selecteer alle ({filteredImages.length})
            </span>
          </div>
        )}

        {/* Image Grid */}
        <ScrollArea className="h-[400px]">
          {filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
              <p>Geen afbeeldingen gevonden</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    'group relative rounded-lg border overflow-hidden cursor-pointer transition-all',
                    selectedIds.has(img.id) && 'ring-2 ring-primary',
                    !img.altText && 'border-yellow-500/50'
                  )}
                  onClick={() => toggleSelect(img.id)}
                >
                  {/* Image */}
                  <div className="aspect-square">
                    <img
                      src={img.imageUrl}
                      alt={img.altText || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Checkbox Overlay */}
                  <div className={cn(
                    'absolute top-2 left-2 transition-opacity',
                    selectedIds.has(img.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}>
                    <div className="w-5 h-5 rounded bg-background/80 backdrop-blur flex items-center justify-center">
                      <Checkbox
                        checked={selectedIds.has(img.id)}
                        className="pointer-events-none"
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {img.altText ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                        <AlertCircle className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Product Name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{img.productName}</p>
                    {img.altText && (
                      <p className="text-xs text-white/70 truncate">{img.altText}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Health Checklist */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Afbeelding SEO Checklist</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={cn(
              'p-3 rounded-lg border flex items-center gap-3',
              imagesMissing === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50'
            )}>
              {imagesMissing === 0 ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Alt-teksten aanwezig</p>
                <p className="text-xs text-muted-foreground">Alle afbeeldingen hebben alt-tekst</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/50 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Bestandsgroottes</p>
                <p className="text-xs text-muted-foreground">Optimaliseer afbeeldingen &lt; 200KB</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/50 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Afmetingen</p>
                <p className="text-xs text-muted-foreground">Gebruik consistente afmetingen</p>
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/50 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Modern formaat</p>
                <p className="text-xs text-muted-foreground">WebP/AVIF voor betere performance</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

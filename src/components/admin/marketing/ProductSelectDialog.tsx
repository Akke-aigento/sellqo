import { useState, useMemo } from 'react';
import { Search, Package, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

interface ProductSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  maxSelect?: number;
}

export function ProductSelectDialog({
  open,
  onOpenChange,
  selectedIds,
  onSelect,
  maxSelect = 5,
}: ProductSelectDialogProps) {
  const { products, isLoading } = useProducts();
  const [search, setSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  // Reset local selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalSelected(selectedIds);
      setSearch('');
    }
    onOpenChange(newOpen);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search) return products.slice(0, 50);
    
    const searchLower = search.toLowerCase();
    return products
      .filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.sku?.toLowerCase().includes(searchLower)
      )
      .slice(0, 50);
  }, [products, search]);

  const handleToggle = (productId: string) => {
    setLocalSelected(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      if (prev.length >= maxSelect) {
        return prev;
      }
      return [...prev, productId];
    });
  };

  const handleConfirm = () => {
    onSelect(localSelected);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalSelected([]);
  };

  const selectedProducts = products?.filter(p => localSelected.includes(p.id)) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Producten Selecteren
          </DialogTitle>
          <DialogDescription>
            Kies tot {maxSelect} producten om te gebruiken in je AI content
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam of SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected Products */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map(product => (
              <Badge
                key={product.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {product.name.substring(0, 20)}
                {product.name.length > 20 && '...'}
                <button
                  onClick={() => handleToggle(product.id)}
                  className="ml-1 hover:bg-muted rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs"
            >
              Wis alles
            </Button>
          </div>
        )}

        {/* Product List */}
        <ScrollArea className="flex-1 min-h-[300px] max-h-[400px] border rounded-lg">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Geen producten gevonden</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredProducts.map((product) => {
                const isSelected = localSelected.includes(product.id);
                const isDisabled = !isSelected && localSelected.length >= maxSelect;
                
                return (
                  <button
                    key={product.id}
                    onClick={() => !isDisabled && handleToggle(product.id)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                      isSelected 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-muted border border-transparent',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="pointer-events-none"
                    />
                    
                    {product.featured_image ? (
                      <img
                        src={product.featured_image}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>€{product.price.toFixed(2)}</span>
                        {product.sku && (
                          <>
                            <span>•</span>
                            <span>{product.sku}</span>
                          </>
                        )}
                        {product.stock !== null && product.stock <= 5 && (
                          <Badge variant="destructive" className="text-xs">
                            Lage voorraad
                          </Badge>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {localSelected.length} van {maxSelect} geselecteerd
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Annuleren
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4" />
              Bevestigen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';

interface ProductMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  singleSelect?: boolean;
}

export function ProductMultiSelect({
  selectedIds,
  onChange,
  placeholder = 'Selecteer producten...',
  singleSelect = false,
}: ProductMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { products = [] } = useProducts();

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const toggle = (id: string) => {
    if (singleSelect) {
      onChange([id]);
      setOpen(false);
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const getImageUrl = (product: any) => {
    if (product.images && product.images.length > 0) return product.images[0];
    if (product.image_url) return product.image_url;
    return null;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {selectedIds.length === 0
                ? placeholder
                : `${selectedIds.length} product${selectedIds.length !== 1 ? 'en' : ''} geselecteerd`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek producten..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="h-[280px]">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Geen producten gevonden
              </div>
            ) : (
              <div className="p-1">
                {filtered.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  const imgUrl = getImageUrl(product);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggle(product.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent transition-colors',
                        isSelected && 'bg-accent/50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        {product.sku && (
                          <div className="text-xs text-muted-foreground">
                            SKU: {product.sku}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">
                        €{product.price?.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedProducts.length > 0 && !singleSelect && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProducts.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

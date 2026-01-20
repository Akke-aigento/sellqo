import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useProducts } from '@/hooks/useProducts';
import { usePOSQuickButtons } from '@/hooks/usePOS';
import { formatCurrency } from '@/lib/utils';
import type { POSQuickButton } from '@/types/pos';
import type { Product } from '@/types/product';

const COLORS = [
  { name: 'Blauw', value: '#3B82F6' },
  { name: 'Groen', value: '#22C55E' },
  { name: 'Geel', value: '#EAB308' },
  { name: 'Oranje', value: '#F97316' },
  { name: 'Rood', value: '#EF4444' },
  { name: 'Paars', value: '#A855F7' },
  { name: 'Roze', value: '#EC4899' },
  { name: 'Grijs', value: '#6B7280' },
];

interface QuickButtonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalId?: string;
}

export function QuickButtonDialog({ open, onOpenChange, terminalId }: QuickButtonDialogProps) {
  const { products } = useProducts();
  const { buttons, createButton, deleteButton, refetch } = usePOSQuickButtons(terminalId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [label, setLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [products, searchQuery]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setLabel(product.name);
    setSearchQuery('');
  };

  const handleAddButton = async () => {
    if (!selectedProduct) return;

    await createButton.mutateAsync({
      product_id: selectedProduct.id,
      label,
      color: selectedColor,
      terminal_id: terminalId,
      position: buttons.length,
    });

    // Reset form
    setSelectedProduct(null);
    setLabel('');
    setSelectedColor(COLORS[0].value);
    setShowAddForm(false);
    refetch();
  };

  const handleDeleteButton = async (buttonId: string) => {
    await deleteButton.mutateAsync(buttonId);
    refetch();
  };

  const handleCancelAdd = () => {
    setSelectedProduct(null);
    setLabel('');
    setSearchQuery('');
    setShowAddForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Snelknoppen Configureren</DialogTitle>
          <DialogDescription>
            Voeg producten toe als snelknoppen voor snellere verkoop.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current buttons list */}
          {buttons.length > 0 && !showAddForm && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Huidige snelknoppen</Label>
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-2 space-y-2">
                  {buttons.map((button) => (
                    <div
                      key={button.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: button.color || '#6B7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{button.label}</p>
                        {button.product && (
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(button.product.price)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteButton(button.id)}
                        disabled={deleteButton.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty state */}
          {buttons.length === 0 && !showAddForm && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nog geen snelknoppen geconfigureerd</p>
              <p className="text-sm">Voeg producten toe voor snelle toegang</p>
            </div>
          )}

          {/* Add button form */}
          {showAddForm && (
            <div className="space-y-4">
              {!selectedProduct ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek product..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {filteredProducts.length > 0 && (
                    <ScrollArea className="h-64 rounded-md border">
                      <div className="p-2 space-y-1">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg text-left"
                            onClick={() => handleSelectProduct(product)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.sku}</p>
                            </div>
                            <p className="font-semibold">{formatCurrency(product.price)}</p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {searchQuery && filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Geen producten gevonden</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* Selected product */}
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedProduct.sku}</p>
                      </div>
                      <Badge variant="secondary">{formatCurrency(selectedProduct.price)}</Badge>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="space-y-2">
                    <Label htmlFor="button-label">Knoplabel</Label>
                    <Input
                      id="button-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Kort label voor de knop"
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">
                      Max 20 tekens. {20 - label.length} resterend.
                    </p>
                  </div>

                  {/* Color picker */}
                  <div className="space-y-2">
                    <Label>Kleur</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-8 h-8 rounded-full transition-transform ${
                            selectedColor === color.value
                              ? 'ring-2 ring-offset-2 ring-primary scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => setSelectedColor(color.value)}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <Label>Voorbeeld</Label>
                    <div className="flex justify-center p-4 rounded-lg bg-muted/50">
                      <div
                        className="w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center p-2 bg-background"
                        style={{ borderColor: selectedColor }}
                      >
                        <span className="text-xs font-medium text-center line-clamp-2">
                          {label || 'Label'}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(selectedProduct.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!showAddForm ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Sluiten
              </Button>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Snelknop Toevoegen
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelAdd}>
                Annuleren
              </Button>
              {selectedProduct && (
                <Button 
                  onClick={handleAddButton} 
                  disabled={!label || createButton.isPending}
                >
                  {createButton.isPending ? 'Toevoegen...' : 'Toevoegen'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

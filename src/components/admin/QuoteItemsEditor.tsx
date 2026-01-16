import { useState } from 'react';
import { Plus, Trash2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import type { QuoteItemInput } from '@/types/quote';

interface QuoteItemsEditorProps {
  items: QuoteItemInput[];
  onChange: (items: QuoteItemInput[]) => void;
  taxPercentage: number;
}

export function QuoteItemsEditor({ items, onChange, taxPercentage }: QuoteItemsEditorProps) {
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const { products, isLoading: productsLoading } = useProducts({ search: productSearch });

  const addItem = (item: QuoteItemInput) => {
    onChange([...items, item]);
  };

  const updateItem = (index: number, updates: Partial<QuoteItemInput>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addManualItem = () => {
    addItem({
      product_name: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
    });
  };

  const addProductItem = (product: any) => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity: 1,
      unit_price: Number(product.price),
      discount_percent: 0,
    });
    setShowProductSearch(false);
    setProductSearch('');
  };

  const calculateItemTotal = (item: QuoteItemInput) => {
    return item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
  };

  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const taxAmount = subtotal * (taxPercentage / 100);
  const total = subtotal + taxAmount;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium">Producten / Diensten</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowProductSearch(true)}>
            <Package className="h-4 w-4 mr-2" />
            Product toevoegen
          </Button>
          <Button variant="outline" size="sm" onClick={addManualItem}>
            <Plus className="h-4 w-4 mr-2" />
            Handmatige regel
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2" />
          <p>Nog geen items toegevoegd</p>
          <p className="text-sm">Voeg producten of handmatige regels toe aan deze offerte</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Omschrijving</TableHead>
                <TableHead className="w-[15%] text-right">Prijs</TableHead>
                <TableHead className="w-[12%] text-center">Aantal</TableHead>
                <TableHead className="w-[13%] text-right">Korting %</TableHead>
                <TableHead className="w-[15%] text-right">Totaal</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={item.product_name}
                      onChange={(e) => updateItem(index, { product_name: e.target.value })}
                      placeholder="Omschrijving..."
                      className="border-0 p-0 h-auto focus-visible:ring-0"
                    />
                    {item.product_sku && (
                      <span className="text-xs text-muted-foreground">SKU: {item.product_sku}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                      className="text-right border-0 p-0 h-auto focus-visible:ring-0"
                      min={0}
                      step={0.01}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                      className="text-center border-0 p-0 h-auto focus-visible:ring-0"
                      min={1}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.discount_percent || 0}
                      onChange={(e) => updateItem(index, { discount_percent: Number(e.target.value) })}
                      className="text-right border-0 p-0 h-auto focus-visible:ring-0"
                      min={0}
                      max={100}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    €{calculateItemTotal(item).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t bg-muted/30 p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BTW ({taxPercentage}%)</span>
                  <span>€{taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-lg pt-2 border-t">
                  <span>Totaal</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Search Dialog */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Laden...
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2" />
                  <p>{productSearch ? 'Geen producten gevonden' : 'Geen producten beschikbaar'}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProductItem(product)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {product.featured_image ? (
                          <img 
                            src={product.featured_image} 
                            alt={product.name} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        {product.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">€{Number(product.price).toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

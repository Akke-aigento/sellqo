import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProductMultiSelect } from '@/components/admin/promotions/ProductMultiSelect';
import { useProducts } from '@/hooks/useProducts';

export interface BundleItem {
  product_id: string;
  quantity: number;
  is_required: boolean;
}

interface BundleProductsSectionProps {
  value: BundleItem[];
  onChange: (items: BundleItem[]) => void;
  currentProductId?: string;
}

export function BundleProductsSection({ value, onChange, currentProductId }: BundleProductsSectionProps) {
  const [showSelect, setShowSelect] = useState(false);
  const { products } = useProducts();

  const selectedIds = value.map(i => i.product_id);

  const handleAddProducts = (ids: string[]) => {
    const newIds = ids.filter(id => !selectedIds.includes(id) && id !== currentProductId);
    const newItems: BundleItem[] = newIds.map(id => ({
      product_id: id,
      quantity: 1,
      is_required: true,
    }));
    onChange([...value, ...newItems]);
  };

  const handleRemove = (productId: string) => {
    onChange(value.filter(i => i.product_id !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    onChange(value.map(i => i.product_id === productId ? { ...i, quantity: Math.max(1, quantity) } : i));
  };

  const handleRequiredToggle = (productId: string) => {
    onChange(value.map(i => i.product_id === productId ? { ...i, is_required: !i.is_required } : i));
  };

  const getProduct = (id: string) => products.find(p => p.id === id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Bundel inhoud
          {value.length > 0 && (
            <Badge variant="secondary">{value.length} item{value.length !== 1 ? 's' : ''}</Badge>
          )}
        </CardTitle>
        <CardDescription>Voeg producten of diensten toe aan deze bundel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.length > 0 && (
          <div className="space-y-2">
            {value.map((item) => {
              const product = getProduct(item.product_id);
              if (!product) return null;
              const imgUrl = product.images?.[0] || (product as any).image_url;
              return (
                <div
                  key={item.product_id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">€{product.price?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Aantal</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product_id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Verplicht</Label>
                      <Switch
                        checked={item.is_required}
                        onCheckedChange={() => handleRequiredToggle(item.product_id)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(item.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showSelect ? (
          <div className="space-y-2">
            <ProductMultiSelect
              selectedIds={selectedIds}
              onChange={(ids) => {
                handleAddProducts(ids.filter(id => !selectedIds.includes(id)));
                // Remove deselected
                const removed = selectedIds.filter(id => !ids.includes(id));
                if (removed.length > 0) {
                  onChange(value.filter(i => !removed.includes(i.product_id)));
                }
              }}
              placeholder="Zoek en selecteer producten..."
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSelect(false)}>
              Sluiten
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setShowSelect(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Product toevoegen
          </Button>
        )}

        {value.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Voeg minimaal één product toe aan de bundel
          </p>
        )}
      </CardContent>
    </Card>
  );
}

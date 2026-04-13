import { useState } from 'react';
import { Plus, Trash2, Link2, Unlink, Wand2, GripVertical, Pencil, Check, X, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProductVariants, type VariantFormData } from '@/hooks/useProductVariants';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProductVariantsTabProps {
  productId: string;
  productImages?: string[];
}

export function ProductVariantsTab({ productId, productImages = [] }: ProductVariantsTabProps) {
  const {
    variants, options, isLoading,
    createVariant, updateVariant, deleteVariant,
    createOption, updateOption, deleteOption,
    generateVariants, syncVariants,
  } = useProductVariants(productId);
  const { products } = useProducts();

  // Option management state
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionValues, setEditOptionValues] = useState('');

  // Variant edit state
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantData, setEditVariantData] = useState<Partial<VariantFormData>>({});

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingVariantId, setLinkingVariantId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Filter out current product from linkable products
  const linkableProducts = products.filter(p => p.id !== productId);

  const handleAddOption = () => {
    if (!newOptionName.trim()) return;
    const values = newOptionValues.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) {
      toast.error('Voeg minimaal één waarde toe');
      return;
    }
    createOption.mutate({
      name: newOptionName.trim(),
      values,
      position: options.length,
    });
    setNewOptionName('');
    setNewOptionValues('');
  };

  const handleUpdateOptionValues = (optionId: string) => {
    const values = editOptionValues.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    updateOption.mutate({ id: optionId, data: { values } }, {
      onSuccess: () => {
        // Build updated options list with the new values to sync variants
        const updatedOptions = options.map(o =>
          o.id === optionId ? { ...o, values } : o
        );
        syncVariants.mutate(updatedOptions);
      },
    });
    setEditingOptionId(null);
  };

  const handleGenerateVariants = () => {
    generateVariants.mutate();
  };

  const startEditVariant = (variant: any) => {
    setEditingVariantId(variant.id);
    setEditVariantData({
      price: variant.price,
      compare_at_price: variant.compare_at_price,
      stock: variant.stock,
      sku: variant.sku,
      is_active: variant.is_active,
    });
  };

  const saveEditVariant = () => {
    if (!editingVariantId) return;
    updateVariant.mutate({ id: editingVariantId, data: editVariantData });
    setEditingVariantId(null);
  };

  const openLinkDialog = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    setLinkingVariantId(variantId);
    setSelectedProductId(variant?.linked_product_id || '');
    setLinkDialogOpen(true);
  };

  const handleLinkProduct = () => {
    if (!linkingVariantId) return;
    updateVariant.mutate({
      id: linkingVariantId,
      data: { linked_product_id: selectedProductId || null },
    });
    setLinkDialogOpen(false);
  };

  const handleUnlinkProduct = (variantId: string) => {
    updateVariant.mutate({
      id: variantId,
      data: { linked_product_id: null },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Options Management */}
      <Card>
        <CardHeader>
          <CardTitle>Variant opties</CardTitle>
          <CardDescription>
            Definieer opties zoals Kleur, Maat, etc. en hun mogelijke waarden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing options */}
          {options.map(option => (
            <div key={option.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <Label className="font-medium">{option.name}</Label>
                {editingOptionId === option.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editOptionValues}
                      onChange={e => setEditOptionValues(e.target.value)}
                      placeholder="Waarden, komma gescheiden"
                      className="flex-1"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => handleUpdateOptionValues(option.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEditingOptionId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {option.values.map(v => (
                      <Badge key={v} variant="secondary">{v}</Badge>
                    ))}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingOptionId(option.id);
                        setEditOptionValues(option.values.join(', '));
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Optie verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dit verwijdert de optie "{option.name}". Bestaande varianten blijven bestaan maar verliezen hun koppeling met deze optie.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteOption.mutate(option.id)}>
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          {/* Add new option */}
          <div className="grid grid-cols-[200px_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Optienaam</Label>
              <Input
                value={newOptionName}
                onChange={e => setNewOptionName(e.target.value)}
                placeholder="bijv. Kleur"
              />
            </div>
            <div>
              <Label className="text-xs">Waarden (komma gescheiden)</Label>
              <Input
                value={newOptionValues}
                onChange={e => setNewOptionValues(e.target.value)}
                placeholder="bijv. Rood, Blauw, Groen"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
              />
            </div>
            <Button type="button" onClick={handleAddOption} disabled={createOption.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Toevoegen
            </Button>
          </div>

          {/* Generate variants button */}
          {options.length > 0 && (
            <Button
              type="button"
              onClick={handleGenerateVariants}
              disabled={generateVariants.isPending}
              variant="outline"
              className="w-full"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Varianten genereren uit opties
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Variants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Varianten ({variants.length})</CardTitle>
          <CardDescription>
            Beheer individuele varianten, prijzen, voorraad en productbkoppelingen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Geen varianten. Voeg opties toe en genereer varianten, of voeg ze handmatig toe.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Prijs</TableHead>
                    <TableHead>Voorraad</TableHead>
                    <TableHead>Actief</TableHead>
                    <TableHead>Gekoppeld product</TableHead>
                    <TableHead className="w-[100px]">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map(variant => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{variant.title}</span>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(variant.attribute_values || {}).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k}: {v}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingVariantId === variant.id ? (
                          <Input
                            value={editVariantData.sku ?? ''}
                            onChange={e => setEditVariantData(prev => ({ ...prev, sku: e.target.value }))}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">{variant.sku || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingVariantId === variant.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editVariantData.price ?? ''}
                            onChange={e => setEditVariantData(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))}
                            className="w-24"
                          />
                        ) : (
                          <span>{variant.price != null ? `€${variant.price.toFixed(2)}` : '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingVariantId === variant.id ? (
                          <Input
                            type="number"
                            value={editVariantData.stock ?? 0}
                            onChange={e => setEditVariantData(prev => ({ ...prev, stock: Number(e.target.value) }))}
                            className="w-20"
                          />
                        ) : (
                          <span>{variant.stock}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingVariantId === variant.id ? (
                          <Switch
                            checked={editVariantData.is_active ?? true}
                            onCheckedChange={v => setEditVariantData(prev => ({ ...prev, is_active: v }))}
                          />
                        ) : (
                          <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                            {variant.is_active ? 'Ja' : 'Nee'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {variant.linked_product_id ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              <Link2 className="h-3 w-3 mr-1" />
                              {linkableProducts.find(p => p.id === variant.linked_product_id)?.name || 'Gekoppeld'}
                            </Badge>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleUnlinkProduct(variant.id)}
                            >
                              <Unlink className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openLinkDialog(variant.id)}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Koppelen
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {editingVariantId === variant.id ? (
                            <>
                              <Button type="button" size="icon" variant="ghost" onClick={saveEditVariant}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" onClick={() => setEditingVariantId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" size="icon" variant="ghost" onClick={() => startEditVariant(variant)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="icon" variant="ghost" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Variant verwijderen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Variant "{variant.title}" wordt permanent verwijderd.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteVariant.mutate(variant.id)}>
                                      Verwijderen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Product Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Variant koppelen aan product</DialogTitle>
            <DialogDescription>
              Kies een bestaand product om aan deze variant te koppelen. Het gekoppelde product verschijnt als zelfstandig product in de catalogus, maar klanten kunnen via de variant selector navigeren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Product selecteren</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies een product..." />
                </SelectTrigger>
                <SelectContent>
                  {linkableProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>Annuleren</Button>
            <Button type="button" onClick={handleLinkProduct} disabled={!selectedProductId}>
              <Link2 className="h-4 w-4 mr-2" />
              Koppelen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

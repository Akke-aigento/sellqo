import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { Plus, Minus, Trash2, Link2, Unlink, Wand2, GripVertical, Pencil, Check, X, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TagInput, type TagInputHandle } from '@/components/ui/tag-input';
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

function InlineStockStepper({ stock, onUpdate }: { stock: number; onUpdate: (val: number) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(stock.toString());

  const handleCommit = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed) && parsed !== stock) {
      onUpdate(Math.max(0, parsed));
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        type="number"
        min={0}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') setIsEditing(false); }}
        className="h-7 w-16 text-sm text-center"
        autoFocus
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6"
        onClick={e => { e.stopPropagation(); onUpdate(Math.max(0, stock - 1)); }}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <button
        className="min-w-[2rem] text-center text-sm font-mono hover:underline cursor-pointer bg-transparent border-none"
        onClick={e => { e.stopPropagation(); setInputVal(stock.toString()); setIsEditing(true); }}
      >
        {stock}
      </button>
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6"
        onClick={e => { e.stopPropagation(); onUpdate(stock + 1); }}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

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

  // Container-width detection for existing variants section
  const variantsContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  useEffect(() => {
    const el = variantsContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only show table when container is wide enough for all 8 columns
  const useTableLayout = containerWidth >= 900;

  // Option management state
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState<string[]>([]);
  const newTagInputRef = useRef<TagInputHandle>(null);
  const editTagInputRef = useRef<TagInputHandle>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionValues, setEditOptionValues] = useState<string[]>([]);

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
    // Commit any uncommitted text and get the final values
    const finalValues = newTagInputRef.current?.commitPending() ?? newOptionValues;
    if (finalValues.length === 0) {
      toast.error('Voeg minimaal één waarde toe');
      return;
    }
    createOption.mutate({
      name: newOptionName.trim(),
      values: finalValues,
      position: options.length,
    });
    setNewOptionName('');
    setNewOptionValues([]);
  };

  const handleUpdateOptionValues = (optionId: string) => {
    const finalValues = editTagInputRef.current?.commitPending() ?? editOptionValues;
    if (finalValues.length === 0) return;
    const values = finalValues;
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
      image_url: variant.image_url,
    });
  };

  const handleSelectVariantImage = (variantId: string, imageUrl: string | null) => {
    updateVariant.mutate({ id: variantId, data: { image_url: imageUrl } });
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
                  <div className="space-y-2 mt-1">
                    <TagInput
                      ref={editTagInputRef}
                      values={editOptionValues}
                      onChange={setEditOptionValues}
                      placeholder="Typ waarde + Enter"
                    />
                    <p className="text-xs text-muted-foreground">Druk Enter na elke waarde</p>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleUpdateOptionValues(option.id)}>
                        <Check className="h-4 w-4 mr-1" /> Opslaan
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingOptionId(null)}>
                        <X className="h-4 w-4 mr-1" /> Annuleren
                      </Button>
                    </div>
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
                        setEditOptionValues([...option.values]);
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
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_auto] gap-2 lg:items-end">
            <div>
              <Label className="text-xs">Optienaam</Label>
              <Input
                value={newOptionName}
                onChange={e => setNewOptionName(e.target.value)}
                placeholder="bijv. Kleur"
              />
            </div>
            <div>
              <Label className="text-xs">Waarden</Label>
              <TagInput
                ref={newTagInputRef}
                values={newOptionValues}
                onChange={setNewOptionValues}
                placeholder="Typ waarde + Enter"
              />
              <p className="text-xs text-muted-foreground">Druk Enter na elke waarde</p>
            </div>
            <Button type="button" onClick={handleAddOption} disabled={createOption.isPending} className="w-full lg:w-auto">
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
            Beheer individuele varianten, prijzen, voorraad en productkoppelingen.
          </CardDescription>
        </CardHeader>
        <CardContent ref={variantsContainerRef}>
          {variants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Geen varianten. Voeg opties toe en genereer varianten, of voeg ze handmatig toe.</p>
            </div>
          ) : (
            <>
              {/* Card layout - shown when container is not wide enough for table */}
              {!useTableLayout && (
                <div className="space-y-3">
                {variants.map(variant => (
                  <div key={variant.id} className="border rounded-lg p-3 space-y-3">
                    {/* Top row: image + title + actions */}
                    <div className="flex items-start gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'w-10 h-10 rounded border overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all shrink-0',
                              !variant.image_url && 'border-dashed border-muted-foreground/30 bg-muted/50'
                            )}
                          >
                            {variant.image_url ? (
                              <img src={variant.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImagePlus className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="start">
                          <p className="text-sm font-medium mb-2">Kies afbeelding</p>
                          {productImages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Geen productafbeeldingen beschikbaar.</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {productImages.map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSelectVariantImage(variant.id, img)}
                                  className={cn(
                                    'aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all',
                                    variant.image_url === img && 'ring-2 ring-primary'
                                  )}
                                >
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                          {variant.image_url && (
                            <Button type="button" variant="ghost" size="sm" className="w-full mt-2 text-destructive" onClick={() => handleSelectVariantImage(variant.id, null)}>
                              <X className="h-3 w-3 mr-1" /> Verwijderen
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{variant.title}</span>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(variant.attribute_values || {}).map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editingVariantId === variant.id ? (
                          <>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={saveEditVariant}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingVariantId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditVariant(variant)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Variant verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription>Variant "{variant.title}" wordt permanent verwijderd.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteVariant.mutate(variant.id)}>Verwijderen</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Details grid */}
                    {editingVariantId === variant.id ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">SKU</Label>
                          <Input value={editVariantData.sku ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, sku: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Prijs</Label>
                          <Input type="number" step="0.01" value={editVariantData.price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Voorraad</Label>
                          <Input type="number" value={editVariantData.stock ?? 0} onChange={e => setEditVariantData(prev => ({ ...prev, stock: Number(e.target.value) }))} className="h-8 text-sm" />
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <Label className="text-xs text-muted-foreground">Actief</Label>
                          <Switch checked={editVariantData.is_active ?? true} onCheckedChange={v => setEditVariantData(prev => ({ ...prev, is_active: v }))} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground block">SKU</span>
                          <span>{variant.sku || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Prijs</span>
                          <span>{variant.price != null ? `€${variant.price.toFixed(2)}` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Voorraad</span>
                          <InlineStockStepper stock={variant.stock} onUpdate={(newStock) => updateVariant.mutate({ id: variant.id, data: { stock: newStock } })} />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Actief</span>
                          <Badge variant={variant.is_active ? 'default' : 'secondary'} className="text-xs">{variant.is_active ? 'Ja' : 'Nee'}</Badge>
                        </div>
                      </div>
                    )}
                    {/* Linked product */}
                    <div className="flex items-center gap-2">
                      {variant.linked_product_id ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {linkableProducts.find(p => p.id === variant.linked_product_id)?.name || 'Gekoppeld'}
                          </Badge>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUnlinkProduct(variant.id)}>
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openLinkDialog(variant.id)}>
                          <Link2 className="h-3 w-3 mr-1" /> Koppelen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* Desktop table layout - only when container is wide enough */}
              {useTableLayout && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Foto</TableHead>
                      <TableHead className="min-w-0">Variant</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Prijs</TableHead>
                      <TableHead>Voorraad</TableHead>
                      <TableHead>Actief</TableHead>
                      <TableHead className="min-w-0">Gekoppeld</TableHead>
                      <TableHead className="w-[80px] whitespace-nowrap">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map(variant => (
                      <TableRow key={variant.id}>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'w-10 h-10 rounded border overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all',
                                  !variant.image_url && 'border-dashed border-muted-foreground/30 bg-muted/50'
                                )}
                              >
                                {variant.image_url ? (
                                  <img src={variant.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="start">
                              <p className="text-sm font-medium mb-2">Kies afbeelding</p>
                              {productImages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Geen productafbeeldingen beschikbaar.</p>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {productImages.map((img, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleSelectVariantImage(variant.id, img)}
                                      className={cn(
                                        'aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all',
                                        variant.image_url === img && 'ring-2 ring-primary'
                                      )}
                                    >
                                      <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {variant.image_url && (
                                <Button type="button" variant="ghost" size="sm" className="w-full mt-2 text-destructive" onClick={() => handleSelectVariantImage(variant.id, null)}>
                                  <X className="h-3 w-3 mr-1" /> Verwijderen
                                </Button>
                              )}
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="min-w-0 max-w-[200px]">
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{variant.title}</span>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {Object.entries(variant.attribute_values || {}).map(([k, v]) => (
                                <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingVariantId === variant.id ? (
                            <Input value={editVariantData.sku ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, sku: e.target.value }))} className="w-24" />
                          ) : (
                            <span className="text-sm text-muted-foreground">{variant.sku || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingVariantId === variant.id ? (
                            <Input type="number" step="0.01" value={editVariantData.price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))} className="w-24" />
                          ) : (
                            <span>{variant.price != null ? `€${variant.price.toFixed(2)}` : '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingVariantId === variant.id ? (
                            <Input type="number" value={editVariantData.stock ?? 0} onChange={e => setEditVariantData(prev => ({ ...prev, stock: Number(e.target.value) }))} className="w-20" />
                          ) : (
                            <InlineStockStepper stock={variant.stock} onUpdate={(newStock) => updateVariant.mutate({ id: variant.id, data: { stock: newStock } })} />
                          )}
                        </TableCell>
                        <TableCell>
                          {editingVariantId === variant.id ? (
                            <Switch checked={editVariantData.is_active ?? true} onCheckedChange={v => setEditVariantData(prev => ({ ...prev, is_active: v }))} />
                          ) : (
                            <Badge variant={variant.is_active ? 'default' : 'secondary'}>{variant.is_active ? 'Ja' : 'Nee'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {variant.linked_product_id ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <Badge variant="outline" className="text-xs max-w-[120px] truncate">
                                <Link2 className="h-3 w-3 mr-1 shrink-0" />
                                <span className="truncate">{linkableProducts.find(p => p.id === variant.linked_product_id)?.name || 'Gekoppeld'}</span>
                              </Badge>
                              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUnlinkProduct(variant.id)}>
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" onClick={() => openLinkDialog(variant.id)}>
                              <Link2 className="h-3 w-3 mr-1" /> Koppelen
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
                                      <AlertDialogDescription>Variant "{variant.title}" wordt permanent verwijderd.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteVariant.mutate(variant.id)}>Verwijderen</AlertDialogAction>
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
            </>
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

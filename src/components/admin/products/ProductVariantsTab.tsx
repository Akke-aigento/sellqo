import { useState, useRef, useEffect } from 'react';
import { History, Plus, Minus, Trash2, Link2, Unlink, Wand2, GripVertical, Pencil, Check, X, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DynamicValueInputs, type DynamicValueInputsHandle } from '@/components/ui/dynamic-value-inputs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProductVariants, type VariantFormData } from '@/hooks/useProductVariants';
import { VariantExtraImagesDialog } from './VariantExtraImagesDialog';
import { StockLedgerDialog } from './StockLedgerDialog';
import { useSetStockManual } from '@/hooks/useStockLedger';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  trackInventory?: boolean;
  defaultPrice?: number | null;
}

export function ProductVariantsTab({ productId, productImages = [], trackInventory = true, defaultPrice = null }: ProductVariantsTabProps) {
  const { t } = useTranslation();
  const {
    variants, options, isLoading,
    createVariant, updateVariant, deleteVariant,
    createOption, updateOption, deleteOption,
    generateVariants, syncVariants,
  } = useProductVariants(productId, defaultPrice);
  const { products } = useProducts();
  const setStockManual = useSetStockManual();

  // Stock ledger dialog state
  const [ledgerVariantId, setLedgerVariantId] = useState<string | null>(null);

  /** Manual stock change — always via the ledger, never a direct stock update. */
  const handleStockChange = (variantId: string, oldStock: number, newStock: number) => {
    setStockManual.mutate({
      productId,
      variantId,
      oldStock: oldStock ?? 0,
      newStock,
      note: 'Handmatige correctie via variantenoverzicht',
    });
  };

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
  const newTagInputRef = useRef<DynamicValueInputsHandle>(null);
  const editTagInputRef = useRef<DynamicValueInputsHandle>(null);
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
      cost_price: variant.cost_price,
      stock: variant.stock,
      sku: variant.sku,
      is_active: variant.is_active,
      image_url: variant.image_url,
    });
  };

  const handleSelectVariantImage = (variantId: string, imageUrl: string | null) => {
    updateVariant.mutate({ id: variantId, data: { image_url: imageUrl } });
  };

  const handleVariantImagesChange = (variantId: string, images: string[]) => {
    updateVariant.mutate({ id: variantId, data: { images } });
  };

  const saveEditVariant = () => {
    if (!editingVariantId) return;
    const variant = variants.find(v => v.id === editingVariantId);
    const { stock, ...rest } = editVariantData;
    updateVariant.mutate({ id: editingVariantId, data: rest });
    if (variant && typeof stock === 'number' && stock !== variant.stock) {
      handleStockChange(editingVariantId, variant.stock ?? 0, stock);
    }
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
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Options Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.productVariantsTab.variant_opties')}</CardTitle>
          <CardDescription>
            {t('admin.products.productVariantsTab.definieer_opties_zoals_kleur_maat_etc')}
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
                    <DynamicValueInputs
                      ref={editTagInputRef}
                      values={editOptionValues}
                      onChange={setEditOptionValues}
                      placeholder={t('admin.products.productVariantsTab.typ_waarde')}
                    />
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleUpdateOptionValues(option.id)}>
                        <Check className="h-4 w-4 mr-1" /> {t('common.save')}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingOptionId(null)}>
                        <X className="h-4 w-4 mr-1" /> {t('common.cancel')}
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
                    <AlertDialogTitle>{t('admin.products.productVariantsTab.optie_verwijderen')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dit verwijdert de optie "{option.name}". Bestaande varianten blijven bestaan maar verliezen hun koppeling met deze optie.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteOption.mutate(option.id)}>
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          {/* Add new option */}
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_auto] gap-2 lg:items-end">
            <div>
              <Label className="text-xs">{t('admin.products.productVariantsTab.optienaam')}</Label>
              <Input
                value={newOptionName}
                onChange={e => setNewOptionName(e.target.value)}
                placeholder={t('admin.products.productVariantsTab.bijv_kleur')}
              />
            </div>
            <div>
              <Label className="text-xs">{t('admin.products.productVariantsTab.waarden')}</Label>
              <DynamicValueInputs
                ref={newTagInputRef}
                values={newOptionValues}
                onChange={setNewOptionValues}
                placeholder={t('admin.products.productVariantsTab.typ_waarde_2')}
              />
            </div>
            <Button type="button" onClick={handleAddOption} disabled={createOption.isPending} className="w-full lg:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              {t('common.add')}
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
              {t('admin.products.productVariantsTab.varianten_genereren_uit_opties')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Variants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Varianten ({variants.length})</CardTitle>
          <CardDescription>
            {t('admin.products.productVariantsTab.beheer_individuele_varianten_prijzen_voorraad_en')}
          </CardDescription>
        </CardHeader>
        <CardContent ref={variantsContainerRef}>
          {variants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('admin.products.productVariantsTab.geen_varianten_voeg_opties_toe_en')}</p>
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
                          <p className="text-sm font-medium mb-2">{t('admin.products.productVariantsTab.kies_afbeelding')}</p>
                          {productImages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{t('admin.products.productVariantsTab.geen_productafbeeldingen_beschikbaar')}</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                              <X className="h-3 w-3 mr-1" /> {t('common.delete')}
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
                            <VariantExtraImagesDialog
                              variantTitle={variant.title}
                              images={variant.images ?? []}
                              onChange={(imgs) => handleVariantImagesChange(variant.id, imgs)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('admin.products.productVariantsTab.variant_verwijderen')}</AlertDialogTitle>
                                  <AlertDialogDescription>Variant "{variant.title}" wordt permanent verwijderd.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteVariant.mutate(variant.id)}>{t('common.delete')}</AlertDialogAction>
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
                          <Label className="text-xs text-muted-foreground">{t('common.price')}</Label>
                          <Input type="number" step="0.01" value={editVariantData.price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : null }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Van-prijs</Label>
                          <Input type="number" step="0.01" value={editVariantData.compare_at_price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, compare_at_price: e.target.value ? Number(e.target.value) : null }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">{t('admin.stockReport.colCostPrice')}</Label>
                          <Input type="number" step="0.01" value={editVariantData.cost_price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, cost_price: e.target.value ? Number(e.target.value) : null }))} className="h-8 text-sm" />
                        </div>
                        {trackInventory && (
                        <div>
                          <Label className="text-xs text-muted-foreground">{t('admin.stockReport.colStock')}</Label>
                          <Input type="number" value={editVariantData.stock ?? 0} onChange={e => setEditVariantData(prev => ({ ...prev, stock: Number(e.target.value) }))} className="h-8 text-sm" />
                        </div>
                        )}
                        <div className="flex items-end gap-2 pb-1">
                          <Label className="text-xs text-muted-foreground">{t('admin.marketing.aBTestingPanel.actief')}</Label>
                          <Switch checked={editVariantData.is_active ?? true} onCheckedChange={v => setEditVariantData(prev => ({ ...prev, is_active: v }))} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <span className="text-xs text-muted-foreground block">SKU</span>
                          <span className="break-all">{variant.sku || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">{t('common.price')}</span>
                          <span>
                            {variant.price != null ? `€${variant.price.toFixed(2)}` : '—'}
                            {variant.compare_at_price != null && (
                              <span className="ml-1 text-xs text-muted-foreground line-through">€{variant.compare_at_price.toFixed(2)}</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">{t('admin.stockReport.colCostPrice')}</span>
                          <span className="text-muted-foreground">{variant.cost_price != null ? `€${variant.cost_price.toFixed(2)}` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">{t('admin.stockReport.colStock')}</span>
                          {trackInventory ? (
                            <div className="inline-flex items-center gap-1"><InlineStockStepper stock={variant.stock} onUpdate={(newStock) => handleStockChange(variant.id, variant.stock ?? 0, newStock)} /><Button variant="ghost" size="icon" className="h-6 w-6" title={t('admin.stockLedger.title')} onClick={e => { e.stopPropagation(); setLedgerVariantId(variant.id); }}><History className="h-3.5 w-3.5" /></Button></div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t('admin.products.productVariantsTab.niet_bijgehouden')}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">{t('admin.marketing.aBTestingPanel.actief')}</span>
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
                          <Link2 className="h-3 w-3 mr-1" /> {t('admin.products.productVariantsTab.koppelen')}
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
                      <TableHead className="w-[50px]">{t('admin.products.productVariantsTab.foto')}</TableHead>
                      <TableHead className="min-w-0">{t('admin.stockReport.colVariant')}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>{t('common.price')}</TableHead>
                      <TableHead>Van-prijs</TableHead>
                      <TableHead>{t('admin.stockReport.colCostPrice')}</TableHead>
                      <TableHead>{t('admin.stockReport.colStock')}</TableHead>
                      <TableHead>{t('admin.marketing.aBTestingPanel.actief')}</TableHead>
                      <TableHead className="min-w-0">{t('admin.ads.platformConnections.gekoppeld')}</TableHead>
                      <TableHead className="w-[80px] whitespace-nowrap">{t('common.actions')}</TableHead>
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
                              <p className="text-sm font-medium mb-2">{t('admin.products.productVariantsTab.kies_afbeelding_2')}</p>
                              {productImages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t('admin.products.productVariantsTab.geen_productafbeeldingen_beschikbaar_2')}</p>
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
                                  <X className="h-3 w-3 mr-1" /> {t('common.delete')}
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
                            <Input type="number" step="0.01" value={editVariantData.compare_at_price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, compare_at_price: e.target.value ? Number(e.target.value) : null }))} className="w-24" />
                          ) : (
                            <span className="text-sm text-muted-foreground line-through">{variant.compare_at_price != null ? `€${variant.compare_at_price.toFixed(2)}` : '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingVariantId === variant.id ? (
                            <Input type="number" step="0.01" value={editVariantData.cost_price ?? ''} onChange={e => setEditVariantData(prev => ({ ...prev, cost_price: e.target.value ? Number(e.target.value) : null }))} className="w-24" />
                          ) : (
                            <span className="text-sm text-muted-foreground">{variant.cost_price != null ? `€${variant.cost_price.toFixed(2)}` : '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {trackInventory ? (
                            editingVariantId === variant.id ? (
                              <Input type="number" value={editVariantData.stock ?? 0} onChange={e => setEditVariantData(prev => ({ ...prev, stock: Number(e.target.value) }))} className="w-20" />
                            ) : (
                              <div className="inline-flex items-center gap-1"><InlineStockStepper stock={variant.stock} onUpdate={(newStock) => handleStockChange(variant.id, variant.stock ?? 0, newStock)} /><Button variant="ghost" size="icon" className="h-6 w-6" title={t('admin.stockLedger.title')} onClick={e => { e.stopPropagation(); setLedgerVariantId(variant.id); }}><History className="h-3.5 w-3.5" /></Button></div>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
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
                              <Link2 className="h-3 w-3 mr-1" /> {t('admin.products.productVariantsTab.koppelen')}
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
                                <VariantExtraImagesDialog
                                  variantTitle={variant.title}
                                  images={variant.images ?? []}
                                  onChange={(imgs) => handleVariantImagesChange(variant.id, imgs)}
                                />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button type="button" size="icon" variant="ghost" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('admin.products.productVariantsTab.variant_verwijderen_2')}</AlertDialogTitle>
                                      <AlertDialogDescription>Variant "{variant.title}" wordt permanent verwijderd.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteVariant.mutate(variant.id)}>{t('common.delete')}</AlertDialogAction>
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
            <DialogTitle>{t('admin.products.productVariantsTab.variant_koppelen_aan_product')}</DialogTitle>
            <DialogDescription>
              {t('admin.products.productVariantsTab.kies_een_bestaand_product_om_aan')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t('admin.products.productVariantsTab.product_selecteren')}</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.marketing.aIImageGenerator.kies_een_product')} />
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
            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={handleLinkProduct} disabled={!selectedProductId}>
              <Link2 className="h-4 w-4 mr-2" />
              {t('admin.products.productVariantsTab.koppelen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StockLedgerDialog
        open={ledgerVariantId !== null}
        onOpenChange={(o) => { if (!o) setLedgerVariantId(null); }}
        productId={productId}
        variantId={ledgerVariantId}
        title={variants.find(v => v.id === ledgerVariantId)?.title ?? undefined}
      />

    </div>
  );
}

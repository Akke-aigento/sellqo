import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Info, Loader2, Package } from 'lucide-react';
import {
  usePrintfulImportApply, usePrintfulImportPreview,
  type ApplyPayloadProduct, type PrintfulImportPreviewProduct,
} from '@/hooks/usePrintfulImport';

interface Props {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintfulImportDialog({ tenantId, open, onOpenChange }: Props) {
  const preview = usePrintfulImportPreview(tenantId);
  const apply = usePrintfulImportApply(tenantId);

  const [products, setProducts] = useState<PrintfulImportPreviewProduct[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    preview.mutate(undefined, {
      onSuccess: (res) => {
        setProducts(res.products);
        const sel: Record<number, boolean> = {};
        const pr: Record<number, string> = {};
        res.products.forEach((p) => {
          sel[p.sync_product_id] = !p.duplicate;
          p.variants.forEach((v) => {
            pr[v.sync_variant_id] = v.retail_price != null ? String(v.retail_price) : '';
          });
        });
        setSelected(sel);
        setPrices(pr);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId]);

  const selectedCount = useMemo(
    () => products.filter((p) => selected[p.sync_product_id]).length,
    [products, selected],
  );

  const handleImport = () => {
    const payload: ApplyPayloadProduct[] = products
      .filter((p) => selected[p.sync_product_id])
      .map((p) => ({
        sync_product_id: p.sync_product_id,
        name: p.name,
        featured_source_url: p.thumbnail_url,
        variants: p.variants.map((v) => {
          const raw = prices[v.sync_variant_id];
          const parsed = raw ? Number.parseFloat(raw.replace(',', '.')) : NaN;
          return {
            sync_variant_id: v.sync_variant_id,
            title: v.title,
            attribute_values: v.attribute_values,
            sku: v.sku,
            price: Number.isFinite(parsed) ? parsed : v.retail_price,
            preview_image_url: v.preview_image_url,
          };
        }),
      }));
    apply.mutate(payload, { onSuccess: () => setDone(true) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Producten importeren uit Printful</DialogTitle>
          <DialogDescription>
            Kies welke Printful-producten je als SellQo-product wilt aanmaken. Elke Printful-variant wordt een
            SellQo-variant.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-xs">
            De prijzen zijn een <strong>suggestie</strong> uit Printful — pas ze hier gerust aan. Geïmporteerde
            producten komen op <strong>niet-actief en verborgen</strong> te staan, zodat je ze eerst kunt nakijken
            voordat je ze zelf live zet.
          </AlertDescription>
        </Alert>

        {preview.isPending && (
          <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Printful-producten ophalen…
          </div>
        )}

        {!preview.isPending && products.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Geen producten gevonden in je Printful-winkel.
          </p>
        )}

        <div className="space-y-3">
          {products.map((p) => (
            <Collapsible key={p.sync_product_id} className="border rounded-lg">
              <div className="flex items-start gap-3 p-3">
                <Checkbox
                  className="mt-1"
                  checked={!!selected[p.sync_product_id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [p.sync_product_id]: !!v }))}
                />
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.name} className="w-12 h-12 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm break-words">{p.name}</span>
                    {p.duplicate && <Badge variant="secondary">Al geïmporteerd</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.variants.length} varianten</p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <div className="border-t divide-y">
                  {p.variants.map((v) => (
                    <div key={v.sync_variant_id} className="flex items-center gap-3 p-3">
                      {v.preview_image_url ? (
                        <img src={v.preview_image_url} alt={v.title} className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{v.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {Object.entries(v.attribute_values).map(([k, val]) => `${k}: ${val}`).join(' · ')}
                          {v.sku ? ` · ${v.sku}` : ''}
                        </p>
                        {v.sku_in_use && (
                          <p className="text-xs text-muted-foreground">SKU bestaat al bij een andere variant</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">€</span>
                        <Input
                          className="w-24"
                          inputMode="decimal"
                          value={prices[v.sync_variant_id] ?? ''}
                          onChange={(e) => setPrices((s) => ({ ...s, [v.sync_variant_id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {done && (
          <Alert>
            <AlertDescription className="text-xs">
              Klaar. Bekijk de nieuwe producten in{' '}
              <Link to="/admin/products" className="underline">Producten</Link> en zet ze live wanneer ze goed staan.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
          <Button onClick={handleImport} disabled={apply.isPending || selectedCount === 0}>
            {apply.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importeren{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

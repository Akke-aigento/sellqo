import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, Unlink } from 'lucide-react';
import { useCan } from '@/hooks/useCan';
import {
  usePrintfulSyncProducts, usePrintfulVariantMappings, useTenantVariants,
} from '@/hooks/usePrintfulVariantMappings';

interface Props {
  tenantId: string;
}

export function PrintfulVariantMapping({ tenantId }: Props) {
  const canWrite = useCan('write', 'integrations');
  const [search, setSearch] = useState('');
  const variants = useTenantVariants(tenantId);
  const products = usePrintfulSyncProducts(tenantId, true);
  const { mappings, upsert, remove } = usePrintfulVariantMappings(tenantId);

  const mapByVariant = useMemo(
    () => new Map(mappings.map((m) => [m.variant_id, m])),
    [mappings],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = variants.data ?? [];
    if (!q) return list;
    return list.filter((v) =>
      `${v.product_name} ${v.title} ${v.sku ?? ''}`.toLowerCase().includes(q));
  }, [variants.data, search]);

  const handleSelect = (variantId: string, value: string) => {
    const syncVariantId = Number(value);
    const product = (products.data ?? []).find((p) =>
      p.variants.some((v) => v.sync_variant_id === syncVariantId));
    const pfVariant = product?.variants.find((v) => v.sync_variant_id === syncVariantId);
    upsert.mutate({
      variant_id: variantId,
      printful_sync_variant_id: syncVariantId,
      printful_sync_product_id: product?.sync_product_id ?? null,
      printful_variant_name: pfVariant ? `${product?.name} · ${pfVariant.name}` : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Variant-koppeling</CardTitle>
            <CardDescription>
              Koppel je SellQo-varianten aan een Printful sync-variant. Alleen gekoppelde varianten
              kunnen worden doorgestuurd.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => products.refetch()}
            disabled={products.isFetching}
          >
            {products.isFetching
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <RefreshCw className="w-4 h-4 mr-2" />}
            Printful verversen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.isError && (
          <p className="text-sm text-destructive">
            {(products.error as Error)?.message || 'Printful-producten konden niet worden geladen'}
          </p>
        )}

        <Input
          placeholder="Zoek op product, variant of SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {variants.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Varianten laden…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen actieve varianten gevonden.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((v) => {
              const mapping = mapByVariant.get(v.id);
              return (
                <div
                  key={v.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.product_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.title}{v.sku ? ` · ${v.sku}` : ''}
                    </p>
                    <div className="mt-1">
                      {mapping ? (
                        <Badge variant="secondary">
                          Gekoppeld{mapping.printful_variant_name ? ` · ${mapping.printful_variant_name}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Niet gekoppeld</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:w-80">
                    <Select
                      value={mapping ? String(mapping.printful_sync_variant_id) : undefined}
                      onValueChange={(val) => handleSelect(v.id, val)}
                      disabled={!canWrite || products.isLoading || (products.data ?? []).length === 0}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={products.isLoading ? 'Laden…' : 'Kies Printful-variant'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(products.data ?? []).map((p) => (
                          <SelectGroup key={p.sync_product_id}>
                            <SelectLabel>{p.name}</SelectLabel>
                            {p.variants.map((pv) => (
                              <SelectItem key={pv.sync_variant_id} value={String(pv.sync_variant_id)}>
                                {pv.name}{pv.sku ? ` · ${pv.sku}` : ''}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ontkoppel variant"
                        onClick={() => remove.mutate(v.id)}
                        disabled={!canWrite}
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

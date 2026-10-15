import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/hooks/useCan';
import {
  usePrintfulSyncProducts, usePrintfulVariantMappings, useTenantVariants,
} from '@/hooks/usePrintfulVariantMappings';

interface Props {
  tenantId: string;
}

export function PrintfulVariantMapping({ tenantId }: Props) {
  const { t } = useTranslation();
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
            <CardTitle className="text-base">{t('admin.printful.mapping.title')}</CardTitle>
            <CardDescription>{t('admin.printful.mapping.description')}</CardDescription>
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
            {t('admin.printful.mapping.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.isError && (
          <p className="text-sm text-destructive">
            {(products.error as Error)?.message || t('admin.printful.mapping.load_error')}
          </p>
        )}

        <Input
          placeholder={t('admin.printful.mapping.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {variants.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('admin.printful.mapping.loading_variants')}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.printful.mapping.no_variants')}</p>
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
                          {t('admin.printful.mapping.linked')}{mapping.printful_variant_name ? ` · ${mapping.printful_variant_name}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('admin.printful.mapping.not_linked')}</Badge>
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
                        <SelectValue placeholder={products.isLoading ? t('admin.printful.mapping.loading') : t('admin.printful.mapping.choose_variant')} />
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
                        aria-label={t('admin.printful.mapping.unlink')}
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

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Search, Save } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock: number | null;
}

interface ChannelMap {
  product_id: string;
  is_advertised: boolean;
  min_stock_for_ads: number;
}

interface RowState {
  is_advertised: boolean;
  min_stock_for_ads: number;
  dirty: boolean;
}

const CHANNEL = 'bolcom';

export default function AdsProductMap() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, RowState>>({});

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['ads-products', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock')
        .eq('tenant_id', tenantId!)
        .order('name', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: maps, isLoading: mapsLoading } = useQuery({
    queryKey: ['ads-product-channel-map', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ChannelMap[]> => {
      const { data, error } = await supabase
        .from('ads_product_channel_map')
        .select('product_id, is_advertised, min_stock_for_ads')
        .eq('tenant_id', tenantId!)
        .eq('channel', CHANNEL);
      if (error) throw error;
      return (data ?? []) as ChannelMap[];
    },
  });

  const mapByProduct = useMemo(() => {
    const m = new Map<string, ChannelMap>();
    (maps ?? []).forEach((row) => m.set(row.product_id, row));
    return m;
  }, [maps]);

  const getRow = (productId: string): RowState => {
    if (overrides[productId]) return overrides[productId];
    const existing = mapByProduct.get(productId);
    return {
      is_advertised: existing?.is_advertised ?? false,
      min_stock_for_ads: existing?.min_stock_for_ads ?? 1,
      dirty: false,
    };
  };

  const setRow = (productId: string, patch: Partial<RowState>) => {
    setOverrides((prev) => {
      const current = prev[productId] ?? getRow(productId);
      return { ...prev, [productId]: { ...current, ...patch, dirty: true } };
    });
  };

  const saveOne = useMutation({
    mutationFn: async ({ productId, row }: { productId: string; row: RowState }) => {
      const { error } = await supabase
        .from('ads_product_channel_map')
        .upsert(
          {
            tenant_id: tenantId!,
            product_id: productId,
            channel: CHANNEL,
            is_advertised: row.is_advertised,
            min_stock_for_ads: row.min_stock_for_ads,
          },
          { onConflict: 'tenant_id,product_id,channel' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.productId];
        return next;
      });
      qc.invalidateQueries({ queryKey: ['ads-product-channel-map', tenantId] });
      toast({ title: 'Opgeslagen', description: 'Mapping bijgewerkt.' });
    },
    onError: (err: any) => {
      toast({ title: 'Fout', description: err?.message ?? 'Opslaan mislukt', variant: 'destructive' });
    },
  });

  const saveAll = useMutation({
    mutationFn: async () => {
      const dirty = Object.entries(overrides).filter(([, r]) => r.dirty);
      let ok = 0; let fail = 0;
      for (const [productId, row] of dirty) {
        try {
          const { error } = await supabase
            .from('ads_product_channel_map')
            .upsert(
              {
                tenant_id: tenantId!,
                product_id: productId,
                channel: CHANNEL,
                is_advertised: row.is_advertised,
                min_stock_for_ads: row.min_stock_for_ads,
              },
              { onConflict: 'tenant_id,product_id,channel' },
            );
          if (error) throw error;
          ok++;
        } catch {
          fail++;
        }
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      setOverrides({});
      qc.invalidateQueries({ queryKey: ['ads-product-channel-map', tenantId] });
      toast({
        title: 'Bulk opgeslagen',
        description: `${ok} succesvol${fail ? `, ${fail} mislukt` : ''}`,
        variant: fail ? 'destructive' : 'default',
      });
    },
  });

  const filtered = useMemo(() => {
    const list = products ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, search]);

  const dirtyCount = Object.values(overrides).filter((r) => r.dirty).length;
  const isLoading = productsLoading || mapsLoading;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Ads</span><span>/</span><span>Product Mapping</span>
        </div>
        <h1 className="text-2xl font-bold">Product Mapping</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bepaal welke producten geadverteerd worden op Bol.com en de minimale voorraad waaronder ads automatisch worden gepauzeerd.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Producten</CardTitle>
            <CardDescription>Bol.com kanaal — {filtered.length} resultaten</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[220px]"
              />
            </div>
            <Button
              onClick={() => saveAll.mutate()}
              disabled={dirtyCount === 0 || saveAll.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              Opslaan ({dirtyCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Geen producten gevonden.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-[100px]">Stock</TableHead>
                    <TableHead className="w-[160px]">Adverteren</TableHead>
                    <TableHead className="w-[160px]">Min stock voor ads</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Actie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const row = getRow(p.id);
                    const stock = p.stock ?? 0;
                    const paused = row.is_advertised && stock < row.min_stock_for_ads;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{stock}</TableCell>
                        <TableCell>
                          <Switch
                            checked={row.is_advertised}
                            onCheckedChange={(v) => setRow(p.id, { is_advertised: v })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={row.min_stock_for_ads}
                            onChange={(e) => setRow(p.id, { min_stock_for_ads: Math.max(0, +e.target.value || 0) })}
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell>
                          {!row.is_advertised ? (
                            <Badge variant="outline">Uit</Badge>
                          ) : paused ? (
                            <Badge variant="secondary">Gepauzeerd</Badge>
                          ) : (
                            <Badge variant="default">Actief</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!row.dirty || saveOne.isPending}
                            onClick={() => saveOne.mutate({ productId: p.id, row })}
                          >
                            Opslaan
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
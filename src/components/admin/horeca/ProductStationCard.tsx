// KASSA-UX-4 — "Bereiden aan": per product kiezen of het naar keuken, bar of een andere post gaat.
// Volgorde op de server (horeca_apply_one): productroute, dan categorieroute, dan de standaardpost.
// Zo kan een café de salami aan de toog laten snijden terwijl de rest van "Hapjes" naar de keuken gaat.
// Bewaart meteen, los van het productformulier (zoals de kanalen en de extra's).
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePrepStationMutations, usePrepStations } from '@/hooks/usePrepStations';

export function ProductStationCard({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = usePrepStations();
  const { routeProduct } = usePrepStationMutations();
  const { data: cat } = useQuery({
    queryKey: ['product-station-category', productId],
    queryFn: async () => {
      const { data: p, error } = await supabase.from('products').select('category_id').eq('id', productId).single();
      if (error) throw error;
      const categoryId = (p as unknown as { category_id: string | null }).category_id;
      if (!categoryId) return { id: null, name: null };
      const { data: c } = await supabase.from('categories').select('name').eq('id', categoryId).maybeSingle();
      return { id: categoryId, name: (c as unknown as { name: string } | null)?.name ?? null };
    },
  });

  const stations = data?.stations ?? [];
  const def = stations.find((s) => s.is_default) ?? null;
  const own = data?.routes.find((r) => r.product_id === productId)?.station_id ?? '';
  const catRoute = cat?.id ? data?.routes.find((r) => r.category_id === cat.id)?.station_id : undefined;
  const viaCategory = stations.find((s) => s.id === catRoute) ?? def;
  const followLabel = viaCategory
    ? cat?.name && catRoute
      ? t('admin.prepStations.product.followCategory', { category: cat.name, station: viaCategory.name })
      : t('admin.prepStations.product.followDefault', { station: viaCategory.name })
    : t('admin.prepStations.noStation');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.prepStations.product.title')}</CardTitle>
        <CardDescription>{t('admin.prepStations.product.intro')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('common.loading')} /> : stations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.prepStations.product.none')}{' '}
            <Link to="/admin/bestellen?tab=posten" className="underline">{t('admin.prepStations.product.manage')}</Link>
          </p>
        ) : (
          <div className="space-y-2">
            <select value={own} aria-label={t('admin.prepStations.product.title')} disabled={routeProduct.isPending}
              onChange={(e) => routeProduct.mutate({ productId, stationId: e.target.value || null }, {
                onError: (err) => toast.error(t('admin.prepStations.error', { detail: err instanceof Error ? err.message : String(err) })),
              })}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm sm:w-auto">
              <option value="">{followLabel}</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">
              {t('admin.prepStations.product.note')}{' '}
              <Link to="/admin/bestellen?tab=posten" className="underline">{t('admin.prepStations.product.manage')}</Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

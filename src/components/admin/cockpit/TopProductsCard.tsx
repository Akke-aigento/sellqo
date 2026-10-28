import { useRouteAllowed } from '@/hooks/useRouteAllowed';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import type { TopProduct } from '@/hooks/useCockpitSignals';
import { formatCurrency } from '@/lib/utils';

interface Props {
  title: string;
  products: TopProduct[] | undefined;
  isLoading: boolean;
  /** Compact: lijst met balkjes (horeca, "hits van vandaag"); anders tegels met foto. */
  compact?: boolean;
}

/** DASH-2b — best verkochte producten, als fototegels of als lijst met balkjes. */
export function TopProductsCard({ title, products, isLoading, compact }: Props) {
  const routeAllowed = useRouteAllowed();
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const list = products ?? [];
  const max = Math.max(1, ...list.map((p) => p.quantity));

  const link = (p: TopProduct) => (p.productId ? `/admin/products/${p.productId}/edit` : routeAllowed('/admin/products') ? '/admin/products' : '/admin/bestellen');

  let body: React.ReactNode;
  if (isLoading && !products) {
    body = compact ? (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (list.length === 0) {
    body = <p className="py-4 text-sm text-muted-foreground">{t('admin.cockpit.top.empty')}</p>;
  } else if (compact) {
    body = (
      <ul className="flex flex-col gap-3.5">
        {list.map((p) => (
          <li key={p.key}>
            <Link to={link(p)} className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Thumb product={p} className="h-11 w-11 rounded-lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="font-extrabold tabular-nums">{p.quantity}×</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[#FF6B33]" style={{ width: `${(p.quantity / max) * 100}%` }} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <ol className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5">
        {list.map((p, i) => (
          <li key={p.key} className="w-36 shrink-0 snap-start md:w-auto">
            <Link to={link(p)} className="group flex flex-col gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="relative block">
                <Thumb product={p} className="aspect-square w-full rounded-xl" />
                <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-extrabold shadow-sm">
                  {i + 1}
                </span>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t('admin.cockpit.top.sold', { count: p.quantity })} · {formatCurrency(p.revenue, currency)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {!compact && routeAllowed('/admin/products') && (
          <Link to="/admin/products" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            {t('admin.cockpit.top.all_products')}
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">{body}</CardContent>
    </Card>
  );
}

function Thumb({ product, className }: { product: TopProduct; className: string }) {
  return product.image ? (
    <img src={product.image} alt="" loading="lazy" className={`${className} bg-muted object-cover`} />
  ) : (
    <span className={`${className} flex items-center justify-center bg-muted text-muted-foreground`} aria-hidden="true">
      <Package className="h-5 w-5" />
    </span>
  );
}

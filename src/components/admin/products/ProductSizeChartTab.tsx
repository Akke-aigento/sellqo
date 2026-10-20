// SIZECHART-1 — tab "Maattabel" in het productscherm.
// Toont de standaard-maattabel zoals de winkel hem krijgt, plus de factchecks.
// Dezelfde rekenfunctie als storefront-api (supabase/functions/_shared/sizeChart.ts).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  buildSizeChart,
  sellSizesFromVariants,
  type SizeChartCheck,
  type SizeChartStatus,
} from '../../../../supabase/functions/_shared/sizeChart';

interface Props {
  productId: string;
  tenantId: string;
  sizeGuide: unknown;
}

const STATUS_STYLE: Record<SizeChartStatus, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  warning: { icon: AlertTriangle, className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  blocked: { icon: XCircle, className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

export function ProductSizeChartTab({ productId, tenantId, sizeGuide }: Props) {
  const { t } = useTranslation();

  const { data: variants, isLoading } = useQuery({
    queryKey: ['product-size-chart-variants', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('attribute_values')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Array<{ attribute_values?: unknown }>;
    },
  });

  const chart = useMemo(
    () => (isLoading ? null : buildSizeChart(sizeGuide, { sellSizes: sellSizesFromVariants(variants) })),
    [sizeGuide, variants, isLoading],
  );

  if (!chart) return <Skeleton className="h-64 w-full" />;

  const style = STATUS_STYLE[chart.status];
  const StatusIcon = style.icon;
  const problems = chart.checks.filter((c) => c.level !== 'info');
  const notes = chart.checks.filter((c) => c.level === 'info' && c.code !== 'SIZE_NOT_SOLD');
  const measureLabel = (m?: string) =>
    m && ['width', 'length', 'sleeve', 'chest'].includes(m) ? t(`admin.sizeChart.col.${m}`) : (m ?? '');
  const checkText = (c: SizeChartCheck) =>
    t(`admin.sizeChart.check.${c.code}`, { size: c.size ?? '', measure: measureLabel(c.measure), detail: c.detail ?? '' });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t('admin.sizeChart.title')}</CardTitle>
            <Badge className={`gap-1 ${style.className}`} variant="secondary">
              <StatusIcon className="h-3.5 w-3.5" aria-hidden />
              {t(`admin.sizeChart.status.${chart.status}`)}
            </Badge>
            {chart.fit && (
              <Badge variant="outline">{t('admin.sizeChart.fitLabel', { fit: t(`admin.sizeChart.fit.${chart.fit}`) })}</Badge>
            )}
          </div>
          <CardDescription>{t(`admin.sizeChart.statusHelp.${chart.status}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {chart.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="sticky left-0 bg-muted/50 p-2 text-left font-medium">{t('admin.sizeChart.col.size')}</th>
                    {chart.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap p-2 text-left font-medium">
                        {t(`admin.sizeChart.col.${col}`)} <span className="font-normal text-muted-foreground">(cm)</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((r) => (
                    <tr key={r.size} className="border-t">
                      <td className="sticky left-0 bg-background p-2 font-semibold">{r.size}</td>
                      {chart.columns.map((col) => (
                        <td key={col} className="whitespace-nowrap p-2 tabular-nums">
                          {col === 'chest'
                            ? r.chest_min === null ? '–' : r.chest_min === r.chest_max ? r.chest_min : `${r.chest_min}–${r.chest_max}`
                            : (r[col] ?? '–')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.sizeChart.noRows')}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('admin.sizeChart.measureHelp')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.sizeChart.checksTitle')}</CardTitle>
          <CardDescription>{t('admin.sizeChart.checksHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {problems.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t('admin.sizeChart.allChecksPassed')}
            </p>
          ) : (
            <ul className="space-y-2">
              {problems.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.level === 'blocked'
                    ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />}
                  <span>{checkText(c)}</span>
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <ul className="space-y-1 pt-2">
              {notes.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{checkText(c)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="pt-2 text-xs text-muted-foreground">{t('admin.sizeChart.refreshHelp')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

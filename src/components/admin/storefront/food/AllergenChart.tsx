// ALLERGEN-3 — allergenenkaart: alle actieve gerechten en extra's tegen de 14 EU-allergenen.
// In België moet een horecazaak de allergeneninformatie ook in de zaak ter beschikking
// hebben (KB 17/07/2014). Deze kaart haalt alles uit de productgegevens; afdrukken = een PDF op A4 liggend.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Printer, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ALLERGENS } from './allergens';
import { allergenState, isMissingColumn, type AllergenState } from './allergenState';
import { KAART_TYPES } from '@/components/admin/horeca/kaart/useKaart';
import { downloadPdf } from '@/utils/floorQrPdf';
import { generateAllergenChartPdf } from '@/utils/allergenChartPdf';

// ALLERGEEN-ADMIN-1 — elke rij weet of ze "geen" (bewust), "niet ingevuld" of een aantal heeft.
// Extra's (product_addon_options) hebben geen verklaring: daar blijft een lege rij gewoon leeg.
interface Row { name: string; allergens: string[]; state?: AllergenState }
interface Group { title: string; rows: Row[] }

// QR-PRINT-1 — afdrukken = een PDF downloaden (src/utils/allergenChartPdf.ts). Het oude
// afdrukvenster (window.open + print) werkte niet in Safari op gsm, in de app op het
// beginscherm en in de native app.
async function downloadChart(groups: Group[], t: TFunction, shopName: string, lang: string) {
  try {
    const date = new Date().toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
    const bytes = await generateAllergenChartPdf({
      title: `${t('admin.storefront.food.allergenChart.title')} — ${shopName}`,
      subtitle: t('admin.storefront.food.allergenChart.updated', { date }),
      footer: t('admin.storefront.food.allergenChart.print_footer'),
      allergens: ALLERGENS.map((a) => t(`admin.allergens.${a}`)),
      groups: groups.map((g) => ({
        title: g.title,
        rows: g.rows.map((r) => ({
          name: r.name,
          marks: ALLERGENS.map((a) => r.allergens.includes(a)),
          note: r.state?.kind === 'missing' ? t('admin.storefront.food.allergenChart.state_missing')
            : r.state?.kind === 'none' ? t('admin.storefront.food.allergenChart.state_none') : undefined,
        })),
      })),
    });
    downloadPdf(bytes, `allergenen-${(shopName || 'kaart').replace(/[^\w-]+/g, '_')}.pdf`);
  } catch (e) {
    toast.error(t('admin.floorPlan.qr_pdf_failed', { reason: e instanceof Error ? e.message : String(e) }));
  }
}

/** Met allergens_declared; bestaat de kolom nog niet (admin live vóór de migratie), dan zonder. */
async function fetchChartProducts(tenantId: string) {
  const q = (cols: string) => supabase.from('products').select(cols as 'id, name, category_id, allergens')
    .eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false)
    .in('product_type', KAART_TYPES as never).order('name');
  const first = await q('id, name, category_id, allergens, allergens_declared');
  return isMissingColumn(first.error) ? q('id, name, category_id, allergens') : first;
}

export function AllergenChart() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['allergen-chart', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [prods, cats, groups] = await Promise.all([
        fetchChartProducts(tenantId!),
        supabase.from('categories').select('id, name, sort_order').eq('tenant_id', tenantId!),
        supabase.from('product_addon_groups').select('name, sort_order, product_addon_options(name, allergens, is_active, sort_order)')
          .eq('tenant_id', tenantId!).eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (prods.error) throw prods.error;
      if (cats.error) throw cats.error;
      if (groups.error) throw groups.error;
      return { products: prods.data || [], categories: cats.data || [], addonGroups: groups.data || [] };
    },
  });

  const { groups, missing } = useMemo(() => {
    if (!data) return { groups: [] as Group[], missing: [] as { id: string; name: string }[] };
    const cats = [...data.categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const byCat = new Map<string | null, Row[]>();
    const missing: { id: string; name: string }[] = [];
    for (const p of data.products as unknown as { id: string; name: string; category_id: string | null; allergens: string[] | null; allergens_declared?: boolean }[]) {
      const al = p.allergens || [];
      const state = allergenState(al, p.allergens_declared);
      if (state.kind === 'missing') missing.push({ id: p.id, name: p.name });
      const k = p.category_id && cats.some((c) => c.id === p.category_id) ? p.category_id : null;
      byCat.set(k, [...(byCat.get(k) || []), { name: p.name, allergens: al, state }]);
    }
    const out: Group[] = cats.filter((c) => byCat.has(c.id)).map((c) => ({ title: c.name, rows: byCat.get(c.id)! }));
    if (byCat.has(null)) out.push({ title: t('admin.storefront.food.allergenChart.other'), rows: byCat.get(null)! });
    for (const g of data.addonGroups) {
      const opts = ((g.product_addon_options || []) as { name: string; allergens: string[] | null; is_active: boolean; sort_order: number | null }[])
        .filter((o) => o.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      if (opts.length) out.push({ title: t('admin.storefront.food.allergenChart.extras_group', { name: g.name }), rows: opts.map((o) => ({ name: o.name, allergens: o.allergens || [] })) });
    }
    return { groups: out, missing };
  }, [data, t]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('admin.storefront.food.allergenChart.title')}</CardTitle>
            <CardDescription>{t('admin.storefront.food.allergenChart.desc')}</CardDescription>
          </div>
          <Button disabled={!groups.length} onClick={() => void downloadChart(groups, t, currentTenant?.name || '', i18n.language)}>
            <Printer className="mr-2 h-4 w-4" />{t('admin.storefront.food.allergenChart.print')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !groups.length ? (
          <p className="text-sm text-muted-foreground">{t('admin.storefront.food.allergenChart.empty')}</p>
        ) : (
          <>
            {missing.length ? (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('admin.storefront.food.allergenChart.missing_todo', { count: missing.length })}</span>
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide">{t('admin.storefront.food.allergenChart.todo_title')}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {missing.map((m) => (
                    <li key={m.id}>
                      <Link to={`/admin/products/${m.id}/edit`} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-400 bg-background px-3 text-xs font-medium text-foreground hover:bg-amber-100 dark:hover:bg-amber-900">
                        <Pencil className="h-3 w-3" aria-hidden />{m.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.storefront.food.allergenChart.all_done')}</p>
            )}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="sticky left-0 bg-muted p-2 text-left font-medium">{t('admin.storefront.food.allergenChart.product')}</th>
                    {ALLERGENS.map((a) => (
                      <th key={a} className="h-28 w-8 p-1 align-bottom font-medium">
                        <span className="inline-block whitespace-nowrap text-xs [writing-mode:vertical-rl] rotate-180">{t(`admin.allergens.${a}`)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <GroupRows key={g.title} group={g} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RowState({ state }: { state?: AllergenState }) {
  const { t } = useTranslation();
  if (state?.kind === 'missing') return <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-50">{t('admin.storefront.food.allergenChart.state_missing')}</span>;
  if (state?.kind === 'none') return <span className="ml-2 text-xs text-muted-foreground">{t('admin.storefront.food.allergenChart.state_none')}</span>;
  return null;
}

function GroupRows({ group }: { group: Group }) {
  return (
    <>
      <tr className="border-t bg-muted/30">
        <td colSpan={ALLERGENS.length + 1} className="sticky left-0 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={`${r.name}-${i}`} className="border-t">
          <td className="sticky left-0 whitespace-nowrap bg-background p-2">
            {r.name}
            <RowState state={r.state} />
          </td>
          {ALLERGENS.map((a) => (
            <td key={a} className="p-1 text-center">{r.allergens.includes(a) ? <span className="text-primary">●</span> : null}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

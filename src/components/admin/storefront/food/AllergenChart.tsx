// ALLERGEN-3 — allergenenkaart: alle actieve gerechten en extra's tegen de 14 EU-allergenen.
// In België moet een horecazaak de allergeneninformatie ook in de zaak ter beschikking
// hebben (KB 17/07/2014). Deze kaart haalt alles uit de productgegevens en drukt af op A4 liggend.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ALLERGENS } from './allergens';

interface Row { name: string; allergens: string[] }
interface Group { title: string; rows: Row[] }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function printChart(groups: Group[], t: TFunction, shopName: string, lang: string) {
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) { toast.error(t('admin.storefront.food.qr_popup_blocked')); return; }
  const head = ALLERGENS.map((a) => `<th class="al"><span>${esc(t(`admin.allergens.${a}`))}</span></th>`).join('');
  const body = groups.map((g) => `
    <tr class="grp"><td colspan="${ALLERGENS.length + 1}">${esc(g.title)}</td></tr>
    ${g.rows.map((r) => `<tr><td class="nm">${esc(r.name)}</td>${ALLERGENS.map((a) => `<td class="c">${r.allergens.includes(a) ? '●' : ''}</td>`).join('')}</tr>`).join('')}`).join('');
  const date = new Date().toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  w.document.open();
  w.document.write(`<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(t('admin.storefront.food.allergenChart.title'))}</title>
<style>
@page{size:A4 landscape;margin:10mm}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0}
h1{font-size:18px;margin:0 0 2px}
.sub{font-size:11px;color:#555;margin:0 0 10px}
table{border-collapse:collapse;width:100%;font-size:10.5px}
th,td{border:1px solid #bbb;padding:3px 4px}
th.al{height:96px;vertical-align:bottom;width:28px;padding:2px}
th.al span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-weight:600}
td.c{text-align:center;font-size:12px}
td.nm{white-space:nowrap}
tr.grp td{background:#eee;font-weight:700}
tr{break-inside:avoid}
.foot{font-size:10px;color:#555;margin-top:8px}
</style></head><body>
<h1>${esc(t('admin.storefront.food.allergenChart.title'))} — ${esc(shopName)}</h1>
<p class="sub">${esc(t('admin.storefront.food.allergenChart.updated', { date }))}</p>
<table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
<p class="foot">${esc(t('admin.storefront.food.allergenChart.print_footer'))}</p>
</body></html>`);
  w.document.close();
  let printed = false;
  const go = () => { if (printed) return; printed = true; try { w.focus(); w.print(); } catch { /* venster al dicht */ } };
  w.onload = go;
  setTimeout(go, 800);
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
        supabase.from('products').select('id, name, category_id, allergens')
          .eq('tenant_id', tenantId!).eq('is_active', true).eq('hide_from_storefront', false).order('name'),
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
    if (!data) return { groups: [] as Group[], missing: 0 };
    const cats = [...data.categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const byCat = new Map<string | null, Row[]>();
    let missing = 0;
    for (const p of data.products) {
      const al = (p.allergens as string[] | null) || [];
      if (!al.length) missing += 1;
      const k = p.category_id && cats.some((c) => c.id === p.category_id) ? p.category_id : null;
      byCat.set(k, [...(byCat.get(k) || []), { name: p.name, allergens: al }]);
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
          <Button disabled={!groups.length} onClick={() => printChart(groups, t, currentTenant?.name || '', i18n.language)}>
            <Printer className="mr-2 h-4 w-4" />{t('admin.storefront.food.allergenChart.print')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !groups.length ? (
          <p className="text-sm text-muted-foreground">{t('admin.storefront.food.allergenChart.empty')}</p>
        ) : (
          <>
            {missing ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('admin.storefront.food.allergenChart.missing', { count: missing })}</span>
              </div>
            ) : null}
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

function GroupRows({ group }: { group: Group }) {
  return (
    <>
      <tr className="border-t bg-muted/30">
        <td colSpan={ALLERGENS.length + 1} className="sticky left-0 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={`${r.name}-${i}`} className="border-t">
          <td className="sticky left-0 whitespace-nowrap bg-background p-2">{r.name}</td>
          {ALLERGENS.map((a) => (
            <td key={a} className="p-1 text-center">{r.allergens.includes(a) ? <span className="text-primary">●</span> : null}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

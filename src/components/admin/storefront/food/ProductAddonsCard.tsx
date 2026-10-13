// DEMO-1 — extra's van één product, vanuit het productscherm. Een groep geldt via de
// categorie (instellen in Bestellen → Extra's) of via dit product zelf (hier aan/uit).
// Wijzigingen bewaren meteen: het is een koppeling, geen deel van het productformulier.
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface GroupRow {
  id: string; name: string; min_select: number; max_select: number | null;
  category_ids: string[] | null; product_ids: string[] | null;
  product_addon_options: { name: string; price: number | string; is_active: boolean }[] | null;
}

const eur = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

function rule(g: GroupRow, t: TFunction): string {
  const min = g.min_select || 0;
  const max = g.max_select;
  if (min === 1 && max === 1) return t('admin.storefront.food.rule_required_one');
  if (min > 0) return max != null ? t('admin.storefront.food.rule_range', { min, max }) : t('admin.storefront.food.rule_min', { min });
  return max != null ? t('admin.storefront.food.rule_optional_max', { max }) : t('admin.storefront.food.rule_optional');
}

export function ProductAddonsCard({ productId, categoryIds }: { productId: string; categoryIds: string[] }) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['product-addon-groups', tenantId];

  const { data: groups, isLoading } = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('product_addon_groups')
        .select('id, name, min_select, max_select, category_ids, product_ids, product_addon_options(name, price, is_active)')
        .eq('tenant_id', tenantId!).eq('is_active', true).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GroupRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ group, on }: { group: GroupRow; on: boolean }) => {
      // Vers lezen: iemand anders kan intussen andere producten gekoppeld hebben.
      const { data, error } = await supabase.from('product_addon_groups').select('product_ids').eq('id', group.id).single();
      if (error) throw error;
      const current = new Set<string>((data?.product_ids as string[] | null) || []);
      if (on) current.add(productId); else current.delete(productId);
      const { error: e2 } = await supabase.from('product_addon_groups')
        .update({ product_ids: [...current], updated_at: new Date().toISOString() }).eq('id', group.id);
      if (e2) throw e2;
    },
    onSuccess: (_d, { group, on }) => toast.success(on ? t('admin.storefront.food.addon_linked', { name: group.name }) : t('admin.storefront.food.addon_unlinked', { name: group.name })),
    onError: () => toast.error(t('admin.storefront.food.save_failed')),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['addon-catalog', tenantId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t('admin.storefront.food.addonGroupsManager.extra_s')}</CardTitle>
            <CardDescription>{t('admin.storefront.food.productAddonsCard.toppings_sauzen_of_formaten_die_klanten')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/bestellen?tab=extras"><Settings2 className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.productAddonsCard.extra_s_beheren')}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !groups?.length ? (
          <p className="text-sm text-muted-foreground">{t('admin.storefront.food.productAddonsCard.je_hebt_nog_geen_extra_s')}</p>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => {
              const viaCategory = (g.category_ids || []).some((c) => categoryIds.includes(c));
              const direct = (g.product_ids || []).includes(productId);
              const options = (g.product_addon_options || []).filter((o) => o.is_active);
              const busy = toggle.isPending && toggle.variables?.group.id === g.id;
              return (
                <li key={g.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      <Badge variant="secondary" className="font-normal">{rule(g, t)}</Badge>
                      {viaCategory ? <Badge variant="outline" className="font-normal">{t('admin.storefront.food.productAddonsCard.via_de_categorie')}</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {options.length
                        ? options.map((o) => (Number(o.price) ? `${o.name} (+${eur(Number(o.price))})` : o.name)).join(', ')
                        : t('admin.storefront.food.group_no_options')}
                    </p>
                  </div>
                  <Switch
                    checked={viaCategory || direct}
                    disabled={viaCategory || busy}
                    title={viaCategory ? t('admin.storefront.food.via_category_hint') : undefined}
                    onCheckedChange={(on) => toggle.mutate({ group: g, on })}
                    aria-label={t('admin.storefront.food.addon_for_product', { name: g.name })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

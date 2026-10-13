// FOOD-1 — extra's (toppings, sauzen, bijgerechten). Een groep geldt voor hele
// categorieën en/of losse producten; de klant kiest op de productpagina, de prijs komt
// bovenop de productprijs.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DecimalInput } from './DecimalInput';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

interface Option { id?: string; name: string; price: number; is_active: boolean }
interface Group {
  id?: string; name: string; min_select: number; max_select: number | null; category_ids: string[]; product_ids: string[];
  is_active: boolean; options: Option[]; removedOptions: string[]; dirty?: boolean;
}

// Eenvoudige keuze in plaats van twee getallen: past bij 95% van de menukaarten.
type Rule = 'optional_many' | 'optional_one' | 'required_one' | 'custom';
function ruleOf(g: Group): Rule {
  if (g.min_select === 0 && g.max_select == null) return 'optional_many';
  if (g.min_select === 0 && g.max_select === 1) return 'optional_one';
  if (g.min_select === 1 && g.max_select === 1) return 'required_one';
  return 'custom';
}

function GroupCard({ g, categories, onChange, onRemove, onSave, saving }: {
  g: Group; categories: { id: string; name: string }[]; saving: boolean;
  onChange: (g: Group) => void; onRemove: () => void; onSave: () => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Group>) => onChange({ ...g, ...patch, dirty: true });
  const rule = ruleOf(g);
  const setOpt = (i: number, patch: Partial<Option>) => set({ options: g.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOpt = (i: number, d: number) => { const n = [...g.options]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); set({ options: n }); };
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Input value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('admin.storefront.food.addonGroupsManager.bv_extra_toppings')} className="h-9 font-medium" aria-label={t('admin.storefront.food.addonGroupsManager.naam_van_de_groep')} />
          <Switch checked={g.is_active} onCheckedChange={(v) => set({ is_active: v })} aria-label={t('admin.marketing.aBTestingPanel.actief')} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label={t('admin.storefront.food.addonGroupsManager.groep_verwijderen')}><Trash2 className="h-4 w-4" /></Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('admin.storefront.food.addonGroupsManager.keuze')}</Label>
            <Select value={rule} onValueChange={(v) => {
              const r = v as Rule;
              if (r === 'optional_many') set({ min_select: 0, max_select: null });
              else if (r === 'optional_one') set({ min_select: 0, max_select: 1 });
              else if (r === 'required_one') set({ min_select: 1, max_select: 1 });
              else set({ min_select: g.min_select, max_select: g.max_select ?? 3 });
            }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="optional_many">{t('admin.storefront.food.addonGroupsManager.optioneel_meerdere_mogelijk_toppings')}</SelectItem>
                <SelectItem value="optional_one">{t('admin.storefront.food.addonGroupsManager.optioneel_maximaal_een')}</SelectItem>
                <SelectItem value="required_one">{t('admin.storefront.food.addonGroupsManager.verplicht_een_kiezen_saus_formaat')}</SelectItem>
                <SelectItem value="custom">{t('admin.storefront.food.addonGroupsManager.eigen_aantal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rule === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{t('admin.productForm.minimum')}</Label>
                <Input inputMode="numeric" value={String(g.min_select)} onChange={(e) => set({ min_select: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="h-9" /></div>
              <div className="space-y-1.5"><Label>{t('admin.productForm.maximum')}</Label>
                <Input inputMode="numeric" placeholder={t('admin.storefront.food.unlimited')} value={g.max_select == null ? '' : String(g.max_select)}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); set({ max_select: Number.isFinite(n) && n > 0 ? n : null }); }} className="h-9" /></div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t('admin.storefront.food.addonGroupsManager.opties')}</Label>
          {g.options.map((o, i) => (
            <div key={o.id || `n${i}`} className="flex items-center gap-2">
              <Input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder={t('admin.storefront.food.addonGroupsManager.bv_extra_mozzarella')} className="h-9" aria-label={t('admin.storefront.food.addonGroupsManager.optie')} />
              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                <DecimalInput value={o.price} onChange={(v) => setOpt(i, { price: v ?? 0 })} className="h-9 pl-6" aria-label={t('admin.storefront.food.addonGroupsManager.meerprijs')} />
              </div>
              <Switch checked={o.is_active} onCheckedChange={(v) => setOpt(i, { is_active: v })} aria-label={t('admin.productForm.beschikbaar')} />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => moveOpt(i, -1)} aria-label={t('admin.storefront.food.addonGroupsManager.omhoog')}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === g.options.length - 1} onClick={() => moveOpt(i, 1)} aria-label={t('admin.storefront.food.addonGroupsManager.omlaag')}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={t('admin.storefront.food.addonGroupsManager.optie_verwijderen')}
                onClick={() => set({ options: g.options.filter((_, j) => j !== i), removedOptions: o.id ? [...g.removedOptions, o.id] : g.removedOptions })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set({ options: [...g.options, { name: '', price: 0, is_active: true }] })}><Plus className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.addonGroupsManager.optie_toevoegen')}</Button>
          <p className="text-xs text-muted-foreground">{t('admin.storefront.food.addonGroupsManager.uitgezette_opties_blijven_bewaard_maar_zijn')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('admin.storefront.food.addonGroupsManager.geldt_voor_de_categorieen')}</Label>
          {categories.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.storefront.food.addonGroupsManager.nog_geen_categorieen')}</p> : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={g.category_ids.includes(c.id)}
                    onCheckedChange={(v) => set({ category_ids: v ? [...g.category_ids, c.id] : g.category_ids.filter((x) => x !== c.id) })} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          {g.product_ids.length ? <p className="text-xs text-muted-foreground">Ook gekoppeld aan {g.product_ids.length} los{g.product_ids.length === 1 ? ' product' : 'se producten'}.</p> : null}
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !g.dirty}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{g.dirty ? t('common.save') : t('admin.adsProductMap.opgeslagen')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AddonGroupsManager() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [groups, setGroups] = useState<Group[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['addon-groups', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [g, o, c] = await Promise.all([
        supabase.from('product_addon_groups').select('*').eq('tenant_id', tenantId!).order('sort_order', { ascending: true }),
        supabase.from('product_addon_options').select('*').eq('tenant_id', tenantId!).order('sort_order', { ascending: true }),
        supabase.from('categories').select('id, name').eq('tenant_id', tenantId!).order('sort_order', { ascending: true }),
      ]);
      if (g.error) throw g.error;
      if (o.error) throw o.error;
      return {
        groups: (g.data || []).map((x) => ({
          id: x.id, name: x.name, min_select: x.min_select, max_select: x.max_select, category_ids: x.category_ids || [], product_ids: x.product_ids || [],
          is_active: x.is_active, removedOptions: [],
          options: (o.data || []).filter((op) => op.group_id === x.id).map((op) => ({ id: op.id, name: op.name, price: Number(op.price), is_active: op.is_active })),
        })) as Group[],
        categories: (c.data || []) as { id: string; name: string }[],
      };
    },
  });

  useEffect(() => { if (data) setGroups(data.groups); }, [data]);

  const saveGroup = async (i: number) => {
    const g = groups[i];
    if (!tenantId) return;
    if (!g.name.trim()) { toast.error(t('admin.storefront.food.addon_name_required')); return; }
    if (g.options.some((o) => !o.name.trim())) { toast.error(t('admin.storefront.food.addon_option_name_required')); return; }
    if (g.max_select != null && g.min_select > g.max_select) { toast.error(t('admin.storefront.food.addon_min_gt_max')); return; }
    setSavingIdx(i);
    try {
      const row = { tenant_id: tenantId, name: g.name.trim(), min_select: g.min_select, max_select: g.max_select, category_ids: g.category_ids,
        product_ids: g.product_ids, is_active: g.is_active, sort_order: i, updated_at: new Date().toISOString() };
      let groupId = g.id;
      if (groupId) {
        const { error } = await supabase.from('product_addon_groups').update(row).eq('id', groupId).eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from('product_addon_groups').insert(row).select('id').single();
        if (error) throw error;
        groupId = ins.id;
      }
      if (g.removedOptions.length) {
        const { error } = await supabase.from('product_addon_options').delete().in('id', g.removedOptions).eq('tenant_id', tenantId);
        if (error) throw error;
      }
      for (const [j, o] of g.options.entries()) {
        const orow = { tenant_id: tenantId, group_id: groupId!, name: o.name.trim(), price: o.price, is_active: o.is_active, sort_order: j };
        const { error } = o.id
          ? await supabase.from('product_addon_options').update(orow).eq('id', o.id).eq('tenant_id', tenantId)
          : await supabase.from('product_addon_options').insert(orow);
        if (error) throw error;
      }
      // Alleen deze groep verversen (nieuwe optie-ID's), andere groepen kunnen nog onbewaarde wijzigingen hebben.
      const { data: fresh, error: fErr } = await supabase.from('product_addon_options').select('id, name, price, is_active')
        .eq('tenant_id', tenantId).eq('group_id', groupId!).order('sort_order', { ascending: true });
      if (fErr) throw fErr;
      setGroups((gs) => gs.map((x, j) => (j === i ? { ...x, id: groupId, dirty: false, removedOptions: [],
        options: (fresh || []).map((op) => ({ id: op.id, name: op.name, price: Number(op.price), is_active: op.is_active })) } : x)));
      toast.success(t('admin.storefront.food.saved_named', { name: g.name }));
    } catch (e) {
      toast.error(t('admin.storefront.food.save_failed_reason', { reason: e instanceof Error ? e.message : t('admin.storefront.food.unknown_error') }));
    } finally {
      setSavingIdx(null);
    }
  };

  const removeGroup = async (i: number) => {
    const g = groups[i];
    if (g.id) {
      if (!window.confirm(t('admin.storefront.food.addon_delete_confirm', { name: g.name }))) return;
      const { error } = await supabase.from('product_addon_groups').delete().eq('id', g.id).eq('tenant_id', tenantId!);
      if (error) { toast.error(t('admin.storefront.food.delete_failed_reason', { reason: error.message })); return; }
    }
    setGroups((gs) => gs.filter((_, j) => j !== i));
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.storefront.food.addonGroupsManager.extra_s')}</CardTitle>
          <CardDescription>{t('admin.storefront.food.addonGroupsManager.toppings_sauzen_bijgerechten_of_formaten_die')}</CardDescription>
        </CardHeader>
      </Card>
      {groups.map((g, i) => (
        <GroupCard key={g.id || `new-${i}`} g={g} categories={data?.categories || []} saving={savingIdx === i}
          onChange={(next) => setGroups((gs) => gs.map((x, j) => (j === i ? next : x)))}
          onRemove={() => removeGroup(i)} onSave={() => saveGroup(i)} />
      ))}
      <Button type="button" variant="outline" onClick={() => setGroups((gs) => [...gs, {
        name: gs.length === 0 ? t('admin.storefront.food.addon_default_name') : '', min_select: 0, max_select: null, category_ids: [], product_ids: [], is_active: true,
        options: [{ name: '', price: 0, is_active: true }], removedOptions: [], dirty: true,
      }])}><Plus className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.addonGroupsManager.groep_toevoegen')}</Button>
    </div>
  );
}

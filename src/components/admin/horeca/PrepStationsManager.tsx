// TAFEL-1 — Bestellen › Posten: keuken, bar, … en welke categorie naar welke post gaat.
// Een ronde van SellQo Kassa maakt per post een eigen keukenbon. Zonder posten komt alles
// op één bon, zoals vandaag.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Beer, ChefHat, Plus, Star, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { usePrepStationMutations, usePrepStations, type StationKind } from '@/hooks/usePrepStations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const KINDS: { kind: StationKind; icon: typeof ChefHat }[] = [
  { kind: 'kitchen', icon: ChefHat },
  { kind: 'bar', icon: Beer },
  { kind: 'other', icon: UtensilsCrossed },
];

export function PrepStationsManager() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data, isLoading } = usePrepStations();
  const { save, setDefault, remove, routeCategory } = usePrepStationMutations();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StationKind>('kitchen');

  const { data: categories } = useQuery({
    queryKey: ['prep-station-categories', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: c, error } = await supabase.from('categories').select('id, name').eq('tenant_id', tenantId!).eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (c ?? []) as { id: string; name: string }[];
    },
  });

  const fail = (e: unknown) => toast.error(t('admin.prepStations.error', { detail: e instanceof Error ? e.message : String(e) }));
  const stations = data?.stations ?? [];
  const routeOf = (categoryId: string) => data?.routes.find((r) => r.category_id === categoryId)?.station_id ?? '';
  const def = stations.find((s) => s.is_default);

  const add = () => {
    if (!name.trim()) return;
    save.mutate({ name, kind, sort: stations.length }, {
      onSuccess: () => { setName(''); },
      onError: fail,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.prepStations.title')}</CardTitle>
          <CardDescription>{t('admin.prepStations.intro')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="h-20 animate-pulse rounded-md bg-muted" /> : stations.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t('admin.prepStations.none')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {stations.map((s) => {
                const Icon = KINDS.find((k) => k.kind === s.kind)?.icon ?? ChefHat;
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    <Button variant={s.is_default ? 'secondary' : 'ghost'} size="sm" aria-pressed={s.is_default}
                      onClick={() => setDefault.mutate(s.is_default ? null : s.id, { onError: fail })}
                      title={t('admin.prepStations.defaultHint')}>
                      <Star className={cn('h-4 w-4 sm:mr-1', s.is_default && 'fill-current')} />
                      <span className="hidden sm:inline">{t(s.is_default ? 'admin.prepStations.isDefault' : 'admin.prepStations.makeDefault')}</span>
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={t('admin.prepStations.remove', { name: s.name })}
                      onClick={() => remove.mutate(s.id, { onError: fail })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t('admin.prepStations.namePlaceholder')}
              aria-label={t('admin.prepStations.namePlaceholder')} className="min-w-0 flex-1 basis-40" />
            <div className="flex rounded-md border" role="group" aria-label={t('admin.prepStations.kind')}>
              {KINDS.map(({ kind: k, icon: Icon }) => (
                <button key={k} type="button" aria-pressed={kind === k} title={t(`admin.prepStations.kinds.${k}`)} aria-label={t(`admin.prepStations.kinds.${k}`)}
                  onClick={() => setKind(k)} className={cn('flex h-10 w-10 items-center justify-center', kind === k && 'bg-muted')}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <Button type="submit" disabled={!name.trim() || save.isPending}><Plus className="mr-1 h-4 w-4" />{t('admin.prepStations.add')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.prepStations.routingTitle')}</CardTitle>
          <CardDescription>
            {def ? t('admin.prepStations.routingIntro', { name: def.name }) : t('admin.prepStations.routingIntroNoDefault')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.prepStations.routingNeedsStations')}</p>
          ) : !categories?.length ? (
            <p className="text-sm text-muted-foreground">{t('admin.prepStations.noCategories')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <select value={routeOf(c.id)} aria-label={t('admin.prepStations.routeFor', { name: c.name })}
                    onChange={(e) => routeCategory.mutate({ categoryId: c.id, stationId: e.target.value || null }, { onError: fail })}
                    className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">{def ? t('admin.prepStations.defaultOption', { name: def.name }) : t('admin.prepStations.noStation')}</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ONDERBALK-1 — Instellingen › Mijn onderbalk: kies zelf de 2 tot 5 snelkoppelingen in de balk
// onderaan op je gsm. Per persoon en per zaak (sidebar_preferences.bottom_nav). Enkel items die je in
// het menu mag zien; wie niets kiest, houdt de standaard van zijn spoor. Elke wijziging wordt meteen
// bewaard.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useTracks } from '@/hooks/useBusinessModules';
import { findNavItems, getAllMenuItems } from '@/components/admin/sidebar/sidebarConfig';
import { useNavItemVisibility } from '@/components/admin/sidebar/useNavItemVisibility';
import { BOTTOM_NAV_MAX, BOTTOM_NAV_MIN, bottomNavLabelKey, resolveBottomNavIds } from '@/components/admin/sidebar/bottomNav';
import { cn } from '@/lib/utils';

export function MyBottomNavSettings() {
  const { t } = useTranslation();
  const { bottomNav, setBottomNav, isSavingBottomNav, isLoading } = useSidebarPreferences();
  const { isItemBlocked } = useNavItemVisibility();
  const { hasTrack } = useTracks();
  const ctx = { horeca: hasTrack('horeca'), webshop: hasTrack('webshop'), events: hasTrack('events') };

  const allowed = (id: string) => { const item = findNavItems([id])[0]; return !!item && !item.disabled && !isItemBlocked(item); };
  const current = resolveBottomNavIds(bottomNav, allowed, ctx);
  const own = !!bottomNav?.length;
  const available = useMemo(
    () => getAllMenuItems().filter((m) => allowed(m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowed hangt af van isItemBlocked (rechten, pakket)
    [isItemBlocked],
  );
  const groups = useMemo(() => {
    const out = new Map<string, typeof available>();
    for (const m of available) {
      if (current.includes(m.id)) continue;
      out.set(m.groupKey, [...(out.get(m.groupKey) ?? []), m]);
    }
    return [...out.entries()];
  }, [available, current]);

  const save = async (next: string[] | null) => {
    try {
      await setBottomNav(next);
    } catch (e) {
      toast.error(t('settings.bottomNav.save_failed', { reason: e instanceof Error ? e.message : String(e) }));
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...current];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };
  const remove = (id: string) => { if (current.length > BOTTOM_NAV_MIN) void save(current.filter((x) => x !== id)); };
  const add = (id: string) => { if (current.length < BOTTOM_NAV_MAX) void save([...current, id]); };

  const items = findNavItems(current);
  const busy = isSavingBottomNav || isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.bottomNav.title')}</CardTitle>
        <CardDescription>{t('settings.bottomNav.intro', { min: BOTTOM_NAV_MIN, max: BOTTOM_NAV_MAX })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voorbeeld van de balk zoals hij op de gsm staat. */}
        <div className="flex justify-center rounded-md bg-muted/50 p-4" aria-hidden>
          <div className="flex w-max max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1.5 shadow-sm">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.id} className="flex min-w-0 flex-auto flex-col items-center gap-0.5 rounded-full px-2 text-[11px] text-muted-foreground">
                  {Icon ? <Icon className="h-5 w-5" /> : null}
                  <span className="max-w-full truncate">{t(bottomNavLabelKey(item, ctx))}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{own ? t('settings.bottomNav.yours') : t('settings.bottomNav.default')}</h3>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <ul className="divide-y rounded-md border">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="flex min-h-[52px] items-center gap-2 px-3 py-1.5">
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate text-sm">{t(bottomNavLabelKey(item, ctx))}</span>
                  <Button variant="ghost" size="icon" className="h-10 w-10" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t('settings.bottomNav.up')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={t('settings.bottomNav.down')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10" disabled={busy || items.length <= BOTTOM_NAV_MIN} onClick={() => remove(item.id)} aria-label={t('settings.bottomNav.remove')}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          {own ? (
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => void save(null)}>
              <RotateCcw className="mr-2 h-4 w-4" />{t('settings.bottomNav.reset')}
            </Button>
          ) : null}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t('settings.bottomNav.add')}</h3>
          {current.length >= BOTTOM_NAV_MAX ? <p className="text-xs text-muted-foreground">{t('settings.bottomNav.full', { max: BOTTOM_NAV_MAX })}</p> : null}
          {groups.map(([groupKey, list]) => (
            <div key={groupKey} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(groupKey)}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((m) => (
                  <Button key={m.id} variant="outline" size="sm" className={cn('h-10')} disabled={busy || current.length >= BOTTOM_NAV_MAX} onClick={() => add(m.id)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />{t(m.titleKey)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

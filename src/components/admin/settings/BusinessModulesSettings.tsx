// MODULES-1 → TRACKS-1 — overzicht van de sporen van de winkel.
// Het plan bepaalt het hoofdspoor; extra sporen zijn betalende add-ons. Alleen een
// platformadmin kan een add-on hier aan- of uitzetten; de winkel ziet de status en
// een link naar de pakketten.
import { Link } from 'react-router-dom';
import { CalendarDays, ExternalLink, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { Switch } from '@/components/ui/switch';
import { useBusinessModules, type BusinessModule } from '@/hooks/useBusinessModules';

const MODULES: { id: BusinessModule; icon: LucideIcon; to: string; demo?: string; points: string[] }[] = [
  {
    id: 'webshop', icon: ShoppingBag, to: '/admin/products',
    points: ['admin.modules.webshop_p1', 'admin.modules.webshop_p2', 'admin.modules.webshop_p3'],
  },
  {
    id: 'horeca', icon: UtensilsCrossed, to: '/admin/bestellen', demo: 'https://demo-pizzeria.sellqo.shop',
    points: ['admin.modules.horeca_p1', 'admin.modules.horeca_p2', 'admin.modules.horeca_p3', 'admin.modules.horeca_p4'],
  },
  {
    id: 'events', icon: CalendarDays, to: '/admin/events',
    points: ['admin.modules.events_p1', 'admin.modules.events_p2', 'admin.modules.events_p3'],
  },
];

export function BusinessModulesSettings() {
  const { t } = useTranslation();
  const { tracks, setModule, saving, planTrack, canManage } = useBusinessModules();
  const canSeePlans = useCan('read', 'platform_billing');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.modules.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.modules.intro')}</p>
      </div>
      {MODULES.map((m) => {
        const viaPlan = planTrack === m.id;
        // Werkelijke sporen van de winkel (zonder de alles-zien van de beheerweergave).
        const on = !viaPlan && tracks.includes(m.id);
        const Icon = m.icon;
        return (
          <Card key={m.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {t(`admin.modules.${m.id}_title`)}
                    {viaPlan ? <Badge variant="secondary" className="font-normal">{t('admin.modules.via_plan')}</Badge> : null}
                    {on ? <Badge variant="secondary" className="font-normal">{t('admin.modules.addon_active')}</Badge> : null}
                    {!viaPlan && !on ? <Badge variant="outline" className="font-normal">{t('admin.modules.not_in_plan')}</Badge> : null}
                  </CardTitle>
                  <CardDescription>{t(`admin.modules.${m.id}_desc`)}</CardDescription>
                </div>
              </div>
              {canManage ? (
                <Switch
                  checked={on || viaPlan}
                  disabled={saving || viaPlan}
                  aria-label={t(`admin.modules.${m.id}_title`)}
                  onCheckedChange={async (v) => {
                    if (await setModule(m.id, v)) toast.success(t(v ? 'admin.modules.turned_on' : 'admin.modules.turned_off', { name: t(`admin.modules.${m.id}_title`) }));
                  }}
                />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 pl-[3.75rem]">
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {m.points.map((p) => <li key={p}>{t(p)}</li>)}
              </ul>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {on || viaPlan ? <Link to={m.to} className="font-medium text-primary hover:underline">{t('admin.modules.open', { name: t(`admin.modules.${m.id}_title`) })}</Link> : null}
                {!on && !viaPlan && !canManage && canSeePlans ? (
                  <Button asChild variant="link" className="h-auto p-0 text-sm"><Link to="/admin/billing">{t('admin.modules.see_plans')}</Link></Button>
                ) : null}
                {m.demo ? (
                  <a href={m.demo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    {t('admin.modules.see_demo')}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

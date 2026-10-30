// TRACKS-3 — onderdelen die je zaak mag gebruiken maar die niet in je zijbalk staan (bv. Inkoop bij
// horeca, Social en Vertalingen bij events). Zo blijft de zijbalk kort en wordt geen pagina onvindbaar.
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTracks } from '@/hooks/useBusinessModules';
import { moreNavItems } from '@/components/admin/sidebar/sidebarConfig';
import { useNavItemVisibility } from '@/components/admin/sidebar/useNavItemVisibility';

export function MoreToolsSettings() {
  const { t } = useTranslation();
  const { hasTrack } = useTracks();
  const { isItemBlocked } = useNavItemVisibility();
  const items = moreNavItems(hasTrack).filter((i) => !isItemBlocked(i));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.moreTools.title')}</CardTitle>
        <CardDescription>{t('settings.moreTools.intro')}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('settings.moreTools.none')}</p> : (
          <ul className="divide-y rounded-md border">
            {items.map((i) => {
              const Icon = i.icon;
              return (
                <li key={i.id}>
                  <Link to={i.url} className="flex min-h-[52px] items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    {Icon ? <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /> : <span className="h-5 w-5 shrink-0" />}
                    <span className="min-w-0 flex-1 text-sm font-medium">{t(i.titleKey)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

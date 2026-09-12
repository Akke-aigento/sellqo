import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount';
import { findNavItems } from './sidebar/sidebarConfig';
import { useNavItemVisibility } from './sidebar/useNavItemVisibility';

/**
 * De vier snelkoppelingen in de balk, op id uit `sidebarConfig`.
 *
 * Niet opnieuw uitgeschreven: door de id's op te zoeken erven titel, icoon en
 * `requireRead` mee uit dezelfde bron als de zijbalk. Een eigen lijstje hier
 * betekende tot 12 september hardgecodeerde Nederlandse labels en geen enkele
 * rechtencontrole.
 */
const TAB_IDS = ['dashboard', 'orders', 'products', 'inbox'];

export function AdminMobileBottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { count } = useUnreadMessagesCount();
  const { isItemBlocked } = useNavItemVisibility();

  const tabs = findNavItems(TAB_IDS).filter((item) => !isItemBlocked(item));

  // Prefix-match, net als de zijbalk. Met een strikte vergelijking was op
  // /admin/orders/123 géén tab actief — je verloor je plaats zodra je een
  // bestelling opende. `/admin` blijft exact, want dat pad is een prefix van
  // alle andere; `/admin/dashboard` bestaat als alias en hoort er ook bij.
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  if (!tabs.length) return null;

  return (
    /*
      Zwevende pil in plaats van een balk over de volle breedte. De vervaging is
      hetzelfde recept als de storefront-header en de platform-cookiebanner,
      inclusief de supports-[]-terugval voor browsers zonder backdrop-filter.

      De afstand tot de onderrand komt uit --admin-nav-offset, zodat de balken
      die hier omheen rekenen (opslaan, bulkacties, AI-hulp) niet ieder hun
      eigen getal hoeven te kennen.
    */
    <div className="fixed bottom-[calc(1rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 z-50 md:hidden">
      <nav
        className={cn(
          // max-w: de pil mag nooit breder worden dan het scherm. Gemeten op
          // 375px liep de Franse labelset op 378px — "Tableau de bord" en
          // "Boîte de réception" duwden hem eroverheen, en dan zoomt de hele
          // pagina uit (M4). De items eronder krimpen mee in plaats van de pil
          // op te rekken.
          'flex items-center gap-1 rounded-full border px-2 py-1.5',
          'max-w-[calc(100vw-2rem)]',
          'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
          'shadow-sellqo-lg',
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.url}
              aria-current={isActive(tab.url) ? 'page' : undefined}
              className={cn(
                // flex-1 + min-w-0: de items delen de beschikbare breedte en
                // mogen krimpen, zodat `truncate` op het label kan aanslaan.
                // Géén min-w-[44px] ernaast — dat spreekt min-w-0 tegen en de
                // twee zouden om voorrang vechten. Het aanraakvlak blijft toch
                // ruim: zelfs op 320px houdt elk van de vier items ~65px over,
                // en min-h-[44px] borgt de hoogte.
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2',
                'text-[11px] min-w-0 min-h-[44px] transition-colors',
                isActive(tab.url)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="relative">
                {Icon && <Icon className="h-5 w-5" />}
                {tab.id === 'inbox' && count > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </div>
              <span className="max-w-full truncate">{t(tab.titleKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

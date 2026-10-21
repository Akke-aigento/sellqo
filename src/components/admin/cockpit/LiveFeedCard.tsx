import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { Inbox, ScanLine, ShoppingBag, Star, Store, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTenant } from '@/hooks/useTenant';
import type { FeedItem, FeedKind } from '@/hooks/useCockpitFeed';
import { cn, formatCurrency } from '@/lib/utils';
import { channelLabel } from './cockpitFormat';

interface Props {
  items: FeedItem[] | undefined;
  isLoading: boolean;
}

const ICON: Record<FeedKind, { icon: typeof ShoppingBag; tone: string }> = {
  order: { icon: ShoppingBag, tone: 'bg-sky-100 text-[#1D3A5C] dark:bg-sky-950 dark:text-sky-200' },
  pos: { icon: Store, tone: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  customer: { icon: UserPlus, tone: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
  review: { icon: Star, tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  checkin: { icon: ScanLine, tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' },
};

/** DASH-2b — "Net binnen": de laatste bestellingen, kassatickets, klanten, reviews en check-ins. */
export function LiveFeedCard({ items, isLoading }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';

  const line = (i: FeedItem): { title: string; sub: string } => {
    const money = i.amount === null ? '' : formatCurrency(i.amount, currency);
    switch (i.kind) {
      case 'order':
        return {
          title: i.name ? t('admin.cockpit.feed.order_from', { name: i.name, amount: money }) : t('admin.cockpit.feed.order', { amount: money }),
          sub: [i.channel ? channelLabel(t, i.channel) : null, i.ref ? `#${i.ref.replace(/^#/, '')}` : null].filter(Boolean).join(' · '),
        };
      case 'pos':
        return { title: t('admin.cockpit.feed.pos', { amount: money }), sub: i.ref ? `#${i.ref}` : t('admin.cockpit.channels.pos') };
      case 'customer':
        return { title: t('admin.cockpit.feed.customer', { name: i.name ?? t('admin.cockpit.feed.someone') }), sub: t('admin.cockpit.feed.customer_sub') };
      case 'review':
        return { title: t('admin.cockpit.feed.review', { count: i.rating ?? 0 }), sub: i.name ?? '' };
      case 'checkin':
        return { title: t('admin.cockpit.feed.checkin', { name: i.name ?? t('admin.cockpit.feed.someone') }), sub: t('admin.cockpit.feed.checkin_sub') };
    }
  };

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t('admin.cockpit.feed.title')}</CardTitle>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {t('admin.cockpit.feed.live')}
        </span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading && !items ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <Inbox className="h-7 w-7" aria-hidden="true" />
            <p className="text-sm">{t('admin.cockpit.feed.empty')}</p>
          </div>
        ) : (
          <ul className="-mx-2.5 flex flex-col">
            {items.map((i) => {
              const { icon: Icon, tone } = ICON[i.kind];
              const { title, sub } = line(i);
              const inner = (
                <>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone)} aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{title}</span>
                    {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(i.at), { locale, roundingMethod: 'floor' })}
                  </span>
                </>
              );
              return (
                <li key={i.id}>
                  {i.href ? (
                    <Link to={i.href} className="flex min-h-12 items-center gap-3 rounded-lg px-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-2.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

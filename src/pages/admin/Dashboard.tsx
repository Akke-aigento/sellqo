import { useRouteAllowed } from '@/hooks/useRouteAllowed';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useCan, useScopedRoles } from '@/hooks/useCan';
import { useTracks } from '@/hooks/useBusinessModules';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { useCockpitRevenue } from '@/hooks/useCockpitRevenue';
import {
  useCockpitNewCustomers,
  useCockpitOpenQuotes,
  useCockpitShipping,
  useCockpitStock,
  useCockpitTopProducts,
  useCockpitUnread,
} from '@/hooks/useCockpitSignals';
import { useCockpitFeed } from '@/hooks/useCockpitFeed';
import { useCockpitMenuState, useCockpitNextEvent, useCockpitPosSession } from '@/hooks/useCockpitTracks';
import { useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { useNavItemVisibility } from '@/components/admin/sidebar/useNavItemVisibility';
import { findNavItems } from '@/components/admin/sidebar/sidebarConfig';
import { lowStockProducts } from '@/lib/cockpitBrief';
import { CockpitHeader, CockpitPill } from '@/components/admin/cockpit/CockpitHeader';
import { MorningBrief } from '@/components/admin/cockpit/MorningBrief';
import { TodayHeroCard } from '@/components/admin/cockpit/TodayHeroCard';
import { GoalCard } from '@/components/admin/cockpit/GoalCard';
import { TodoCard, type TodoItem } from '@/components/admin/cockpit/TodoCard';
import { ChannelRevenueCard } from '@/components/admin/cockpit/ChannelRevenueCard';
import { LiveFeedCard } from '@/components/admin/cockpit/LiveFeedCard';
import { TopProductsCard } from '@/components/admin/cockpit/TopProductsCard';
import { EventHeroCard } from '@/components/admin/cockpit/EventHeroCard';
import { DeliveriesCard, HorecaTiles, KitchenHeroCard, RushCard, SoldOutCard } from '@/components/admin/cockpit/HorecaCards';
import { CockpitCustomizeDialog } from '@/components/admin/cockpit/CockpitCustomizeDialog';
import { COCKPIT_LAYOUT_TYPE, resolveLayout, spanClass, type CockpitCardId } from '@/components/admin/cockpit/cockpitLayout';
import { minuteLabel } from '@/components/admin/cockpit/cockpitFormat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// DASH-2b — cockpit-dashboard: per spoor een eigen hero (events, horeca), daaronder de
// kaarten in de volgorde die de gebruiker koos. Het oude DashboardGrid
// (src/components/admin/DashboardGrid.tsx) wordt niet meer gerenderd maar blijft staan tot fase 4.
export default function AdminDashboard() {
  const routeAllowed = useRouteAllowed();
  const { t } = useTranslation();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformAdmin } = useAuth();
  // De échte sporen van de winkel (niet hasTrack: dat zegt altijd ja voor een platformadmin).
  const { tracks, planTrack, ready: tracksReady } = useTracks();
  const has = (tr: (typeof tracks)[number]) => tracks.includes(tr);
  const { isItemBlocked } = useNavItemVisibility();

  const roles = useScopedRoles();
  const rolesLoading = roles === null;
  const canRevenue = useCan('read', 'reports_financial');
  const canOrders = useCan('read', 'orders');
  const canProducts = useCan('read', 'products');
  const canWriteProducts = useCan('write', 'products');
  const canInbox = useCan('read', 'inbox');
  const canInvoices = useCan('read', 'invoices');
  const canCustomers = useCan('read', 'customers');
  const canPos = useCan('read', 'pos');
  const isShopAdmin = isPlatformAdmin || (roles ?? []).some((r) => r === 'tenant_admin');
  const hasTenant = !!currentTenant;

  // Klok voor de keukentimers en "nu" in de grafieken.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const webshop = has('webshop');
  const horeca = has('horeca');
  const events = has('events');
  const horecaFirst = planTrack === 'horeca' && !webshop;

  const revenue = useCockpitRevenue(hasTenant && canRevenue);
  const shipping = useCockpitShipping(hasTenant && canOrders && webshop);
  const stock = useCockpitStock(hasTenant && canProducts);
  const newCustomers = useCockpitNewCustomers(hasTenant && canCustomers);
  const quotes = useCockpitOpenQuotes(hasTenant && canInvoices && webshop);
  const unread = useCockpitUnread(hasTenant && canInbox);
  const feed = useCockpitFeed({
    orders: canOrders,
    pos: canPos,
    customers: canCustomers,
    reviews: canCustomers,
    checkins: events && canOrders,
  });
  // De dag als sleutel: "vandaag" verschuift om middernacht zonder elke 30 s de toplijsten te herladen.
  const dayKey = format(new Date(nowMs), 'yyyy-MM-dd');
  const dayStart = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey]);
  const topSince = useMemo(() => (horecaFirst ? dayStart : subDays(dayStart, 7)), [horecaFirst, dayStart]);
  const top = useCockpitTopProducts(topSince, hasTenant && canOrders, 5);
  const menuSince = useMemo(() => subDays(dayStart, 14), [dayStart]);
  const menuTop = useCockpitTopProducts(menuSince, hasTenant && horeca && canProducts && canOrders, 8);
  const menu = useCockpitMenuState((menuTop.data ?? []).flatMap((p) => (p.productId ? [p.productId] : [])), hasTenant && horeca && canProducts && !menuTop.isLoading, 5);
  const event = useCockpitNextEvent(hasTenant && events);
  const kitchen = useKitchenBoard(nowMs, hasTenant && horeca && canOrders);
  const posSession = useCockpitPosSession(hasTenant && horeca && canPos);
  const kitchenItem = findNavItems(['kitchen'])[0];
  const canOpenKitchen = !!kitchenItem && !isItemBlocked(kitchenItem);

  const prefs = useDashboardPreferences();
  // useTracks geeft elke render een nieuwe array: de sleutel houdt de layout stabiel.
  const tracksKey = tracks.join(',');
  const layout = useMemo(() => resolveLayout(tracksKey ? (tracksKey.split(',') as typeof tracks) : [], prefs.preferences), [tracksKey, prefs.preferences]);
  const [customizing, setCustomizing] = useState(false);

  if (tenantLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentTenant && !isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('admin.dashboard.geen_winkel_gevonden')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {t('admin.dashboard.je_hebt_nog_geen_toegang_tot')}
        </p>
      </div>
    );
  }

  const revenueLoading = rolesLoading || revenue.isLoading;
  const revenueProps = {
    canRead: canRevenue || rolesLoading,
    data: revenue.data,
    isLoading: revenueLoading,
    isError: revenue.isError,
  };

  const briefLoading =
    rolesLoading ||
    (canRevenue && revenue.isLoading) ||
    (webshop && canOrders && shipping.isLoading) ||
    (canProducts && stock.isLoading);

  const lowStock = stock.data ? lowStockProducts(stock.data).length : 0;
  const todoItems: TodoItem[] = [
    ...(webshop && canOrders && shipping.data
      ? [{ key: 'ship', count: shipping.data.openCount, label: t('admin.cockpit.todo.ship'), href: '/admin/orders', oldestAgeMs: shipping.data.oldestAgeMs, tone: 'urgent' as const }]
      : []),
    ...(canInbox && routeAllowed('/admin/messages') && unread.data !== undefined
      ? [{ key: 'inbox', count: unread.data, label: t('admin.cockpit.todo.messages'), href: '/admin/messages', tone: 'normal' as const }]
      : []),
    ...(webshop && canInvoices && quotes.data !== undefined
      ? [{ key: 'quotes', count: quotes.data, label: t('admin.cockpit.todo.quotes'), href: '/admin/orders/quotes', tone: 'normal' as const }]
      : []),
    ...(canProducts && stock.data
      ? [{ key: 'stock', count: lowStock, label: t('admin.cockpit.todo.low_stock'), href: '/admin/products?stock=low', tone: 'soft' as const }]
      : []),
  ];
  const todoLoading = shipping.isLoading || unread.isLoading || quotes.isLoading || stock.isLoading;

  // Een kaart zonder recht verbergen we liever dan een lege "geen toegang"-kaart te tonen.
  const permitted = (id: CockpitCardId): boolean => {
    if (rolesLoading) return true;
    switch (id) {
      case 'today':
      case 'goal':
      case 'channels':
      case 'rush':
        return canRevenue;
      case 'kitchen':
      case 'deliveries':
      case 'top':
        return canOrders;
      case 'menu':
        return canProducts;
      case 'feed':
        return canOrders || canPos || canCustomers;
      default:
        return true;
    }
  };

  const visible = layout.order.filter((c) => !layout.hidden.has(c.id) && permitted(c.id));
  // In "aanpassen" enkel kaarten die deze gebruiker kan zien: een schakelaar zonder effect is een dode knop.
  const customizable = { order: layout.order.filter((c) => permitted(c.id)), hidden: layout.hidden };

  const renderCard = (id: CockpitCardId) => {
    switch (id) {
      case 'event':
        return <EventHeroCard event={event.data} isLoading={event.isLoading} />;
      case 'kitchen':
        return (
          <div className="flex flex-col gap-4">
            <KitchenHeroCard cards={kitchen.cards} isLoading={kitchen.isLoading} nowMs={nowMs} canOpenKitchen={canOpenKitchen} />
            <HorecaTiles data={revenue.data} cards={kitchen.cards} canRevenue={canRevenue} />
          </div>
        );
      case 'today':
        return <TodayHeroCard {...revenueProps} newCustomers={canCustomers ? newCustomers.data ?? null : null} />;
      case 'goal':
        return <GoalCard canRead={revenueProps.canRead} canEdit={isShopAdmin} data={revenue.data} isLoading={revenueLoading} />;
      case 'rush':
        return <RushCard data={revenue.data} isLoading={revenueLoading} />;
      case 'menu':
        return <SoldOutCard items={menu.data} isLoading={menu.isLoading || menuTop.isLoading} canWrite={canWriteProducts} />;
      case 'todo':
        return <TodoCard items={todoItems} isLoading={todoLoading} />;
      case 'channels':
        return <ChannelRevenueCard {...revenueProps} />;
      case 'feed':
        return <LiveFeedCard items={feed.data} isLoading={feed.isLoading} />;
      case 'deliveries':
        return <DeliveriesCard cards={kitchen.cards} isLoading={kitchen.isLoading} />;
      case 'top':
        return (
          <TopProductsCard
            title={horecaFirst ? t('admin.cockpit.top.title_today') : t('admin.cockpit.top.title_week')}
            products={top.data}
            isLoading={top.isLoading}
            compact={horecaFirst}
          />
        );
    }
  };

  const saveLayout = (order: CockpitCardId[], hidden: CockpitCardId[]) => {
    prefs.updatePreferences(
      { layout_type: COCKPIT_LAYOUT_TYPE, widget_order: order, hidden_widgets: hidden },
      {
        onSuccess: () => {
          setCustomizing(false);
          toast.success(t('admin.cockpit.customize.saved'));
        },
        onError: () => toast.error(t('admin.cockpit.customize.save_failed')),
      },
    );
  };
  const resetLayout = () => {
    prefs.updatePreferences(
      { layout_type: COCKPIT_LAYOUT_TYPE, widget_order: [], hidden_widgets: [] },
      { onSuccess: () => setCustomizing(false), onError: () => toast.error(t('admin.cockpit.customize.save_failed')) },
    );
  };

  const pills =
    horeca && posSession.data ? (
      <CockpitPill live>
        {t('admin.cockpit.header.pos_open', {
          time: minuteLabel(new Date(posSession.data.opened_at).getHours() * 60 + new Date(posSession.data.opened_at).getMinutes()),
        })}
      </CockpitPill>
    ) : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      {currentTenant && (
        <>
          <CockpitHeader pills={pills} onCustomize={() => setCustomizing(true)} />

          <div className="relative -mt-14 flex flex-col gap-6 px-2 md:-mt-16 md:px-4">
            <MorningBrief
              isLoading={briefLoading}
              input={{
                yesterday: canRevenue ? revenue.data?.yesterdayChannels ?? null : null,
                shipping: webshop && canOrders ? shipping.data ?? null : null,
                products: canProducts ? stock.data ?? null : null,
              }}
            />

            {tracksReady && (
              <div className="grid grid-flow-row-dense grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((c) => (
                  <div key={c.id} className={cn('min-w-0', spanClass(c.span))}>
                    {renderCard(c.id)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <CockpitCustomizeDialog
            open={customizing}
            onOpenChange={setCustomizing}
            layout={customizable}
            onSave={saveLayout}
            onReset={resetLayout}
            saving={prefs.isUpdating}
          />
        </>
      )}

      {/* Platform Admin Notice */}
      {isPlatformAdmin && (
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.platform_administrator')}</CardTitle>
            <CardDescription>
              {t('admin.dashboard.je_hebt_volledige_toegang_tot_het')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin/platform">
                {t('admin.dashboard.ga_naar_platform_beheer')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

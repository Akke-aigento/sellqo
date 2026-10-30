import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Settings as SettingsIcon, Sliders, Store, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { SellqoLogo } from '@/components/SellqoLogo';
import { SidebarCustomizeDialog } from './SidebarCustomizeDialog';
import { sidebarGroups, platformGroup, getAllMenuItems, type NavItem, type NavGroup } from './sidebar/sidebarConfig';
import { useNavItemVisibility } from './sidebar/useNavItemVisibility';
import { bottomNavUrl } from './sidebar/bottomNav';
import { useTracks } from '@/hooks/useBusinessModules';
import { InboxBadge } from './sidebar/InboxBadge';
import { AdsAiBadge } from './sidebar/AdsAiBadge';
import { GroupedTenantPicker } from './sidebar/GroupedTenantPicker';
import { groupTenants } from '@/lib/tenantGroups';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, signOut, isPlatformAdmin } = useAuth();
  const { currentTenant, tenants, setCurrentTenant, loading: tenantsLoading } = useTenant();
  const { hiddenItems } = useSidebarPreferences();
  const { isPageHidden, togglePage, isToggling, isFeatureGranted, toggleGrantedFeature, isTogglingFeature } = useTenantPageOverrides();
  const { isAdminView } = usePlatformViewMode();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // TENANT-SWITCHER-1: platform-admins krijgen de gegroepeerde kiezer; voor
  // iedereen anders is dit null en blijft de gewone kiezer hieronder staan.
  const tenantGroups = groupTenants(tenants, isPlatformAdmin);

  // De zichtbaarheidsregels stonden hier, en de mobiele onderbalk paste ze
  // niet toe. Ze zijn verhuisd naar useNavItemVisibility zodat beide weergaven
  // dezelfde definitie gebruiken; zie de toelichting daar.
  const { shouldHideItem, isItemSubscriptionBlocked } = useNavItemVisibility();
  // TRACKS-2: een horecazaak zonder webshop opent de Kassa in de kassa-app (/kassa), niet het kassabeheer.
  const { hasTrack } = useTracks();
  const navCtx = { horeca: hasTrack('horeca'), webshop: hasTrack('webshop'), events: hasTrack('events') };
  const sidebarHref = (item: NavItem) => bottomNavUrl(item, navCtx);

  // SIDEBAR-CLEAN-1 — één actief item: de langste menu-URL die de huidige
  // route dekt. Zo licht /admin/promotions/customer-groups enkel Klantgroepen
  // op (onder Klanten) en niet ook Promoties, en /admin/orders/invoices enkel
  // Facturen en niet ook Bestellingen.
  // INKOOP-6: `match` is de route, `url` het item dat oplicht (activeAlso).
  const allUrls = useMemo(() => {
    const urls: { match: string; url: string }[] = [];
    const add = (item: { url: string; activeAlso?: string[] }) => {
      urls.push({ match: item.url, url: item.url });
      for (const m of item.activeAlso ?? []) urls.push({ match: m, url: item.url });
    };
    for (const group of [...sidebarGroups, platformGroup]) {
      for (const item of group.items) {
        add(item);
        for (const child of item.children ?? []) add(child);
      }
    }
    return urls;
  }, []);

  const activeUrl = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    let best: { match: string; url: string } | null = null;
    for (const u of allUrls) {
      const hit = u.match === '/admin' ? path === '/admin' : path === u.match || path.startsWith(u.match + '/');
      if (hit && (!best || u.match.length > best.match.length)) best = u;
    }
    return best?.url ?? null;
  }, [location.pathname, allUrls]);

  const isActive = (path: string) => path === activeUrl;

  // Uitklapstand per parent. Een parent gaat open zodra je op hem of een kind staat.
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const isOnPlatform = location.pathname.startsWith('/admin/platform');
  const [platformOpen, setPlatformOpen] = useState(isOnPlatform);

  useEffect(() => {
    if (!activeUrl) return;
    for (const group of [...sidebarGroups, platformGroup]) {
      for (const item of group.items) {
        if (item.children?.some((c) => c.url === activeUrl) || (item.children && item.url === activeUrl)) {
          setOpenItems((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: true }));
        }
      }
    }
  }, [activeUrl]);

  useEffect(() => {
    if (isOnPlatform) setPlatformOpen(true);
  }, [isOnPlatform]);

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const showAdminToggles = isPlatformAdmin && isAdminView;

  const renderFeatureToggle = (item: NavItem) => {
    if (!showAdminToggles || !item.featureKey) return null;
    const blocked = isItemSubscriptionBlocked(item);
    if (!blocked) return null; // Only show for subscription-blocked items
    
    const granted = isFeatureGranted(item.featureKey);
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleGrantedFeature(item.featureKey!);
        }}
        disabled={isTogglingFeature}
        className={cn(
          'p-0.5 rounded hover:bg-accent/50 transition-colors shrink-0',
          granted ? 'text-green-500' : 'text-amber-500/60 hover:text-amber-500'
        )}
        title={granted ? t('sidebar.adminView.featureGranted') : t('sidebar.adminView.featureBlocked')}
      >
        {granted ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      </button>
    );
  };

  const renderPageToggle = (itemId: string, item?: NavItem) => {
    if (!showAdminToggles) return null;
    const hidden = isPageHidden(itemId);
    return (
      <span className="ml-auto flex items-center gap-0.5 shrink-0">
        {item && renderFeatureToggle(item)}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePage(itemId);
          }}
          disabled={isToggling}
          className={cn(
            'p-0.5 rounded hover:bg-accent/50 transition-colors',
            hidden ? 'text-destructive/60' : 'text-muted-foreground/40 hover:text-muted-foreground'
          )}
          title={hidden ? t('sidebar.adminView.pageHidden') : t('sidebar.adminView.pageVisible')}
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </span>
    );
  };

  const renderNavItem = (item: NavItem) => {
    // Check if item is hidden (by preference or by role)
    if (shouldHideItem(item)) return null;

    const itemIsPageHidden = isPageHidden(item.id);

    // Item met kinderen. SIDEBAR-CLEAN-1: het label navigeert (naar het
    // landingskind of, als dat verborgen is, naar het eerste zichtbare kind);
    // de chevron klapt het submenu open of dicht.
    if (item.children && item.children.length > 0) {
      const visibleChildren = item.children.filter(child => !shouldHideItem(child));
      const landing = item.children.find((c) => c.landing);
      const landingVisible = landing ? visibleChildren.includes(landing) : false;
      const subItems = visibleChildren.filter((c) => !c.landing);
      const href = landing ? (landingVisible ? landing.url : subItems[0]?.url) : item.url;
      if (!href) return null;

      if (subItems.length === 0) {
        return renderLeaf(item, href);
      }

      const open = openItems[item.id] ?? false;
      const setOpen = (value: boolean) => setOpenItems((prev) => ({ ...prev, [item.id]: value }));
      const parentActive = isActive(href) || (landingVisible && isActive(landing!.url));

      return (
        <Collapsible key={item.id} open={open} onOpenChange={setOpen} className="group/collapsible">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={parentActive} className={cn(showAdminToggles && itemIsPageHidden && 'opacity-40')}>
              <NavLink to={href} onClick={() => setOpen(true)} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{t(item.titleKey)}</span>
                </span>
                {renderPageToggle(item.id, item)}
              </NavLink>
            </SidebarMenuButton>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction aria-label={t(item.titleKey)} className="data-[state=open]:rotate-90 transition-transform">
                <ChevronRight className="h-4 w-4" />
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {subItems.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    {child.disabled ? (
                      <SidebarMenuSubButton className="opacity-40 pointer-events-none">
                        <span>{t(child.titleKey)}</span>
                        <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{t('navigation.soon')}</span>
                      </SidebarMenuSubButton>
                    ) : (
                      <SidebarMenuSubButton asChild isActive={isActive(child.url)} className={cn(showAdminToggles && isPageHidden(child.id) && 'opacity-40')}>
                        <NavLink to={child.url} className="flex items-center justify-between w-full">
                          <span>{t(child.titleKey)}</span>
                          {child.badge && child.id === 'ads-ai' && <AdsAiBadge />}
                          {renderPageToggle(child.id, child)}
                        </NavLink>
                      </SidebarMenuSubButton>
                    )}
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return renderLeaf(item, sidebarHref(item));
  };

  const renderLeaf = (item: NavItem, href: string) => {
    const itemIsPageHidden = isPageHidden(item.id);
    // Regular item without children
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton asChild isActive={isActive(href)} className={cn(showAdminToggles && itemIsPageHidden && 'opacity-40')}>
          <NavLink to={href} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{t(item.titleKey)}</span>
            </span>
            {item.badge && item.id === 'inbox' && <InboxBadge />}
            {renderPageToggle(item.id, item)}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const visibleItems = group.items.filter(item => {
      if (shouldHideItem(item)) return false;
      // Een parent met landingskind heeft minstens één zichtbaar kind nodig
      // (anders is er geen pagina om naartoe te linken); zonder landingskind
      // is de parent zelf de pagina.
      if (item.children?.some((c) => c.landing)) {
        return item.children.some(child => !shouldHideItem(child));
      }
      return true;
    });

    if (visibleItems.length === 0) return null;

    // SIDEBAR-CLEAN-1: het Platform-blok is inklapbaar en staat standaard dicht,
    // behalve als je op een platformpagina zit.
    if (group.id === 'platform') {
      return (
        <Collapsible key={group.id} open={platformOpen} onOpenChange={setPlatformOpen} className="group/platform">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>{t(group.titleKey)}</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/platform:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map(item => renderNavItem(item))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      );
    }

    return (
      <SidebarGroup key={group.id}>
        <SidebarGroupLabel>{t(group.titleKey)}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map(item => renderNavItem(item))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b">
          <Link 
            to="/admin" 
            className="px-4 py-3 flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <SellqoLogo variant="full" width={140} className="h-auto" />
          </Link>

          {tenantGroups && (
            <div className="px-2 pb-2">
              <GroupedTenantPicker
                groups={tenantGroups}
                currentTenant={currentTenant}
                loading={tenantsLoading}
                onSelect={setCurrentTenant}
              />
            </div>
          )}

          {!tenantGroups && (isPlatformAdmin || tenants.length > 1) && (
            <div className="px-2 pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal"
                    disabled={tenantsLoading}
                  >
                    {tenantsLoading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : currentTenant ? (
                      <span className="truncate">{currentTenant.name}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('sidebar.selectStore')}</span>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {tenants.map((tenant) => (
                    <DropdownMenuItem
                      key={tenant.id}
                      onClick={() => setCurrentTenant(tenant)}
                      className={cn(currentTenant?.id === tenant.id && 'bg-accent')}
                    >
                      <Store className="mr-2 h-4 w-4" />
                      {tenant.name}
                    </DropdownMenuItem>
                  ))}
                  {tenants.length === 0 && (
                    <DropdownMenuItem disabled>
                      {t('sidebar.noStores')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent>
          {/* Admin View indicator banner */}
          {showAdminToggles && (
            <div className="mx-3 mt-2 mb-1 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-primary">
                {t('sidebar.adminView.banner')}
              </span>
            </div>
          )}

          {sidebarGroups.map(group => renderGroup(group))}

          {isPlatformAdmin && renderGroup(platformGroup)}
        </SidebarContent>

        <SidebarFooter className="border-t">
          <SidebarMenu>
            {/* Customize menu button */}
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setCustomizeOpen(true)}>
                <Sliders className="h-4 w-4" />
                <span>{t('sidebar.customize')}</span>
                {hiddenItems.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {t('sidebar.hiddenCount', { count: hiddenItems.length })}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* User menu */}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {user?.email ? getInitials(user.email) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate flex-1 text-left">
                      {user?.email}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem asChild>
                    <NavLink to="/admin/settings">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      {t('navigation.settings')}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        menuItems={getAllMenuItems()}
      />
    </>
  );
}

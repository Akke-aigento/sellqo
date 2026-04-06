import { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Settings as SettingsIcon, Sliders, Store, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { SellqoLogo } from '@/components/SellqoLogo';
import { SidebarCustomizeDialog } from './SidebarCustomizeDialog';
import { sidebarGroups, platformGroup, getAllMenuItems, WAREHOUSE_ALLOWED_ITEMS, type NavItem, type NavGroup } from './sidebar/sidebarConfig';
import { InboxBadge } from './sidebar/InboxBadge';
import { AdsAiBadge } from './sidebar/AdsAiBadge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
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
  const location = useLocation();
  const { user, signOut, isPlatformAdmin, userRole, isWarehouse } = useAuth();
  const { currentTenant, tenants, setCurrentTenant, loading: tenantsLoading } = useTenant();
  const { isItemHidden, hiddenItems } = useSidebarPreferences();
  const { isPageHidden, togglePage, isToggling } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const { isAdminView } = usePlatformViewMode();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Check if item should be hidden based on subscription features
  const isItemFeatureHidden = (item: NavItem): boolean => {
    if (!item.featureKey) return false;
    
    // Platform admins in admin view see everything
    if (isPlatformAdmin && isAdminView) return false;
    
    const features = subscription?.pricing_plan?.features;
    if (!features) return true; // No subscription = hide premium features
    
    return features[item.featureKey as keyof typeof features] !== true;
  };

  // Check if item should be hidden based on user role
  const isItemRoleHidden = (item: NavItem): boolean => {
    // Warehouse users can only see specific items
    if (isWarehouse) {
      // Check if the item is in the allowed list
      const isAllowed = WAREHOUSE_ALLOWED_ITEMS.includes(item.id);
      // Also check explicit excludeRoles
      const isExcluded = item.excludeRoles?.includes('warehouse');
      return !isAllowed || isExcluded === true;
    }
    
    // Check allowedRoles - if set, only those roles can see it
    if (item.allowedRoles && item.allowedRoles.length > 0) {
      if (!userRole || !item.allowedRoles.includes(userRole)) {
        return true;
      }
    }
    
    // Check excludeRoles - if user's role is in the list, hide it
    if (item.excludeRoles && item.excludeRoles.length > 0) {
      if (userRole && item.excludeRoles.includes(userRole)) {
        return true;
      }
    }
    
    return false;
  };

  // Check if page is hidden via tenant page overrides
  const isItemPageOverridden = (item: NavItem): boolean => {
    if (isPlatformAdmin && isAdminView) return false;
    return isPageHidden(item.id);
  };

  // Combined check for preference, role, feature, AND page override hiding
  const shouldHideItem = (item: NavItem): boolean => {
    return isItemHidden(item.id) || isItemRoleHidden(item) || isItemFeatureHidden(item) || isItemPageOverridden(item);
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const isGroupExpanded = (item: NavItem) => {
    if (isActive(item.url)) return true;
    return item.children?.some(child => isActive(child.url)) || false;
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const showAdminToggles = isPlatformAdmin && isAdminView;

  const renderPageToggle = (itemId: string) => {
    if (!showAdminToggles) return null;
    const hidden = isPageHidden(itemId);
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePage(itemId);
        }}
        disabled={isToggling}
        className={cn(
          'ml-auto p-0.5 rounded hover:bg-accent/50 transition-colors shrink-0',
          hidden ? 'text-destructive/60' : 'text-muted-foreground/40 hover:text-muted-foreground'
        )}
        title={hidden ? 'Verborgen voor tenant — klik om te tonen' : 'Zichtbaar voor tenant — klik om te verbergen'}
      >
        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    );
  };

  const renderNavItem = (item: NavItem) => {
    // Check if item is hidden (by preference or by role)
    if (shouldHideItem(item)) return null;

    const itemIsPageHidden = isPageHidden(item.id);

    // Item with children (collapsible)
    if (item.children && item.children.length > 0) {
      const visibleChildren = item.children.filter(child => !shouldHideItem(child));
      if (visibleChildren.length === 0) return null;

      return (
        <Collapsible key={item.id} defaultOpen={isGroupExpanded(item)} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isActive(item.url)} className={cn(showAdminToggles && itemIsPageHidden && 'opacity-40')}>
                {item.icon && <item.icon className="h-4 w-4" />}
                <span>{item.title}</span>
                {renderPageToggle(item.id)}
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {visibleChildren.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    {child.disabled ? (
                      <SidebarMenuSubButton className="opacity-40 pointer-events-none">
                        <span>{child.title}</span>
                        <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">soon</span>
                      </SidebarMenuSubButton>
                    ) : (
                      <SidebarMenuSubButton asChild isActive={isActive(child.url)} className={cn(showAdminToggles && isPageHidden(child.id) && 'opacity-40')}>
                        <NavLink to={child.url} className="flex items-center justify-between w-full">
                          <span>{child.title}</span>
                          {child.badge && child.id === 'ads-ai' && <AdsAiBadge />}
                          {renderPageToggle(child.id)}
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

    // Regular item without children
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton asChild isActive={isActive(item.url)} className={cn(showAdminToggles && itemIsPageHidden && 'opacity-40')}>
          <NavLink to={item.url} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.title}</span>
            </span>
            {item.badge && item.id === 'inbox' && <InboxBadge />}
            {renderPageToggle(item.id)}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const visibleItems = group.items.filter(item => {
      if (shouldHideItem(item)) return false;
      // If item has children, check if at least one child is visible
      if (item.children) {
        return item.children.some(child => !shouldHideItem(child));
      }
      return true;
    });

    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup key={group.id}>
        <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
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

          {(isPlatformAdmin || tenants.length > 1) && (
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
                      <span className="text-muted-foreground">Selecteer winkel</span>
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
                      Geen winkels beschikbaar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent>
          {sidebarGroups.map(group => renderGroup(group))}

          {isPlatformAdmin && renderGroup(platformGroup)}
        </SidebarContent>

        <SidebarFooter className="border-t">
          <SidebarMenu>
            {/* Customize menu button */}
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setCustomizeOpen(true)}>
                <Sliders className="h-4 w-4" />
                <span>Personaliseer menu</span>
                {hiddenItems.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {hiddenItems.length} verborgen
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
                      Instellingen
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Uitloggen
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

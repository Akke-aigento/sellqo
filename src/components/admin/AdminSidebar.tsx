import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Settings as SettingsIcon, Sliders, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { SellqoLogo } from '@/components/SellqoLogo';
import { SidebarCustomizeDialog } from './SidebarCustomizeDialog';
import { sidebarGroups, platformGroup, getAllMenuItems, type NavItem, type NavGroup } from './sidebar/sidebarConfig';
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
  const { user, signOut, isPlatformAdmin } = useAuth();
  const { currentTenant, tenants, setCurrentTenant, loading: tenantsLoading } = useTenant();
  const { isItemHidden, hiddenItems } = useSidebarPreferences();
  const [customizeOpen, setCustomizeOpen] = useState(false);

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

  const renderNavItem = (item: NavItem) => {
    // Check if item is hidden
    if (isItemHidden(item.id)) return null;

    // Item with children (collapsible)
    if (item.children && item.children.length > 0) {
      const visibleChildren = item.children.filter(child => !isItemHidden(child.id));
      if (visibleChildren.length === 0) return null;

      return (
        <Collapsible key={item.id} defaultOpen={isGroupExpanded(item)} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isActive(item.url)}>
                {item.icon && <item.icon className="h-4 w-4" />}
                <span>{item.title}</span>
                <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {visibleChildren.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                      <NavLink to={child.url}>
                        {child.title}
                      </NavLink>
                    </SidebarMenuSubButton>
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
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink to={item.url}>
            {item.icon && <item.icon className="h-4 w-4" />}
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const visibleItems = group.items.filter(item => {
      if (isItemHidden(item.id)) return false;
      // If item has children, check if at least one child is visible
      if (item.children) {
        return item.children.some(child => !isItemHidden(child.id));
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
          <div className="px-4 pt-6 pb-4">
            <SellqoLogo variant="full" width={140} className="h-auto" />
          </div>

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

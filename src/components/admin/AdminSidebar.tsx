import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  FolderTree,
  Truck,
  Settings, 
  BarChart3,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  Store,
  FileText,
  RefreshCw,
  Receipt
} from 'lucide-react';
import { SellqoLogo } from '@/components/SellqoLogo';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
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
  SidebarTrigger,
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

const mainNavItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Producten', url: '/admin/products', icon: Package },
  { title: 'Klanten', url: '/admin/customers', icon: Users },
  { title: 'Categorieën', url: '/admin/categories', icon: FolderTree },
];

const settingsNavItems = [
  { title: 'Verzending', url: '/admin/shipping', icon: Truck },
  { title: 'Facturatie', url: '/admin/billing', icon: Receipt },
  { title: 'Instellingen', url: '/admin/settings', icon: Settings },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
];

const platformNavItems = [
  { title: 'Tenants', url: '/admin/platform', icon: Building2 },
  { title: 'Platform Billing', url: '/admin/platform/billing', icon: Receipt },
];

export function AdminSidebar() {
  const location = useLocation();
  const { user, signOut, isPlatformAdmin } = useAuth();
  const { currentTenant, tenants, setCurrentTenant, loading: tenantsLoading } = useTenant();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const isOrdersActive = location.pathname.startsWith('/admin/orders');

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        {/* Logo Area - proper padding as per brand guidelines */}
        <div className="px-4 pt-6 pb-4">
          <SellqoLogo variant="full" width={140} className="h-auto" />
        </div>

        {/* Tenant Switcher */}
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
                    className={cn(
                      currentTenant?.id === tenant.id && 'bg-accent'
                    )}
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
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Orders with submenu */}
              <Collapsible defaultOpen={isOrdersActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isOrdersActive}>
                      <ShoppingCart className="h-4 w-4" />
                      <span>Bestellingen</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname === '/admin/orders'}>
                          <NavLink to="/admin/orders">
                            Alle bestellingen
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname.startsWith('/admin/orders/quotes')}>
                          <NavLink to="/admin/orders/quotes">
                            Offertes
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname.startsWith('/admin/orders/invoices')}>
                          <NavLink to="/admin/orders/invoices">
                            Facturen
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname.startsWith('/admin/orders/creditnotes')}>
                          <NavLink to="/admin/orders/creditnotes">
                            Creditnota's
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname.startsWith('/admin/orders/subscriptions')}>
                          <NavLink to="/admin/orders/subscriptions">
                            <RefreshCw className="h-3 w-3 mr-1.5" />
                            Abonnementen
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Instellingen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
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
                    <Settings className="mr-2 h-4 w-4" />
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
  );
}

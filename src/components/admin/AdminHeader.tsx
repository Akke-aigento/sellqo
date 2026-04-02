import { Menu, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { Switch } from '@/components/ui/switch';

export function AdminHeader() {
  const { currentTenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const { viewMode, setViewMode, isAdminView } = usePlatformViewMode();
  
  const isOnDashboard = location.pathname === '/admin';

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SidebarTrigger>

      {/* Back button - only on mobile/tablet and not on dashboard */}
      {!isOnDashboard && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="lg:hidden h-10 w-10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Terug</span>
        </Button>
      )}

      {/* Logo as home link - only on mobile/tablet */}
      <Link to="/admin" className="lg:hidden hover:opacity-80 transition-opacity">
        <SellqoLogo variant="icon" width={28} className="h-auto" />
      </Link>

      <div className="flex-1">
        {currentTenant && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {currentTenant.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {currentTenant.subscription_plan}
            </Badge>
          </div>
        )}
      </div>

      {/* Platform Admin View Mode Toggle */}
      {isPlatformAdmin && currentTenant && (
        <div className="flex items-center gap-2 border-l pl-3 ml-1">
          <div className="flex items-center gap-1.5">
            {isAdminView ? (
              <Eye className="h-3.5 w-3.5 text-primary" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium hidden sm:inline">
              {isAdminView ? 'Admin' : 'Tenant'}
            </span>
          </div>
          <Switch
            checked={isAdminView}
            onCheckedChange={(checked) => setViewMode(checked ? 'admin' : 'tenant')}
            className="scale-75"
          />
        </div>
      )}

      <NotificationCenter />
      <ThemeToggle />
    </header>
  );
}

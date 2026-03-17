import { Menu, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Button } from '@/components/ui/button';

export function AdminHeader() {
  const { currentTenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  
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
          onClick={() => navigate('/admin')}
          className="lg:hidden h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Terug</span>
        </Button>
      )}

      {/* Logo + shop name as home link - centered on mobile/tablet */}
      <Link to="/admin" className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all">
        <SellqoLogo variant="icon" width={28} className="h-auto" />
        {currentTenant && (
          <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">
            {currentTenant.name}
          </span>
        )}
      </Link>

      <div className="flex-1">
        {currentTenant && (
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {currentTenant.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {currentTenant.subscription_plan}
            </Badge>
          </div>
        )}
      </div>

      <NotificationCenter />
      <ThemeToggle />
    </header>
  );
}

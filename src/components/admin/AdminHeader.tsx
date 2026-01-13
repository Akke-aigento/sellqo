import { Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';

export function AdminHeader() {
  const { currentTenant } = useTenant();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SidebarTrigger>

      <div className="flex-1">
        {currentTenant && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentTenant.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {currentTenant.subscription_plan}
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, MessageSquare, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount';

export function AdminMobileBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  const { count } = useUnreadMessagesCount();

  const isActive = (path: string) => location.pathname === path;

  const tabs = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: ShoppingCart, label: 'Bestellingen', path: '/admin/orders' },
    { icon: Package, label: 'Producten', path: '/admin/products' },
    { icon: MessageSquare, label: 'Inbox', path: '/admin/messages' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <nav className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "relative flex flex-col items-center gap-0.5 text-[11px] min-w-[44px] min-h-[44px] justify-center",
              isActive(tab.path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <tab.icon className="h-5 w-5" />
              {tab.path === '/admin/messages' && count > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </div>
            <span>{tab.label}</span>
          </Link>
        ))}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-0.5 text-[11px] text-muted-foreground min-w-[44px] min-h-[44px] justify-center"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}

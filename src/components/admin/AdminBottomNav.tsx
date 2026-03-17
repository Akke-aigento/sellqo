import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Package, label: 'Producten', path: '/admin/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/admin/orders' },
];

export function AdminBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t lg:hidden">
      <nav className="flex items-center justify-around h-14">
        {navItems.map(({ icon: Icon, label, path }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center gap-0.5 text-xs min-w-0 px-2 py-1 transition-colors',
              isActive(path)
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground min-w-0 px-2 py-1"
        >
          <Menu className="h-5 w-5" />
          <span>Meer</span>
        </button>
      </nav>
    </div>
  );
}
